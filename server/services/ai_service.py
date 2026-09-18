from google import genai
from google.genai import types
import json
import os
import re
from ..config import settings
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# Fallback model list if the requested model is not found or deprecated
FALLBACK_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
]

_client = None


def get_client() -> genai.Client:
    """Get or lazily initialize the Gemini client."""
    global _client
    if _client is not None:
        return _client

    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise Exception("GEMINI_API_KEY chưa được cấu hình. Vui lòng thêm key trên hệ thống.")

    _client = genai.Client(api_key=api_key)
    return _client


def _clean_json_text(text: str) -> str:
    """Strip markdown code fence if present in model response."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def _generate_with_fallback(prompt: str, config: types.GenerateContentConfig) -> str:
    """Attempt content generation with candidate models, falling back on 404 / not found."""
    client = get_client()

    candidates: List[str] = []
    if settings.GEMINI_MODEL:
        candidates.append(settings.GEMINI_MODEL)
    for m in FALLBACK_MODELS:
        if m not in candidates:
            candidates.append(m)

    last_err = None
    for model_name in candidates:
        try:
            logger.info(f"Generating content with model: {model_name}")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
            return response.text
        except Exception as e:
            err_str = str(e)
            # Check if this error is due to model not found / unsupported version
            if "404" in err_str or "NOT_FOUND" in err_str or "not found" in err_str.lower():
                logger.warning(f"Model '{model_name}' not available ({err_str}). Trying next model candidate...")
                last_err = e
                continue
            # For other errors (e.g. quota, auth), raise immediately
            raise e

    raise last_err or Exception("Không tìm thấy model Gemini phù hợp để tạo nội dung.")


def generate_summary(text: str) -> Dict[str, Any]:
    """Generate summary and examples from text using Gemini."""
    prompt = f"""Bạn là một trợ lý học tập chuyên nghiệp. Hãy đọc kỹ văn bản sau và tạo ra:
1. Tóm tắt nội dung chính (summary): Viết bằng Markdown, chia thành các phần rõ ràng với tiêu đề, sử dụng bullet points để dễ đọc. Tóm tắt phải bám sát nội dung tài liệu gốc.
2. Ví dụ nội bộ (internal_examples): Một danh sách các ví dụ thực tế hoặc minh họa được lấy TRỰC TIẾP từ trong văn bản.
3. Ví dụ bên ngoài (external_examples): Một danh sách các ví dụ thực tế HOÀN TOÀN MỚI do bạn tự nghĩ ra để minh họa cho các khái niệm trong văn bản, giúp người đọc hiểu sâu hơn.

Văn bản:
{text}

YÊU CẦU ĐẦU RA:
Trả về định dạng JSON chính xác như sau:
{{
    "summary": "Nội dung tóm tắt định dạng markdown...",
    "internal_examples": ["ví dụ 1 từ bài", "ví dụ 2 từ bài"],
    "external_examples": ["ví dụ mới 1", "ví dụ mới 2"]
}}"""

    try:
        raw_text = _generate_with_fallback(
            prompt=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        return json.loads(_clean_json_text(raw_text))
    except Exception as e:
        logger.error(f"Failed to generate summary: {str(e)}")
        raise Exception(f"Lỗi khi gọi API AI: {str(e)}")


def generate_quiz(
    text: str, num_easy: int, num_medium: int, num_hard: int
) -> List[Dict[str, Any]]:
    """Generate quiz questions from text based on difficulty counts."""
    total_questions = num_easy + num_medium + num_hard

    prompt = f"""Bạn là một chuyên gia ra đề thi trắc nghiệm. Dựa vào văn bản dưới đây, hãy tạo ra {total_questions} câu hỏi trắc nghiệm chất lượng cao.

Yêu cầu số lượng theo độ khó:
- {num_easy} câu Dễ (easy) — Mức Nhận biết/Hiểu: kiểm tra kiến thức cơ bản, định nghĩa, khái niệm.
- {num_medium} câu Trung bình (medium) — Mức Vận dụng: áp dụng kiến thức vào tình huống cụ thể.
- {num_hard} câu Khó (hard) — Mức Vận dụng cao: phân tích, so sánh, tổng hợp kiến thức phức tạp.

Mỗi câu hỏi PHẢI có đầy đủ:
- question_text: Nội dung câu hỏi rõ ràng, không mơ hồ.
- options: Đúng 4 đáp án A, B, C, D. Các đáp án sai phải hợp lý và dễ nhầm lẫn.
- correct_option: Đáp án đúng (A, B, C hoặc D).
- difficulty: Độ khó (easy, medium, hoặc hard).
- brief_explanation: Giải thích ngắn gọn (1-2 câu) tại sao đáp án đó đúng. Hiển thị khi người dùng trả lời đúng.
- detailed_explanation: Giải thích chi tiết (3-5 câu), phân tích tại sao các phương án sai là sai, liên hệ với lý thuyết. Hiển thị khi người dùng trả lời sai.

Văn bản:
{text}

YÊU CẦU ĐẦU RA:
Trả về một MẢNG JSON, mỗi phần tử có cấu trúc:
{{
    "question_text": "...",
    "options": {{
        "A": "...",
        "B": "...",
        "C": "...",
        "D": "..."
    }},
    "correct_option": "A",
    "difficulty": "easy",
    "brief_explanation": "...",
    "detailed_explanation": "..."
}}"""

    try:
        raw_text = _generate_with_fallback(
            prompt=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        questions = json.loads(_clean_json_text(raw_text))
        if not isinstance(questions, list):
            questions = [questions]
        return questions
    except Exception as e:
        logger.error(f"Failed to generate quiz: {str(e)}")
        raise Exception(f"Lỗi khi tạo câu hỏi: {str(e)}")


def extract_exam_questions(text: str) -> List[Dict[str, Any]]:
    """
    Extract existing exam questions, options, correct answers, and explanations
    directly from a document that already contains an exam test.
    """
    prompt = f"""Bạn là một chuyên gia xử lý và số hóa đề thi.
Văn bản dưới đây là một ĐỀ THI TRẮC NGHIỆM ĐÃ CÓ SẴN (bao gồm danh sách câu hỏi, các lựa chọn A, B, C, D, và phần bảng đáp án / lời giải thích chi tiết ở cuối hoặc kèm theo mỗi câu).

Nhiệm vụ của bạn là TRÍCH XUẤT NGUYÊN VẸN toàn bộ các câu hỏi từ tài liệu thành cấu trúc dữ liệu JSON chuẩn:
1. question_text: Nội dung câu hỏi chính xác từ bài (bỏ tiền tố 'Câu 1:', 'Câu 2:' nếu có).
2. options: Dictionary 4 phương án {{"A": "...", "B": "...", "C": "...", "D": "..."}}.
3. correct_option: Đáp án đúng chính xác (A, B, C hoặc D) được tra cứu từ "Bảng đáp án", "Đáp án nhanh", hoặc phần giải thích trong tài liệu.
4. difficulty: Ước lượng độ khó ("easy", "medium", hoặc "hard") dựa trên nội dung câu hỏi.
5. brief_explanation: Tóm tắt ngắn gọn lý do chọn đáp án này (1-2 câu).
6. detailed_explanation: Lời giải thích chi tiết được lấy TRỰC TIẾP từ mục "Hướng dẫn giải thích chi tiết" hoặc "Giải thích" trong tài liệu (bao gồm cả trích dẫn Slide, giáo trình nếu tài liệu có ghi). Nếu tài liệu không có giải thích cho câu đó, hãy tự giải thích chi tiết dựa vào ngữ cảnh bài học.

Văn bản tài liệu:
{text}

YÊU CẦU ĐẦU RA:
Trả về một MẢNG JSON các câu hỏi (không thêm văn bản ngoài JSON):
[
  {{
    "question_text": "Nội dung câu hỏi...",
    "options": {{
      "A": "...",
      "B": "...",
      "C": "...",
      "D": "..."
    }},
    "correct_option": "A",
    "difficulty": "medium",
    "brief_explanation": "Giải thích ngắn gọn...",
    "detailed_explanation": "Giải thích chi tiết trích xuất từ tài liệu..."
  }}
]"""

    try:
        raw_text = _generate_with_fallback(
            prompt=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        questions = json.loads(_clean_json_text(raw_text))
        if not isinstance(questions, list):
            questions = [questions]
        return questions
    except Exception as e:
        logger.error(f"Failed to extract exam questions: {str(e)}")
        raise Exception(f"Lỗi khi trích xuất đề thi: {str(e)}")

