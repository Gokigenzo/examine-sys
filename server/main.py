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
