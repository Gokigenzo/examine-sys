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
    Extract existing exam questions from a document supporting 3 modern Vietnamese exam types:
    1. multiple_choice: Trắc nghiệm 4 phương án lựa chọn (A, B, C, D)
    2. true_false: Trắc nghiệm Đúng / Sai (4 nhận định a, b, c, d)
    3. short_answer: Trắc nghiệm trả lời ngắn (điền số hoặc từ khóa)
    With FULL preservation of shared context/passages for clustered questions ("câu hỏi chùm").
    """
    prompt = f"""Bạn là một chuyên gia số hóa đề thi hàng đầu theo chuẩn Bộ Giáo dục & Đào tạo Việt Nam (chương trình GDPT 2018 mới nhất).
Văn bản dưới đây là một ĐỀ THI (bao gồm danh sách câu hỏi, các lựa chọn, bảng nhận định Đúng/Sai, câu hỏi trả lời ngắn, và phần bảng đáp án / lời giải thích chi tiết ở cuối hoặc kèm theo mỗi câu).

NHIỆM VỤ CỦA BẠN:
Trích xuất toàn bộ các câu hỏi từ tài liệu thành cấu trúc dữ liệu JSON chuẩn, phân loại chính xác 3 dạng câu hỏi và BẮT BUỘC TUÂN THỦ CÁC QUY TẮC SAU:

======================================================================
⭐ QUY TẮC BẮT BUỘC 1: BẢO TOÀN ĐẦY ĐỦ NGỮ CẢNH CHO "CÂU HỎI CHÙM" (SHARED CONTEXT / PASSAGE)
======================================================================
- Trong các đề thi (đặc biệt là Phần II Đúng/Sai, Phần III Trả lời ngắn, hoặc bài đọc hiểu Phần I), rất thường xuyên xuất hiện các "CÂU HỎI CHÙM" dùng chung một đoạn văn bản dữ kiện chung phía trước, ví dụ:
  "Sử dụng dữ kiện sau để trả lời cho câu 1 và câu 2: Trong một cuộc tập luyện chạy Marathon, người ta ước tính 'nữ hoàng chân đất' Phạm Thị Bình... tiêu tốn khoảng E = 2,52 . 10^6 calo... nhiệt hoá hơi L = 2,4 . 10^6 J/kg...
  Câu 1. Phần năng lượng chuyển thành nhiệt...
  Câu 2. Có khoảng bao nhiêu lít nước đã thoát ra ngoài cơ thể của cô...?"
  hoặc "Dựa vào thông tin sau đây để trả lời câu 3, câu 4: ..."
  hoặc "Đọc đoạn trích sau và trả lời các câu hỏi từ 1 đến 5: ..."

- YÊU CẦU BẮT BUỘC:
  1. TẤT CẢ các câu hỏi thuộc cùng chùm đó (cả Câu 1, Câu 2, Câu 3...) PHẢI ĐƯỢC GIỮ NGUYÊN VẸN ĐOẠN DỮ KIỆN CHUNG ĐÓ.
  2. TUYỆT ĐỐI KHÔNG ĐƯỢC LƯỢC BỎ dữ kiện chung.
  3. TUYỆT ĐỐI KHÔNG ĐƯỢC chỉ đưa dữ kiện vào câu đầu tiên rồi bỏ qua ở các câu tiếp theo! (Nếu câu 2 bị mất dữ kiện chung, thí sinh sẽ không có số liệu E, L, D... để tính toán).
  4. CÁCH TRÌNH BÀY TRONG `question_text` KHI CÓ DỮ KIỆN CHUNG:
     Bắt đầu bằng Markdown blockquote `> ` chứa toàn bộ phần dữ kiện chung, sau đó xuống dòng và ghi nội dung câu hỏi cụ thể:

     > **Dữ kiện chung:**
     > [Toàn bộ nội dung dữ kiện chung, đoạn trích, bảng số liệu, các thông số của bài toán...]

     **Câu hỏi:** [Nội dung yêu cầu tính toán / câu hỏi cụ thể]

  5. Đồng thời, ghi đoạn dữ kiện chung đó vào trường `"context"` của câu hỏi. Nếu là câu hỏi đơn lẻ không có dữ kiện chung thì để `"context": null`.

======================================================================
⭐ QUY TẮC BẮT BUỘC 2: CHUẨN HÓA CÔNG THỨC TOÁN - VẬT LÝ - HÓA HỌC
======================================================================
- Sửa triệt để các lỗi trích xuất ký tự OCR từ file:
  * Ví dụ: `10!` hoặc `106` trong công thức vật lý thực chất là lỗi hiển thị của số mũ 10^6. Phải chuẩn hóa thành `$10^6$` hoặc `10^6`.
  * Bao bọc tất cả công thức toán, lý, hóa trong ký hiệu LaTeX `$ ... $`, ví dụ: `$x \\cdot 10^6\\text{{ J}}$`, `$E = 2,52 \\cdot 10^6\\text{{ cal}}$`, `$L = 2,4 \\cdot 10^6\\text{{ J/kg}}$`, `$D = 1,0 \\cdot 10^3\\text{{ kg/m}}^3$`, `$25^\\circ\\text{{C}}$`, `$H_2SO_4$`.

======================================================================
⭐ CÁC DẠNG CÂU HỎI:
======================================================================
1. Dạng 1: "multiple_choice" (Trắc nghiệm nhiều lựa chọn - 4 phương án A, B, C, D):
   - question_type: "multiple_choice"
   - context: Đoạn dữ kiện chung nếu có (hoặc null).
   - question_text: Nội dung câu hỏi (chứa blockquote dữ kiện chung nếu thuộc câu chùm).
   - options: {{"A": "...", "B": "...", "C": "...", "D": "..."}}
   - correct_option: "A", "B", "C" hoặc "D" (tra cứu từ bảng đáp án hoặc lời giải).
   - brief_explanation: Tóm tắt ngắn gọn lý do chọn đáp án này.
   - detailed_explanation: Lời giải chi tiết từ tài liệu.

2. Dạng 2: "true_false" (Trắc nghiệm Đúng / Sai gồm 4 nhận định a, b, c, d):
   - question_type: "true_false"
   - context: Đoạn dữ kiện chung/ngữ cảnh bài toán nếu có (hoặc null).
   - question_text: Nội dung phần dẫn/bối cảnh của câu hỏi (chứa blockquote dữ kiện chung nếu thuộc câu chùm).
   - options: {{"a": "Nhận định a", "b": "Nhận định b", "c": "Nhận định c", "d": "Nhận định d"}}
   - correct_option: {{"a": true/false, "b": true/false, "c": true/false, "d": true/false}} (true = Đúng, false = Sai).
   - brief_explanation: Tóm tắt kết quả (ví dụ: "a-Đúng, b-Sai, c-Đúng, d-Sai").
   - detailed_explanation: Lời giải chi tiết giải thích rõ vì sao từng ý a, b, c, d là Đúng hay Sai.

3. Dạng 3: "short_answer" (Trắc nghiệm trả lời ngắn):
   - question_type: "short_answer"
   - context: Đoạn dữ kiện bài toán nếu thuộc câu chùm (hoặc null).
   - question_text: Chứa blockquote dữ kiện chung và yêu cầu tính toán cụ thể.
   - options: {{}} (object rỗng).
   - correct_option: Giá trị kết quả chính xác (dạng chuỗi, ví dụ: "6.32" hoặc "15").
   - brief_explanation: Kết quả đáp án ngắn gọn kèm đơn vị.
   - detailed_explanation: Các bước tính toán chi tiết dẫn đến kết quả.

Văn bản tài liệu:
{text}

YÊU CẦU ĐẦU RA:
Trả về DUY NHẤT một MẢNG JSON các câu hỏi (không thêm văn bản ngoài JSON):
[
  {{
    "question_type": "short_answer",
    "context": "Trong một cuộc tập luyện chạy Marathon, người ta ước tính 'nữ hoàng chân đất' Phạm Thị Bình...",
    "question_text": "> **Dữ kiện chung:**\\n> Trong một cuộc tập luyện chạy Marathon, người ta ước tính 'nữ hoàng chân đất' Phạm Thị Bình của Việt Nam tiêu tốn khoảng $E = 2,52 \\cdot 10^6$ calo...\\n\\n**Câu hỏi:** Phần năng lượng chuyển thành nhiệt cho cuộc tập luyện này là $x \\cdot 10^6$ J. Tìm x (làm tròn kết quả đến chữ số hàng phần trăm).",
    "options": {{}},
    "correct_option": "6.32",
    "difficulty": "hard",
    "brief_explanation": "x = 6.32",
    "detailed_explanation": "..."
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

