import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from ..database import get_db
from ..models import User, UserProgress, ExamAttempt, Chapter
from ..schemas import (
    UserRegister,
    UserLogin,
    GoogleAuthRequest,
    UserOut,
    TokenResponse,
    UserDashboardStats,
    ExamAttemptOut,
)
from ..services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    verify_google_token,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/google", response_model=TokenResponse)
async def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Authenticate or auto-register a user using a verified Google ID Token.
    Returns standard system JWT token.
    """
    if not req.credential:
        raise HTTPException(
            status_code=400, detail="Thiếu Google ID Token (credential)"
        )

    # 1. Verify token with Google
    payload = verify_google_token(req.credential)
    email = payload.get("email")
    if not email:
        raise HTTPException(
            status_code=400, detail="Không thể trích xuất email từ tài khoản Google"
        )

    email_clean = email.strip().lower()
    name = payload.get("name") or email_clean.split("@")[0]
    picture = payload.get("picture")

    # 2. Check if user exists
    user = db.query(User).filter(User.email == email_clean).first()

    if not user:
        # Create new user
        user = User(
            email=email_clean,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=name,
            avatar_url=picture,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # User already exists - update avatar/name if missing
        updated = False
        if picture and not user.avatar_url:
            user.avatar_url = picture
            updated = True
        if name and (not user.full_name or user.full_name == email_clean.split("@")[0]):
            user.full_name = name
            updated = True
        if updated:
            db.commit()
            db.refresh(user)

    # 3. Generate system JWT
    token = create_access_token({"sub": str(user.id)})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=TokenResponse)
async def register(req: UserRegister, db: Session = Depends(get_db)):
    """Register a new user account and return JWT token."""
    email_clean = req.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(
            status_code=400, detail="Địa chỉ email không hợp lệ"
        )

    if len(req.password) < 6:
        raise HTTPException(
            status_code=400, detail="Mật khẩu phải chứa ít nhất 6 ký tự"
        )

    # Check existing email
    existing_user = db.query(User).filter(User.email == email_clean).first()
    if existing_user:
        raise HTTPException(
            status_code=400, detail="Email này đã được đăng ký tài khoản"
        )

    # Create user
    new_user = User(
        email=email_clean,
        hashed_password=hash_password(req.password),
        full_name=req.full_name.strip() or email_clean.split("@")[0],
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate JWT
    token = create_access_token({"sub": str(new_user.id)})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(new_user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: UserLogin, db: Session = Depends(get_db)):
    """Authenticate with email and password, return JWT token."""
    email_clean = req.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác",
        )

    token = create_access_token({"sub": str(user.id)})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get profile information of currently logged in user."""
    return UserOut.model_validate(current_user)


@router.get("/dashboard", response_model=UserDashboardStats)
async def get_user_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get personalized learning statistics and exam history for the current user.
    """
    # 1. Total exams taken
    total_exams = (
        db.query(ExamAttempt)
        .filter(ExamAttempt.user_id == current_user.id)
        .count()
    )

    # 2. Average score
    avg_score_row = (
        db.query(func.avg(ExamAttempt.score))
        .filter(ExamAttempt.user_id == current_user.id)
        .scalar()
    )
    avg_score = round(float(avg_score_row), 1) if avg_score_row is not None else 0.0

    # 3. Wrong questions count for this user
    wrong_count = (
        db.query(UserProgress)
        .filter(
            UserProgress.user_id == current_user.id,
            UserProgress.is_wrong == True,
        )
        .count()
    )

    # 4. Bookmarked questions count for this user
    bookmarked_count = (
        db.query(UserProgress)
        .filter(
            UserProgress.user_id == current_user.id,
            UserProgress.is_bookmarked == True,
        )
        .count()
    )

    # 5. Recent attempts
    recent_attempts_db = (
        db.query(ExamAttempt, Chapter.title)
        .join(Chapter, ExamAttempt.chapter_id == Chapter.id)
        .filter(ExamAttempt.user_id == current_user.id)
        .order_by(ExamAttempt.created_at.desc())
        .limit(10)
        .all()
    )

    recent_attempts = []
    for att, chap_title in recent_attempts_db:
        att_dict = {
            "id": att.id,
            "chapter_id": att.chapter_id,
            "chapter_title": chap_title,
            "score": att.score,
            "total_questions": att.total_questions,
            "correct_count": att.correct_count,
            "wrong_count": att.wrong_count,
            "skipped_count": att.skipped_count or 0,
            "time_spent_seconds": att.time_spent_seconds or 0,
            "mode": att.mode or "exam",
            "created_at": att.created_at,
        }
        recent_attempts.append(ExamAttemptOut(**att_dict))

    return UserDashboardStats(
        user=UserOut.model_validate(current_user),
        total_exams_taken=total_exams,
        average_score=avg_score,
        total_wrong_questions=wrong_count,
        total_bookmarked_questions=bookmarked_count,
        recent_attempts=recent_attempts,
    )
