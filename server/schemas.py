from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from .models import FileType, DocStatus, Difficulty


# ───────────── Auth Schemas ───────────── #

class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ───────────── Chapter Schemas ───────────── #

class ChapterBase(BaseModel):
    title: str
    order: Optional[int] = 0


class ChapterCreate(ChapterBase):
    pass


class ChapterOut(ChapterBase):
    id: int
    user_id: Optional[int] = None
    created_at: datetime
    document_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ───────────── Document Schemas ───────────── #

class DocumentBase(BaseModel):
    filename: str
    file_type: FileType
    chapter_id: int


class DocumentCreate(DocumentBase):
    pass


class DocumentOut(DocumentBase):
    id: int
    status: DocStatus
    created_at: datetime

    class Config:
        from_attributes = True


# ───────────── Summary Schemas ───────────── #

class ExamplesSchema(BaseModel):
    internal_examples: List[str]
    external_examples: List[str]


class SummaryOut(BaseModel):
    id: int
    document_id: int
    content_markdown: str
    examples: ExamplesSchema
    created_at: datetime

    class Config:
        from_attributes = True


# ───────────── Question & Quiz Schemas ───────────── #

class OptionsSchema(BaseModel):
    A: str
    B: str
    C: str
    D: str


class QuestionOut(BaseModel):
    id: int
    chapter_id: int
    document_id: int
    question_text: str
    options: OptionsSchema
    difficulty: Difficulty

    class Config:
        from_attributes = True


class QuizSubmitRequest(BaseModel):
    question_id: int
    selected_option: str


class QuizSubmitResponse(BaseModel):
    is_correct: bool
    correct_option: str
    brief_explanation: str
    detailed_explanation: str
    wrong_count: int


class QuizGenerateRequest(BaseModel):
    document_id: int
    num_easy: int = 5
    num_medium: int = 3
    num_hard: int = 2


class UserProgressOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    question_id: int
    is_bookmarked: bool
    is_wrong: bool
    wrong_count: int
    updated_at: datetime

    class Config:
        from_attributes = True


class PracticeWrongOut(BaseModel):
    question: QuestionOut
    progress: UserProgressOut


# ───────────── Exam & Learning History Schemas ───────────── #

class ExamAnswerItem(BaseModel):
    question_id: int
    selected_option: Optional[str] = None


class ExamSubmitBatchRequest(BaseModel):
    answers: List[ExamAnswerItem]
    chapter_id: Optional[int] = None
    time_spent_seconds: Optional[int] = 0
    mode: Optional[str] = "exam"


class ExamAnswerResult(BaseModel):
    question_id: int
    selected_option: Optional[str]
    is_correct: bool
    correct_option: str
    brief_explanation: str
    detailed_explanation: str
    wrong_count: int


class ExamSubmitBatchResponse(BaseModel):
    total_questions: int
    answered_count: int
    correct_count: int
    wrong_count: int
    skipped_count: int
    score: float
    results: List[ExamAnswerResult]


class ExamQuickCreateResponse(BaseModel):
    chapter_id: int
    chapter_title: str
    document_id: int
    document_filename: str
    questions: List[QuestionOut]


class ExamAttemptOut(BaseModel):
    id: int
    chapter_id: int
    chapter_title: Optional[str] = None
    score: float
    total_questions: int
    correct_count: int
    wrong_count: int
    skipped_count: int
    time_spent_seconds: int
    mode: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserDashboardStats(BaseModel):
    user: UserOut
    total_exams_taken: int
    average_score: float
    total_wrong_questions: int
    total_bookmarked_questions: int
    recent_attempts: List[ExamAttemptOut]
