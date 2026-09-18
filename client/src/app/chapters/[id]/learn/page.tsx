"use client";
import { useEffect, useState, use } from "react";
import { api, Summary } from "@/lib/api";
import SummaryView from "@/components/summary-view";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function LearnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getChapterLearn(id)
      .then((data) => {
        setSummaries(data);
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
        Đang tải nội dung...
      </div>
    );

  if (error)
    return (
      <div className="text-center p-12 text-red-500">
        Lỗi: {error}
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Quay lại
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Học lý thuyết</h1>
      </div>

      {summaries.length === 0 ? (
        <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <p className="text-lg mb-2">Chưa có tóm tắt lý thuyết nào.</p>
          <p className="text-sm">
            Hãy tải tài liệu lên và tạo tóm tắt bằng AI trước.
          </p>
        </div>
      ) : (
        summaries.map((summary, idx) => (
          <div key={summary.id} className="space-y-4">
            {summaries.length > 1 && (
              <h2 className="text-xl font-bold text-blue-900">
                Phần {idx + 1}
              </h2>
            )}
            <SummaryView summary={summary} />
          </div>
        ))
      )}
    </div>
  );
}
