"use client";
import { useEffect, useState } from "react";
import UploadZone from "@/components/upload-zone";
import { api, Chapter, Document as DocType } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, FileQuestion } from "lucide-react";

export default function UploadPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<number | "">("");
  const [uploadedDoc, setUploadedDoc] = useState<DocType | null>(null);
  const [generatingSum, setGeneratingSum] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.getChapters().then(setChapters).catch(console.error);
  }, []);

  const handleUploadSuccess = (doc: DocType) => {
    setUploadedDoc(doc);
    setMessage(null);
  };

  const handleGenerateSummary = async () => {
    if (!uploadedDoc) return;
    setGeneratingSum(true);
    try {
      await api.generateSummary(uploadedDoc.id);
      setMessage("✅ Tạo tóm tắt thành công!");
    } catch (e: any) {
      setMessage(`❌ Lỗi: ${e.message}`);
    }
    setGeneratingSum(false);
  };

  const handleGenerateQuiz = async () => {
    if (!uploadedDoc) return;
    setGeneratingQuiz(true);
    try {
      const res = await api.generateQuiz(uploadedDoc.id);
      setMessage(`✅ Đã tạo ${res.count} câu hỏi thành công!`);
    } catch (e: any) {
      setMessage(`❌ Lỗi: ${e.message}`);
    }
    setGeneratingQuiz(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Tải lên tài liệu</h1>

      {/* Chapter selector */}
      <Card>
        <CardHeader>
          <CardTitle>Chọn chương</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedChapter}
            onChange={(e) =>
              setSelectedChapter(
                e.target.value ? Number(e.target.value) : ""
              )
            }
          >
            <option value="">-- Chọn chương --</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Upload zone */}
      {selectedChapter !== "" && (
        <Card>
          <CardHeader>
            <CardTitle>Tải file</CardTitle>
          </CardHeader>
          <CardContent>
            <UploadZone
              chapterId={selectedChapter}
              onSuccess={handleUploadSuccess}
            />
          </CardContent>
        </Card>
      )}

      {/* AI generation options */}
      {uploadedDoc && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              Tạo nội dung bằng AI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tài liệu <strong>{uploadedDoc.filename}</strong> đã được xử lý.
              Chọn chức năng bên dưới:
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleGenerateSummary}
                disabled={generatingSum}
                variant="outline"
              >
                {generatingSum ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Tạo tóm tắt lý thuyết
              </Button>
              <Button
                onClick={handleGenerateQuiz}
                disabled={generatingQuiz}
              >
                {generatingQuiz ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <FileQuestion className="w-4 h-4 mr-2" />
                )}
                Tạo câu hỏi trắc nghiệm
              </Button>
            </div>
            {message && (
              <p className="text-sm font-medium mt-2">{message}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
