from sqlalchemy import Column, Integer, String, Text, ForeignKey, Enum, Boolean, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base

class FileType(str, enum.Enum):
    pdf = "pdf"
    docx = "docx"
    pptx = "pptx"

class DocStatus(str, enum.Enum):
    pending = "pending"
    parsed = "parsed"
    error = "error"

class Difficulty(str, enum.Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"

class Chapter(Base):
    __tablename__ = "chapters"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    documents = relationship("Document", back_populates="chapter", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="chapter", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_type = Column(Enum(FileType), nullable=False)
    raw_text = Column(Text, nullable=True)
    status = Column(Enum(DocStatus), default=DocStatus.pending)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    chapter = relationship("Chapter", back_populates="documents")
    summary = relationship("Summary", back_populates="document", uselist=False, cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="document", cascade="all, delete-orphan")

class Summary(Base):
    __tablename__ = "summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, unique=True)
    content_markdown = Column(Text, nullable=False)
    examples = Column(JSON, nullable=False) # JSON with internal_examples and external_examples
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    document = relationship("Document", back_populates="summary")

class Question(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    options = Column(JSON, nullable=False) # JSON with A, B, C, D
    correct_option = Column(String, nullable=False)
    difficulty = Column(Enum(Difficulty), nullable=False)
    brief_explanation = Column(Text, nullable=False)
    detailed_explanation = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    chapter = relationship("Chapter", back_populates="questions")
    document = relationship("Document", back_populates="questions")
    user_progress = relationship("UserProgress", back_populates="question", uselist=False, cascade="all, delete-orphan")

class UserProgress(Base):
    __tablename__ = "user_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, unique=True)
    is_bookmarked = Column(Boolean, default=False)
    is_wrong = Column(Boolean, default=False)
    wrong_count = Column(Integer, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    question = relationship("Question", back_populates="user_progress")
