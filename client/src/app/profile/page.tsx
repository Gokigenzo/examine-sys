"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { api, UserDashboardStats } from "@/lib/api";
import Link from "next/link";
import {
  User as UserIcon,
  Trophy,
  Target,
  Clock,
  BookOpen,
  Calendar,
  Sparkles,
  Loader2,
  LogIn,
  AlertCircle,
  FileCheck,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [stats, setStats] = useState<UserDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    api
      .getDashboard()
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "Không thể tải dữ liệu tiến độ.");
      })
      .finally(() => setLoading(false));
  }, [user]);

  // Loading state
  if (authLoading || (user && loading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-muted-foreground">Đang tải hồ sơ học tập...</p>
      </div>
    );
  }

  // Not logged in view
  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 text-center space-y-6">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto">
          <UserIcon className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">
            Hồ Sơ & Tiến Độ Học Tập
          </h1>
          <p className="text-sm text-muted-foreground">
            Đăng nhập để theo dõi bảng điểm, lịch sử luyện đề và danh sách các
            câu hỏi cần ôn tập của riêng bạn.
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/login" className="flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              Đăng nhập ngay
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Quay về trang chủ</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header Profile Card */}
      <Card className="border-2 border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 border-2 border-white/40 rounded-full flex items-center justify-center text-2xl sm:text-3xl font-black text-white shadow-inner">
              {user.full_name ? user.full_name[0].toUpperCase() : "U"}
            </div>
            <div className="space-y-1 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold">
                {user.full_name}
              </h1>
              <p className="text-blue-100 text-sm">{user.email}</p>
              <p className="text-xs text-blue-200/90 flex items-center justify-center sm:justify-start gap-1">
                <Calendar className="w-3.5 h-3.5" /> Thành viên từ{" "}
                {new Date(user.created_at).toLocaleDateString("vi-VN")}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={logout}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs sm:text-sm"
            >
              Đăng xuất
            </Button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 bg-slate-50/70">
          <div className="p-5 text-center">
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Số bài đã luyện
            </div>
            <div className="text-3xl font-black text-slate-900 mt-1.5 flex items-center justify-center gap-1.5">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {stats?.total_exams_taken ?? 0}
            </div>
          </div>

          <div className="p-5 text-center">
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Điểm trung bình
            </div>
            <div className="text-3xl font-black text-blue-600 mt-1.5">
              {stats?.average_score ?? 0}
              <span className="text-xs font-semibold text-slate-400">/10</span>
            </div>
          </div>

          <div className="p-5 text-center">
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Câu cần ôn lại
            </div>
            <div className="text-3xl font-black text-red-600 mt-1.5 flex items-center justify-center gap-1.5">
              <Target className="w-5 h-5 text-red-500" />
              {stats?.total_wrong_questions ?? 0}
            </div>
          </div>

          <div className="p-5 text-center">
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Câu đánh dấu
            </div>
            <div className="text-3xl font-black text-amber-600 mt-1.5 flex items-center justify-center gap-1.5">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              {stats?.total_bookmarked_questions ?? 0}
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Action Banner */}
      <div className="flex flex-wrap gap-4 items-center justify-between p-5 bg-blue-50/60 border border-blue-200 rounded-2xl">
        <div className="space-y-0.5">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Sẵn sàng nâng cao điểm số của bạn?
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            Luyện thêm các đề kiểm tra mới hoặc ôn lại danh sách câu bạn từng làm sai.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 shadow-sm">
            <Link href="/exam" className="flex items-center gap-1.5">
              <FileCheck className="w-4 h-4" />
              Luyện đề mới
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="border-blue-300">
            <Link href="/practice" className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-red-600" />
              Vào phòng Ôn luyện ({stats?.total_wrong_questions ?? 0})
            </Link>
          </Button>
        </div>
      </div>

      {/* Recent Exam Attempts Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          Lịch sử các bài thi gần đây
        </h2>

        {stats?.recent_attempts && stats.recent_attempts.length > 0 ? (
          <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Tên đề thi</th>
                    <th className="px-5 py-3.5">Điểm số</th>
                    <th className="px-5 py-3.5">Kết quả</th>
                    <th className="px-5 py-3.5">Chế độ</th>
                    <th className="px-5 py-3.5">Thời gian</th>
                    <th className="px-5 py-3.5">Ngày làm</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {stats.recent_attempts.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {att.chapter_title || `Đề thi #${att.chapter_id}`}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`font-black text-base ${
                            att.score >= 5.0 ? "text-blue-600" : "text-red-600"
                          }`}
                        >
                          {att.score}
                        </span>
                        <span className="text-xs text-slate-400">/10</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-green-600 font-semibold">
                          {att.correct_count} đúng
                        </span>{" "}
                        •{" "}
                        <span className="text-red-500 font-semibold">
                          {att.wrong_count} sai
                        </span>
                        {att.skipped_count > 0 && (
                          <span className="text-slate-400">
                            {" "}
                            • {att.skipped_count} bỏ qua
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            att.mode === "exam"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {att.mode === "exam" ? "Thi thử" : "Luyện tập"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {Math.floor(att.time_spent_seconds / 60)}p{" "}
                        {att.time_spent_seconds % 60}s
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {new Date(att.created_at).toLocaleString("vi-VN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <Card className="p-10 text-center text-muted-foreground border-dashed">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-medium text-slate-700">Bạn chưa làm bài kiểm tra nào.</p>
            <p className="text-xs mt-1">
              Hãy bấm "Luyện đề ngay" để tải tài liệu lên và bắt đầu bài thi đầu tiên!
            </p>
            <Button asChild size="sm" className="mt-4 bg-blue-600 hover:bg-blue-700">
              <Link href="/exam">Bắt đầu làm bài ngay</Link>
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
