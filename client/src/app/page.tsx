"use client";
import { useEffect, useState } from "react";
import { api, Chapter } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import ChapterList from "@/components/chapter-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Target, BookOpen, AlertTriangle, Loader2, FileCheck, Upload, User as UserIcon } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const { user } = useAuth();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const loadChapters = () => {
    api
      .getChapters()
      .then((data) => {
        setChapters(data);
        setLoading(false);
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadChapters();
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await api.createChapter(newTitle.trim(), chapters.length);
      setNewTitle("");
      setShowCreate(false);
      loadChapters();
    } catch (e) {
      console.error(e);
    }
    setCreating(false);
  };

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-50 -mx-4 px-4 py-12 mb-8 rounded-b-3xl shadow-sm text-center">
        {user && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold mb-4">
            <UserIcon className="w-3.5 h-3.5" />
            Xin chào, {user.full_name}! Chúc bạn học tập hiệu quả hôm nay.
          </div>
        )}
        <h1 className="text-4xl font-bold text-blue-900 mb-4">
          Chào mừng đến với Luyện Thi Thông Minh
        </h1>
        <p className="text-lg text-blue-700 max-w-2xl mx-auto">
          Nền tảng học tập ứng dụng AI giúp bạn tóm tắt lý thuyết tự động và
          tạo bài tập luyện thi thông minh từ tài liệu của bạn.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-md text-white">
            <a href="/exam" className="flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Luyện đề ngay (Từ file có sẵn)
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="bg-white/80 border-blue-200 text-blue-900 hover:bg-white">
            <a href="/upload" className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Tải tài liệu theo chương
            </a>
          </Button>
        </div>
      </section>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng số chương</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{chapters.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng tài liệu</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {chapters.reduce((sum, c) => sum + c.document_count, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ôn luyện</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <a href="/practice">Xem câu cần luyện →</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Chapter header + create */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Chương trình học</h2>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Tạo chương mới
        </Button>
      </div>

      {/* Create chapter form */}
      {showCreate && (
        <Card className="p-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Tên chương mới..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Tạo"
              )}
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Hủy
            </Button>
          </div>
        </Card>
      )}

      {/* Chapter list */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Đang tải...
        </div>
      ) : (
        <ChapterList chapters={chapters} />
      )}
    </div>
  );
}
