# Nexus Risk — AI-Powered Credit Risk Underwriting Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![CatBoost](https://img.shields.io/badge/CatBoost-ROC--AUC%200.774-F7931E)](https://catboost.ai)
[![MLflow](https://img.shields.io/badge/MLflow-Tracking-0194E2)](https://mlflow.org)
[![Render](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render)](https://render.com)
[![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel)](https://vercel.com)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://python.org)

A production-grade credit risk intelligence platform that serves real-time loan default predictions via a FastAPI inference service deployed on Render. Built on CatBoost trained across 307K applicants with 145 handcrafted features, SHAP explainability, What-If scenario simulation, and Gemini AI-powered risk Q&A.

**Live Demo:** [nexus-risk.vercel.app](https://nexus-risk.vercel.app)  
**API Docs:** [credit-card-default-3xnc.onrender.com/docs](https://credit-card-default-3xnc.onrender.com/docs)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Vanilla JS Dashboard (Vercel)               │
│   What-If Sliders  │  SHAP Charts  │  Gemini AI Chat    │
└──────────────────────────┬──────────────────────────────┘
                           │  HTTP/JSON
┌──────────────────────────▼──────────────────────────────┐
│           FastAPI Inference Service (Render)             │
│                                                          │
│   POST /api/predict    →  Single prediction              │
│   POST /api/batch      →  CSV bulk inference             │
│   GET  /api/health     →  Health check                   │
│   POST /api/chat       →  Gemini AI chatbot              │
│   GET  /api/history    →  Audit log                      │
│                                                          │
│   Swagger UI at /docs                                    │
└────────────┬──────────────────────┬─────────────────────┘
             │                      │
┌────────────▼──────────┐  ┌───────▼─────────────────────┐
│  CatBoost Model       │  │  SQLite Audit Log            │
│  + SHAP TreeExplainer │  │  (every prediction logged)   │
│  + Counterfactuals    │  └─────────────────────────────┘
└───────────────────────┘
             │
┌────────────▼──────────┐
│  Gemini 2.5 Flash     │
│  AI Risk Chatbot      │
│  + Local fallback     │
└───────────────────────┘
```

---

## Key Features

| Feature | Description |
|---|---|
| **Real-time prediction** | CatBoost inference with 145-feature pipeline in ~200ms |
| **SHAP explainability** | Top-7 feature contributions per prediction |
| **What-If Simulator** | Live sliders recompute probability instantly |
| **Counterfactual paths** | "Do X to reach next approval tier" |
| **Batch inference** | Upload CSV → download bulk predictions |
| **Gemini AI chatbot** | Natural language credit risk Q&A |
| **Audit logging** | Every prediction saved to SQLite |
| **Auto API docs** | Swagger UI auto-generated at `/docs` |

---

## ML Results

| Model | CV ROC-AUC |
|---|---|
| Logistic Regression | 0.649 (baseline) |
| Random Forest | 0.721 |
| XGBoost | 0.773 |
| LightGBM | 0.772 |
| **CatBoost (selected)** | **0.774** |

**Threshold Optimisation** — default class is 8.07% of dataset (imbalanced):

| Threshold | Recall on defaulters | Precision |
|---|---|---|
| 0.50 (default) | ~18% | High |
| **0.15 (selected)** | **43.5%** | 25.5% |

CatBoost selected over XGBoost for native handling of high-cardinality categoricals without one-hot encoding.

---

## Project Structure

```
nexus-risk/
├── backend/
│   ├── main.py                    ← FastAPI entry point
│   ├── config.py                  ← Paths, thresholds, model loading
│   ├── runtime.txt                ← Python 3.11.9 for Render
│   ├── requirements.txt           ← Dependencies
│   ├── catboost_credit_risk.pkl   ← Trained model (145 features)
│   ├── feature_columns.pkl        ← Ordered feature list
│   ├── feature_defaults.json      ← Default values per feature
│   ├── category_mappings.json     ← Categorical encodings
│   ├── routes/
│   │   ├── predict.py             ← /predict, /batch, /health
│   │   ├── chat.py                ← /chat (Gemini AI)
│   │   └── history.py             ← /history
│   ├── services/
│   │   ├── prediction_service.py  ← 145-feature pipeline + CatBoost inference
│   │   ├── shap_service.py        ← SHAP TreeExplainer
│   │   ├── gemini_service.py      ← Gemini API + local fallback
│   │   └── db_service.py          ← SQLite audit logging
│   ├── schemas/
│   │   └── applicant.py           ← Pydantic request/response models
│   └── models/
│       └── train.py               ← MLflow + Optuna training pipeline
├── frontend/
│   ├── index.html                 ← Dashboard UI
│   ├── app.js                     ← Vanilla JS + What-If simulator
│   └── style.css                  ← Design system
├── research/
│   └── Credit_Risk_Prediction.ipynb  ← EDA + training notebook
├── render.yaml                    ← Render deployment config
├── vercel.json                    ← Vercel deployment config
└── README.md
```

---

## API Reference

### `POST /api/predict`

```bash
curl -X POST https://credit-card-default-3xnc.onrender.com/api/predict \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","age":35,"income":75000,"loan_amount":250000,"ext_source_2":0.62}'
```

**Response:**
```json
{
  "default_probability": 0.24,
  "risk_category": "Medium Risk",
  "decision": "REVIEW",
  "decision_color": "#f59e0b",
  "risk_score": 24.0,
  "contributions": [
    {"feature": "External Credit Score 2", "impact": -0.18, "value": "0.62"}
  ],
  "counterfactuals": [
    {"action": "Increase annual income", "change_needed": "by ₹7,500 (+10%)", "new_tier": "APPROVE", "new_probability": "18.2"}
  ],
  "scores": {"dti_ratio": 32.4, "ltv_ratio": 78.1, "credit_to_income": 3.33}
}
```

### `POST /api/batch`

```bash
curl -X POST https://credit-card-default-3xnc.onrender.com/api/batch \
  -F "file=@applicants.csv"
```

### `GET /api/health`

```json
{"status": "ok", "model": "catboost_v1", "features": 145, "version": "2.0.0"}
```

---

## Running Locally

```bash
# Clone
git clone https://github.com/PranavJain-GOAT/Credit_Card_Default.git
cd Credit_Card_Default/backend

# Install dependencies
pip install -r requirements.txt

# Add Gemini key (optional)
echo "GEMINI_API_KEY=your_key_here" > .env

# Start server
python main.py

# Open platform
# http://localhost:8000
# http://localhost:8000/docs  ← Swagger UI
```

---

## Training Pipeline

```bash
# Install training dependencies
pip install mlflow optuna lightgbm xgboost

# Train (MLflow tracking + Optuna 50-trial Bayesian search)
cd backend
python models/train.py

# View experiment dashboard
mlflow ui
# Open http://localhost:5000
```

Training steps:
1. Merges 4 Home Credit datasets (307K applicants)
2. Engineers 145 features (DTI, LTV, bureau aggregations, payment consistency)
3. Benchmarks 5 classifiers with cross-validation
4. Runs Optuna Bayesian search over 50 trials (depth, LR, L2, border_count)
5. Logs all metrics, parameters, and model artifacts to MLflow
6. Registers best model in MLflow Model Registry

---

## Deployment

| Service | Platform | Config |
|---|---|---|
| **Backend (FastAPI)** | Render | `render.yaml` |
| **Frontend (Vanilla JS)** | Vercel | `vercel.json` |

Auto-deploys on every `git push` to `main`.

---

## Tech Stack

| Layer | Tech |
|---|---|
| **ML** | CatBoost, SHAP, Optuna, MLflow, scikit-learn, pandas, numpy |
| **API** | FastAPI, Uvicorn, Pydantic |
| **Frontend** | Vanilla JS, Chart.js, IBM Plex Sans |
| **AI** | Gemini 2.5 Flash Lite |
| **Storage** | SQLite |
| **Deploy** | Render (backend) + Vercel (frontend) |
