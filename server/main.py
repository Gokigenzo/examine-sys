from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, migrate_db
from .config import settings
from .routers import documents, generate, chapters, quiz, exam, auth
import os

# Create DB tables & apply migrations
Base.metadata.create_all(bind=engine)
migrate_db()

# Ensure uploads directory
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="AI-Powered Learning & Test Prep Platform API",
    description="Backend for AI Learning Platform",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(chapters.router)
app.include_router(documents.router)
app.include_router(generate.router)
app.include_router(quiz.router)
app.include_router(exam.router)

@app.get("/")
async def root():
    return {"message": "Welcome to AI-Powered Learning & Test Prep API"}


@app.get("/api/llm/status")
async def llm_status():
    """Check current LLM provider status."""
    from .services.ai_service import get_ollama_status

    provider = settings.LLM_PROVIDER.lower()
    result = {
        "provider": provider,
        "gemini_model": settings.GEMINI_MODEL,
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "ollama": get_ollama_status(),
    }
    return result


@app.post("/api/llm/switch")
async def switch_llm(provider: str):
    """Switch LLM provider at runtime (gemini or ollama)."""
    provider = provider.lower().strip()
    if provider not in ("gemini", "ollama"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Provider phải là 'gemini' hoặc 'ollama'")
    settings.LLM_PROVIDER = provider
    return {"message": f"Đã chuyển sang {provider}", "provider": provider}

