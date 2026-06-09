import http.server
import socketserver
import json
import pickle
import os
import traceback
import sqlite3
import datetime
import pandas as pd
from catboost import Pool

PORT = 8000

# Database Path
base_dir = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(base_dir, "credit_risk.db")

def init_db():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                applicant_name TEXT,
                prediction_timestamp TEXT,
                default_probability REAL,
                non_default_probability REAL,
                risk_category TEXT,
                lending_decision TEXT,
                age REAL,
                annual_income REAL,
                loan_amount REAL,
                total_debt REAL,
                ext_source_1 REAL,
                ext_source_2 REAL,
                ext_source_3 REAL,
                executive_summary TEXT,
                raw_inputs TEXT,
                response_json TEXT
            )
        """)
        conn.commit()
        conn.close()
        print("SQLite Database initialized and tables verified.")
    except Exception as e:
        print(f"Error initializing SQLite Database: {e}")

init_db()

# Load environment variables from .env file if it exists in backend/ or root/
base_dir = os.path.dirname(os.path.abspath(__file__))
for folder in [base_dir, os.path.abspath(os.path.join(base_dir, ".."))]:
    env_path = os.path.join(folder, ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r") as env_f:
                for line in env_f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        k = key.strip()
                        v = val.strip().strip('"').strip("'")
                        os.environ[k] = v
                        print(f"Loaded environment variable {k} from {env_path} (length: {len(v)})")
        except Exception as e:
            print(f"Warning: Could not read .env file at {env_path}: {e}")

# Load models and mappings relative to server.py location
base_dir = os.path.dirname(os.path.abspath(__file__))

print("Loading model and configuration files...")
with open(os.path.join(base_dir, "catboost_credit_risk.pkl"), "rb") as f:
    model = pickle.load(f)

with open(os.path.join(base_dir, "feature_columns.pkl"), "rb") as f:
    feature_cols = pickle.load(f)

with open(os.path.join(base_dir, "feature_defaults.json"), "r") as f:
    feature_defaults = json.load(f)

with open(os.path.join(base_dir, "category_mappings.json"), "r") as f:
    category_mappings = json.load(f)

print("Backend initialized successfully. Model ready for inference.")

# Helpers to safely parse inputs
def get_float(inputs, key, default=0.0):
    val = inputs.get(key)
    if val is None or pd.isna(val) or val == "":
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def get_int(inputs, key, default=0):
    val = inputs.get(key)
    if val is None or pd.isna(val) or val == "":
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default

# Helper to run prediction on input dictionary
def predict_credit_risk(inputs):
    # Initialize a row with defaults
    row = feature_defaults.copy()
    
    # Map form fields to model columns and overwrite
    # Personal Profile
    age = get_float(inputs, "age", 35.0)
    row["DAYS_BIRTH"] = -int(age * 365)
    row["AGE"] = age
    row["CODE_GENDER"] = inputs.get("gender", "F")
    row["NAME_FAMILY_STATUS"] = inputs.get("marital_status", "Married")
    row["CNT_CHILDREN"] = get_int(inputs, "children", 0)
    row["NAME_EDUCATION_TYPE"] = inputs.get("education", "Secondary / secondary special")
    row["NAME_HOUSING_TYPE"] = inputs.get("housing", "House / apartment")
    row["FLAG_OWN_CAR"] = inputs.get("own_car", "N")
    row["FLAG_OWN_REALTY"] = inputs.get("own_property", "Y")
    row["NAME_INCOME_TYPE"] = inputs.get("employment_type", "Working")
    
    years_employed = get_float(inputs, "years_employed", 5.0)
    row["DAYS_EMPLOYED"] = -int(years_employed * 365)
    row["YEARS_EMPLOYED"] = years_employed
    
    # Financial Profile & Co-variance Scaling
    income = get_float(inputs, "income", 50000.0)
    credit = get_float(inputs, "loan_amount", 100000.0)
    
    # Scale annuity proportionally if loan amount changes from What-If
    original_credit = get_float(inputs, "original_loan_amount", credit)
    original_annuity = get_float(inputs, "original_annuity", get_float(inputs, "annuity", 10000.0))
    if original_credit > 0:
        annuity = (credit / original_credit) * original_annuity
    else:
        annuity = get_float(inputs, "annuity", 10000.0)
        
    # Scale goods price proportionally to credit changes
    original_goods_price = get_float(inputs, "goods_price", credit)
    if original_credit > 0:
        goods_price = (credit / original_credit) * original_goods_price
    else:
        goods_price = credit
        
    row["AMT_INCOME_TOTAL"] = income
    row["AMT_CREDIT"] = credit
    row["AMT_ANNUITY"] = annuity
    row["AMT_GOODS_PRICE"] = goods_price
    
    # Ratios
    row["CREDIT_INCOME_RATIO"] = credit / income if income > 0 else 0.0
    row["ANNUITY_INCOME_RATIO"] = annuity / income if income > 0 else 0.0
    
    # Credit History (Bureau)
    total_debt = get_float(inputs, "total_debt", 0.0)
    active_loans = get_int(inputs, "active_loans", 0)
    closed_loans = get_int(inputs, "closed_loans", 0)
    total_loans = active_loans + closed_loans
    avg_credit_age = get_float(inputs, "avg_credit_age_days", 1000.0)
    
    row["TOTAL_DEBT"] = total_debt
    row["AVG_DEBT"] = total_debt / total_loans if total_loans > 0 else total_debt
    row["ACTIVE_LOAN_COUNT"] = active_loans
    row["CLOSED_LOAN_COUNT"] = closed_loans
    row["AVG_CREDIT_AGE"] = -avg_credit_age
    row["OLDEST_CREDIT"] = -avg_credit_age * 1.5
    row["NEWEST_CREDIT"] = -avg_credit_age * 0.5
    
    # Estimate Credit Sums to make inputs actually affect these features
    estimated_credit_sum = total_debt * 1.3 + credit
    row["TOTAL_CREDIT_SUM"] = estimated_credit_sum
    row["AVG_CREDIT_SUM"] = estimated_credit_sum / total_loans if total_loans > 0 else estimated_credit_sum
    
    # Previous applications and Approval Rate Co-variance Scaling
    approval_rate = get_float(inputs, "approval_rate", 1.0)
    prev_count = get_int(inputs, "prev_app_count", 0)
    
    # If approval rate is adjusted but count was 0, assume at least 2 prev applications to show dynamic effect
    if prev_count == 0 and approval_rate < 0.99:
        prev_count = 2
        
    approved_count = int(prev_count * approval_rate)
    refused_count = prev_count - approved_count
    
    avg_prev_credit = get_float(inputs, "avg_prev_credit", credit)
    
    row["PREV_APP_COUNT"] = prev_count
    row["APPROVED_COUNT"] = approved_count
    row["REFUSED_COUNT"] = refused_count
    row["APPROVAL_RATE"] = approval_rate
    row["YEARS_SINCE_LAST_APPLICATION"] = get_float(inputs, "years_since_last_app", 1.0)
    row["AVG_PREV_CREDIT"] = avg_prev_credit
    row["MAX_PREV_CREDIT"] = get_float(inputs, "max_prev_credit", credit)
    row["AVG_PREV_ANNUITY"] = get_float(inputs, "avg_prev_annuity", annuity)
    row["AVG_PREV_APPLICATION"] = avg_prev_credit * 0.95
    
    # Payment Behavior and Late Rate Co-variance Scaling
    late_rate = get_float(inputs, "late_payment_rate", 0.0)
    orig_late_rate = get_float(inputs, "original_late_payment_rate", 0.0)
    
    # Base assumptions for a 100% late rate profile
    assumed_count = int(late_rate * 20)
    assumed_avg_days = late_rate * 18.0
    assumed_max_days = late_rate * 60.0
    
    if orig_late_rate > 0.01:
        # Scale applicant's original late payment attributes proportionally
        scale_factor = late_rate / orig_late_rate
        avg_days_late = get_float(inputs, "original_avg_days_late", 0.0) * scale_factor
        max_days_late = get_float(inputs, "original_max_days_late", 0.0) * scale_factor
        late_payment_count = int(get_int(inputs, "original_late_payment_count", 0) * scale_factor)
    else:
        avg_days_late = assumed_avg_days
        max_days_late = assumed_max_days
        late_payment_count = assumed_count
        
    row["AVG_DAYS_LATE"] = avg_days_late
    row["MAX_DAYS_LATE"] = max_days_late
    row["LATE_PAYMENT_COUNT"] = late_payment_count
    row["LATE_PAYMENT_RATE"] = late_rate
    row["AVG_PAYMENT_RATIO"] = get_float(inputs, "avg_payment_ratio", 1.0)
    row["TOTAL_PAYMENT"] = get_float(inputs, "total_payment_amount", 0.0)
    
    # External Scores
    row["EXT_SOURCE_1"] = get_float(inputs, "ext_source_1", 0.5)
    row["EXT_SOURCE_2"] = get_float(inputs, "ext_source_2", 0.5)
    row["EXT_SOURCE_3"] = get_float(inputs, "ext_source_3", 0.5)
    
    # Construct final feature vector
    features_list = []
    for col in feature_cols:
        val = row.get(col, 0.0)
        # Apply encoding if column is categorical
        if col in category_mappings:
            mapping = category_mappings[col]
            # If value is string (like "Cash loans"), map it. Otherwise use as-is (e.g. if code was supplied)
            if isinstance(val, str):
                val = mapping.get(val, mapping.get(X_eval_mode(col), 0))
        # Ensure it's a numeric float
        features_list.append(float(val) if val is not None and not pd.isna(val) else 0.0)
        
    # Create DataFrame for model
    df_pred = pd.DataFrame([features_list], columns=feature_cols)
    
    # Model Predict Proba
    probs = model.predict_proba(df_pred)[0]
    default_prob = float(probs[1])
    non_default_prob = 1.0 - default_prob
    
    # Underwriting Metrics
    credit_income_ratio = row["CREDIT_INCOME_RATIO"]
    annuity_income_ratio = row["ANNUITY_INCOME_RATIO"]
    
    # Decision and Risk Metrics
    risk_score = round(default_prob * 100, 1)
    
    # Risk Category and Decision based on model probability thresholds
    # < 20% -> APPROVE
    # 20%-50% -> REVIEW
    # 50%-75% -> MANUAL REVIEW
    # > 75% -> REJECT
    if risk_score < 20.0:
        risk_category = "Low Risk"
        decision = "APPROVE"
        decision_color = "#10b981"
    elif risk_score < 50.0:
        risk_category = "Medium Risk"
        decision = "REVIEW"
        decision_color = "#f59e0b"
    elif risk_score < 75.0:
        risk_category = "High Risk"
        decision = "MANUAL REVIEW"
        decision_color = "#3b82f6"
    else:
        risk_category = "Critical Risk"
        decision = "REJECT"
        decision_color = "#ef4444"
        
    # Determine strengths and weaknesses
    strengths = []
    weaknesses = []
    
    # Evaluate variables
    ext_1 = row.get("EXT_SOURCE_1", 0.5)
    ext_2 = row.get("EXT_SOURCE_2", 0.5)
    ext_3 = row.get("EXT_SOURCE_3", 0.5)
    
    if ext_2 > 0.6 or ext_3 > 0.6:
        max_ext = max(ext_2, ext_3)
        strengths.append(f"Strong external credit bureau scoring scores (peak score of {max_ext:.2f})")
    else:
        min_ext = min(ext_1, ext_2, ext_3)
        weaknesses.append(f"Weak external credit scoring indices (minimum score of {min_ext:.2f})")
        
    if years_employed >= 5:
        strengths.append(f"Stable employment tenure ({years_employed:.1f} years)")
    elif years_employed < 2:
        weaknesses.append(f"Short employment history ({years_employed:.1f} years)")
        
    if credit_income_ratio < 2.0:
        strengths.append(f"Low loan credit-to-income leverage ({credit_income_ratio:.2f})")
    elif credit_income_ratio > 4.0:
        weaknesses.append(f"High credit load compared to income ({credit_income_ratio:.2f} ratio)")
        
    if annuity_income_ratio < 0.12:
        strengths.append(f"Comfortable monthly debt service capability ({annuity_income_ratio*100:.1f}% of income)")
    elif annuity_income_ratio > 0.25:
        weaknesses.append(f"Elevated annuity load ({annuity_income_ratio*100:.1f}% debt service ratio)")
        
    late_rate = row.get("LATE_PAYMENT_RATE", 0.0)
    avg_days_late = row.get("AVG_DAYS_LATE", 0.0)
    late_count = row.get("LATE_PAYMENT_COUNT", 0)
    if late_rate < 0.05:
        strengths.append(f"High repayment consistency (negligible {late_rate*100:.1f}% late rate)")
    else:
        weaknesses.append(f"History of payment delinquencies ({late_count} late payments averaging {avg_days_late:.1f} days late)")
        
    if refused_count == 0:
        strengths.append("Clean application record with zero prior credit refusals")
    elif refused_count > 1:
        weaknesses.append(f"Multiple credit application rejections in history ({refused_count} rejections)")

    # Build reasoning based on actual decision
    reasons = []
    if decision == "APPROVE":
        reasons.append("The applicant exhibits exceptional financial indicators, a clean credit history, and very low default probability.")
        reasons.append("Highly consistent employment history combined with strong external credit indices justifies immediate approval.")
    elif decision == "REVIEW":
        reasons.append("The applicant shows a solid profile overall, but minor risk flags exist, such as intermediate external scores or higher loan size.")
        reasons.append("Recommend review subject to standard debt-servicing conditions or a higher downpayment.")
    elif decision == "MANUAL REVIEW":
        reasons.append("The risk profile falls in the borderline zone, driven by elevated debt-to-income and payment warning indicators.")
        reasons.append("Manual verification of supplementary income assets and secondary collateral is strongly recommended.")
    else: # REJECT
        reasons.append("Critical underwriting thresholds breached due to highly elevated default risk and previous credit complications.")
        reasons.append("High debt burden relative to income, paired with frequent payment delays, presents an unacceptable risk profile.")
        
    reasoning = " ".join(reasons)
    
    # Calculate real banking credit underwriting metrics
    # 1. Loan-to-Value (LTV) Ratio (Principal / Goods Price)
    ltv_ratio = (credit / goods_price * 100.0) if goods_price > 0 else 0.0
    
    # 2. Monthly Debt Service (Annuity + 3% of existing bureau debt as monthly payment proxy)
    monthly_proposed_payment = annuity / 12.0
    monthly_existing_payment = (total_debt * 0.03)
    total_monthly_obligations = monthly_proposed_payment + monthly_existing_payment
    
    # 3. Monthly Gross Income
    monthly_income = income / 12.0
    
    # 4. Total Debt-to-Income (DTI) Ratio
    dti_ratio = (total_monthly_obligations / monthly_income * 100.0) if monthly_income > 0 else 0.0
    
    # 5. Monthly Disposable Surplus
    monthly_surplus = monthly_income - total_monthly_obligations
    
    # 6. Payment Delinquency Rate
    delinquency_rate = late_rate * 100.0
    
    # 7. Credit Stability Score (0 to 100)
    has_car = 15.0 if inputs.get("own_car") == "Y" else 0.0
    has_realty = 15.0 if inputs.get("own_property") == "Y" else 0.0
    tenure_score = min(40.0, years_employed * 4.0)
    history_score = max(0.0, 30.0 - (refused_count * 15.0))
    stability_score = has_car + has_realty + tenure_score + history_score

    scores = {
        "credit_to_income": float(credit_income_ratio),
        "annuity_to_income": float(annuity_income_ratio),
        "ltv_ratio": float(ltv_ratio),
        "dti_ratio": float(dti_ratio),
        "monthly_surplus": float(monthly_surplus),
        "delinquency_rate": float(delinquency_rate),
        "stability_score": float(stability_score),
        "monthly_income": float(monthly_income),
        "monthly_proposed_payment": float(monthly_proposed_payment),
        "monthly_existing_payment": float(monthly_existing_payment)
    }
    
    # Executive Summary (5-8 sentences)
    summary_sentences = [
        f"A thorough evaluation of applicant profile indicates a default probability of {risk_score}%, placing them in the {risk_category} category.",
        f"The applicant shows an annual income of ${income:,.2f} against a requested loan of ${credit:,.2f}, resulting in a credit-to-income ratio of {credit_income_ratio:.2f}."
    ]
    if strengths:
        summary_sentences.append(f"Key credit strengths include {', '.join(strengths[:2])}.")
    if weaknesses:
        summary_sentences.append(f"Primary risk concerns center on {', '.join(weaknesses[:2])}.")
    summary_sentences.append(f"The external credit scores (EXT 1: {row['EXT_SOURCE_1']:.2f}, EXT 2: {row['EXT_SOURCE_2']:.2f}, EXT 3: {row['EXT_SOURCE_3']:.2f}) point to a {risk_category.lower()} underwriting profile.")
    summary_sentences.append(f"Based on the CatBoost risk engine's recommendation, the recommended decision is {decision} with the underwriting rationale detailed in the officer log.")
    
    exec_summary = " ".join(summary_sentences)
    
    # Recommendations
    recommendations = []
    
    # 1. External Scores
    min_ext = min(ext_1, ext_2, ext_3)
    if min_ext < 0.4:
        collateral_pledge = credit * 0.20
        recommendations.append(f"The minimum external credit rating is low at {min_ext:.3f}. Provide credit enhancement (such as an institutional guarantor or a ${collateral_pledge:,.0f} collateral pledge) to offset bureau rating weaknesses.")
    
    # 2. Leverage/Credit-to-Income
    if credit_income_ratio > 3.0:
        target_limit = income * 2.0
        reduction = credit - target_limit
        recommendations.append(f"Requested loan amount of ${credit:,.2f} represents a high leverage multiple of {credit_income_ratio:.2f}x annual income. Restructure exposure downward by ${reduction:,.0f} to reach the low-risk limit of ${target_limit:,.0f}.")
        
    # 3. Debt Service / Annuity-to-Income
    if annuity_income_ratio > 0.15:
        target_max_annuity = income * 0.12
        reduction_monthly = (annuity - target_max_annuity) / 12.0
        recommendations.append(f"Proposed monthly debt service of ${annuity/12.0:,.0f} is {annuity_income_ratio*100:.1f}% of income. Extend the amortization term or reduce principal to lower the monthly burden by ${reduction_monthly:,.0f}/mo (targeting a <12.0% ratio).")
        
    # 4. Late Payments
    if late_rate > 0.05 or late_count > 0:
        recommendations.append(f"Set up automated payment transfers on all active accounts to address the {late_rate*100:.1f}% late payment rate and clear the history of {late_count} payment delays (averaging {avg_days_late:.1f} days late).")
        
    # 5. Employment Tenure
    if years_employed < 3.0:
        months_needed = max(1, int((3.0 - years_employed) * 12))
        recommendations.append(f"Maintain the current state employment role (currently {years_employed:.1f} yrs tenure) for at least {months_needed} more months to reach the low-risk underwriting benchmark of 3.0+ years.")
        
    # 6. Outstanding Debt
    if total_debt > 20000:
        debt_reduction = total_debt - 10000
        recommendations.append(f"Pay down a minimum of ${debt_reduction:,.0f} of the current outstanding bureau debt (${total_debt:,.2f}) to improve overall credit capacity and DTI ratios.")
        
    # 7. Refused prior apps
    if refused_count > 0:
        cooling_off = max(6, refused_count * 4)
        recommendations.append(f"Observe a cooling-off period of {cooling_off} months before submitting new credit queries to allow the {refused_count} historical bureau refusals to age out of active scoring models.")

    # 8. Debt-to-Income (DTI)
    if dti_ratio > 40.0:
        debt_reduction_needed = total_monthly_obligations - (monthly_income * 0.40)
        recommendations.append(f"The applicant's DTI ratio is high at {dti_ratio:.1f}%. Reduce active monthly non-proposed debt service obligations by ${debt_reduction_needed:,.0f}/mo or increase verified income to bring DTI under the 40.0% policy limit.")

    # 9. Loan-to-Value (LTV)
    if ltv_ratio > 80.0:
        downpayment_needed = credit - (goods_price * 0.80)
        recommendations.append(f"The loan-to-value (LTV) ratio is elevated at {ltv_ratio:.1f}%. Inject an additional down payment of ${downpayment_needed:,.0f} to lower LTV to the standard institutional benchmark of 80.0% or lower.")

    # Fallbacks if list is too short
    if len(recommendations) < 3:
        recommendations.append(f"Maintain a low debt-servicing profile by ensuring the proposed annuity does not exceed 12.0% of gross income (currently {annuity_income_ratio*100:.1f}%).")
        recommendations.append(f"To maintain the low default probability score of {risk_score}%, ensure no active accounts exceed a 30% utilization rate and continue paying monthly balances in full.")
        
    # Natively compute SHAP values for local explainability
    pool = Pool(df_pred)
    shap_vals = model.get_feature_importance(data=pool, type='ShapValues')[0][:-1]
    
    feature_names_mapping = {
        "EXT_SOURCE_3": "External Credit Score 3 (Bureau)",
        "EXT_SOURCE_2": "External Credit Score 2 (Bureau)",
        "EXT_SOURCE_1": "External Credit Score 1 (Bureau)",
        "AMT_INCOME_TOTAL": "Annual Income",
        "AMT_CREDIT": "Requested Loan Amount",
        "AMT_ANNUITY": "Loan Annuity (Monthly Payment)",
        "ANNUITY_INCOME_RATIO": "Annuity-to-Income Ratio",
        "CREDIT_INCOME_RATIO": "Credit-to-Income Ratio",
        "YEARS_EMPLOYED": "Employment Tenure (Years)",
        "DAYS_EMPLOYED": "Employment Tenure",
        "AGE": "Age (Years)",
        "DAYS_BIRTH": "Age",
        "LATE_PAYMENT_RATE": "Late Payment Rate",
        "LATE_PAYMENT_COUNT": "Late Payment Count",
        "AVG_DAYS_LATE": "Average Days Late",
        "MAX_DAYS_LATE": "Maximum Days Late",
        "TOTAL_DEBT": "Outstanding Bureau Debt",
        "ACTIVE_LOAN_COUNT": "Active Bureau Loans",
        "CLOSED_LOAN_COUNT": "Closed Bureau Loans",
        "AVG_CREDIT_SUM": "Average Credit Sum (Bureau)",
        "TOTAL_CREDIT_SUM": "Total Credit Sum (Bureau)",
        "PREV_APP_COUNT": "Previous Application Count",
        "APPROVED_COUNT": "Approved Prior Loans",
        "REFUSED_COUNT": "Refused Prior Loans",
        "APPROVAL_RATE": "Prior Loan Approval Rate",
        "YEARS_SINCE_LAST_APPLICATION": "Years Since Last Application",
        "CODE_GENDER": "Gender",
        "NAME_EDUCATION_TYPE": "Education Level",
        "NAME_INCOME_TYPE": "Employment Income Type",
        "NAME_FAMILY_STATUS": "Marital Status",
        "NAME_HOUSING_TYPE": "Housing Type",
        "FLAG_OWN_CAR": "Car Ownership Status",
        "FLAG_OWN_REALTY": "Realty Ownership Status",
        "CNT_CHILDREN": "Number of Children"
    }
    
    contributions = []
    for i, col in enumerate(feature_cols):
        if col in feature_names_mapping:
            val = row.get(col, 0.0)
            formatted_val = str(val)
            if col in ["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]:
                formatted_val = f"{val:.2f}"
            elif col in ["AMT_INCOME_TOTAL", "AMT_CREDIT", "AMT_ANNUITY", "TOTAL_DEBT", "TOTAL_CREDIT_SUM", "AVG_CREDIT_SUM"]:
                formatted_val = f"${val:,.0f}"
            elif col in ["ANNUITY_INCOME_RATIO", "LATE_PAYMENT_RATE", "APPROVAL_RATE"]:
                formatted_val = f"{val*100:.1f}%"
            elif col in ["CREDIT_INCOME_RATIO", "AVG_DEBT"]:
                formatted_val = f"{val:.2f}"
            elif col in ["YEARS_EMPLOYED", "AGE"]:
                formatted_val = f"{val:.1f} yrs"
            elif col == "DAYS_BIRTH":
                formatted_val = f"{abs(val)/365:.1f} yrs"
            elif col == "DAYS_EMPLOYED":
                formatted_val = f"{abs(val)/365:.1f} yrs" if val < 0 else "0.0 yrs"
                
            contributions.append({
                "feature": feature_names_mapping[col],
                "impact": float(shap_vals[i]),
                "value": formatted_val
            })
            
    # Sort contributions by absolute SHAP impact
    contributions.sort(key=lambda x: abs(x["impact"]), reverse=True)
    
    # Construct engineered features dictionary
    engineered_features = {
        "DAYS_BIRTH": float(row.get("DAYS_BIRTH", 0.0)),
        "AGE": float(row.get("AGE", 0.0)),
        "DAYS_EMPLOYED": float(row.get("DAYS_EMPLOYED", 0.0)),
        "YEARS_EMPLOYED": float(row.get("YEARS_EMPLOYED", 0.0)),
        "AMT_INCOME_TOTAL": float(row.get("AMT_INCOME_TOTAL", 0.0)),
        "AMT_CREDIT": float(row.get("AMT_CREDIT", 0.0)),
        "AMT_ANNUITY": float(row.get("AMT_ANNUITY", 0.0)),
        "AMT_GOODS_PRICE": float(row.get("AMT_GOODS_PRICE", 0.0)),
        "CREDIT_INCOME_RATIO": float(row.get("CREDIT_INCOME_RATIO", 0.0)),
        "ANNUITY_INCOME_RATIO": float(row.get("ANNUITY_INCOME_RATIO", 0.0)),
        "TOTAL_DEBT": float(row.get("TOTAL_DEBT", 0.0)),
        "AVG_DEBT": float(row.get("AVG_DEBT", 0.0)),
        "ACTIVE_LOAN_COUNT": float(row.get("ACTIVE_LOAN_COUNT", 0.0)),
        "CLOSED_LOAN_COUNT": float(row.get("CLOSED_LOAN_COUNT", 0.0)),
        "AVG_CREDIT_AGE": float(row.get("AVG_CREDIT_AGE", 0.0)),
        "OLDEST_CREDIT": float(row.get("OLDEST_CREDIT", 0.0)),
        "NEWEST_CREDIT": float(row.get("NEWEST_CREDIT", 0.0)),
        "TOTAL_CREDIT_SUM": float(row.get("TOTAL_CREDIT_SUM", 0.0)),
        "AVG_CREDIT_SUM": float(row.get("AVG_CREDIT_SUM", 0.0)),
        "PREV_APP_COUNT": float(row.get("PREV_APP_COUNT", 0.0)),
        "APPROVED_COUNT": float(row.get("APPROVED_COUNT", 0.0)),
        "REFUSED_COUNT": float(row.get("REFUSED_COUNT", 0.0)),
        "APPROVAL_RATE": float(row.get("APPROVAL_RATE", 0.0)),
        "YEARS_SINCE_LAST_APPLICATION": float(row.get("YEARS_SINCE_LAST_APPLICATION", 0.0)),
        "AVG_PREV_CREDIT": float(row.get("AVG_PREV_CREDIT", 0.0)),
        "MAX_PREV_CREDIT": float(row.get("MAX_PREV_CREDIT", 0.0)),
        "AVG_PREV_ANNUITY": float(row.get("AVG_PREV_ANNUITY", 0.0)),
        "AVG_PREV_APPLICATION": float(row.get("AVG_PREV_APPLICATION", 0.0)),
        "AVG_DAYS_LATE": float(row.get("AVG_DAYS_LATE", 0.0)),
        "MAX_DAYS_LATE": float(row.get("MAX_DAYS_LATE", 0.0)),
        "LATE_PAYMENT_COUNT": float(row.get("LATE_PAYMENT_COUNT", 0.0)),
        "LATE_PAYMENT_RATE": float(row.get("LATE_PAYMENT_RATE", 0.0)),
        "AVG_PAYMENT_RATIO": float(row.get("AVG_PAYMENT_RATIO", 0.0)),
        "TOTAL_PAYMENT": float(row.get("TOTAL_PAYMENT", 0.0))
    }

    # Format the final_dataframe
    final_df_list = []
    for col in feature_cols:
        val = df_pred[col].iloc[0]
        final_df_list.append({
            "name": col,
            "value": float(val) if not isinstance(val, str) else val
        })

    alignment = {
        "expected_count": len(feature_cols),
        "received_count": len(df_pred.columns),
        "missing_features": [col for col in feature_cols if col not in df_pred.columns],
        "extra_features": [col for col in df_pred.columns if col not in feature_cols],
        "column_order_match": list(df_pred.columns) == list(feature_cols)
    }

    prediction_val = {
        "default_probability": default_prob,
        "non_default_probability": non_default_prob,
        "raw_catboost_output": [non_default_prob, default_prob]
    }

    all_shap = []
    for i, col in enumerate(feature_cols):
        val = df_pred.iloc[0, i]
        all_shap.append({
            "name": col,
            "impact": float(shap_vals[i]),
            "value": float(val) if not isinstance(val, str) else val
        })
    all_shap.sort(key=lambda x: abs(x["impact"]), reverse=True)
    top_10_features = all_shap[:10]

    debug_payload = {
        "raw_inputs": inputs,
        "engineered_features": engineered_features,
        "final_dataframe": final_df_list,
        "alignment": alignment,
        "prediction": prediction_val,
        "top_10_features": top_10_features
    }
    
    return {
        "default_probability": default_prob,
        "non_default_probability": non_default_prob,
        "risk_score": risk_score,
        "risk_category": risk_category,
        "decision": decision,
        "decision_color": decision_color,
        "reasoning": reasoning,
        "executive_summary": exec_summary,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "scores": scores,
        "recommendations": recommendations[:4],
        "contributions": contributions[:7],
        "debug": debug_payload
    }

# Helper to get categorical default values
def X_eval_mode(col):
    return "Unknown"

# Chat helper calling Gemini API via urllib
def call_gemini_api(api_key, system_instruction, user_prompt):
    import urllib.request
    import urllib.error
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": f"System: {system_instruction}\nUser: {user_prompt}"}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2
        }
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return res_data['candidates'][0]['content']['parts'][0]['text']
    except urllib.error.HTTPError as e:
        try:
            error_body = e.read().decode('utf-8')
            return f"Error calling Gemini API: {e}. Details: {error_body}"
        except Exception:
            return f"Error calling Gemini API: {e}."
    except Exception as e:
        return f"Error calling Gemini API: {str(e)}. Please check your API key and network connection."

# Local fallback responder using specific applicant numbers
def local_chat_responder(question, applicant_data, prediction_results, case_loaded=False):
    q = question.lower().strip()
    if not case_loaded:
        if q in ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "g'day", "whats up", "what's up"]:
            return "Hello! I am Nexus Risk AI Advisor. Welcome to the platform. To start, please navigate to the **New Underwrite** tab, fill in the applicant's profile, and click **Evaluate Underwrite** to perform an analysis. Once loaded, I will guide you through their credit risk metrics."
        elif "my name is" in q or "i am" in q or "i'm" in q:
            name = "there"
            if "my name is" in q:
                idx = q.find("my name is") + len("my name is")
                name = question[idx:].strip().strip('.')
            elif "i am" in q:
                idx = q.find("i am") + len("i am")
                name = question[idx:].strip().strip('.')
            elif "i'm" in q:
                idx = q.find("i'm") + len("i'm")
                name = question[idx:].strip().strip('.')
            return f"Hello, {name}! I am Nexus Risk AI Advisor. Nice to meet you. Please load an applicant's case using the **New Underwrite** tab first, so I can analyze their credit risk details with you."
        return "Welcome to the Underwriting Assistant! Currently, no applicant has been evaluated yet. Please navigate to the **New Underwrite** tab, fill in the applicant's profile, and click **Evaluate Underwrite** to perform an analysis. Once loaded, I will be happy to guide you through their risk scores and profile details."

    q = question.lower()
    name = applicant_data.get("name", "the applicant")
    decision = prediction_results.get("decision", "PENDING")
    prob = prediction_results.get("default_probability", 0.0)
    category = prediction_results.get("risk_category", "Unknown")
    
    # 1. Look for definition requests in layman terms
    is_explain = any(w in q for w in ["explain", "layman", "mean", "what is", "what are", "meaning", "define", "understanding"])
    
    if is_explain:
        if any(w in q for w in ["ext_source", "ext source", "external", "bureau", "score"]):
            ext1 = applicant_data.get("ext_source_1", 0.5)
            ext2 = applicant_data.get("ext_source_2", 0.5)
            ext3 = applicant_data.get("ext_source_3", 0.5)
            
            # Helper to rate score
            def rate_score(s):
                if s < 0.4: return "Weak (high risk)"
                if s < 0.6: return "Moderate (intermediate risk)"
                return "Strong (low risk)"
                
            return (
                f"### External Bureau Credit Scores (Layman's Terms)\n\n"
                f"**External Credit Scores** (specifically `EXT_SOURCE_1`, `EXT_SOURCE_2`, and `EXT_SOURCE_3` in our model) "
                f"are credit risk ratings sourced from external credit bureaus and databases (similar to FICO or credit bureau registries). "
                f"They are normalized to range from **0.0 (highest risk)** to **1.0 (lowest risk)**.\n\n"
                f"Here is how {name}'s external scores break down:\n"
                f"- **EXT_SOURCE_1 = {ext1:.3f}** - {rate_score(ext1)}\n"
                f"- **EXT_SOURCE_2 = {ext2:.3f}** - {rate_score(ext2)}\n"
                f"- **EXT_SOURCE_3 = {ext3:.3f}** - {rate_score(ext3)}\n\n"
                f"**Why they matter:** These scores are the single most important features in our CatBoost classification model. "
                f"A higher score indicates a proven history of creditworthiness, which drastically pulls down the default probability. "
                f"Conversely, lower scores trigger higher risk warnings."
            )
        elif any(w in q for w in ["ltv", "loan-to-value", "loan to value", "collateral"]):
            ltv = prediction_results.get("scores", {}).get("ltv_ratio", 100.0)
            return (
                f"### Loan-to-Value (LTV) Ratio (Layman's Terms)\n\n"
                f"The **Loan-to-Value (LTV) ratio** measures the size of the loan compared to the actual purchase value of the asset/property being financed.\n\n"
                f"- **Formula:** (Requested Loan Amount / Collateral Asset Value) x 100%\n"
                f"- **Applicant's LTV:** **{ltv:.1f}%**\n\n"
                f"**What it means:** An LTV of 100% means the applicant is borrowing the entire value of the property (0% down payment), which is very risky for banks. "
                f"A standard healthy benchmark is **80% or lower**, which means the applicant paid a **20% down payment**. "
                f"This down payment serves as a cushion for the lender in case the loan default forces asset liquidation."
            )
        elif any(w in q for w in ["dti", "debt-to-income", "debt to income", "debt service", "annuity"]):
            dti = prediction_results.get("scores", {}).get("dti_ratio", 0.0)
            annuity_inc = prediction_results.get("scores", {}).get("annuity_to_income", 0.0) * 100.0
            return (
                f"### Debt-to-Income (DTI) and Annuity-to-Income (Layman's Terms)\n\n"
                f"These metrics measure how much of the applicant's income is already spoken for by monthly debt obligations:\n\n"
                f"1. **Annuity-to-Income ({annuity_inc:.1f}% for {name}):** "
                f"This shows what percentage of gross income is consumed solely by the *proposed* loan payments. Ratios under 12% are highly favorable, while ratios over 25% indicate stress.\n"
                f"2. **Total Debt-to-Income (DTI) ({dti:.1f}% for {name}):** "
                f"This includes both the proposed loan payments AND the applicant's existing monthly obligations (estimated from outstanding bureau debt). "
                f"A DTI below **40%** is the industry standard limit; anything higher indicates high risk of payment strain."
            )
        elif any(w in q for w in ["risk", "probability", "decision", "default"]):
            return (
                f"### Default Risk and Lending Decision (Layman's Terms)\n\n"
                f"Our AI machine learning engine evaluates the probability that an applicant will default (i.e., fail to make payments for 90+ days):\n\n"
                f"- **Default Probability:** **{prob*100:.1f}%** for {name}.\n"
                f"- **Risk Category:** **{category}**.\n"
                f"- **Lending Decision:** **{decision}**.\n\n"
                f"**What it means:** The model evaluates all 30+ features (bureau history, scores, income, loan size, etc.) "
                f"to calculate a percentage risk. Underwriting limits set critical action levels: "
                f"approving clean files (under 20% risk), requesting review for borderline cases (20-75% risk), "
                f"and rejecting high-risk files (above 75% risk)."
            )
            
    # 2. General conversation triggers
    if "why" in q or "reason" in q or "reject" in q or "approve" in q:
        return f"The credit underwriting decision for {name} is {decision} with a default probability of {prob*100:.2f}% ({category}). The main factors influencing this include the external ratings and financial leverage ratios (Credit-to-Income: {prediction_results['scores']['credit_to_income']:.2f}, Annuity-to-Income: {prediction_results['scores']['annuity_to_income']*100:.1f}%)."
    elif "improve" in q or "recommend" in q or "how" in q:
        recs = "\n".join([f"- {r}" for r in prediction_results.get("recommendations", [])])
        return f"To improve the credit risk rating for {name}, the following actionable recommendations are advised:\n{recs}"
    elif "debt" in q or "income" in q or "ratio" in q:
        return f"For {name}, the Annual Income is ${applicant_data.get('income', 0.0):,.2f} and the Requested Loan is ${applicant_data.get('loan_amount', 0.0):,.2f}, resulting in a Credit-to-Income ratio of {prediction_results['scores']['credit_to_income']:.2f}. The outstanding bureau debt is ${applicant_data.get('total_debt', 0.0):,.2f}."
    elif "score" in q or "ext" in q or "bureau" in q:
        ext1 = applicant_data.get("ext_source_1", 0.5)
        ext2 = applicant_data.get("ext_source_2", 0.5)
        ext3 = applicant_data.get("ext_source_3", 0.5)
        return (
            f"The applicant's external credit scores are: EXT_SOURCE_1 = {ext1:.3f}, EXT_SOURCE_2 = {ext2:.3f}, and EXT_SOURCE_3 = {ext3:.3f}. "
            f"These ratings represent creditworthiness scores from external credit databases normalized to a 0.0 - 1.0 scale. "
            f"If you'd like a layman's explanation of what these scores represent, feel free to ask me to explain them!"
        )
    else:
        return f"Hello! I am Aura Risk AI. I am here to help you analyze the underwriting decision for {name}. Ask me about their default risk ({prob*100:.1f}%), recommendations, or debt service capabilities."

# HTTP Request Handler class
class CreditRiskHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Override translate_path to serve static assets from the frontend/ directory
        base_dir = os.path.dirname(os.path.abspath(__file__))
        frontend_dir = os.path.abspath(os.path.join(base_dir, "..", "frontend"))
        
        # Split off query and fragment
        path = path.split('?', 1)[0]
        path = path.split('#', 1)[0]
        
        # Clean path parts to prevent directory traversal
        parts = [p for p in path.split('/') if p and p != '..']
        
        return os.path.join(frontend_dir, *parts)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "OK")
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/predict':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                inputs = json.loads(post_data.decode('utf-8'))
                results = predict_credit_risk(inputs)
                
                # Save to SQLite Database
                try:
                    conn = sqlite3.connect(DB_PATH)
                    cursor = conn.cursor()
                    
                    timestamp = datetime.datetime.now().isoformat()
                    applicant_name = inputs.get("name", "John Doe")
                    default_prob = float(results.get("default_probability", 0.0))
                    non_default_prob = float(results.get("non_default_probability", 1.0))
                    risk_cat = results.get("risk_category", "Unknown")
                    decision = results.get("decision", "PENDING")
                    age = float(inputs.get("age", 35.0))
                    income = float(inputs.get("income", 50000.0))
                    loan_amount = float(inputs.get("loan_amount", 100000.0))
                    total_debt = float(inputs.get("total_debt", 0.0))
                    ext_1 = float(inputs.get("ext_source_1", 0.5))
                    ext_2 = float(inputs.get("ext_source_2", 0.5))
                    ext_3 = float(inputs.get("ext_source_3", 0.5))
                    exec_summary = results.get("executive_summary", "")
                    
                    raw_inputs_str = json.dumps(inputs)
                    response_json_str = json.dumps(results)
                    
                    cursor.execute("""
                        INSERT INTO predictions (
                            applicant_name, prediction_timestamp, default_probability, non_default_probability,
                            risk_category, lending_decision, age, annual_income, loan_amount, total_debt,
                            ext_source_1, ext_source_2, ext_source_3, executive_summary, raw_inputs, response_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        applicant_name, timestamp, default_prob, non_default_prob,
                        risk_cat, decision, age, income, loan_amount, total_debt,
                        ext_1, ext_2, ext_3, exec_summary, raw_inputs_str, response_json_str
                    ))
                    conn.commit()
                    results["db_id"] = cursor.lastrowid
                    conn.close()
                    print(f"Saved prediction for {applicant_name} to SQLite history (ID: {results['db_id']})")
                except Exception as db_err:
                    print(f"Error saving prediction to SQLite: {db_err}")
                    traceback.print_exc()
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(results).encode('utf-8'))
            except Exception as e:
                print("Error predicting:")
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e), "traceback": traceback.format_exc()}).encode('utf-8'))
        elif self.path == '/api/chat':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                inputs = json.loads(post_data.decode('utf-8'))
                question = inputs.get("question", "")
                applicant_data = inputs.get("applicant_data", {})
                prediction_results = inputs.get("prediction_results", {})
                case_loaded = inputs.get("case_loaded", False)
                api_key_browser = inputs.get("api_key", "")
                api_key_env = os.environ.get("GEMINI_API_KEY", "")
                
                print(f"[Nexus Risk] Chat request API key source: browser length={len(api_key_browser)}, env length={len(api_key_env)}", flush=True)
                if api_key_browser:
                    print(f"[Nexus Risk] Using browser API key: {api_key_browser[:10]}...", flush=True)
                else:
                    print(f"[Nexus Risk] Using environment API key: {api_key_env[:10]}...", flush=True)
                
                api_key = api_key_browser or api_key_env
                # Clean the prediction results by removing the heavy debug payload
                pred_results_clean = prediction_results.copy() if prediction_results else {}
                if "debug" in pred_results_clean:
                    del pred_results_clean["debug"]
                
                if api_key:
                    if not case_loaded:
                        system_instruction = (
                            "You are Aura Risk AI, an expert banking credit analyst chatbot. "
                            "Currently, NO applicant has been evaluated yet (the dashboard is empty). "
                            "If the user asks questions, recommendations, or details, clearly explain that "
                            "no underwriting case has been loaded in the dashboard yet. "
                            "Instruct the user to first go to the 'New Underwrite' tab, input an applicant's "
                            "profile, and run the evaluation by clicking 'Evaluate Underwrite'. "
                            "Do not make up, assume, or fabricate any default values, statistics, or recommendations."
                        )
                    else:
                        system_instruction = (
                            "You are Aura Risk AI, an expert banking credit analyst chatbot. You have complete access to "
                            f"the credit risk evaluation of {applicant_data.get('name', 'the applicant')}. "
                            "Answer any questions the user has about this applicant's profile, default probability, "
                            "risk factors, recommendations, and the machine learning model. "
                            "Provide highly personalized, numbers-driven recommendations and suggestions to improve the risk score "
                            "(e.g. reducing loan size, paying down existing bureau debt, or letting applications age) using the "
                            "applicant's exact metrics. "
                            "Be highly professional, direct, and institutional-grade. Address the applicant by name where appropriate. "
                            f"Applicant Profile: {json.dumps(applicant_data)}. "
                            f"Prediction Metrics: {json.dumps(pred_results_clean)}."
                        )
                    reply = call_gemini_api(api_key, system_instruction, question)
                    if reply.startswith("Error calling Gemini API:"):
                        print(f"[Nexus Risk] Gemini API call failed: {reply}")
                        print("[Nexus Risk] Gracefully falling back to local rule-based advisor.")
                        reply = local_chat_responder(question, applicant_data, prediction_results, case_loaded)
                else:
                    reply = local_chat_responder(question, applicant_data, prediction_results, case_loaded)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"reply": reply}).encode('utf-8'))
            except Exception as e:
                print("Error in chat API:")
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e), "traceback": traceback.format_exc()}).encode('utf-8'))
        elif self.path == '/api/history':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                body = json.loads(post_data.decode('utf-8'))
                search = body.get("search", "").strip()
                sort = body.get("sort", "newest")
                record_id = body.get("id", None)

                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                if record_id is not None:
                    cursor.execute("SELECT * FROM predictions WHERE id = ?", (record_id,))
                    row = cursor.fetchone()
                    conn.close()
                    if row:
                        self.send_response(200)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps(dict(row)).encode('utf-8'))
                    else:
                        self.send_response(404)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({"error": "Record not found"}).encode('utf-8'))
                    return

                query = "SELECT id, applicant_name, prediction_timestamp, default_probability, risk_category, lending_decision FROM predictions WHERE 1=1"
                params = []

                if search:
                    query += " AND (applicant_name LIKE ? OR risk_category LIKE ? OR lending_decision LIKE ?)"
                    like = f"%{search}%"
                    params.extend([like, like, like])

                if sort == "newest":
                    query += " ORDER BY id DESC"
                elif sort == "highest_risk":
                    query += " ORDER BY default_probability DESC"
                elif sort == "lowest_risk":
                    query += " ORDER BY default_probability ASC"
                else:
                    query += " ORDER BY id DESC"

                cursor.execute(query, params)
                rows = [dict(r) for r in cursor.fetchall()]
                conn.close()

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"records": rows}).encode('utf-8'))
            except Exception as e:
                print("Error in /api/history:")
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

        elif self.path == '/api/history/delete':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                body = json.loads(post_data.decode('utf-8'))
                record_id = body.get("id")
                if record_id is None:
                    raise ValueError("Missing record id")

                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM predictions WHERE id = ?", (record_id,))
                affected = cursor.rowcount
                conn.commit()
                conn.close()

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"deleted": affected > 0, "id": record_id}).encode('utf-8'))
            except Exception as e:
                print("Error in /api/history/delete:")
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Endpoint not found")

# Run the server — ThreadingTCPServer handles concurrent requests without blocking
class ThreadedServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    with ThreadedServer(("", PORT), CreditRiskHandler) as httpd:
        print(f"[Nexus Risk] Server running at http://localhost:{PORT}")
        print(f"[Nexus Risk] SQLite DB: {DB_PATH}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("[Nexus Risk] Stopping server...")
