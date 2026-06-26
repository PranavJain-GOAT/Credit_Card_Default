# Nexus Risk — AI-Powered Credit Risk Underwriting Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![CatBoost](https://img.shields.io/badge/CatBoost-ROC--AUC%200.774-F7931E)](https://catboost.ai)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://python.org)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![Render](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=white)](https://render.com)
[![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)

A production-grade credit risk intelligence platform serving real-time loan default predictions via a containerized FastAPI inference service. Built on CatBoost trained across 307K applicants with 145 handcrafted features, SHAP explainability, live What-If simulation, counterfactual paths, and Gemini AI-powered risk Q&A.

**API Docs (Swagger):** [credit-card-default-3xnc.onrender.com/docs](https://credit-card-default-3xnc.onrender.com/docs)  
**Health Check:** [credit-card-default-3xnc.onrender.com/api/health](https://credit-card-default-3xnc.onrender.com/api/health)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│               Vanilla JS Dashboard  (Vercel)                 │
│                                                              │
│  New Assessment  │  What-If Sliders  │  SHAP Charts         │
│  Gemini AI Chat  │  Case History     │  Batch Upload        │
└───────────────────────────┬──────────────────────────────────┘
                            │  HTTPS / JSON
┌───────────────────────────▼──────────────────────────────────┐
│        Containerized FastAPI Service  (Render)               │
│                                                              │
│   GET  /api/health    →  model status + feature count        │
│   POST /api/predict   →  single applicant inference          │
│   POST /api/batch     →  bulk CSV inference                  │
│   POST /api/chat      →  Gemini AI risk Q&A                  │
│   GET  /api/history   →  audit log retrieval                 │
│                                                              │
│   Interactive Swagger UI at /docs                            │
└───────────┬────────────────────────┬─────────────────────────┘
            │                        │
┌───────────▼──────────┐   ┌────────▼──────────────────────┐
│   CatBoost Model     │   │   SQLite Audit Database        │
│   145 features       │   │   every prediction logged      │
│   SHAP TreeExplainer │   └────────────────────────────────┘
│   Counterfactuals    │
└───────────┬──────────┘
            │
┌───────────▼──────────┐
│   Gemini 2.5 Flash   │
│   AI Risk Chatbot    │
│   + local fallback   │
└──────────────────────┘
```

---

## Features

| Feature | Description |
|---|---|
| **Real-time inference** | CatBoost prediction with 145-feature pipeline in ~200ms |
| **SHAP explainability** | Top-7 per-prediction feature contributions |
| **What-If simulator** | Live sliders recompute default probability instantly |
| **Counterfactual paths** | Cheapest action to reach next approval tier |
| **Batch inference** | Upload CSV → JSON predictions for all rows |
| **Gemini AI chatbot** | Natural language credit risk Q&A |
| **Audit logging** | Every prediction persisted to SQLite |
| **Swagger UI** | Auto-generated interactive API docs at `/docs` |
| **Auto-deploy** | Both services redeploy on every `git push` to main |

---

## ML Results

**5-Model Benchmark (CV ROC-AUC):**

| Model | ROC-AUC |
|---|---|
| Logistic Regression | 0.649 (baseline) |
| Random Forest | 0.721 |
| LightGBM | 0.772 |
| XGBoost | 0.773 |
| **CatBoost (deployed)** | **0.774 (+12.5%)** |

**Threshold Optimisation** (8.07% minority class):

| Threshold | Recall on Defaulters | Precision |
|---|---|---|
| 0.50 (default) | ~18% | High |
| **0.15 (selected)** | **43.5%** | 25.5% |

CatBoost selected for native high-cardinality categorical handling — no one-hot encoding required.

---

## Project Structure

```
nexus-risk/
│
├── backend/
│   ├── Dockerfile                 ← Container build definition
│   ├── .dockerignore              ← Excludes large files from image
│   ├── main.py                    ← FastAPI application entry point
│   ├── config.py                  ← Paths, thresholds, model loading at startup
│   ├── runtime.txt                ← Python 3.11.9 pin for Render
│   ├── requirements.txt           ← Production dependencies
│   │
│   ├── catboost_credit_risk.pkl   ← Trained CatBoost model (145 features)
│   ├── feature_columns.pkl        ← Ordered feature list for inference
│   ├── feature_defaults.json      ← Training-set medians for missing fields
│   ├── category_mappings.json     ← Categorical encoding mappings
│   │
│   ├── routes/
│   │   ├── predict.py             ← /health, /predict, /batch
│   │   ├── chat.py                ← /chat (Gemini AI)
│   │   └── history.py             ← /history
│   │
│   ├── services/
│   │   ├── prediction_service.py  ← Feature engineering + CatBoost inference
│   │   ├── shap_service.py        ← SHAP TreeExplainer (top-7 contributions)
│   │   ├── gemini_service.py      ← Gemini 2.5 API + rule-based fallback
│   │   └── db_service.py          ← SQLite audit logging
│   │
│   ├── schemas/
│   │   └── applicant.py           ← Pydantic request / response models
│   │
│   └── models/
│       └── train.py               ← MLflow + Optuna training pipeline
│
├── frontend/
│   ├── index.html                 ← Single-page dashboard
│   ├── app.js                     ← Vanilla JS + What-If simulator logic
│   └── style.css                  ← Design system (IBM Plex Sans)
│
├── research/
│   └── Credit_Risk_Prediction.ipynb  ← EDA, feature engineering, model benchmarking
│
├── render.yaml                    ← Render Web Service deployment config
├── vercel.json                    ← Vercel static site deployment config
├── .gitignore
└── README.md
```

---

## Running Locally

### Without Docker

```bash
git clone https://github.com/PranavJain-GOAT/Credit_Card_Default.git
cd Credit_Card_Default/backend

pip install -r requirements.txt

# Optional: add Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env

python main.py
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

### With Docker

```bash
cd Credit_Card_Default/backend

docker build -t nexus-risk .
docker run -p 8000:8000 -e GEMINI_API_KEY=your_key nexus-risk
# → http://localhost:8000
```

---

## API Reference

### `GET /api/health`
```json
{"status": "ok", "model": "catboost_v1", "features": 145, "version": "2.0.0"}
```

### `POST /api/predict`
```bash
curl -X POST https://credit-card-default-3xnc.onrender.com/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "age": 35,
    "income": 75000,
    "loan_amount": 250000,
    "ext_source_2": 0.62,
    "late_payment_rate": 0.02
  }'
```

**Response:**
```json
{
  "default_probability": 0.24,
  "risk_category": "Medium Risk",
  "decision": "REVIEW",
  "risk_score": 24.0,
  "contributions": [
    {"feature": "External Credit Score 2", "impact": -0.18, "value": "0.62"},
    {"feature": "Credit-to-Income Ratio",  "impact": +0.12, "value": "3.33"}
  ],
  "counterfactuals": [
    {
      "action": "Increase annual income",
      "change_needed": "by ₹7,500 (+10%)",
      "new_tier": "APPROVE",
      "new_probability": "18.2"
    }
  ],
  "scores": {
    "dti_ratio": 32.4,
    "ltv_ratio": 78.1,
    "credit_to_income": 3.33
  }
}
```

### `POST /api/batch`
```bash
curl -X POST https://credit-card-default-3xnc.onrender.com/api/batch \
  -F "file=@applicants.csv"
```

---

## Deployment

| Layer | Platform | Config File | Trigger |
|---|---|---|---|
| **Backend** | Render | `render.yaml` | Auto on `git push` |
| **Frontend** | Vercel | `vercel.json` | Auto on `git push` |

**Render settings** (`render.yaml`):
- Root Dir: `backend`
- Build: `pip install -r requirements.txt`
- Start: `python main.py`
- Python: 3.11.9 (pinned via `runtime.txt`)

---

## Training Pipeline

```bash
pip install mlflow optuna lightgbm xgboost

cd backend
python models/train.py   # runs MLflow + Optuna 50-trial search

mlflow ui                # view at http://localhost:5000
```

Pipeline: merge 4 datasets → engineer 145 features → 5-model benchmark → Optuna Bayesian search → MLflow experiment logging → register best model.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **ML** | CatBoost, SHAP, scikit-learn, pandas, numpy |
| **Training** | MLflow (tracking), Optuna (hyperparameter search) |
| **API** | FastAPI, Uvicorn, Pydantic |
| **Frontend** | Vanilla JS, Chart.js, IBM Plex Sans |
| **AI** | Gemini 2.5 Flash Lite + local fallback |
| **Storage** | SQLite |
| **Container** | Docker |
| **Deploy** | Render (backend) · Vercel (frontend) |
