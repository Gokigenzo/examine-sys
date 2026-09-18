const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ───────────── Types matching backend schemas ───────────── */

export interface Chapter {
  id: number;
  title: string;
  order: number;
  created_at: string;
  document_count: number;
}

export interface Document {
  id: number;
  chapter_id: number;
  filename: string;
  file_type: "pdf" | "docx" | "pptx";
  status: "pending" | "parsed" | "error";
  created_at: string;
}

export interface ExamplesSchema {
  internal_examples: string[];
  external_examples: string[];
}

export interface Summary {
  id: number;
  document_id: number;
  content_markdown: string;
  examples: ExamplesSchema;
  created_at: string;
}

export interface OptionsSchema {
  A: string;
  B: string;
  C: string;
  D: string;
}

export interface QuizQuestion {
  id: number;
  chapter_id: number;
  document_id: number;
  question_text: string;
  options: OptionsSchema;
  difficulty: "easy" | "medium" | "hard";
  correct_option?: string;
  brief_explanation?: string;
  detailed_explanation?: string;
}

export interface QuizSubmitResponse {
  is_correct: boolean;
  correct_option: string;
  brief_explanation: string;
  detailed_explanation: string;
  wrong_count: number;
}

export interface UserProgress {
  id: number;
  question_id: number;
  is_bookmarked: boolean;
  is_wrong: boolean;
  wrong_count: number;
  updated_at: string;
}

export interface PracticeWrongItem {
  question: QuizQuestion;
  progress: UserProgress;
}

/* ───────────── API Client ───────────── */

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  /* ── Chapters ── */
  getChapters: (): Promise<Chapter[]> =>
    fetchApi("/api/chapters"),

  createChapter: (title: string, order: number = 0): Promise<Chapter> =>
    fetchApi("/api/chapters", {
      method: "POST",
      body: JSON.stringify({ title, order }),
    }),

  /* ── Documents ── */
  uploadFile: async (file: File, chapterId: number): Promise<Document> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("chapter_id", String(chapterId));
    const res = await fetch(`${API_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  /* ── AI Generation ── */
  generateSummary: (documentId: number): Promise<Summary> =>
    fetchApi("/api/generate/summary", {
      method: "POST",
      body: JSON.stringify({ document_id: documentId }),
    }),

  generateQuiz: (
    documentId: number,
    numEasy: number = 5,
    numMedium: number = 3,
    numHard: number = 2
  ): Promise<{ message: string; count: number }> =>
    fetchApi("/api/generate/quiz", {
      method: "POST",
      body: JSON.stringify({
        document_id: documentId,
        num_easy: numEasy,
        num_medium: numMedium,
        num_hard: numHard,
      }),
    }),

  /* ── Learning ── */
  getChapterLearn: (chapterId: number | string): Promise<Summary[]> =>
    fetchApi(`/api/chapters/${chapterId}/learn`),

  getChapterQuiz: (
    chapterId: number | string,
    difficulty?: string
  ): Promise<QuizQuestion[]> => {
    const params = difficulty ? `?difficulty=${difficulty}` : "";
    return fetchApi(`/api/chapters/${chapterId}/quiz${params}`);
  },

  /* ── Quiz ── */
  submitQuiz: (
    questionId: number,
    selectedOption: string
  ): Promise<QuizSubmitResponse> =>
    fetchApi("/api/quiz/submit", {
      method: "POST",
      body: JSON.stringify({
        question_id: questionId,
        selected_option: selectedOption,
      }),
    }),

  toggleBookmark: (
    questionId: number
  ): Promise<{ message: string; is_bookmarked: boolean }> =>
    fetchApi("/api/quiz/bookmark", {
      method: "POST",
      body: JSON.stringify({ question_id: questionId }),
    }),

  getPracticeWrong: (): Promise<PracticeWrongItem[]> =>
    fetchApi("/api/quiz/practice-wrong"),
};
