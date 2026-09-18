from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from ..database import get_db
from ..models import Question, UserProgress, User
from ..schemas import (
    QuizSubmitRequest,
    QuizSubmitResponse,
    PracticeWrongOut,
    QuestionOut,
    UserProgressOut,
)
from ..services.auth_service import get_optional_current_user
from ..services.grading_service import evaluate_question_answer
import json

router = APIRouter(prefix="/api/quiz", tags=["Quiz"])


class BookmarkRequest(BaseModel):
    question_id: int


@router.post("/submit", response_model=QuizSubmitResponse)
async def submit_answer(
    req: QuizSubmitRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    question = db.query(Question).filter(Question.id == req.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    is_correct, sub_results, _ = evaluate_question_answer(
        question.question_type, question.correct_option, req.selected_option
    )
    user_id = current_user.id if current_user else None

    # Find progress for this user and question
    progress_query = db.query(UserProgress).filter(
        UserProgress.question_id == req.question_id
    )
    if user_id is not None:
        progress_query = progress_query.filter(UserProgress.user_id == user_id)
    else:
        progress_query = progress_query.filter(UserProgress.user_id.is_(None))

    progress = progress_query.first()
    if not progress:
        progress = UserProgress(
            user_id=user_id,
            question_id=req.question_id,
            is_wrong=not is_correct,
            wrong_count=1 if not is_correct else 0,
        )
        db.add(progress)
    else:
        if not is_correct:
            progress.is_wrong = True
            progress.wrong_count += 1
        else:
            progress.is_wrong = False

    db.commit()
    db.refresh(progress)

    # Parse correct_option if true_false JSON
    parsed_correct = question.correct_option
    if question.question_type == "true_false":
        try:
            parsed_correct = json.loads(question.correct_option)
        except Exception:
            pass

    return QuizSubmitResponse(
        is_correct=is_correct,
        correct_option=parsed_correct,
        sub_results=sub_results,
        brief_explanation=question.brief_explanation,
        detailed_explanation=question.detailed_explanation,
        wrong_count=progress.wrong_count,
    )


@router.post("/bookmark")
async def toggle_bookmark(
    req: BookmarkRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    question = db.query(Question).filter(Question.id == req.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    user_id = current_user.id if current_user else None
    progress_query = db.query(UserProgress).filter(
        UserProgress.question_id == req.question_id
    )
    if user_id is not None:
        progress_query = progress_query.filter(UserProgress.user_id == user_id)
    else:
        progress_query = progress_query.filter(UserProgress.user_id.is_(None))

    progress = progress_query.first()
    if not progress:
        progress = UserProgress(
            user_id=user_id,
            question_id=req.question_id,
            is_bookmarked=True,
        )
        db.add(progress)
    else:
        progress.is_bookmarked = not progress.is_bookmarked

    db.commit()
    db.refresh(progress)

    return {"message": "Bookmark toggled", "is_bookmarked": progress.is_bookmarked}


@router.get("/practice-wrong", response_model=List[PracticeWrongOut])
async def get_practice_wrong(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    user_id = current_user.id if current_user else None

    query = (
        db.query(Question, UserProgress)
        .join(UserProgress, Question.id == UserProgress.question_id)
        .filter((UserProgress.is_wrong == True) | (UserProgress.is_bookmarked == True))
    )

    if user_id is not None:
        query = query.filter(UserProgress.user_id == user_id)
    else:
        query = query.filter(UserProgress.user_id.is_(None))

    records = query.all()

    result = []
    for q, p in records:
        result.append(
            PracticeWrongOut(
                question=QuestionOut.model_validate(q),
                progress=UserProgressOut.model_validate(p),
            )
        )

    return result
