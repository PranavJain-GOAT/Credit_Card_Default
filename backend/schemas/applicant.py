from typing import Optional
from pydantic import BaseModel, Field


# ── Input Schema ──────────────────────────────────────────────────────────────
class ApplicantInput(BaseModel):
    # Identity
    name: str = Field(default="Applicant", description="Applicant name for audit log")

    # Personal Profile
    age: float = Field(default=35.0, ge=18, le=100)
    gender: str = Field(default="F")
    marital_status: str = Field(default="Married")
    children: int = Field(default=0, ge=0)
    education: str = Field(default="Secondary / secondary special")
    housing: str = Field(default="House / apartment")
    own_car: str = Field(default="N")
    own_property: str = Field(default="Y")
    employment_type: str = Field(default="Working")
    years_employed: float = Field(default=5.0, ge=0)

    # Financial
    income: float = Field(default=50000.0, gt=0)
    loan_amount: float = Field(default=100000.0, gt=0)
    annuity: float = Field(default=10000.0, gt=0)
    goods_price: float = Field(default=100000.0, gt=0)

    # Credit Bureau
    total_debt: float = Field(default=0.0, ge=0)
    active_loans: int = Field(default=0, ge=0)
    closed_loans: int = Field(default=0, ge=0)
    avg_credit_age_days: float = Field(default=1000.0, ge=0)

    # Previous Applications
    approval_rate: float = Field(default=1.0, ge=0, le=1)
    prev_app_count: int = Field(default=0, ge=0)
    avg_prev_credit: float = Field(default=0.0, ge=0)
    max_prev_credit: float = Field(default=0.0, ge=0)
    avg_prev_annuity: float = Field(default=0.0, ge=0)
    years_since_last_app: float = Field(default=1.0, ge=0)

    # Payment Behaviour
    late_payment_rate: float = Field(default=0.0, ge=0, le=1)
    avg_payment_ratio: float = Field(default=1.0)
    total_payment_amount: float = Field(default=0.0, ge=0)

    # External Credit Scores (bureau — 0.0 = highest risk, 1.0 = lowest risk)
    ext_source_1: float = Field(default=0.5, ge=0, le=1)
    ext_source_2: float = Field(default=0.5, ge=0, le=1)
    ext_source_3: float = Field(default=0.5, ge=0, le=1)

    # What-If co-variance scaling fields (populated by frontend sliders)
    original_loan_amount: Optional[float] = None
    original_annuity: Optional[float] = None
    original_late_payment_rate: Optional[float] = None
    original_avg_days_late: Optional[float] = None
    original_max_days_late: Optional[float] = None
    original_late_payment_count: Optional[int] = None


# ── SHAP Contribution ─────────────────────────────────────────────────────────
class FeatureContribution(BaseModel):
    feature: str
    impact: float
    value: str


# ── Counterfactual Suggestion ─────────────────────────────────────────────────
class Counterfactual(BaseModel):
    action: str           # e.g. "Increase income"
    change_needed: str    # e.g. "by ₹15,000"
    new_probability: float
    new_tier: str


# ── Prediction Response ───────────────────────────────────────────────────────
class PredictionResponse(BaseModel):
    default_probability: float
    non_default_probability: float
    risk_score: float
    risk_category: str
    decision: str
    decision_color: str
    reasoning: str
    executive_summary: str
    strengths: list
    weaknesses: list
    scores: dict
    recommendations: list
    contributions: list
    counterfactuals: list
    model_version: str = "catboost_v1"
    db_id: Optional[int] = None


# ── Chat Schemas ──────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    question: str
    applicant_data: dict = {}
    prediction_results: dict = {}
    case_loaded: bool = False
    api_key: str = ""


class ChatResponse(BaseModel):
    reply: str


# ── History Schemas ───────────────────────────────────────────────────────────
class HistoryRequest(BaseModel):
    search: str = ""
    sort: str = "newest"
    id: Optional[int] = None


class DeleteRequest(BaseModel):
    id: int


# ── Batch ─────────────────────────────────────────────────────────────────────
class BatchResult(BaseModel):
    row_index: int
    applicant_name: str
    default_probability: float
    risk_category: str
    decision: str
    error: Optional[str] = None


# ── Health Check ──────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    model: str
    features: int
    version: str
