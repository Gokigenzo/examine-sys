from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Document, Chapter, DocStatus, FileType
from ..schemas import DocumentOut
from ..services.parser import parse_file
from ..config import settings
import shutil
import os
from pathlib import Path

router = APIRouter(prefix="/api/upload", tags=["Documents"])

@router.post("", response_model=DocumentOut)
async def upload_document(
    chapter_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Check if chapter exists
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
        
    # Determine file type
    ext = Path(file.filename).suffix.lower()
    if ext == ".pdf":
        file_type = FileType.pdf
    elif ext == ".docx":
        file_type = FileType.docx
    elif ext == ".pptx":
        file_type = FileType.pptx
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format")
        
    # Save file
    safe_filename = f"{chapter_id}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Create DB record
    new_doc = Document(
        chapter_id=chapter_id,
        filename=file.filename,
        file_type=file_type,
        status=DocStatus.pending
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    
    # Parse text
    try:
        raw_text = parse_file(file_path, file_type)
        new_doc.raw_text = raw_text
        new_doc.status = DocStatus.parsed
    except Exception as e:
        new_doc.status = DocStatus.error
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to parse document: {str(e)}")
        
    db.commit()
    db.refresh(new_doc)
    return new_doc
