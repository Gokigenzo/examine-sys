"use client";
import { Summary } from "@/lib/api";
import MarkdownRender from "./markdown-render";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useState } from "react";
import { BookOpen, Globe } from "lucide-react";

export default function SummaryView({ summary }: { summary: Summary }) {
  const [tab, setTab] = useState<"internal" | "external">("internal");

  return (
    <div className="space-y-6">
      {/* Core theory section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Lý thuyết cốt lõi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MarkdownRender content={summary.content_markdown} />
        </CardContent>
      </Card>

      {/* Examples section with tabs */}
      <Card>
        <CardHeader>
          <div className="flex gap-4 border-b pb-2">
            <button
              className={`flex items-center gap-2 text-base font-semibold pb-2 transition-colors ${
                tab === "internal"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setTab("internal")}
            >
              <BookOpen className="w-4 h-4" />
              Ví dụ trong bài
            </button>
            <button
              className={`flex items-center gap-2 text-base font-semibold pb-2 transition-colors ${
                tab === "external"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setTab("external")}
            >
              <Globe className="w-4 h-4" />
              Ví dụ thực tế
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {tab === "internal" ? (
            <div className="space-y-4">
              {summary.examples.internal_examples.length === 0 ? (
                <p className="text-muted-foreground">Không có ví dụ trong bài.</p>
              ) : (
                summary.examples.internal_examples.map((ex, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-blue-50 rounded-lg border border-blue-100"
                  >
                    <div className="text-xs font-semibold text-blue-600 mb-1">
                      Ví dụ {idx + 1}
                    </div>
                    <MarkdownRender content={ex} />
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {summary.examples.external_examples.length === 0 ? (
                <p className="text-muted-foreground">Không có ví dụ thực tế.</p>
              ) : (
                summary.examples.external_examples.map((ex, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-amber-50 rounded-lg border border-amber-100"
                  >
                    <div className="text-xs font-semibold text-amber-600 mb-1">
                      Ví dụ thực tế {idx + 1}
                    </div>
                    <MarkdownRender content={ex} />
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
