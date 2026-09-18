"use client";
import { useState } from "react";
import { QuizQuestion, QuizSubmitResponse, api } from "@/lib/api";
import MarkdownRender from "./markdown-render";
import BookmarkButton from "./bookmark-button";
import { CheckCircle2, XCircle, Loader2, Send } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Dễ",
  medium: "Trung bình",
  hard: "Khó",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  hard: "bg-red-100 text-red-800",
};

export default function QuizCard({ question }: { question: QuizQuestion }) {
  const qType = question.question_type || "multiple_choice";

  // Multiple Choice State
  const [selectedMC, setSelectedMC] = useState<string | null>(null);

  // True / False State: { a: true, b: false, ... }
  const [selectedTF, setSelectedTF] = useState<Record<string, boolean>>({});

  // Short Answer State
  const [shortText, setShortText] = useState<string>("");

  // Common submission states
  const [result, setResult] = useState<QuizSubmitResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Submit Multiple Choice
  const handleMCSubmit = async (opt: string) => {
    if (result || submitting) return;
    setSelectedMC(opt);
    setSubmitting(true);
    try {
      const res = await api.submitQuiz(question.id, opt);
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit True / False
  const handleTFSubmit = async () => {
    if (result || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.submitQuiz(question.id, selectedTF);
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Short Answer
  const handleShortSubmit = async () => {
    if (result || submitting || !shortText.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.submitQuiz(question.id, shortText.trim());
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const isCorrect = result?.is_correct;

  return (
    <Card
      className={`p-6 relative transition-all border-2 ${
        result
          ? isCorrect
            ? "border-green-500 shadow-green-100 shadow-md"
            : "border-red-500 shadow-red-100 shadow-md"
          : "border-slate-200 shadow-sm"
      }`}
    >
      {/* Header: Type tag + difficulty badge + bookmark */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="text-xs px-2.5 py-1 rounded-md font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          {qType === "true_false"
            ? "Phần II: Đúng / Sai"
            : qType === "short_answer"
            ? "Phần III: Trả lời ngắn"
            : "Phần I: Trắc nghiệm"}
        </span>

        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-semibold ${
              DIFFICULTY_COLORS[question.difficulty] || ""
            }`}
          >
            {DIFFICULTY_LABELS[question.difficulty] || question.difficulty}
          </span>
          <BookmarkButton questionId={question.id} />
        </div>
      </div>

      {/* Question text */}
      <div className="mb-6 font-medium text-slate-900 leading-relaxed">
        <MarkdownRender content={question.question_text} />
      </div>

      {/* Interactive Options based on question_type */}
      {qType === "true_false" ? (
        <div className="space-y-3 mb-6">
          {Object.entries(question.options).map(([key, val]) => {
            const keyLower = key.toLowerCase();
            const currentVal = selectedTF[keyLower];
            const subRes = result?.sub_results?.[keyLower];

            let correctChoice: boolean | undefined = undefined;
            if (result?.correct_option && typeof result.correct_option === "object") {
              correctChoice = result.correct_option[keyLower] ?? result.correct_option[key];
            }

            return (
              <div
                key={key}
                className={`p-3.5 rounded-xl border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  result
                    ? subRes
                      ? "bg-green-50/40 border-green-300"
                      : "bg-red-50/30 border-red-200"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-2.5 flex-1">
                  <span className="font-bold w-6 text-slate-800 uppercase shrink-0">
                    {key})
                  </span>
                  <span className="text-slate-800 text-sm leading-relaxed">{val}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {/* True Button */}
                  <button
                    type="button"
                    disabled={!!result || submitting}
                    onClick={() =>
                      setSelectedTF((prev) => ({
                        ...prev,
                        [keyLower]: true,
                      }))
                    }
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      currentVal === true
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    Đúng
                  </button>

                  {/* False Button */}
                  <button
                    type="button"
                    disabled={!!result || submitting}
                    onClick={() =>
                      setSelectedTF((prev) => ({
                        ...prev,
                        [keyLower]: false,
                      }))
                    }
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      currentVal === false
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    Sai
                  </button>

                  {/* Feedback icon & correct answer tag if submitted */}
                  {result && (
                    <div className="flex items-center gap-1.5 ml-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        Đáp án: {correctChoice === true ? "Đúng" : correctChoice === false ? "Sai" : "—"}
                      </span>
                      {subRes ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {!result && (
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleTFSubmit}
                disabled={submitting || Object.keys(selectedTF).length === 0}
                className="gap-2 font-semibold"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Kiểm tra kết quả
              </Button>
            </div>
          )}
        </div>
      ) : qType === "short_answer" ? (
        <div className="space-y-4 mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              value={shortText}
              disabled={!!result || submitting}
              onChange={(e) => setShortText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !result && !submitting) {
                  handleShortSubmit();
                }
              }}
              placeholder="Nhập đáp án số hoặc cụm từ..."
              className="flex-1 px-4 py-2.5 rounded-lg border-2 border-slate-300 focus:border-blue-500 focus:outline-none text-slate-900 font-mono text-base disabled:bg-slate-100"
            />
            {!result && (
              <Button
                onClick={handleShortSubmit}
                disabled={submitting || !shortText.trim()}
                className="gap-2 font-semibold shrink-0"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Kiểm tra
              </Button>
            )}
          </div>

          {result && (
            <div className="p-3 bg-slate-50 border rounded-lg text-sm flex items-center justify-between">
              <span className="text-slate-600">Đáp án chuẩn từ tài liệu:</span>
              <span className="font-mono font-bold text-base px-2.5 py-0.5 rounded bg-emerald-600 text-white">
                {String(result.correct_option ?? "")}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Multiple choice A, B, C, D */
        <div className="space-y-3 mb-6">
          {Object.entries(question.options).map(([key, val]) => (
            <button
              key={key}
              onClick={() => handleMCSubmit(key)}
              disabled={!!result || submitting}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                result && key === result.correct_option
                  ? "bg-green-50 border-green-500 font-medium"
                  : result && key === selectedMC && !isCorrect
                  ? "bg-red-50 border-red-500"
                  : selectedMC === key && !result
                  ? "border-blue-500 bg-blue-50"
                  : "hover:bg-slate-50 border-slate-200"
              }`}
            >
              <span className="font-bold mr-2">{key}.</span> {val}
            </button>
          ))}
        </div>
      )}

      {/* Result feedback & explanations */}
      {result && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 border ${
            isCorrect
              ? "bg-green-50/60 text-green-950 border-green-200"
              : "bg-red-50/60 text-red-950 border-red-200"
          }`}
        >
          {isCorrect ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          )}
          <div className="space-y-1.5 flex-1">
            <p className="font-bold text-sm">
              {isCorrect ? "Chính xác! 🎉" : "Chưa chính xác"}
            </p>
            <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
              {result.detailed_explanation || result.brief_explanation}
            </p>
            {!isCorrect && (
              <span className="inline-block mt-1 text-xs bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded font-medium">
                📌 Đã lưu vào danh sách câu cần ôn lại
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
