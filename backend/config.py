import os
import pickle
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Paths ──────────────────────────────────────────────────────────────────────
MODEL_PATH          = os.path.join(BASE_DIR, "catboost_credit_risk.pkl")
FEATURE_COLS_PATH   = os.path.join(BASE_DIR, "feature_columns.pkl")
FEATURE_DEFAULTS_PATH = os.path.join(BASE_DIR, "feature_defaults.json")
CATEGORY_MAPPINGS_PATH = os.path.join(BASE_DIR, "category_mappings.json")
DB_PATH             = os.path.join(BASE_DIR, "credit_risk.db")
FRONTEND_DIR        = os.path.join(BASE_DIR, "..", "frontend")

# ── Server ─────────────────────────────────────────────────────────────────────
PORT = int(os.environ.get("PORT", 8000))

# ── ML Decision Thresholds ────────────────────────────────────────────────────
# Tuned via precision-recall analysis — 0.15 maximises recall on 8.07% minority class
DECISION_THRESHOLD = 0.15

# Confidence gate: predictions between these bounds go to UNCERTAIN / MANUAL REVIEW
CONFIDENCE_GATE_LOW  = 0.45
CONFIDENCE_GATE_HIGH = 0.55

# Risk tier boundaries (as % of default probability)
RISK_TIERS = {
    "LOW":      (0.0,  20.0),
    "MEDIUM":   (20.0, 50.0),
    "HIGH":     (50.0, 75.0),
    "CRITICAL": (75.0, 100.0),
}

# ── Load Model Artifacts Once at Import ───────────────────────────────────────
print("[Nexus Risk] Loading model artifacts...")

with open(MODEL_PATH, "rb") as f:
    MODEL = pickle.load(f)

with open(FEATURE_COLS_PATH, "rb") as f:
    FEATURE_COLS = pickle.load(f)

with open(FEATURE_DEFAULTS_PATH, "r") as f:
    FEATURE_DEFAULTS = json.load(f)

with open(CATEGORY_MAPPINGS_PATH, "r") as f:
    CATEGORY_MAPPINGS = json.load(f)

print(f"[Nexus Risk] Model ready. Features: {len(FEATURE_COLS)}")
