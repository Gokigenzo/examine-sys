"""
AI Service — Hỗ trợ cả Google Gemini và Ollama local model.

Provider được chọn qua biến môi trường LLM_PROVIDER:
  - "gemini": Google Gemini API (cần GEMINI_API_KEY)
  - "ollama": Ollama local model (cần Ollama server đang chạy)
"""

import json
import os
import re
import httpx
from ..config import settings
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────
# Gemini client (lazy init)
# ──────────────────────────────────────────────────────────────────────
_gemini_client = None

FALLBACK_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
]


def _get_gemini_client():
    global _gemini_client
    if _gemini_client is not None:
        return _gemini_client

    from google import genai

    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise Exception("GEMINI_API_KEY chưa được cấu hình.")
    _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


# ──────────────────────────────────────────────────────────────────────
# JSON repair utilities
# ──────────────────────────────────────────────────────────────────────

def repair_json_string(s: str) -> str:
    """
    Repair common LLM JSON syntax anomalies:
    1. Unescaped backslashes in LaTeX math
    2. Unescaped control characters inside string literals
    3. Trailing commas before closing brackets/braces
    """
    s = s.strip()
    if s.startswith("```json"):
        s = s[7:]
    elif s.startswith("```"):
        s = s[3:]
    if s.endswith("```"):
        s = s[:-3]
    s = s.strip()

    result = []
    in_string = False
    i = 0
    n = len(s)

    while i < n:
        c = s[i]
        if not in_string:
            if c == '"':
                in_string = True
            result.append(c)
            i += 1
        else:
            if c == "\\":
                if i + 1 < n:
                    nxt = s[i + 1]
                    if nxt in ('"', "\\", "/"):
                        result.append("\\" + nxt)
                        i += 2
                    elif nxt in ("b", "f", "n", "r", "t"):
                        if i + 2 < n and s[i + 2].isalpha():
                            result.append("\\\\")
                            i += 1
                        else:
                            result.append("\\" + nxt)
                            i += 2
                    elif nxt == "u" and i + 5 < n and all(
                        ch in "0123456789abcdefABCDEF" for ch in s[i + 2 : i + 6]
                    ):
                        result.append(s[i : i + 6])
                        i += 6
                    else:
                        result.append("\\\\")
                        i += 1
                else:
                    result.append("\\\\")
                    i += 1
            elif c == '"':
                in_string = False
                result.append(c)
                i += 1
            elif c == "\n":
                result.append("\\n")
                i += 1
            elif c == "\r":
                result.append("\\r")
                i += 1
            elif c == "\t":
                result.append("\\t")
                i += 1
            else:
                result.append(c)
                i += 1

    fixed = "".join(result)
    fixed = re.sub(r",\s*([\]\}])", r"\1", fixed)
    return fixed


def parse_ai_json_response(raw_text: str) -> Any:
    """Safely parse JSON response from AI models with multiple fallback repair strategies."""
    basic = raw_text.strip()
    if basic.startswith("```json"):
        basic = basic[7:]
    elif basic.startswith("```"):
        basic = basic[3:]
    if basic.endswith("```"):
        basic = basic[:-3]
    basic = basic.strip()

    # Strategy 1: standard json.loads
    try:
        return json.loads(basic)
    except Exception:
        pass

    # Strategy 2: repaired string
    repaired = repair_json_string(raw_text)
    try:
        return json.loads(repaired)
    except Exception:
        pass

    # Strategy 3: extract outer JSON structure from repaired text
    match = re.search(r"(\[.*\]|\{.*\})", repaired, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass

    # Strategy 4: extract from basic text
    match_orig = re.search(r"(\[.*\]|\{.*\})", basic, re.DOTALL)
    if match_orig:
        try:
            return json.loads(match_orig.group(1))
        except Exception:
            pass

    return json.loads(repaired)


# ──────────────────────────────────────────────────────────────────────
# Ollama provider
# ──────────────────────────────────────────────────────────────────────

def _call_ollama(prompt: str) -> str:
    """Call Ollama API with JSON format and return the response text."""
    url = f"{settings.OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "format": "json",
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_ctx": 8192,
            "num_predict": 8192,
        },
    }

    try:
        # Ollama can be slow for long generations, use generous timeout
        with httpx.Client(timeout=300.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")
    except httpx.ConnectError:
        raise Exception(
            f"Không thể kết nối Ollama tại {settings.OLLAMA_BASE_URL}. "
            "Hãy đảm bảo Ollama đang chạy (ollama serve)."
        )
    except httpx.HTTPStatusError as e:
        raise Exception(f"Ollama API lỗi: {e.response.status_code} — {e.response.text}")
    except Exception as e:
        raise Exception(f"Lỗi khi gọi Ollama: {str(e)}")


def get_ollama_status() -> Dict[str, Any]:
    """Check Ollama server status and available models."""
    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            response.raise_for_status()
            data = response.json()
            models = [m["name"] for m in data.get("models", [])]
            return {
                "status": "online",
                "base_url": settings.OLLAMA_BASE_URL,
                "models": models,
                "active_model": settings.OLLAMA_MODEL,
                "model_available": settings.OLLAMA_MODEL in models,
            }
    except Exception as e:
        return {
            "status": "offline",
            "base_url": settings.OLLAMA_BASE_URL,
            "error": str(e),
            "models": [],
            "active_model": settings.OLLAMA_MODEL,
            "model_available": False,
        }


# ──────────────────────────────────────────────────────────────────────
# Gemini provider
# ──────────────────────────────────────────────────────────────────────

def _call_gemini(prompt: str) -> str:
    """Call Gemini API with JSON format and return the response text."""
    from google.genai import types

    client = _get_gemini_client()
    config = types.GenerateContentConfig(response_mime_type="application/json")

    candidates: List[str] = []
    if settings.GEMINI_MODEL:
        candidates.append(settings.GEMINI_MODEL)
    for m in FALLBACK_MODELS:
        if m not in candidates:
            candidates.append(m)

    last_err = None
    for model_name in candidates:
        try:
            logger.info(f"Generating with Gemini model: {model_name}")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
            return response.text
        except Exception as e:
            err_str = str(e)
            if "404" in err_str or "NOT_FOUND" in err_str or "not found" in err_str.lower():
                logger.warning(f"Model '{model_name}' not available. Trying next...")
                last_err = e
                continue
            raise e

    raise last_err or Exception("Không tìm thấy model Gemini phù hợp.")


# ──────────────────────────────────────────────────────────────────────
# Unified dispatcher
# ──────────────────────────────────────────────────────────────────────

def _generate_content(prompt: str) -> str:
    """Route to the configured LLM provider and return raw response text."""
    provider = settings.LLM_PROVIDER.lower()

    if provider == "ollama":
        logger.info(f"Using Ollama ({settings.OLLAMA_MODEL})")
        return _call_ollama(prompt)
    elif provider == "gemini":
        logger.info(f"Using Gemini ({settings.GEMINI_MODEL})")
        return _call_gemini(prompt)
    else:
        raise Exception(
            f"LLM_PROVIDER không hợp lệ: '{provider}'. Chọn 'gemini' hoặc 'ollama'."
        )


# ──────────────────────────────────────────────────────────────────────
# Public API — generate_summary, generate_quiz, extract_exam_questions
# ──────────────────────────────────────────────────────────────────────

def generate_summary(text: str) -> Dict[str, Any]:
    """Generate summary and examples from text using the configured LLM."""
    prompt = f"""Bạn là một trợ lý học tập chuyên nghiệp. Hãy đọc kỹ văn bản sau và tạo ra:
1. Tóm tắt nội dung chính (summary): Viết bằng Markdown, chia thành các phần rõ ràng với tiêu đề, sử dụng bullet points để dễ đọc. Tóm tắt phải bám sát nội dung tài liệu gốc.
2. Ví dụ nội bộ (internal_examples): Một danh sách các ví dụ thực tế hoặc minh họa được lấy TRỰC TIẾP từ trong văn bản.
3. Ví dụ bên ngoài (external_examples): Một danh sách các ví dụ thực tế HOÀN TOÀN MỚI do bạn tự nghĩ ra để minh họa cho các khái niệm trong văn bản, giúp người đọc hiểu sâu hơn.

Văn bản:
{text}

YÊU CẦU ĐẦU RA:
Trả về định dạng JSON chính xác như sau (KHÔNG thêm bất kỳ văn bản nào ngoài JSON):
{{
    "summary": "Nội dung tóm tắt định dạng markdown...",
    "internal_examples": ["ví dụ 1 từ bài", "ví dụ 2 từ bài"],
    "external_examples": ["ví dụ mới 1", "ví dụ mới 2"]
}}"""

    try:
        raw_text = _generate_content(prompt)
        return parse_ai_json_response(raw_text)
    except Exception as e:
        logger.error(f"Failed to generate summary: {str(e)}")
        raise Exception(f"Lỗi khi tạo tóm tắt: {str(e)}")


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
Trả về DUY NHẤT một MẢNG JSON (KHÔNG thêm bất kỳ văn bản nào ngoài JSON), mỗi phần tử có cấu trúc:
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
        raw_text = _generate_content(prompt)
        questions = parse_ai_json_response(raw_text)
        if not isinstance(questions, list):
            questions = [questions]
        return questions
    except Exception as e:
        logger.error(f"Failed to generate quiz: {str(e)}")
        raise Exception(f"Lỗi khi tạo câu hỏi: {str(e)}")


def _split_text_into_question_chunks(raw_text: str, chunk_size: int = 4) -> List[str]:
    """Split a full exam document into smaller groups of questions for local LLM processing."""
    # Pattern to detect question headings like: Câu 1, Câu 2:, Bài 1., Question 1, etc.
    pattern = r'(?=(?:^|\n)\s*(?:Câu|Bài|Question|CÂU|BÀI)\s*\d+[\s\.\:\-])'
    parts = [p.strip() for p in re.split(pattern, raw_text, flags=re.IGNORECASE) if p.strip()]

    # If no question markers found, or very few chunks, fallback to splitting by double newlines
    if len(parts) <= 1:
        # Check overall length
        if len(raw_text) < 3000:
            return [raw_text]
        # Split by paragraphs
        paragraphs = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
        chunks = []
        curr = []
        curr_len = 0
        for p in paragraphs:
            curr.append(p)
            curr_len += len(p)
            if curr_len >= 2000:
                chunks.append("\n\n".join(curr))
                curr = []
                curr_len = 0
        if curr:
            chunks.append("\n\n".join(curr))
        return chunks if chunks else [raw_text]

    chunks = []
    # If the first part is just header/instructions before Câu 1, prepend it to the first chunk
    start_idx = 0
    header = ""
    first_part = parts[0]
    if not re.match(r'^(?:Câu|Bài|Question|CÂU|BÀI)\s*\d+', first_part, re.IGNORECASE):
        header = first_part
        start_idx = 1

    actual_questions = parts[start_idx:]
    for i in range(0, len(actual_questions), chunk_size):
        batch = actual_questions[i : i + chunk_size]
        text_batch = "\n\n".join(batch)
        if i == 0 and header:
            text_batch = f"{header}\n\n{text_batch}"
        chunks.append(text_batch)

    return chunks if chunks else [raw_text]


def extract_exam_questions(text: str) -> List[Dict[str, Any]]:
    """
    Extract existing exam questions from a document supporting:
    1. multiple_choice: Trắc nghiệm 4 phương án lựa chọn (A, B, C, D)
    2. true_false: Trắc nghiệm Đúng / Sai (4 nhận định a, b, c, d)
    3. short_answer: Trắc nghiệm trả lời ngắn (điền số hoặc từ khóa)

    Uses intelligent chunking to ensure ALL questions (e.g. 30-50 questions) are extracted
    without being truncated by local model context window limits.
    """
    provider = settings.LLM_PROVIDER.lower()
    
    # For Ollama / local model, use smaller batch chunking to avoid skipping questions
    # For Gemini, it has a 1M token context window, but chunking also helps precision
    chunk_size = 4 if provider == "ollama" else 10
    chunks = _split_text_into_question_chunks(text, chunk_size=chunk_size)
    logger.info(f"Extracting exam questions in {len(chunks)} chunk(s) (provider={provider})...")

    all_questions: List[Dict[str, Any]] = []

    for idx, chunk in enumerate(chunks):
        logger.info(f"Processing chunk {idx + 1}/{len(chunks)} (length: {len(chunk)} chars)...")
        prompt = f"""Bạn là một chuyên gia số hóa đề thi hàng đầu theo chuẩn Bộ Giáo dục & Đào tạo Việt Nam.
Văn bản dưới đây là một phần của ĐỀ THI. 

NHIỆM VỤ CỦA BẠN:
Trích xuất TẤT CẢ các câu hỏi có trong đoạn văn bản này thành danh sách JSON.
BẮT BUỘC: Không được bỏ sót bất kỳ câu hỏi nào có trong đoạn văn bản! Nếu có 4 câu, danh sách "questions" PHẢI có đủ 4 câu!

CÁC DẠNG CÂU HỎI:
1. "multiple_choice": Trắc nghiệm 4 phương án A, B, C, D
2. "true_false": Trắc nghiệm Đúng / Sai gồm 4 nhận định a, b, c, d
3. "short_answer": Trắc nghiệm trả lời ngắn (điền số hoặc từ khóa)

Văn bản tài liệu:
{chunk}

YÊU CẦU ĐẦU RA:
Trả về DUY NHẤT một đối tượng JSON có thuộc tính "questions" là danh sách các câu hỏi đã trích xuất:
{{
  "questions": [
    {{
      "question_type": "multiple_choice",
      "context": null,
      "question_text": "Nội dung câu hỏi...",
      "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
      "correct_option": "A",
      "difficulty": "easy",
      "brief_explanation": "Giải thích ngắn...",
      "detailed_explanation": "Giải thích chi tiết..."
    }}
  ]
}}"""

        try:
            raw_text = _generate_content(prompt)
            parsed = parse_ai_json_response(raw_text)

            extracted_items = []
            if isinstance(parsed, dict):
                if "questions" in parsed and isinstance(parsed["questions"], list):
                    extracted_items = parsed["questions"]
                elif "data" in parsed and isinstance(parsed["data"], list):
                    extracted_items = parsed["data"]
                else:
                    # Single question dict
                    extracted_items = [parsed]
            elif isinstance(parsed, list):
                extracted_items = parsed

            # Filter valid questions
            for q in extracted_items:
                if isinstance(q, dict) and q.get("question_text"):
                    all_questions.append(q)

            logger.info(f"Chunk {idx + 1} extracted {len(extracted_items)} question(s). Total so far: {len(all_questions)}")
        except Exception as e:
            logger.warning(f"Error extracting questions in chunk {idx + 1}: {e}")
            continue

    # Deduplicate questions by question_text while preserving order
    seen_texts = set()
    unique_questions = []
    for q in all_questions:
        txt = q.get("question_text", "").strip()
        if txt and txt not in seen_texts:
            seen_texts.add(txt)
            unique_questions.append(q)

    logger.info(f"Finished extraction. Total unique questions extracted: {len(unique_questions)}")
    if not unique_questions:
        raise Exception("Không thể trích xuất được câu hỏi nào từ tài liệu.")

    return unique_questions
