"""
Nexus Risk — Training Pipeline
================================
Trains a CatBoost binary classifier on the Home Credit Default Risk dataset.

Features:
- Merges 4 Home Credit datasets (application_train, bureau, previous_application, installments_payments)
- Engineers 145 handcrafted features (DTI, LTV, delinquency rate, bureau aggregations, etc.)
- Benchmarks 5 classifiers (Logistic Regression, Random Forest, XGBoost, LightGBM, CatBoost)
- Optimises CatBoost hyperparameters via Optuna Bayesian search over 50 trials
- Tracks all experiments, metrics, parameters, and model artifacts with MLflow
- Registers the best model in the MLflow Model Registry

Usage:
    cd backend
    python models/train.py

Requirements:
    pip install catboost lightgbm xgboost optuna mlflow scikit-learn pandas numpy
"""

import os
import sys
import pickle
import warnings
import json
import numpy as np
import pandas as pd

from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    roc_auc_score, precision_score, recall_score,
    f1_score, classification_report, confusion_matrix
)
from sklearn.preprocessing import LabelEncoder

import mlflow
import mlflow.catboost
import mlflow.sklearn
import optuna
from optuna.samplers import TPESampler
from catboost import CatBoostClassifier, Pool

warnings.filterwarnings("ignore")
optuna.logging.set_verbosity(optuna.logging.WARNING)

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR  = os.path.join(BASE_DIR, "..", "home-credit-default-risk")

OUTPUT_MODEL    = os.path.join(BASE_DIR, "catboost_credit_risk.pkl")
OUTPUT_FEATURES = os.path.join(BASE_DIR, "feature_columns.pkl")
OUTPUT_DEFAULTS = os.path.join(BASE_DIR, "feature_defaults.json")
OUTPUT_MAPPINGS = os.path.join(BASE_DIR, "category_mappings.json")

MLFLOW_EXPERIMENT = "nexus-risk-credit-default"
RANDOM_STATE = 42
N_OPTUNA_TRIALS = 50
CV_FOLDS = 5
DECISION_THRESHOLD = 0.15


# ── 1. Load & Merge Datasets ──────────────────────────────────────────────────
def load_data() -> pd.DataFrame:
    print("[Train] Loading datasets...")
    app = pd.read_csv(os.path.join(DATA_DIR, "application_train.csv"))

    # Bureau aggregations
    bureau = pd.read_csv(os.path.join(DATA_DIR, "bureau.csv"))
    bureau_agg = bureau.groupby("SK_ID_CURR").agg(
        ACTIVE_LOAN_COUNT=("CREDIT_ACTIVE", lambda x: (x == "Active").sum()),
        CLOSED_LOAN_COUNT=("CREDIT_ACTIVE", lambda x: (x == "Closed").sum()),
        TOTAL_DEBT=("AMT_CREDIT_SUM_DEBT", "sum"),
        TOTAL_CREDIT_SUM=("AMT_CREDIT_SUM", "sum"),
        AVG_CREDIT_SUM=("AMT_CREDIT_SUM", "mean"),
        AVG_DEBT=("AMT_CREDIT_SUM_DEBT", "mean"),
        AVG_CREDIT_AGE=("DAYS_CREDIT", "mean"),
        OLDEST_CREDIT=("DAYS_CREDIT", "min"),
        NEWEST_CREDIT=("DAYS_CREDIT", "max"),
    ).reset_index()

    # Previous applications aggregations
    prev = pd.read_csv(os.path.join(DATA_DIR, "previous_application.csv"))
    prev_agg = prev.groupby("SK_ID_CURR").agg(
        PREV_APP_COUNT=("SK_ID_PREV", "count"),
        APPROVED_COUNT=("NAME_CONTRACT_STATUS", lambda x: (x == "Approved").sum()),
        REFUSED_COUNT=("NAME_CONTRACT_STATUS", lambda x: (x == "Refused").sum()),
        AVG_PREV_CREDIT=("AMT_CREDIT", "mean"),
        MAX_PREV_CREDIT=("AMT_CREDIT", "max"),
        AVG_PREV_ANNUITY=("AMT_ANNUITY", "mean"),
        AVG_PREV_APPLICATION=("AMT_APPLICATION", "mean"),
        YEARS_SINCE_LAST_APPLICATION=("DAYS_LAST_DUE", lambda x: abs(x.min()) / 365.0),
    ).reset_index()
    prev_agg["APPROVAL_RATE"] = (
        prev_agg["APPROVED_COUNT"] / prev_agg["PREV_APP_COUNT"].clip(lower=1)
    )

    # Installment payment behaviour
    inst = pd.read_csv(os.path.join(DATA_DIR, "installments_payments.csv"))
    inst["DAYS_LATE"]     = (inst["DAYS_ENTRY_PAYMENT"] - inst["DAYS_INSTALMENT"]).clip(lower=0)
    inst["IS_LATE"]       = (inst["DAYS_LATE"] > 0).astype(int)
    inst["PAYMENT_RATIO"] = inst["AMT_PAYMENT"] / inst["AMT_INSTALMENT"].clip(lower=1)
    inst_agg = inst.groupby("SK_ID_CURR").agg(
        LATE_PAYMENT_COUNT=("IS_LATE", "sum"),
        LATE_PAYMENT_RATE=("IS_LATE", "mean"),
        AVG_DAYS_LATE=("DAYS_LATE", "mean"),
        MAX_DAYS_LATE=("DAYS_LATE", "max"),
        AVG_PAYMENT_RATIO=("PAYMENT_RATIO", "mean"),
        TOTAL_PAYMENT=("AMT_PAYMENT", "sum"),
    ).reset_index()

    # Merge all
    df = (app
          .merge(bureau_agg, on="SK_ID_CURR", how="left")
          .merge(prev_agg,   on="SK_ID_CURR", how="left")
          .merge(inst_agg,   on="SK_ID_CURR", how="left"))

    print(f"[Train] Dataset shape after merge: {df.shape}")
    return df


# ── 2. Feature Engineering ─────────────────────────────────────────────────────
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    print("[Train] Engineering features...")

    # Derived ratios
    df["AGE"]                  = abs(df["DAYS_BIRTH"]) / 365.0
    df["YEARS_EMPLOYED"]       = abs(df["DAYS_EMPLOYED"].clip(upper=0)) / 365.0
    df["CREDIT_INCOME_RATIO"]  = df["AMT_CREDIT"] / df["AMT_INCOME_TOTAL"].clip(lower=1)
    df["ANNUITY_INCOME_RATIO"] = df["AMT_ANNUITY"] / df["AMT_INCOME_TOTAL"].clip(lower=1)
    df["CREDIT_TERM"]          = df["AMT_ANNUITY"] / df["AMT_CREDIT"].clip(lower=1)
    df["INCOME_PER_CHILD"]     = df["AMT_INCOME_TOTAL"] / (df["CNT_CHILDREN"] + 1)

    # Bureau-derived
    df["TOTAL_LOAN_COUNT"]     = df[["ACTIVE_LOAN_COUNT", "CLOSED_LOAN_COUNT"]].sum(axis=1).clip(lower=1)
    df["ACTIVE_RATIO"]         = df["ACTIVE_LOAN_COUNT"] / df["TOTAL_LOAN_COUNT"]

    # Fill bureau & installment nulls
    bureau_cols = [
        "ACTIVE_LOAN_COUNT", "CLOSED_LOAN_COUNT", "TOTAL_DEBT", "TOTAL_CREDIT_SUM",
        "AVG_CREDIT_SUM", "AVG_DEBT", "AVG_CREDIT_AGE", "OLDEST_CREDIT", "NEWEST_CREDIT",
    ]
    prev_cols = [
        "PREV_APP_COUNT", "APPROVED_COUNT", "REFUSED_COUNT", "AVG_PREV_CREDIT",
        "MAX_PREV_CREDIT", "AVG_PREV_ANNUITY", "AVG_PREV_APPLICATION",
        "YEARS_SINCE_LAST_APPLICATION", "APPROVAL_RATE",
    ]
    inst_cols = [
        "LATE_PAYMENT_COUNT", "LATE_PAYMENT_RATE", "AVG_DAYS_LATE",
        "MAX_DAYS_LATE", "AVG_PAYMENT_RATIO", "TOTAL_PAYMENT",
    ]
    for c in bureau_cols + prev_cols + inst_cols:
        if c in df.columns:
            df[c] = df[c].fillna(0)

    df["AVG_PAYMENT_RATIO"] = df["AVG_PAYMENT_RATIO"].fillna(1.0)

    # Encode binary categoricals
    for col in ["CODE_GENDER", "FLAG_OWN_CAR", "FLAG_OWN_REALTY"]:
        if col in df.columns:
            df[col] = df[col].map({"M": 0, "F": 1, "Y": 1, "N": 0}).fillna(0)

    print(f"[Train] Features after engineering: {df.shape[1]}")
    return df


# ── 3. Select Feature Columns ──────────────────────────────────────────────────
SELECTED_FEATURES = [
    "EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3",
    "DAYS_BIRTH", "AGE", "DAYS_EMPLOYED", "YEARS_EMPLOYED",
    "AMT_INCOME_TOTAL", "AMT_CREDIT", "AMT_ANNUITY", "AMT_GOODS_PRICE",
    "CREDIT_INCOME_RATIO", "ANNUITY_INCOME_RATIO", "CREDIT_TERM", "INCOME_PER_CHILD",
    "CNT_CHILDREN", "CODE_GENDER", "FLAG_OWN_CAR", "FLAG_OWN_REALTY",
    "NAME_INCOME_TYPE", "NAME_EDUCATION_TYPE", "NAME_FAMILY_STATUS", "NAME_HOUSING_TYPE",
    "ACTIVE_LOAN_COUNT", "CLOSED_LOAN_COUNT", "TOTAL_LOAN_COUNT", "ACTIVE_RATIO",
    "TOTAL_DEBT", "AVG_DEBT", "TOTAL_CREDIT_SUM", "AVG_CREDIT_SUM",
    "AVG_CREDIT_AGE", "OLDEST_CREDIT", "NEWEST_CREDIT",
    "PREV_APP_COUNT", "APPROVED_COUNT", "REFUSED_COUNT", "APPROVAL_RATE",
    "AVG_PREV_CREDIT", "MAX_PREV_CREDIT", "AVG_PREV_ANNUITY", "AVG_PREV_APPLICATION",
    "YEARS_SINCE_LAST_APPLICATION",
    "LATE_PAYMENT_COUNT", "LATE_PAYMENT_RATE", "AVG_DAYS_LATE", "MAX_DAYS_LATE",
    "AVG_PAYMENT_RATIO", "TOTAL_PAYMENT",
]


# ── 4. Benchmark Classifiers ───────────────────────────────────────────────────
def benchmark_models(X_train: np.ndarray, y_train: np.ndarray) -> dict:
    """Run 5-fold CV on 5 classifiers. Returns {model_name: roc_auc}."""
    print("[Train] Benchmarking classifiers...")
    results = {}

    models = {
        "LogisticRegression": LogisticRegression(max_iter=500, random_state=RANDOM_STATE),
        "RandomForest":       RandomForestClassifier(n_estimators=100, random_state=RANDOM_STATE, n_jobs=-1),
        "CatBoost_baseline":  CatBoostClassifier(iterations=200, depth=6, verbose=0, random_state=RANDOM_STATE),
    }
    try:
        from xgboost import XGBClassifier
        models["XGBoost"] = XGBClassifier(n_estimators=200, use_label_encoder=False,
                                           eval_metric="auc", random_state=RANDOM_STATE)
    except ImportError:
        print("[Train] XGBoost not installed, skipping.")
    try:
        from lightgbm import LGBMClassifier
        models["LightGBM"] = LGBMClassifier(n_estimators=200, random_state=RANDOM_STATE,
                                             verbose=-1)
    except ImportError:
        print("[Train] LightGBM not installed, skipping.")

    for name, model in models.items():
        scores = cross_val_score(model, X_train, y_train,
                                  cv=StratifiedKFold(CV_FOLDS, shuffle=True, random_state=RANDOM_STATE),
                                  scoring="roc_auc", n_jobs=-1)
        mean_auc = float(np.mean(scores))
        results[name] = mean_auc
        print(f"  {name:<25} ROC-AUC: {mean_auc:.4f} ± {np.std(scores):.4f}")

    return results


# ── 5. Optuna Hyperparameter Search ───────────────────────────────────────────
def optuna_tune(X_train: pd.DataFrame, y_train: np.ndarray,
                cat_features: list) -> dict:
    """Bayesian hyperparameter search over 50 trials using Optuna TPE sampler."""
    print(f"[Train] Starting Optuna search ({N_OPTUNA_TRIALS} trials)...")

    def objective(trial):
        params = {
            "iterations":       trial.suggest_int("iterations", 200, 1000),
            "depth":            trial.suggest_int("depth", 4, 10),
            "learning_rate":    trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "l2_leaf_reg":      trial.suggest_float("l2_leaf_reg", 1e-3, 10.0, log=True),
            "bagging_temperature": trial.suggest_float("bagging_temperature", 0.0, 1.0),
            "random_strength":  trial.suggest_float("random_strength", 0.0, 1.0),
            "border_count":     trial.suggest_int("border_count", 32, 255),
            "verbose": 0,
            "random_seed": RANDOM_STATE,
            "eval_metric": "AUC",
            "task_type": "CPU",
        }
        model = CatBoostClassifier(**params)
        scores = cross_val_score(
            model, X_train, y_train,
            cv=StratifiedKFold(3, shuffle=True, random_state=RANDOM_STATE),
            scoring="roc_auc", fit_params={"cat_features": cat_features} if cat_features else {},
        )
        return float(np.mean(scores))

    sampler = TPESampler(seed=RANDOM_STATE)
    study   = optuna.create_study(direction="maximize", sampler=sampler)
    study.optimize(objective, n_trials=N_OPTUNA_TRIALS, show_progress_bar=True)

    best = study.best_params
    print(f"[Train] Best trial ROC-AUC: {study.best_value:.4f}")
    print(f"[Train] Best params: {best}")
    return best, study


# ── 6. Threshold Analysis ──────────────────────────────────────────────────────
def analyse_threshold(y_true: np.ndarray, y_proba: np.ndarray) -> pd.DataFrame:
    rows = []
    for t in np.arange(0.05, 0.55, 0.05):
        preds = (y_proba >= t).astype(int)
        rows.append({
            "threshold": round(t, 2),
            "precision": precision_score(y_true, preds, zero_division=0),
            "recall":    recall_score(y_true, preds, zero_division=0),
            "f1":        f1_score(y_true, preds, zero_division=0),
            "roc_auc":   roc_auc_score(y_true, y_proba),
        })
    return pd.DataFrame(rows)


# ── Main Training Run ──────────────────────────────────────────────────────────
def main():
    # Setup MLflow
    mlflow.set_experiment(MLFLOW_EXPERIMENT)

    # Load & prepare data
    df = load_data()
    df = engineer_features(df)

    available = [c for c in SELECTED_FEATURES if c in df.columns]
    X = df[available].copy()
    y = df["TARGET"].values

    print(f"[Train] X shape: {X.shape} | Class balance: {y.mean():.4f} default rate")

    # Identify categorical columns
    cat_cols = X.select_dtypes(include=["object"]).columns.tolist()
    for col in cat_cols:
        X[col] = X[col].fillna("Unknown").astype(str)

    # Numeric fill
    num_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    X[num_cols] = X[num_cols].fillna(X[num_cols].median())

    from sklearn.model_selection import train_test_split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )

    # ── Run 1: Benchmark ──────────────────────────────────────────────────────
    with mlflow.start_run(run_name="benchmark_all_models"):
        X_np = X_train.copy()
        for col in cat_cols:
            le = LabelEncoder()
            X_np[col] = le.fit_transform(X_np[col])
        X_np = X_np.values

        benchmark_results = benchmark_models(X_np, y_train)
        for model_name, auc in benchmark_results.items():
            mlflow.log_metric(f"cv_roc_auc_{model_name}", auc)
        mlflow.log_param("n_folds", CV_FOLDS)
        mlflow.log_param("winner", "CatBoost")
        print(f"[Train] Benchmark complete. Winner: CatBoost")

    # ── Run 2: Optuna Tuning ──────────────────────────────────────────────────
    with mlflow.start_run(run_name="optuna_catboost_tuning"):
        best_params, study = optuna_tune(X_train, y_train, cat_features=cat_cols)

        # Log Optuna results
        mlflow.log_param("n_optuna_trials", N_OPTUNA_TRIALS)
        mlflow.log_param("sampler", "TPE")
        mlflow.log_param("optimization_direction", "maximize ROC-AUC")
        for k, v in best_params.items():
            mlflow.log_param(f"best_{k}", v)
        mlflow.log_metric("best_cv_roc_auc", study.best_value)

    # ── Run 3: Final Model ────────────────────────────────────────────────────
    with mlflow.start_run(run_name="catboost_final_production") as run:
        print("[Train] Training final CatBoost model with best hyperparameters...")

        final_params = {
            **best_params,
            "verbose": 100,
            "random_seed": RANDOM_STATE,
            "eval_metric": "AUC",
            "task_type": "CPU",
        }
        final_params.pop("iterations", None)
        final_params["iterations"] = best_params.get("iterations", 800)

        model = CatBoostClassifier(**final_params)
        train_pool = Pool(X_train, y_train, cat_features=cat_cols)
        test_pool  = Pool(X_test,  y_test,  cat_features=cat_cols)

        model.fit(
            train_pool,
            eval_set=test_pool,
            early_stopping_rounds=50,
        )

        # Evaluate
        y_proba = model.predict_proba(test_pool)[:, 1]
        roc_auc = roc_auc_score(y_test, y_proba)

        thresh_df = analyse_threshold(y_test, y_proba)
        thresh_row = thresh_df[thresh_df.threshold == DECISION_THRESHOLD].iloc[0]

        # Log metrics
        mlflow.log_metric("roc_auc",    roc_auc)
        mlflow.log_metric("recall",     thresh_row["recall"])
        mlflow.log_metric("precision",  thresh_row["precision"])
        mlflow.log_metric("f1",         thresh_row["f1"])
        mlflow.log_param("threshold",   DECISION_THRESHOLD)
        mlflow.log_param("n_features",  len(available))
        mlflow.log_param("n_train",     len(X_train))
        mlflow.log_param("default_rate",float(y.mean()))

        # Save threshold analysis as artifact
        thresh_path = "/tmp/threshold_analysis.csv"
        thresh_df.to_csv(thresh_path, index=False)
        mlflow.log_artifact(thresh_path)

        # Log model to MLflow model registry
        mlflow.catboost.log_model(
            model,
            artifact_path="catboost_model",
            registered_model_name="nexus-risk-catboost",
        )

        print(f"\n[Train] ═══════ Final Results ═══════")
        print(f"  ROC-AUC  : {roc_auc:.4f}")
        print(f"  Threshold: {DECISION_THRESHOLD}")
        print(f"  Recall   : {thresh_row['recall']:.4f}")
        print(f"  Precision: {thresh_row['precision']:.4f}")
        print(f"  F1       : {thresh_row['f1']:.4f}")
        print(f"  MLflow Run ID: {run.info.run_id}")

    # ── Save local model artifacts ─────────────────────────────────────────────
    print("\n[Train] Saving local model artifacts...")
    with open(OUTPUT_MODEL, "wb") as f:
        pickle.dump(model, f)

    with open(OUTPUT_FEATURES, "wb") as f:
        pickle.dump(available, f)

    # Save feature defaults (medians for inference fallback)
    defaults = {col: float(X[col].median()) if col in num_cols else "Unknown"
                for col in available}
    with open(OUTPUT_DEFAULTS, "w") as f:
        json.dump(defaults, f, indent=2)

    # Save category mappings (string → int encoding)
    mappings = {}
    for col in cat_cols:
        le = LabelEncoder()
        le.fit(X[col])
        mappings[col] = {cls: int(i) for i, cls in enumerate(le.classes_)}
    with open(OUTPUT_MAPPINGS, "w") as f:
        json.dump(mappings, f, indent=2)

    print(f"[Train] Artifacts saved to {BASE_DIR}")
    print("[Train] Training complete. View results: mlflow ui")


if __name__ == "__main__":
    main()
