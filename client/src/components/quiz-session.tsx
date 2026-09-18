"use client";
import { useState } from "react";
import { QuizQuestion } from "@/lib/api";
import QuizCard from "./quiz-card";

const FILTERS = [
  { label: "Tất cả", value: "all" },
  { label: "Dễ", value: "easy" },
  { label: "Trung bình", value: "medium" },
  { label: "Khó", value: "hard" },
];

export default function QuizSession({
  questions,
}: {
  questions: QuizQuestion[];
}) {
  const [filter, setFilter] = useState("all");

  const filtered =
    filter === "all"
      ? questions
      : questions.filter((q) => q.difficulty === filter);

  return (
    <div className="space-y-6">
      {/* Difficulty filter tabs */}
      <div className="flex gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-blue-600 text-white"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            {f.label}
            <span className="ml-1 text-xs opacity-70">
              ({f.value === "all"
                ? questions.length
                : questions.filter((q) => q.difficulty === f.value).length})
            </span>
          </button>
        ))}
      </div>

      {/* Progress info */}
      <div className="text-sm text-muted-foreground">
        Hiển thị {filtered.length} / {questions.length} câu hỏi
      </div>

      {/* Questions */}
      <div className="space-y-8">
        {filtered.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-lg">
            Không có câu hỏi nào ở mức độ này.
          </div>
        ) : (
          filtered.map((q, idx) => (
            <div key={q.id}>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Câu {idx + 1}/{filtered.length}
              </div>
              <QuizCard question={q} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
