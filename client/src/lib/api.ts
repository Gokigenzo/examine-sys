const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ───────────── Auth Token Management ───────────── */

const TOKEN_KEY = "examine_sys_auth_token";

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setAuthToken = (token: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeAuthToken = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
};

/* ───────────── Types matching backend schemas ───────────── */

export interface User {
  id: number;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Chapter {
  id: number;
  user_id?: number | null;
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
  user_id?: number | null;
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

export interface ExamAnswerResult {
  question_id: number;
  selected_option: string | null;
  is_correct: boolean;
  correct_option: string;
  brief_explanation: string;
  detailed_explanation: string;
  wrong_count: number;
}

export interface ExamSubmitBatchResponse {
  total_questions: number;
  answered_count: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  score: number;
  results: ExamAnswerResult[];
}

export interface ExamQuickCreateResponse {
  chapter_id: number;
  chapter_title: string;
  document_id: number;
  document_filename: string;
  questions: QuizQuestion[];
}

export interface ExamAttempt {
  id: number;
  chapter_id: number;
  chapter_title?: string | null;
  score: number;
  total_questions: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  time_spent_seconds: number;
  mode: string;
  created_at: string;
}

export interface UserDashboardStats {
  user: User;
  total_exams_taken: number;
  average_score: number;
  total_wrong_questions: number;
  total_bookmarked_questions: number;
  recent_attempts: ExamAttempt[];
}

/* ───────────── API Client ───────────── */

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  /* ── Authentication ── */
  register: async (
    email: string,
    password: string,
    fullName: string
  ): Promise<TokenResponse> => {
    const res = await fetchApi<TokenResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    if (res.access_token) {
      setAuthToken(res.access_token);
    }
    return res;
  },

  login: async (email: string, password: string): Promise<TokenResponse> => {
    const res = await fetchApi<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (res.access_token) {
      setAuthToken(res.access_token);
    }
    return res;
  },

  getMe: (): Promise<User> => fetchApi("/api/auth/me"),

  getDashboard: (): Promise<UserDashboardStats> =>
    fetchApi("/api/auth/dashboard"),

  logout: (): void => {
    removeAuthToken();
  },

  /* ── Chapters ── */
  getChapters: (): Promise<Chapter[]> => fetchApi("/api/chapters"),

  createChapter: (title: string, order: number = 0): Promise<Chapter> =>
    fetchApi("/api/chapters", {
      method: "POST",
      body: JSON.stringify({ title, order }),
    }),

  /* ── Documents ── */
  uploadFile: async (file: File, chapterId: number): Promise<Document> => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("chapter_id", String(chapterId));

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}/api/upload`, {
      method: "POST",
      body: formData,
      headers,
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

  /* ── Exam Mode ── */
  quickCreateExam: async (
    file: File,
    examTitle?: string
  ): Promise<ExamQuickCreateResponse> => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append("file", file);
    if (examTitle) {
      formData.append("exam_title", examTitle);
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}/api/exam/quick-create`, {
      method: "POST",
      body: formData,
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Không thể tải lên và trích xuất đề thi");
    }
    return res.json();
  },

  submitExamBatch: (
    answers: { question_id: number; selected_option?: string | null }[],
    chapterId?: number,
    timeSpentSeconds?: number,
    mode?: string
  ): Promise<ExamSubmitBatchResponse> =>
    fetchApi("/api/exam/submit-batch", {
      method: "POST",
      body: JSON.stringify({
        answers,
        chapter_id: chapterId,
        time_spent_seconds: timeSpentSeconds,
        mode,
      }),
    }),
};
