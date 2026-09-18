from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Document, Summary, Question, DocStatus
from ..schemas import SummaryOut, QuizGenerateRequest
from ..services.ai_service import generate_summary, generate_quiz
from pydantic import BaseModel

router = APIRouter(prefix="/api/generate", tags=["AI Generation"])

class SummaryRequest(BaseModel):
    document_id: int

@router.post("/summary", response_model=SummaryOut)
async def generate_summary_endpoint(
    req: SummaryRequest,
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == req.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if doc.status != DocStatus.parsed or not doc.raw_text:
        raise HTTPException(status_code=400, detail="Document text not parsed yet")
        
    # Check if summary already exists
    existing_summary = db.query(Summary).filter(Summary.document_id == doc.id).first()
    if existing_summary:
        return existing_summary
        
    # Call AI
    try:
        result = generate_summary(doc.raw_text)
        
        new_summary = Summary(
            document_id=doc.id,
            content_markdown=result.get("summary", ""),
            examples={
                "internal_examples": result.get("internal_examples", []),
                "external_examples": result.get("external_examples", [])
            }
        )
        db.add(new_summary)
        db.commit()
        db.refresh(new_summary)
        return new_summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/quiz")
async def generate_quiz_endpoint(
    req: QuizGenerateRequest,
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == req.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if doc.status != DocStatus.parsed or not doc.raw_text:
        raise HTTPException(status_code=400, detail="Document text not parsed yet")
        
    try:
        questions_data = generate_quiz(doc.raw_text, req.num_easy, req.num_medium, req.num_hard)
        
        saved_questions = []
        for q_data in questions_data:
            new_q = Question(
                chapter_id=doc.chapter_id,
                document_id=doc.id,
                question_text=q_data.get("question_text", ""),
                options=q_data.get("options", {}),
                correct_option=q_data.get("correct_option", "A"),
                difficulty=q_data.get("difficulty", "easy"),
                brief_explanation=q_data.get("brief_explanation", ""),
                detailed_explanation=q_data.get("detailed_explanation", "")
            )
            db.add(new_q)
            saved_questions.append(new_q)
            
        db.commit()
        return {"message": f"Successfully generated {len(saved_questions)} questions", "count": len(saved_questions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
