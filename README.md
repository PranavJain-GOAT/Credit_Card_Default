# Nexus Risk — AI-Powered Credit Risk Underwriting Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-2.0-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![CatBoost](https://img.shields.io/badge/CatBoost-ROC--AUC%200.774-yellow)](https://catboost.ai)
[![MLflow](https://img.shields.io/badge/MLflow-Experiment%20Tracking-blue)](https://mlflow.org)
[![Docker](https://img.shields.io/badge/Docker-Containerised-2496ED?logo=docker)](https://docker.com)
[![Optuna](https://img.shields.io/badge/Optuna-Bayesian%20Tuning-purple)](https://optuna.org)

A production-grade credit risk intelligence platform that serves real-time loan default predictions via a Dockerized FastAPI inference service. Built on CatBoost trained across 307K applicants with 145 handcrafted features, SHAP explainability, and a live What-If scenario simulator.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Vanilla JS Dashboard                   │
│   What-If Sliders │ SHAP Charts │ Gemini AI Chatbot     │
└──────────────────────────┬──────────────────────────────┘
                           │  HTTP/JSON
┌──────────────────────────▼──────────────────────────────┐
│              FastAPI Inference Service                   │
│  POST /api/predict   POST /api/batch   GET /api/health  │
│  POST /api/chat      POST /api/history                  │
│  Swagger Docs at /docs                                  │
└───────────┬───────────────────────┬─────────────────────┘
            │                       │
┌───────────▼──────────┐  ┌────────▼────────────────────┐
│  CatBoost Model      │  │  SQLite Audit Log            │
│  + SHAP TreeExplainer│  │  (predictions + decisions)   │
│  + Counterfactuals   │  └─────────────────────────────┘
│  catboost_v1.pkl     │
└──────────────────────┘
            │
┌───────────▼──────────┐
│  Gemini 2.5 Flash    │
│  Lite AI Chatbot     │
└──────────────────────┘
```

---

## Key Features

| Feature | Description |
|---|---|
| **FastAPI REST API** | `/predict`, `/batch`, `/health` with Swagger auto-docs |
| **145 handcrafted features** | DTI, LTV, bureau aggregations, delinquency rate, installment consistency |
| **CatBoost (ROC-AUC 0.774)** | +12.5% over Logistic Regression baseline (0.649) |
| **Threshold optimisation** | 0.5 → 0.15, recall 18% → **43.5%** on 8.07% imbalanced class |
| **SHAP explainability** | Top-7 feature contributions per prediction |
| **What-If Simulator** | Live sliders recompute probability + SHAP instantly |
| **Counterfactual paths** | "Reduce debt by ₹X → reach REVIEW tier" |
| **MLflow tracking** | Experiments, params, metrics, model registry |
| **Optuna tuning** | Bayesian search over 50 trials (depth, LR, L2) |
| **Gemini 2.5 AI chatbot** | Natural language risk Q&A with local fallback |
| **Batch inference** | CSV upload → bulk predictions download |
| **Docker** | One-command deployment |

---

## Quickstart

### Option 1 — Docker (Recommended)

```bash
# Clone and navigate
git clone https://github.com/your-username/nexus-risk.git
cd nexus-risk

# Set your Gemini API key (optional — platform works without it)
export GEMINI_API_KEY=your_key_here

# Start everything
docker-compose up --build

# Open the platform
open http://localhost:8000

# View API docs
open http://localhost:8000/docs
```

### Option 2 — Local Development

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run FastAPI server
python main.py

# Open platform
open http://localhost:8000
```

---

## API Reference

### POST `/api/predict`
Single applicant credit risk inference.

**Request:**
```json
{
  "name": "John Doe",
  "age": 35,
  "income": 75000,
  "loan_amount": 250000,
  "ext_source_2": 0.62,
  "late_payment_rate": 0.02,
  "total_debt": 15000
}
```

**Response:**
```json
{
  "default_probability": 0.24,
  "risk_category": "Medium Risk",
  "decision": "REVIEW",
  "contributions": [{"feature": "External Credit Score 2", "impact": -0.18, "value": "0.62"}],
  "counterfactuals": [{"action": "Increase annual income", "change_needed": "by ₹12,000 (+16%)", "new_tier": "APPROVE"}],
  "scores": {"dti_ratio": 32.4, "ltv_ratio": 78.1}
}
```

### POST `/api/batch`
Upload CSV → bulk predictions.

```bash
curl -X POST http://localhost:8000/api/batch \
  -F "file=@applicants.csv"
```

### GET `/api/health`
```json
{"status": "ok", "model": "catboost_v1", "features": 145, "version": "2.0.0"}
```

---

## Model Training

```bash
cd backend

# Train with MLflow tracking + Optuna hyperparameter search
python models/train.py

# View MLflow experiment dashboard
mlflow ui
# Open http://localhost:5000
```

Training pipeline:
1. Merges 4 Home Credit datasets (307K applicants)
2. Engineers 145 features (DTI, bureau aggregations, payment consistency)
3. Benchmarks 5 classifiers (LR, RF, XGBoost, LightGBM, CatBoost)
4. Runs Optuna Bayesian search over 50 trials
5. Logs all metrics, params, and model artifacts to MLflow
6. Registers best model in MLflow Model Registry

---

## ML Results

| Model | CV ROC-AUC |
|---|---|
| Logistic Regression | 0.649 (baseline) |
| Random Forest | 0.721 |
| XGBoost | 0.773 |
| LightGBM | 0.772 |
| **CatBoost (selected)** | **0.774** |

**Threshold Analysis:**

| Threshold | Recall | Precision | F1 |
|---|---|---|---|
| 0.50 (default) | ~18% | High | Low |
| **0.15 (selected)** | **43.5%** | 25.5% | 32.1% |
| 0.10 | 62.4% | 20.0% | 30.2% |

CatBoost was selected over XGBoost for its native handling of high-cardinality categorical features without encoding overhead.

---

## Project Structure

```
nexus-risk/
├── backend/
│   ├── main.py                    ← FastAPI entry point
│   ├── config.py                  ← Paths, thresholds, model loading
│   ├── routes/
│   │   ├── predict.py             ← /predict, /batch, /health
│   │   ├── chat.py                ← /chat (Gemini AI)
│   │   └── history.py             ← /history, /history/delete
│   ├── services/
│   │   ├── prediction_service.py  ← Feature engineering + CatBoost inference
│   │   ├── shap_service.py        ← SHAP TreeExplainer
│   │   ├── gemini_service.py      ← Gemini API + local fallback
│   │   └── db_service.py          ← SQLite audit logging
│   ├── schemas/
│   │   └── applicant.py           ← Pydantic request/response models
│   ├── models/
│   │   └── train.py               ← MLflow + Optuna training pipeline
│   ├── catboost_credit_risk.pkl   ← Trained model
│   └── requirements.txt
├── frontend/
│   ├── index.html                 ← Dashboard UI
│   ├── app.js                     ← Vanilla JS logic + What-If simulator
│   └── style.css                  ← IBM Plex Sans enterprise design system
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Interview Q&A

**Why CatBoost over XGBoost?**
CatBoost handles high-cardinality categorical features (NAME_INCOME_TYPE, NAME_EDUCATION_TYPE) natively without one-hot encoding, reducing preprocessing complexity and training time on 300K rows.

**Why threshold 0.15?**
The dataset has 8.07% default rate (severely imbalanced). At the default 0.5 threshold, recall was ~18% — the model missed most actual defaulters. A precision-recall tradeoff analysis (logged in MLflow) showed 0.15 maximizes recall (43.5%) while keeping precision above 25%, acceptable for a human-review workflow.

**Why ROC-AUC over PR-AUC?**
ROC-AUC is used for model selection as it measures discriminative ability across all thresholds. PR-AUC is included in threshold analysis where class imbalance matters.

**How does the What-If simulator work?**
The frontend sliders send modified inputs to `/api/predict`. The backend applies co-variance scaling — if loan amount changes, annuity and goods price scale proportionally. The full 145-feature vector is recomputed and CatBoost returns a new probability in under 200ms.

**How would you retrain monthly?**
`python models/train.py` — MLflow tracks the new run, registers a new model version, and the old version remains in the registry for rollback.

---

## Tech Stack

**ML:** CatBoost, SHAP, Optuna, MLflow, Pandas, NumPy, scikit-learn  
**API:** FastAPI, Uvicorn, Pydantic  
**Frontend:** Vanilla JS, Chart.js, IBM Plex Sans  
**AI:** Gemini 2.5 Flash Lite  
**Storage:** SQLite  
**DevOps:** Docker, docker-compose
