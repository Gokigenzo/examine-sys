"use client";
import { useState } from "react";
import { QuizQuestion, QuizSubmitResponse, api } from "@/lib/api";
import MarkdownRender from "./markdown-render";
import BookmarkButton from "./bookmark-button";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card } from "./ui/card";

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
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<QuizSubmitResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (opt: string) => {
    if (result || submitting) return;
    setSelected(opt);
    setSubmitting(true);
    try {
      const res = await api.submitQuiz(question.id, opt);
      setResult(res);
    } catch (e) {
      console.error(e);
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
          : "border-transparent"
      }`}
    >
      {/* Header: difficulty badge + bookmark */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span
          className={`px-2 py-1 rounded text-xs font-semibold ${
            DIFFICULTY_COLORS[question.difficulty] || ""
          }`}
        >
          {DIFFICULTY_LABELS[question.difficulty] || question.difficulty}
        </span>
        <BookmarkButton questionId={question.id} />
      </div>

      {/* Question text */}
      <div className="mb-6 pr-28">
        <MarkdownRender content={question.question_text} />
      </div>

      {/* Options A/B/C/D */}
      <div className="space-y-3 mb-6">
        {Object.entries(question.options).map(([key, val]) => (
          <button
            key={key}
            onClick={() => handleSubmit(key)}
            disabled={!!result || submitting}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              result && key === result.correct_option
                ? "bg-green-50 border-green-500 font-medium"
                : result && key === selected && !isCorrect
                ? "bg-red-50 border-red-500"
                : selected === key && !result
                ? "border-blue-500 bg-blue-50"
                : "hover:bg-slate-50 border-slate-200"
            }`}
          >
            <span className="font-bold mr-2">{key}.</span> {val}
          </button>
        ))}
      </div>

      {/* Result feedback */}
      {result && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${
            isCorrect
              ? "bg-green-50 text-green-900"
              : "bg-red-50 text-red-900"
          }`}
        >
          {isCorrect ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <p className="font-bold mb-1">
              {isCorrect ? "Chính xác! 🎉" : "Chưa chính xác"}
            </p>
            <p className="text-sm leading-relaxed">
              {isCorrect
                ? result.brief_explanation
                : result.detailed_explanation}
            </p>
            {!isCorrect && (
              <span className="inline-block mt-2 text-xs bg-red-200 text-red-900 px-2 py-1 rounded font-medium">
                📌 Đã lưu vào câu cần luyện lại
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
