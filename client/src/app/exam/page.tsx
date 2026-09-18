"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Send,
  Loader2,
  Trophy,
  Target,
  FileCheck,
  HelpCircle,
} from "lucide-react";
import {
  api,
  QuizQuestion,
  ExamAnswerResult,
  ExamSubmitBatchResponse,
  QuizSubmitResponse,
} from "@/lib/api";
import MarkdownRender from "@/components/markdown-render";
import BookmarkButton from "@/components/bookmark-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ExamPhase = "upload" | "loading" | "taking" | "review";
type ExamMode = "exam" | "practice";

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

export default function ExamPage() {
  // Phase
  const [phase, setPhase] = useState<ExamPhase>("upload");

  // Config state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [examTitle, setExamTitle] = useState("");
  const [mode, setMode] = useState<ExamMode>("exam");
  const [durationMinutes, setDurationMinutes] = useState<number>(30); // 0 = unlimited

  // Exam state
  const [chapterId, setChapterId] = useState<number | null>(null);
  const [examName, setExamName] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // User answers in exam mode: questionId -> selectedOption (e.g. 'A')
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});

  // Practice mode answers: questionId -> QuizSubmitResponse
  const [practiceResults, setPracticeResults] = useState<
    Record<number, QuizSubmitResponse>
  >({});
  const [submittingPractice, setSubmittingPractice] = useState(false);

  // Timer
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Review state
  const [batchResult, setBatchResult] =
    useState<ExamSubmitBatchResponse | null>(null);
  const [reviewFilter, setReviewFilter] = useState<
    "all" | "wrong" | "correct" | "skipped"
  >("all");
  const [submittingExam, setSubmittingExam] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>(
    "Đang đọc nội dung tài liệu..."
  );

  // Drag & drop
  const [isDragging, setIsDragging] = useState(false);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer tick
  useEffect(() => {
    if (phase !== "taking") return;

    timerRef.current = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
      if (durationMinutes > 0) {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, durationMinutes]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // ── Handle file selection ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setSelectedFile(f);
      if (!examTitle) {
        const nameWithoutExt = f.name.replace(/\.[^/.]+$/, "");
        setExamTitle(nameWithoutExt);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      setSelectedFile(f);
      if (!examTitle) {
        const nameWithoutExt = f.name.replace(/\.[^/.]+$/, "");
        setExamTitle(nameWithoutExt);
      }
    }
  };

  // ── Start upload & extraction ──
  const handleStartUploadAndCreate = async () => {
    if (!selectedFile) return;
    setPhase("loading");
    setErrorMessage(null);

    setLoadingStep("1/3. Đang tải lên và bóc tách văn bản file...");
    const timer1 = setTimeout(() => {
      setLoadingStep(
        "2/3. AI đang đọc câu hỏi, bảng đáp án và giải thích chi tiết..."
      );
    }, 3500);

    const timer2 = setTimeout(() => {
      setLoadingStep("3/3. Đang khởi tạo bộ đề và giao diện làm bài...");
    }, 12000);

    try {
      const res = await api.quickCreateExam(selectedFile, examTitle);
      clearTimeout(timer1);
      clearTimeout(timer2);

      if (!res.questions || res.questions.length === 0) {
        throw new Error(
          "Không trích xuất được câu hỏi nào từ file. Vui lòng kiểm tra lại định dạng."
        );
      }

      setChapterId(res.chapter_id);
      setExamName(res.chapter_title);
      setQuestions(res.questions);
      setCurrentIndex(0);
      setUserAnswers({});
      setPracticeResults({});
      setBatchResult(null);

      // Setup timer
      if (durationMinutes > 0) {
        setSecondsRemaining(durationMinutes * 60);
      }
      setSecondsElapsed(0);

      setPhase("taking");
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setErrorMessage(
        err.message || "Đã xảy ra lỗi trong quá trình xử lý đề thi."
      );
      setPhase("upload");
    }
  };

  // ── Answer selection ──
  const handleSelectOption = async (optionKey: string) => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    if (mode === "exam") {
      // In exam mode: update local selection map
      setUserAnswers((prev) => ({
        ...prev,
        [currentQ.id]: optionKey,
      }));
    } else {
      // In practice mode: submit immediately to get instant explanation
      if (practiceResults[currentQ.id] || submittingPractice) return;
      setSubmittingPractice(true);
      try {
        const res = await api.submitQuiz(currentQ.id, optionKey);
        setPracticeResults((prev) => ({
          ...prev,
          [currentQ.id]: res,
        }));
        setUserAnswers((prev) => ({
          ...prev,
          [currentQ.id]: optionKey,
        }));
      } catch (err) {
        console.error("Practice submit error", err);
      } finally {
        setSubmittingPractice(false);
      }
    }
  };

  // ── Submit exam (batch) ──
  const handleSubmitExam = async () => {
    const unansweredCount =
      questions.length - Object.keys(userAnswers).length;
    if (unansweredCount > 0) {
      const confirmSubmit = window.confirm(
        `Bạn còn ${unansweredCount} câu chưa làm. Bạn có chắc chắn muốn nộp bài không?`
      );
      if (!confirmSubmit) return;
    }

    if (timerRef.current) clearInterval(timerRef.current);
    setSubmittingExam(true);

    try {
      const answersPayload = questions.map((q) => ({
        question_id: q.id,
        selected_option: userAnswers[q.id] || null,
      }));

      const res = await api.submitExamBatch(
        answersPayload,
        chapterId || undefined,
        secondsElapsed,
        mode
      );
      setBatchResult(res);
      setPhase("review");
    } catch (err: any) {
      alert("Lỗi khi nộp bài: " + (err.message || "Vui lòng thử lại"));
    } finally {
      setSubmittingExam(false);
    }
  };

  const handleAutoSubmit = useCallback(async () => {
    if (phase !== "taking") return;
    alert("Hết giờ làm bài! Hệ thống đang tự động nộp bài thi của bạn.");
    const answersPayload = questions.map((q) => ({
      question_id: q.id,
      selected_option: userAnswers[q.id] || null,
    }));
    try {
      const res = await api.submitExamBatch(
        answersPayload,
        chapterId || undefined,
        secondsElapsed,
        mode
      );
      setBatchResult(res);
      setPhase("review");
    } catch (err) {
      console.error(err);
    }
  }, [phase, questions, userAnswers, chapterId, secondsElapsed, mode]);

  // ── Restart / New Exam ──
  const handleRestartExam = () => {
    setUserAnswers({});
    setPracticeResults({});
    setBatchResult(null);
    setCurrentIndex(0);
    setSecondsElapsed(0);
    if (durationMinutes > 0) {
      setSecondsRemaining(durationMinutes * 60);
    }
    setPhase("taking");
  };

  const handleNewExam = () => {
    setSelectedFile(null);
    setExamTitle("");
    setQuestions([]);
    setUserAnswers({});
    setPracticeResults({});
    setBatchResult(null);
    setPhase("upload");
  };

  // =========================================================================
  // RENDER: 1. UPLOAD PHASE
  // =========================================================================
  if (phase === "upload") {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Tính năng mới: Luyện đề tức thì
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Luyện Đề Ngay Từ File Có Sẵn
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">
            Tải lên tài liệu trắc nghiệm (.pdf, .docx) đã có sẵn câu hỏi, bảng
            đáp án và giải thích chi tiết. Hệ thống sẽ tự động bóc tách và tạo
            bài thi tương tác cho bạn làm ngay!
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
            <div>
              <p className="font-semibold">Đã xảy ra lỗi</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Upload Card */}
        <Card className="border-2 border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Tải tài liệu đề thi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                isDragging
                  ? "border-blue-500 bg-blue-50/50"
                  : selectedFile
                  ? "border-green-500 bg-green-50/30"
                  : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
              }`}
              onClick={() => document.getElementById("exam-file-input")?.click()}
            >
              <input
                id="exam-file-input"
                type="file"
                accept=".pdf,.docx,.pptx"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex flex-col items-center justify-center space-y-3">
                <div
                  className={`p-3 rounded-full ${
                    selectedFile
                      ? "bg-green-100 text-green-600"
                      : "bg-blue-100 text-blue-600"
                  }`}
                >
                  {selectedFile ? (
                    <FileCheck className="w-8 h-8" />
                  ) : (
                    <Upload className="w-8 h-8" />
                  )}
                </div>
                {selectedFile ? (
                  <div>
                    <p className="font-semibold text-slate-800">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB •
                      Nhấn để đổi file khác
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-slate-700">
                      Kéo thả file đề thi vào đây, hoặc nhấn để duyệt file
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Hỗ trợ PDF, Word (.docx), PowerPoint (.pptx)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Exam Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tên bài thi / Đề thi (tùy chọn)
              </label>
              <input
                type="text"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="VD: Đề ôn tập Kiến trúc máy tính - Chương 4"
                className="w-full px-3.5 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Mode selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Chế độ luyện đề
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode("exam")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    mode === "exam"
                      ? "border-blue-600 bg-blue-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-slate-900 mb-1">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Chế độ Thi thử (Exam Mode)
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Làm toàn bộ đề, có đồng hồ đếm ngược, ẩn đáp án. Khi nộp
                    bài mới chấm điểm và xem giải thích chi tiết.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("practice")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    mode === "practice"
                      ? "border-blue-600 bg-blue-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-slate-900 mb-1">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    Luyện tập tức thì (Practice Mode)
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Chọn phương án là biết ngay Đúng/Sai và đọc ngay giải
                    thích chi tiết trích xuất từ đề thi cho từng câu.
                  </p>
                </button>
              </div>
            </div>

            {/* Duration (if exam mode) */}
            {mode === "exam" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Thời gian làm bài
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[15, 30, 45, 60, 0].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDurationMinutes(mins)}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                        durationMinutes === mins
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {mins === 0 ? "Không giới hạn" : `${mins} phút`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Submit button */}
            <Button
              onClick={handleStartUploadAndCreate}
              disabled={!selectedFile}
              className="w-full py-6 text-base font-semibold shadow-md"
            >
              <FileCheck className="w-5 h-5 mr-2" />
              Bắt đầu tạo & làm đề ngay
            </Button>
          </CardContent>
        </Card>

        {/* Feature highlight box */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-2 text-sm">
              1
            </div>
            <h4 className="font-semibold text-sm text-slate-800">
              Giữ nguyên 100% đề gốc
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              AI đọc chính xác câu hỏi và 4 phương án A, B, C, D từ file của
              bạn.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-2 text-sm">
              2
            </div>
            <h4 className="font-semibold text-sm text-slate-800">
              Khớp bảng đáp án & lời giải
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Tự động đối chiếu bảng đáp án và trích xuất nguyên vẹn giải
              thích từng câu.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2 text-sm">
              3
            </div>
            <h4 className="font-semibold text-sm text-slate-800">
              Tự động lưu câu sai
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Các câu làm sai hoặc đánh dấu sao sẽ tự động đưa vào mục Ôn
              luyện để làm lại.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: 2. LOADING PHASE
  // =========================================================================
  if (phase === "loading") {
    return (
      <div className="max-w-md mx-auto my-20 p-8 text-center bg-white rounded-2xl border-2 border-slate-100 shadow-xl space-y-6">
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-pulse"></div>
          <div className="w-20 h-20 rounded-full border-4 border-blue-600 border-t-transparent animate-spin flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-blue-600 animate-bounce" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">
            Đang bóc tách đề thi bằng AI
          </h2>
          <p className="text-sm text-blue-600 font-medium animate-pulse">
            {loadingStep}
          </p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto pt-2">
            AI đang đồng bộ danh sách câu hỏi với bảng đáp án và giải thích chi
            tiết trong tài liệu của bạn...
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: 3. TAKING EXAM PHASE
  // =========================================================================
  if (phase === "taking") {
    const currentQ = questions[currentIndex];
    const answeredCount = Object.keys(userAnswers).length;
    const isAnswered = currentQ ? userAnswers[currentQ.id] !== undefined : false;
    const practiceRes = currentQ ? practiceResults[currentQ.id] : null;

    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-16">
        {/* Top Sticky Bar */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b px-4 py-3 rounded-xl shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Bạn có muốn hủy bài thi này và quay về trang tải đề?"
                  )
                ) {
                  setPhase("upload");
                }
              }}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
              title="Thoát"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="truncate">
              <h2 className="font-bold text-slate-900 truncate text-base">
                {examName}
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{questions.length} câu</span>
                <span>•</span>
                <span
                  className={`font-medium ${
                    mode === "exam" ? "text-blue-600" : "text-amber-600"
                  }`}
                >
                  {mode === "exam" ? "Thi thử" : "Luyện tập tức thì"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Timer */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-sm ${
                durationMinutes > 0 && secondsRemaining < 300
                  ? "bg-red-100 text-red-700 animate-pulse"
                  : "bg-slate-100 text-slate-800"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>
                {durationMinutes > 0
                  ? formatTime(secondsRemaining)
                  : formatTime(secondsElapsed)}
              </span>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmitExam}
              disabled={submittingExam}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4"
            >
              {submittingExam ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Send className="w-4 h-4 mr-1.5" />
              )}
              Nộp bài ({answeredCount}/{questions.length})
            </Button>
          </div>
        </div>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Current Question Area (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {currentQ && (
              <Card className="p-6 sm:p-8 relative shadow-sm border-2 border-slate-200">
                {/* Card header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-blue-600">
                      Câu {currentIndex + 1}
                    </span>
                    <span className="text-xs text-slate-400">/ {questions.length}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                        DIFFICULTY_COLORS[currentQ.difficulty] || ""
                      }`}
                    >
                      {DIFFICULTY_LABELS[currentQ.difficulty] ||
                        currentQ.difficulty}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <BookmarkButton questionId={currentQ.id} />
                  </div>
                </div>

                {/* Question text */}
                <div className="mb-8 text-slate-900 text-base sm:text-lg leading-relaxed">
                  <MarkdownRender content={currentQ.question_text} />
                </div>

                {/* Options */}
                <div className="space-y-3 mb-6">
                  {Object.entries(currentQ.options).map(([optKey, optVal]) => {
                    const isSelected = userAnswers[currentQ.id] === optKey;

                    // In practice mode with result:
                    let optionStyle =
                      "border-slate-200 hover:border-slate-300 hover:bg-slate-50/70";
                    if (mode === "practice" && practiceRes) {
                      if (optKey === practiceRes.correct_option) {
                        optionStyle =
                          "bg-green-50 border-green-500 font-semibold text-green-900";
                      } else if (isSelected && !practiceRes.is_correct) {
                        optionStyle =
                          "bg-red-50 border-red-500 text-red-900";
                      }
                    } else if (isSelected) {
                      optionStyle =
                        "border-blue-600 bg-blue-50/70 font-semibold text-blue-950 shadow-sm";
                    }

                    return (
                      <button
                        key={optKey}
                        onClick={() => handleSelectOption(optKey)}
                        disabled={
                          mode === "practice" &&
                          (!!practiceRes || submittingPractice)
                        }
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3.5 ${optionStyle}`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {optKey}
                        </span>
                        <span className="pt-0.5 text-sm sm:text-base leading-relaxed">
                          {optVal}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Instant Feedback in Practice Mode */}
                {mode === "practice" && practiceRes && (
                  <div
                    className={`p-5 rounded-xl border mt-6 flex items-start gap-3.5 ${
                      practiceRes.is_correct
                        ? "bg-green-50/90 border-green-300 text-green-950"
                        : "bg-red-50/90 border-red-300 text-red-950"
                    }`}
                  >
                    {practiceRes.is_correct ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-2 text-sm">
                      <div className="font-bold text-base flex items-center gap-2">
                        {practiceRes.is_correct
                          ? "Chính xác! 🎉"
                          : `Chưa đúng. Đáp án đúng là ${practiceRes.correct_option}`}
                      </div>
                      <div className="leading-relaxed whitespace-pre-wrap">
                        {practiceRes.detailed_explanation ||
                          practiceRes.brief_explanation}
                      </div>
                      {!practiceRes.is_correct && (
                        <div className="inline-block px-2.5 py-1 bg-red-200/70 text-red-900 text-xs font-medium rounded-md mt-1">
                          📌 Đã tự động lưu vào mục Ôn luyện
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Bottom Navigation */}
                <div className="flex items-center justify-between pt-6 mt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
                    disabled={currentIndex === 0}
                    className="text-slate-700"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                    Câu trước
                  </Button>

                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    Nhấn vào các số bên phải để chuyển nhanh
                  </span>

                  {currentIndex < questions.length - 1 ? (
                    <Button
                      onClick={() =>
                        setCurrentIndex((p) =>
                          Math.min(questions.length - 1, p + 1)
                        )
                      }
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Câu tiếp theo
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmitExam}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Hoàn thành & Nộp bài
                      <Send className="w-4 h-4 ml-1.5" />
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Right: Question Palette / Navigator (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="p-5 shadow-sm border-2 border-slate-200">
              <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center justify-between">
                <span>Bảng câu hỏi</span>
                <span className="text-xs text-blue-600 font-semibold">
                  {answeredCount}/{questions.length} đã làm
                </span>
              </h3>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(answeredCount / questions.length) * 100}%`,
                  }}
                ></div>
              </div>

              {/* Palette Grid */}
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-[360px] overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const isCur = idx === currentIndex;
                  const isAns = userAnswers[q.id] !== undefined;
                  const pRes = practiceResults[q.id];

                  let btnStyle = "bg-slate-100 text-slate-700 hover:bg-slate-200";
                  if (mode === "practice" && pRes) {
                    btnStyle = pRes.is_correct
                      ? "bg-green-100 text-green-800 border-green-400"
                      : "bg-red-100 text-red-800 border-red-400";
                  } else if (isAns) {
                    btnStyle = "bg-blue-600 text-white font-bold";
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-10 rounded-lg text-xs font-semibold transition-all border ${btnStyle} ${
                        isCur ? "ring-2 ring-blue-500 ring-offset-2" : ""
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-5 pt-4 border-t space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-blue-600 inline-block"></span>
                  <span>Đã trả lời</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-slate-100 border inline-block"></span>
                  <span>Chưa trả lời</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded ring-2 ring-blue-500 ring-offset-1 bg-white border inline-block"></span>
                  <span>Đang xem</span>
                </div>
              </div>

              {/* Big Submit Button */}
              <Button
                onClick={handleSubmitExam}
                disabled={submittingExam}
                className="w-full mt-5 py-5 font-semibold bg-blue-600 hover:bg-blue-700"
              >
                {submittingExam ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Nộp bài & Chấm điểm
              </Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: 4. REVIEW / RESULT PHASE
  // =========================================================================
  if (phase === "review" && batchResult) {
    const filteredResults = batchResult.results.filter((r) => {
      if (reviewFilter === "wrong") return !r.is_correct && r.selected_option;
      if (reviewFilter === "correct") return r.is_correct;
      if (reviewFilter === "skipped") return !r.selected_option;
      return true;
    });

    const isPassed = batchResult.score >= 5.0;

    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-16">
        {/* Score Banner */}
        <Card className="overflow-hidden border-2 border-slate-200 shadow-md">
          <div
            className={`p-8 text-center text-white ${
              isPassed
                ? "bg-gradient-to-r from-blue-600 to-indigo-600"
                : "bg-gradient-to-r from-slate-700 to-slate-900"
            }`}
          >
            <div className="inline-flex p-3 bg-white/10 rounded-full mb-3">
              <Trophy className="w-10 h-10 text-yellow-300" />
            </div>
            <h1 className="text-3xl font-extrabold mb-1">Kết Quả Bài Thi</h1>
            <p className="text-blue-100 text-sm">{examName}</p>

            <div className="mt-6 flex items-baseline justify-center gap-1">
              <span className="text-6xl font-black tracking-tight">
                {batchResult.score}
              </span>
              <span className="text-2xl font-semibold opacity-75">/ 10</span>
            </div>
            <p className="mt-2 text-sm font-medium">
              {isPassed
                ? "🎉 Chúc mừng! Bạn đã hoàn thành xuất sắc bài thi!"
                : "💪 Tiếp tục cố gắng nhé! Hãy ôn lại các câu sai bên dưới."}
            </p>
          </div>

          {/* Metric Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 bg-slate-50/50">
            <div className="p-4 text-center">
              <div className="text-xs text-muted-foreground font-medium uppercase">
                Số câu đúng
              </div>
              <div className="text-2xl font-bold text-green-600 mt-1">
                {batchResult.correct_count}
              </div>
              <div className="text-xs text-muted-foreground">
                / {batchResult.total_questions} câu
              </div>
            </div>
            <div className="p-4 text-center">
              <div className="text-xs text-muted-foreground font-medium uppercase">
                Số câu sai
              </div>
              <div className="text-2xl font-bold text-red-600 mt-1">
                {batchResult.wrong_count}
              </div>
              <div className="text-xs text-red-500 font-medium">
                Đã lưu ôn luyện
              </div>
            </div>
            <div className="p-4 text-center">
              <div className="text-xs text-muted-foreground font-medium uppercase">
                Bỏ qua
              </div>
              <div className="text-2xl font-bold text-slate-600 mt-1">
                {batchResult.skipped_count}
              </div>
              <div className="text-xs text-muted-foreground">Chưa chọn</div>
            </div>
            <div className="p-4 text-center">
              <div className="text-xs text-muted-foreground font-medium uppercase">
                Thời gian làm
              </div>
              <div className="text-2xl font-bold text-slate-800 mt-1">
                {formatTime(secondsElapsed)}
              </div>
              <div className="text-xs text-muted-foreground">Phút : Giây</div>
            </div>
          </div>
        </Card>

        {/* Action Controls */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRestartExam}
              className="gap-1.5"
            >
              <RotateCcw className="w-4 h-4" /> Làm lại đề này
            </Button>
            <Button
              variant="outline"
              onClick={handleNewExam}
              className="gap-1.5"
            >
              <Upload className="w-4 h-4" /> Tải đề khác
            </Button>
          </div>

          <Link href="/practice">
            <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-sm font-semibold">
              <Target className="w-4 h-4" />
              Luyện lại câu sai trong phòng Ôn Luyện ({batchResult.wrong_count})
            </Button>
          </Link>
        </div>

        {/* Question Review Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Xem lại chi tiết bài làm & Lời giải
            </h3>

            {/* Filter Pills */}
            <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setReviewFilter("all")}
                className={`px-3 py-1 rounded-md transition-all ${
                  reviewFilter === "all"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tất cả ({batchResult.results.length})
              </button>
              <button
                onClick={() => setReviewFilter("wrong")}
                className={`px-3 py-1 rounded-md transition-all ${
                  reviewFilter === "wrong"
                    ? "bg-white text-red-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Sai ({batchResult.wrong_count})
              </button>
              <button
                onClick={() => setReviewFilter("correct")}
                className={`px-3 py-1 rounded-md transition-all ${
                  reviewFilter === "correct"
                    ? "bg-white text-green-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Đúng ({batchResult.correct_count})
              </button>
            </div>
          </div>

          {/* List of questions with answers and detailed explanations */}
          <div className="space-y-6">
            {filteredResults.map((item, idx) => {
              const originalQ = questions.find((q) => q.id === item.question_id);
              if (!originalQ) return null;

              return (
                <Card
                  key={item.question_id}
                  className={`p-6 border-2 transition-all ${
                    item.is_correct
                      ? "border-green-300 bg-green-50/10"
                      : "border-red-300 bg-red-50/10"
                  }`}
                >
                  {/* Question header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        Câu {idx + 1}
                      </span>
                      {item.is_correct ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đúng
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-100 text-red-800 px-2 py-0.5 rounded">
                          <XCircle className="w-3.5 h-3.5" /> Chưa đúng
                        </span>
                      )}
                    </div>
                    <BookmarkButton questionId={item.question_id} />
                  </div>

                  {/* Question content */}
                  <div className="mb-5 text-slate-900 leading-relaxed font-medium">
                    <MarkdownRender content={originalQ.question_text} />
                  </div>

                  {/* Options */}
                  <div className="space-y-2 mb-6">
                    {Object.entries(originalQ.options).map(([optKey, optVal]) => {
                      const isCorrectOpt = optKey === item.correct_option;
                      const isUserSelected = optKey === item.selected_option;

                      let rowClass = "border-slate-200 bg-white";
                      if (isCorrectOpt) {
                        rowClass =
                          "border-green-500 bg-green-50 font-semibold text-green-900";
                      } else if (isUserSelected && !item.is_correct) {
                        rowClass =
                          "border-red-500 bg-red-50 text-red-900 line-through opacity-85";
                      }

                      return (
                        <div
                          key={optKey}
                          className={`p-3 rounded-lg border-2 text-sm flex items-start gap-2.5 ${rowClass}`}
                        >
                          <span className="font-bold w-6 text-center">
                            {optKey}.
                          </span>
                          <span className="flex-1">{optVal}</span>
                          {isCorrectOpt && (
                            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-bold">
                              Đáp án đúng
                            </span>
                          )}
                          {isUserSelected && !isCorrectOpt && (
                            <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded font-bold">
                              Bạn đã chọn
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Detailed Explanation from file */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm space-y-1.5">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      Hướng dẫn giải thích chi tiết bám sát nội dung bài học:
                    </div>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {item.detailed_explanation || item.brief_explanation}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
