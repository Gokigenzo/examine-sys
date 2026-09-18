"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import { api } from "@/lib/api";

export default function BookmarkButton({
  questionId,
  initial = false,
}: {
  questionId: number;
  initial?: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initial);

  const toggle = async () => {
    const prev = bookmarked;
    setBookmarked(!prev); // optimistic update
    try {
      const res = await api.toggleBookmark(questionId);
      setBookmarked(res.is_bookmarked);
    } catch {
      setBookmarked(prev); // revert on error
    }
  };

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-full hover:bg-slate-100 transition-colors"
      title={bookmarked ? "Bỏ đánh dấu" : "Đánh dấu ôn tập"}
    >
      <Star
        className={`w-5 h-5 transition-colors ${
          bookmarked
            ? "fill-yellow-400 text-yellow-400"
            : "text-slate-400 hover:text-yellow-400"
        }`}
      />
    </button>
  );
}
