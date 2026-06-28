# Nexus Risk — AI-Powered Credit Risk Underwriting Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![CatBoost](https://img.shields.io/badge/CatBoost-ROC--AUC%200.774-F7931E)](https://catboost.ai)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://python.org)
[![Render](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=white)](https://render.com)
[![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)

A production-grade credit risk intelligence platform serving real-time loan default predictions via a FastAPI inference service. Built on CatBoost trained across 307K applicants with 145 handcrafted features, SHAP explainability, live What-If simulation, counterfactual paths, and Gemini AI-powered risk Q&A.

**API Docs (Swagger):** [credit-card-default-3xnc.onrender.com/docs](https://credit-card-default-3xnc.onrender.com/docs)  
**Health Check:** [credit-card-default-3xnc.onrender.com/api/health](https://credit-card-default-3xnc.onrender.com/api/health)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│               React Dashboard  (Vercel)                      │
│                                                              │
│  New Assessment  │  What-If Sliders  │  SHAP Charts         │
│  Gemini AI Chat  │  Case History     │  Risk Dashboard       │
└───────────────────────────┬──────────────────────────────────┘
                            │  HTTPS / JSON
┌───────────────────────────▼──────────────────────────────────┐
│               FastAPI Service  (Render)                      │
│                                                              │
│   GET  /api/health    →  service status                      │
│   POST /api/predict   →  single applicant inference          │
│   POST /api/batch     →  bulk CSV inference                  │
│   POST /api/chat      →  Gemini AI risk Q&A                  │
│   POST /api/history   →  audit log retrieval                 │
│                                                              │
│   Interactive Swagger UI at /docs                            │
└───────────┬────────────────────────┬─────────────────────────┘
            │                        │
┌───────────▼──────────┐   ┌────────▼──────────────────────┐
│   CatBoost Model     │   │   PostgreSQL Audit Database    │
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
| **Audit logging** | Every prediction persisted to PostgreSQL |
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
│   ├── main.py                    ← FastAPI entry point (API-only, no static serving)
│   ├── config.py                  ← Thresholds, model loading at startup
│   ├── runtime.txt                ← Python 3.11.9 pin for Render
│   ├── requirements.txt           ← Production dependencies
│   │
│   ├── catboost_credit_risk.pkl   ← Trained CatBoost model (145 features)
│   ├── feature_columns.pkl        ← Ordered feature list for inference
│   ├── feature_defaults.json      ← Training-set medians for missing fields
│   ├── category_mappings.json     ← Categorical encoding mappings
│   │
│   ├── routes/
│   │   ├── predict.py             ← /predict, /batch
│   │   ├── chat.py                ← /chat (Gemini AI)
│   │   └── history.py             ← /history
│   │
│   ├── services/
│   │   ├── prediction_service.py  ← Feature engineering + CatBoost inference
│   │   ├── shap_service.py        ← SHAP TreeExplainer (top-7 contributions)
│   │   ├── gemini_service.py      ← Gemini 2.5 API + rule-based fallback
│   │   └── db_service.py          ← PostgreSQL audit logging
│   │
│   └── schemas/
│       └── applicant.py           ← Pydantic request / response models
│
├── frontend/                      ← React + Vite (deployed on Vercel)
│   ├── index.html
│   ├── vite.config.js             ← Dev proxy → localhost:8000
│   ├── .env.production            ← VITE_API_BASE_URL (Render URL)
│   ├── package.json
│   └── src/
│       ├── main.jsx               ← Entry point
│       ├── App.jsx                ← Global state, tab routing
│       ├── api.js                 ← All API calls (fetch wrapper)
│       ├── index.css              ← Full design system (IBM Plex Sans)
│       └── components/
│           ├── Sidebar.jsx        ← Nav, theme toggle
│           ├── UnderwriteTab.jsx  ← 5-step wizard (35 fields)
│           ├── DashboardTab.jsx   ← KPIs, risk meter, SHAP bars
│           ├── AnalysisTab.jsx    ← Radar chart, bar chart, cash flow
│           ├── HistoryTab.jsx     ← Table, search/sort, details modal
│           ├── ChatBot.jsx        ← Floating Gemini AI chat
│           ├── WhatIfSimulator.jsx← 4 sliders + counterfactual cards
│           └── PrintShell.jsx     ← PDF export template
│
├── research/
│   ├── Credit_Risk_Prediction.ipynb  ← EDA, feature engineering, model benchmarking
│   └── train.py                      ← MLflow + Optuna training pipeline
│
├── render.yaml                    ← Render backend deployment config
├── vercel.json                    ← Vercel frontend deployment config
├── .gitignore
└── README.md
```

---

## Running Locally

```bash
git clone https://github.com/PranavJain-GOAT/Credit_Card_Default.git
cd Credit_Card_Default
```

### Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt

# Optional: add Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env

python main.py
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

### Frontend (React)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
# API calls auto-proxy to localhost:8000 via vite.config.js
```

---

## API Reference

### `GET /api/health`
```json
{"status": "ok"}
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

**Render** (`render.yaml`):
- Root Dir: `backend`
- Build: `pip install -r requirements.txt`
- Start: `python main.py`
- Env vars: `GEMINI_API_KEY`, `DATABASE_URL` (set in Render dashboard)

**Vercel** (`vercel.json`):
- Root Dir: `frontend` (set in Vercel project settings)
- Build: `npm ci && npm run build`
- Output: `dist/`
- SPA rewrites: all routes → `index.html`

---

## Training Pipeline

```bash
pip install mlflow optuna lightgbm xgboost catboost

cd research
python train.py   # runs MLflow + Optuna 50-trial search

mlflow ui         # view experiments at http://localhost:5000
```

Pipeline: merge 4 datasets → engineer 145 features → 5-model benchmark → Optuna Bayesian search → MLflow experiment logging → register best model.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **ML** | CatBoost, SHAP, scikit-learn, pandas, numpy |
| **Training** | MLflow (tracking), Optuna (hyperparameter search) |
| **API** | FastAPI, Uvicorn, Pydantic |
| **Frontend** | React 18, Vite, react-chartjs-2, IBM Plex Sans |
| **AI** | Gemini 2.5 Flash Lite + local fallback |
| **Storage** | PostgreSQL (Neon) |
| **Deploy** | Render (backend) · Vercel (frontend) |
