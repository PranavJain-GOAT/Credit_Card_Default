"""
Nexus Risk — AI-Powered Credit Risk Underwriting Platform
FastAPI inference service | CatBoost + SHAP + Gemini 2.5 Flash Lite
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import PORT, FRONTEND_DIR
from services.db_service import init_db
from routes.predict import router as predict_router
from routes.chat import router as chat_router
from routes.history import router as history_router

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
)

# ── CORS ─────────────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    "http://localhost:8000",
    "http://localhost:3000",
    "http://127.0.0.1:8000",
    # Add your Vercel frontend URL here after deployment:
    # "https://nexus-risk.vercel.app",
    # "https://nexus-risk-yourname.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Keep wildcard for Render free tier (no custom domain)
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ────────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    init_db()
    print("[Nexus Risk] FastAPI server started. Swagger docs at /docs")

# ── API Routes (prefix /api) ───────────────────────────────────────────────────
app.include_router(predict_router, prefix="/api")
app.include_router(chat_router,    prefix="/api")
app.include_router(history_router, prefix="/api")

# ── Serve Frontend Static Files ────────────────────────────────────────────────
frontend_path = os.path.abspath(FRONTEND_DIR)
if os.path.isdir(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

    @app.get("/", include_in_schema=False)
    def serve_index():
        return FileResponse(os.path.join(frontend_path, "index.html"))

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        file_path = os.path.join(frontend_path, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_path, "index.html"))

# ── Run ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
