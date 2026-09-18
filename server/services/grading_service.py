import json
from typing import Any, Dict, Optional, Tuple


def evaluate_question_answer(
    question_type: str,
    correct_option_raw: str,
    user_answer: Any,
) -> Tuple[bool, Optional[Dict[str, bool]], float]:
    """
    Evaluates user answer against the question's correct answer.
    Returns:
        (is_correct: bool, sub_results: Optional[Dict[str, bool]], score_ratio: float)
    """
    if user_answer is None or user_answer == "":
        return False, None, 0.0

    q_type = str(question_type or "multiple_choice").lower().strip()

    # 1. Multiple Choice (4 options: A, B, C, D)
    if q_type == "multiple_choice":
        corr = str(correct_option_raw or "A").strip().upper()
        sel = str(user_answer).strip().upper()
        is_corr = (sel == corr)
        return is_corr, None, 1.0 if is_corr else 0.0

    # 2. True / False (4 statements: a, b, c, d)
    elif q_type == "true_false":
        # Parse correct options dict
        correct_map: Dict[str, bool] = {}
        if isinstance(correct_option_raw, dict):
            correct_map = {str(k).lower(): bool(v) for k, v in correct_option_raw.items()}
        else:
            try:
                parsed = json.loads(str(correct_option_raw))
                if isinstance(parsed, dict):
                    correct_map = {str(k).lower(): bool(v) for k, v in parsed.items()}
            except Exception:
                # Fallback format like "a:T,b:F" or "Đ,S,Đ,S"
                parts = str(correct_option_raw).replace(" ", "").split(",")
                for i, p in enumerate(parts):
                    key = chr(ord('a') + i)
                    val = True if any(x in p.lower() for x in ["t", "đ", "true", "1"]) else False
                    correct_map[key] = val

        # Parse user answer dict
        user_map: Dict[str, bool] = {}
        if isinstance(user_answer, dict):
            user_map = {str(k).lower(): bool(v) for k, v in user_answer.items()}
        else:
            try:
                parsed = json.loads(str(user_answer))
                if isinstance(parsed, dict):
                    user_map = {str(k).lower(): bool(v) for k, v in parsed.items()}
            except Exception:
                pass

        sub_results: Dict[str, bool] = {}
        correct_sub_count = 0
        total_subs = len(correct_map) if correct_map else 4

        for k in ["a", "b", "c", "d"]:
            if k in correct_map:
                is_sub_corr = (user_map.get(k) == correct_map[k])
                sub_results[k] = is_sub_corr
                if is_sub_corr:
                    correct_sub_count += 1

        # Ministry GDPT 2018 True/False scoring scale:
        # 1 correct = 0.1, 2 = 0.25, 3 = 0.5, 4 = 1.0
        score_scale = {1: 0.1, 2: 0.25, 3: 0.5, 4: 1.0}
        score_ratio = score_scale.get(correct_sub_count, 0.0)
        is_all_correct = (correct_sub_count == total_subs and total_subs > 0)

        return is_all_correct, sub_results, score_ratio

    # 3. Short Answer (numerical or short text)
    elif q_type == "short_answer":
        corr_str = str(correct_option_raw or "").strip()
        user_str = str(user_answer or "").strip()

        # Normalize numbers (e.g. 6,32 -> 6.32)
        corr_norm = corr_str.replace(",", ".").replace(" ", "").lower()
        user_norm = user_str.replace(",", ".").replace(" ", "").lower()

        # Try float comparison
        try:
            val_user = float(user_norm)
            val_corr = float(corr_norm)
            # Allow small rounding tolerance: 0.02
            is_corr = abs(val_user - val_corr) <= 0.02
            return is_corr, None, 1.0 if is_corr else 0.0
        except ValueError:
            # Fallback to string comparison
            is_corr = (user_norm == corr_norm)
            return is_corr, None, 1.0 if is_corr else 0.0

    return False, None, 0.0
