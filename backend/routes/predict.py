import io
import time
import traceback

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from schemas.applicant import (
    ApplicantInput, PredictionResponse, HealthResponse, BatchResult
)
from services.prediction_service import predict, build_feature_vector
from services.shap_service import compute_shap
from services.db_service import save_prediction
from config import FEATURE_COLS

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["System"])
def health():
    """Service health check — returns model status and feature count."""
    return {
        "status":   "ok",
        "model":    "catboost_v1",
        "features": len(FEATURE_COLS),
        "version":  "2.0.0",
    }


@router.post("/predict", response_model=PredictionResponse, tags=["Inference"])
def predict_endpoint(body: ApplicantInput):
    """
    Run full credit risk inference for a single applicant.

    Returns default probability, risk tier (Approve / Review / Manual Review / Reject),
    SHAP top-7 feature contributions, counterfactual improvement paths,
    underwriting scores (DTI, LTV, etc.), and Gemini AI recommendations.
    """
    try:
        t0     = time.perf_counter()
        inputs = body.model_dump()
        result = predict(inputs)

        # Compute SHAP values
        feats, row = build_feature_vector(inputs)
        df_pred    = pd.DataFrame([feats], columns=FEATURE_COLS)
        result["contributions"] = compute_shap(df_pred, row)

        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        print(f"[Nexus Risk] Prediction for {inputs.get('name')} | "
              f"{result['risk_score']}% | {result['decision']} | {latency_ms}ms")

        # Persist to PostgreSQL
        db_id = save_prediction(inputs, result)
        result["db_id"] = db_id

        return result

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch", tags=["Inference"])
async def batch_predict(file: UploadFile = File(...)):
    """
    Bulk inference endpoint. Upload a CSV file with applicant data.

    Required CSV columns (minimum): income, loan_amount, ext_source_1,
    ext_source_2, ext_source_3. All other columns default to training medians.

    Returns a JSON array of predictions — one per CSV row.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    results = []
    for idx, row_series in df.iterrows():
        row_dict = row_series.dropna().to_dict()
        try:
            r = predict(row_dict)
            results.append(BatchResult(
                row_index=int(idx),
                applicant_name=str(row_dict.get("name", f"Applicant_{idx}")),
                default_probability=r["default_probability"],
                risk_category=r["risk_category"],
                decision=r["decision"],
            ).model_dump())
        except Exception as e:
            results.append(BatchResult(
                row_index=int(idx),
                applicant_name=str(row_dict.get("name", f"Applicant_{idx}")),
                default_probability=-1.0,
                risk_category="ERROR",
                decision="ERROR",
                error=str(e),
            ).model_dump())

    return JSONResponse(content={"total": len(results), "predictions": results})
