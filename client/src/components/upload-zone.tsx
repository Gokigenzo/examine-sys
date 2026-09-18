"use client";
import { useState } from "react";
import { UploadCloud, File, CheckCircle2 } from "lucide-react";
import { api, Document as DocType } from "@/lib/api";
import { Button } from "./ui/button";

export default function UploadZone({
  chapterId,
  onSuccess,
}: {
  chapterId: number;
  onSuccess?: (doc: DocType) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ACCEPTED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];
  const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx"];

  const validateFile = (f: File): boolean => {
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError("Chỉ chấp nhận file PDF, DOCX hoặc PPTX");
      return false;
    }
    setError(null);
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (validateFile(f)) setFile(f);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (validateFile(f)) setFile(f);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const doc = await api.uploadFile(file, chapterId);
      setSuccess(true);
      onSuccess?.(doc);
    } catch (err: any) {
      setError(err.message || "Upload thất bại");
    }
    setUploading(false);
  };

  if (success) {
    return (
      <div className="text-center p-8 border-2 border-dashed border-green-300 rounded-lg bg-green-50">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-green-700 mb-2">
          Tải lên thành công!
        </h3>
        <p className="text-sm text-green-600 mb-4">
          File <strong>{file?.name}</strong> đã được xử lý.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setSuccess(false);
            setFile(null);
          }}
        >
          Tải thêm file khác
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 hover:bg-slate-50"
        }`}
      >
        <UploadCloud
          className={`w-12 h-12 mx-auto mb-4 ${
            dragOver ? "text-blue-500" : "text-slate-400"
          }`}
        />
        <h3 className="text-lg font-semibold mb-2">Kéo thả file vào đây</h3>
        <p className="text-sm text-slate-500 mb-6">
          Hỗ trợ PDF, DOCX, PPTX
        </p>

        <input
          type="file"
          id="fileUpload"
          className="hidden"
          accept=".pdf,.docx,.pptx"
          onChange={handleFileChange}
        />
        <Button asChild variant="outline">
          <label htmlFor="fileUpload" className="cursor-pointer">
            Chọn file từ máy tính
          </label>
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-500 mt-2">{error}</p>
      )}

      {file && !success && (
        <div className="mt-4 flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
          <div className="flex items-center">
            <File className="w-5 h-5 text-blue-500 mr-2" />
            <div>
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-xs text-muted-foreground ml-2">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          </div>
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? "Đang tải..." : "Tải lên"}
          </Button>
        </div>
      )}
    </div>
  );
}
