from google import genai
from google.genai import types
import json
from ..config import settings
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# Configure Gemini client
client = None
if settings.GEMINI_API_KEY:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
else:
    logger.warning("GEMINI_API_KEY is not set. AI services will fail.")

MODEL_NAME = "gemini-1.5-flash"


def generate_summary(text: str) -> Dict[str, Any]:
    """Generate summary and examples from text using Gemini."""
    if not client:
        raise Exception("GEMINI_API_KEY chưa được cấu hình.")

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
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        logger.error(f"Failed to generate summary: {str(e)}")
        raise Exception(f"Lỗi khi gọi API AI: {str(e)}")


def generate_quiz(
    text: str, num_easy: int, num_medium: int, num_hard: int
) -> List[Dict[str, Any]]:
    """Generate quiz questions from text based on difficulty counts."""
    if not client:
        raise Exception("GEMINI_API_KEY chưa được cấu hình.")

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
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        questions = json.loads(response.text)
        if not isinstance(questions, list):
            questions = [questions]
        return questions
    except Exception as e:
        logger.error(f"Failed to generate quiz: {str(e)}")
        raise Exception(f"Lỗi khi tạo câu hỏi: {str(e)}")
