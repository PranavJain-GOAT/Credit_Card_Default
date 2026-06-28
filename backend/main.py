"""
Nexus Risk — AI-Powered Credit Risk Underwriting Platform
FastAPI inference service | CatBoost + SHAP + Gemini 2.5 Flash Lite
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import PORT
from services.db_service import init_db
from routes.predict import router as predict_router
from routes.chat import router as chat_router
from routes.history import router as history_router

# ── Lifespan ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print("[Nexus Risk] FastAPI server started. Swagger docs at /docs")
    yield

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Nexus Risk API",
    description=(
        "AI-powered credit risk underwriting platform. "
        "Serves CatBoost predictions, SHAP explainability, "
        "Gemini AI recommendations, and audit logging."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# Allow the Vercel frontend + local dev
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGINS] if ALLOWED_ORIGINS != "*" else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routes (prefix /api) ───────────────────────────────────────────────────
app.include_router(predict_router, prefix="/api")
app.include_router(chat_router,    prefix="/api")
app.include_router(history_router, prefix="/api")

# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/api/health", include_in_schema=False)
def health():
    return {"status": "ok"}

# ── Run ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
