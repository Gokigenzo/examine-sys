import { Chapter } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import Link from "next/link";
import { FileText, Book, Edit3 } from "lucide-react";

export default function ChapterList({ chapters }: { chapters: Chapter[] }) {
  if (chapters.length === 0) {
    return (
      <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-lg">
        <p className="text-lg mb-2">Chưa có chương nào.</p>
        <p className="text-sm">Nhấn &quot;Tạo chương mới&quot; để bắt đầu.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {chapters.map((chapter) => (
        <Card key={chapter.id} className="flex flex-col hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="line-clamp-2">{chapter.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="flex items-center text-muted-foreground">
              <FileText className="w-4 h-4 mr-2" />
              <span>{chapter.document_count} tài liệu</span>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link href={`/chapters/${chapter.id}/learn`}>
                <Book className="w-4 h-4 mr-2" />
                Học lý thuyết
              </Link>
            </Button>
            <Button asChild className="flex-1">
              <Link href={`/chapters/${chapter.id}/quiz`}>
                <Edit3 className="w-4 h-4 mr-2" />
                Làm bài quiz
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
