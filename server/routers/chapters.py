from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from ..database import get_db
from ..models import Chapter, Document, Summary, Question, Difficulty
from ..schemas import ChapterOut, ChapterCreate, SummaryOut, QuestionOut

router = APIRouter(prefix="/api/chapters", tags=["Chapters"])

@router.get("", response_model=List[ChapterOut])
async def list_chapters(db: Session = Depends(get_db)):
    chapters = db.query(Chapter).order_by(Chapter.order.asc()).all()
    result = []
    for c in chapters:
        doc_count = db.query(Document).filter(Document.chapter_id == c.id).count()
        c_dict = c.__dict__
        c_dict["document_count"] = doc_count
        result.append(c_dict)
    return result

@router.post("", response_model=ChapterOut)
async def create_chapter(chapter: ChapterCreate, db: Session = Depends(get_db)):
    new_chap = Chapter(title=chapter.title, order=chapter.order)
    db.add(new_chap)
    db.commit()
    db.refresh(new_chap)
    return new_chap

@router.get("/{id}/learn")
async def get_chapter_learn_materials(id: int, db: Session = Depends(get_db)):
    chapter = db.query(Chapter).filter(Chapter.id == id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
        
    summaries = (
        db.query(Summary)
        .join(Document)
        .filter(Document.chapter_id == id)
        .all()
    )
    
    return [SummaryOut.model_validate(s) for s in summaries]

@router.get("/{id}/quiz", response_model=List[QuestionOut])
async def get_chapter_quiz(id: int, difficulty: Optional[Difficulty] = None, db: Session = Depends(get_db)):
    chapter = db.query(Chapter).filter(Chapter.id == id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
        
    query = db.query(Question).filter(Question.chapter_id == id)
    if difficulty:
        query = query.filter(Question.difficulty == difficulty)
        
    questions = query.all()
    return questions
