from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from ..database import get_db
from ..models import Chapter, Document, Summary, Question, Difficulty, User
from ..schemas import ChapterOut, ChapterCreate, SummaryOut, QuestionOut
from ..services.auth_service import get_optional_current_user

router = APIRouter(prefix="/api/chapters", tags=["Chapters"])


@router.get("", response_model=List[ChapterOut])
async def list_chapters(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    query = db.query(Chapter)
    if current_user:
        # Show public chapters and user's private chapters
        query = query.filter(
            or_(Chapter.user_id.is_(None), Chapter.user_id == current_user.id)
        )

    chapters = query.order_by(Chapter.order.asc(), Chapter.created_at.desc()).all()
    result = []
    for c in chapters:
        doc_count = db.query(Document).filter(Document.chapter_id == c.id).count()
        c_dict = {
            "id": c.id,
            "title": c.title,
            "order": c.order,
            "user_id": c.user_id,
            "created_at": c.created_at,
            "document_count": doc_count,
        }
        result.append(ChapterOut(**c_dict))
    return result


@router.post("", response_model=ChapterOut)
async def create_chapter(
    chapter: ChapterCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    user_id = current_user.id if current_user else None
    new_chap = Chapter(title=chapter.title, order=chapter.order, user_id=user_id)
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
async def get_chapter_quiz(
    id: int, difficulty: Optional[Difficulty] = None, db: Session = Depends(get_db)
):
    chapter = db.query(Chapter).filter(Chapter.id == id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    query = db.query(Question).filter(Question.chapter_id == id)
    if difficulty:
        query = query.filter(Question.difficulty == difficulty)

    questions = query.all()
    return questions
