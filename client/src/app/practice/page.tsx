"use client";
import { useEffect, useState } from "react";
import { api, PracticeWrongItem, QuizQuestion } from "@/lib/api";
import QuizCard from "@/components/quiz-card";
import { Loader2, RotateCcw, Star } from "lucide-react";

export default function PracticePage() {
  const [items, setItems] = useState<PracticeWrongItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"wrong" | "bookmarked">("wrong");

  useEffect(() => {
    setLoading(true);
    api
      .getPracticeWrong()
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const wrongQuestions = items
    .filter((item) => item.progress.is_wrong)
    .map((item) => item.question);

  const bookmarkedQuestions = items
    .filter((item) => item.progress.is_bookmarked)
    .map((item) => item.question);

  const displayedQuestions =
    tab === "wrong" ? wrongQuestions : bookmarkedQuestions;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Ôn luyện</h1>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={`flex items-center gap-2 py-3 px-4 font-semibold transition-colors ${
            tab === "wrong"
              ? "text-red-600 border-b-2 border-red-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setTab("wrong")}
        >
          <RotateCcw className="w-4 h-4" />
          Câu đã làm sai
          <span className="ml-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            {wrongQuestions.length}
          </span>
        </button>
        <button
          className={`flex items-center gap-2 py-3 px-4 font-semibold transition-colors ${
            tab === "bookmarked"
              ? "text-yellow-600 border-b-2 border-yellow-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setTab("bookmarked")}
        >
          <Star className="w-4 h-4" />
          Câu đã đánh dấu
          <span className="ml-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
            {bookmarkedQuestions.length}
          </span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Đang tải...
        </div>
      ) : displayedQuestions.length === 0 ? (
        <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-lg">
          {tab === "wrong" ? (
            <>
              <p className="text-lg mb-2">🎉 Không có câu sai!</p>
              <p className="text-sm">Bạn đang làm rất tốt!</p>
            </>
          ) : (
            <>
              <p className="text-lg mb-2">Chưa có câu nào được đánh dấu.</p>
              <p className="text-sm">
                Nhấn ⭐ khi làm quiz để đánh dấu câu cần ôn tập.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {displayedQuestions.map((q, idx) => (
            <div key={q.id}>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Câu {idx + 1}/{displayedQuestions.length}
              </div>
              <QuizCard question={q} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
