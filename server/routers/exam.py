from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from pathlib import Path
import os
import shutil
import logging

from ..database import get_db
from ..models import (
    Chapter,
    Document,
    Question,
    UserProgress,
    ExamAttempt,
    User,
    FileType,
    DocStatus,
    Difficulty,
)
from ..schemas import (
    ExamQuickCreateResponse,
    ExamSubmitBatchRequest,
    ExamSubmitBatchResponse,
    ExamAnswerResult,
    QuestionOut,
)
from ..services.parser import parse_file
from ..services.ai_service import extract_exam_questions
from ..services.auth_service import get_optional_current_user
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exam", tags=["Exam"])


@router.post("/quick-create", response_model=ExamQuickCreateResponse)
@router.post("/quick-create/", response_model=ExamQuickCreateResponse)
async def quick_create_exam(
    file: UploadFile = File(...),
    exam_title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Upload an exam file (.pdf, .docx, .pptx), extract questions,
    options, answers, and explanations automatically using AI,
    and save them into a new exam chapter attached to the current user (if logged in).
    """
    # 1. Determine file type
    ext = Path(file.filename).suffix.lower()
    if ext == ".pdf":
        file_type = FileType.pdf
    elif ext == ".docx":
        file_type = FileType.docx
    elif ext == ".pptx":
        file_type = FileType.pptx
    else:
        raise HTTPException(
            status_code=400,
            detail="Định dạng file không hỗ trợ. Vui lòng tải lên file .pdf, .docx hoặc .pptx",
        )

    # 2. Determine title
    clean_title = exam_title.strip() if exam_title and exam_title.strip() else ""
    if not clean_title:
        base_name = Path(file.filename).stem
        clean_title = f"Đề thi: {base_name}"

    # 3. Create Chapter
    user_id = current_user.id if current_user else None
    chapter = Chapter(title=clean_title, order=0, user_id=user_id)
    db.add(chapter)
    db.commit()
    db.refresh(chapter)

    # 4. Save file
    safe_filename = f"exam_{chapter.id}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 5. Create Document record
    doc = Document(
        chapter_id=chapter.id,
        filename=file.filename,
        file_type=file_type,
        status=DocStatus.pending,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # 6. Parse document text
    try:
        raw_text = parse_file(file_path, file_type)
        doc.raw_text = raw_text
        doc.status = DocStatus.parsed
        db.commit()
    except Exception as e:
        doc.status = DocStatus.error
        db.commit()
        logger.error(f"Failed to parse document {file.filename}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Không thể đọc nội dung file: {str(e)}"
        )

    # 7. Extract questions with AI
    try:
        extracted_data = extract_exam_questions(raw_text)
        if not extracted_data:
            raise Exception("AI không tìm thấy câu hỏi trắc nghiệm nào trong tài liệu.")
    except Exception as e:
        logger.error(f"AI extraction failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Lỗi khi trích xuất đề thi: {str(e)}"
        )

    # 8. Save extracted questions into DB
    saved_questions: List[Question] = []
    for item in extracted_data:
        diff_str = str(item.get("difficulty", "medium")).lower()
        if diff_str not in ["easy", "medium", "hard"]:
            diff_str = "medium"

        new_q = Question(
            chapter_id=chapter.id,
            document_id=doc.id,
            question_text=item.get("question_text", "").strip(),
            options=item.get("options", {}),
            correct_option=str(item.get("correct_option", "A")).upper().strip(),
            difficulty=Difficulty(diff_str),
            brief_explanation=item.get("brief_explanation", "").strip(),
            detailed_explanation=item.get("detailed_explanation", "").strip(),
        )
        db.add(new_q)
        saved_questions.append(new_q)

    db.commit()
    for q in saved_questions:
        db.refresh(q)

    return ExamQuickCreateResponse(
        chapter_id=chapter.id,
        chapter_title=chapter.title,
        document_id=doc.id,
        document_filename=doc.filename,
        questions=[QuestionOut.model_validate(q) for q in saved_questions],
    )


@router.post("/submit-batch", response_model=ExamSubmitBatchResponse)
@router.post("/submit-batch/", response_model=ExamSubmitBatchResponse)
async def submit_exam_batch(
    req: ExamSubmitBatchRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Submit multiple questions at once (Exam Mode), evaluate answers,
    update user-specific progress (mark wrong answers), record exam attempt,
    and return full score breakdown.
    """
    total = len(req.answers)
    answered = 0
    correct = 0
    wrong = 0
    skipped = 0
    results: List[ExamAnswerResult] = []
    user_id = current_user.id if current_user else None
    attempt_chapter_id = req.chapter_id

    for item in req.answers:
        q = db.query(Question).filter(Question.id == item.question_id).first()
        if not q:
            continue

        if not attempt_chapter_id:
            attempt_chapter_id = q.chapter_id

        sel = item.selected_option.strip().upper() if item.selected_option else None
        is_answered = sel is not None and sel != ""

        if is_answered:
            answered += 1
            is_corr = sel == q.correct_option.upper()
            if is_corr:
                correct += 1
            else:
                wrong += 1

            # Update UserProgress
            prog_query = db.query(UserProgress).filter(
                UserProgress.question_id == q.id
            )
            if user_id is not None:
                prog_query = prog_query.filter(UserProgress.user_id == user_id)
            else:
                prog_query = prog_query.filter(UserProgress.user_id.is_(None))

            prog = prog_query.first()
            if not prog:
                prog = UserProgress(
                    user_id=user_id,
                    question_id=q.id,
                    is_wrong=not is_corr,
                    wrong_count=1 if not is_corr else 0,
                )
                db.add(prog)
            else:
                if not is_corr:
                    prog.is_wrong = True
                    prog.wrong_count += 1
                else:
                    prog.is_wrong = False
            db.commit()
            db.refresh(prog)
            current_wrong_count = prog.wrong_count
        else:
            skipped += 1
            is_corr = False
            # If skipped, record as wrong so it can be reviewed
            prog_query = db.query(UserProgress).filter(
                UserProgress.question_id == q.id
            )
            if user_id is not None:
                prog_query = prog_query.filter(UserProgress.user_id == user_id)
            else:
                prog_query = prog_query.filter(UserProgress.user_id.is_(None))

            prog = prog_query.first()
            if not prog:
                prog = UserProgress(
                    user_id=user_id,
                    question_id=q.id,
                    is_wrong=True,
                    wrong_count=1,
                )
                db.add(prog)
            else:
                prog.is_wrong = True
                prog.wrong_count += 1
            db.commit()
            db.refresh(prog)
            current_wrong_count = prog.wrong_count

        results.append(
            ExamAnswerResult(
                question_id=q.id,
                selected_option=sel,
                is_correct=is_corr,
                correct_option=q.correct_option,
                brief_explanation=q.brief_explanation,
                detailed_explanation=q.detailed_explanation,
                wrong_count=current_wrong_count,
            )
        )

    score = round((correct / total * 10), 1) if total > 0 else 0.0

    # Record ExamAttempt in user's history
    if attempt_chapter_id:
        attempt = ExamAttempt(
            user_id=user_id,
            chapter_id=attempt_chapter_id,
            score=score,
            total_questions=total,
            correct_count=correct,
            wrong_count=wrong,
            skipped_count=skipped,
            time_spent_seconds=req.time_spent_seconds or 0,
            mode=req.mode or "exam",
        )
        db.add(attempt)
        db.commit()

    return ExamSubmitBatchResponse(
        total_questions=total,
        answered_count=answered,
        correct_count=correct,
        wrong_count=wrong,
        skipped_count=skipped,
        score=score,
        results=results,
    )
