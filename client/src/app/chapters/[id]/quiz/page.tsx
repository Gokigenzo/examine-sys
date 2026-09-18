"use client";
import { useEffect, useState, use } from "react";
import { api, QuizQuestion } from "@/lib/api";
import QuizSession from "@/components/quiz-session";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getChapterQuiz(id)
      .then((data) => {
        setQuestions(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading)
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Đang tải câu hỏi...
      </div>
    );

  if (error)
    return (
      <div className="text-center p-12 text-red-500">
        Lỗi: {error}
      </div>
    );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Quay lại
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Luyện Quiz</h1>
      </div>

      {questions.length === 0 ? (
        <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <p className="text-lg mb-2">Chưa có câu hỏi nào.</p>
          <p className="text-sm">
            Hãy tải tài liệu lên và tạo câu hỏi bằng AI trước.
          </p>
        </div>
      ) : (
        <QuizSession questions={questions} />
      )}
    </div>
  );
}
