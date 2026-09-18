from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from .models import FileType, DocStatus, Difficulty

class ChapterBase(BaseModel):
    title: str
    order: Optional[int] = 0

class ChapterCreate(ChapterBase):
    pass

class ChapterOut(ChapterBase):
    id: int
    created_at: datetime
    document_count: Optional[int] = 0
    
    class Config:
        from_attributes = True

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
    # Exclude correct_option and explanations when just serving questions to learn
    
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
