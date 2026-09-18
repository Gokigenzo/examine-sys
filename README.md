# 📚 Luyện Thi Thông Minh — AI-Powered Learning & Test Prep Platform

Nền tảng học tập ứng dụng AI giúp tóm tắt lý thuyết tự động và tạo bài tập luyện thi thông minh từ tài liệu của bạn.

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS, Shadcn/ui, Lucide Icons, KaTeX |
| **Backend** | Python FastAPI, SQLAlchemy, Pydantic v2 |
| **AI** | Google Gemini 1.5 Flash (structured JSON output) |
| **Database** | SQLite (dev) — sẵn sàng migration sang PostgreSQL |
| **Document Parsing** | PyMuPDF (PDF), python-docx (DOCX), python-pptx (PPTX) |

## 📁 Cấu trúc dự án

```
examine_sys/
├── README.md
├── server/                          # Python FastAPI Backend
│   ├── requirements.txt
│   ├── .env.example
│   ├── main.py                      # FastAPI entry point
│   ├── config.py                    # Settings
│   ├── database.py                  # SQLAlchemy engine
│   ├── models.py                    # ORM models
│   ├── schemas.py                   # Pydantic v2 schemas
│   ├── routers/
│   │   ├── chapters.py              # Chapter CRUD + learn/quiz
│   │   ├── documents.py             # Upload endpoint
│   │   ├── generate.py              # AI generation
│   │   └── quiz.py                  # Quiz submit/bookmark/practice
│   ├── services/
│   │   ├── parser.py                # Document text extraction
│   │   └── ai_service.py            # Gemini AI integration
│   └── uploads/                     # Uploaded files
│
├── client/                          # Next.js Frontend
│   ├── package.json
│   ├── src/
│   │   ├── app/                     # Pages (App Router)
│   │   ├── components/              # React components
│   │   └── lib/                     # API client & utilities
│   └── public/
```

## 🚀 Cài đặt & Chạy

### Yêu cầu hệ thống

- **Python** >= 3.10
- **Node.js** >= 18
- **npm** >= 9
- **Google Gemini API Key** (lấy tại [Google AI Studio](https://aistudio.google.com/apikey))

### 1. Setup Backend

```bash
# Di chuyển vào thư mục server
cd server

# Tạo virtual environment
python -m venv venv
source venv/bin/activate   # Linux/Mac
# venv\Scripts\activate    # Windows

# Cài đặt dependencies
pip install -r requirements.txt

# Tạo file .env từ template
cp .env.example .env

# Chỉnh sửa .env và thêm API key của bạn
# DATABASE_URL=sqlite:///./examine.db
# GEMINI_API_KEY=your-api-key-here
# UPLOAD_DIR=./uploads
```

### 2. Chạy Backend

```bash
cd server
uvicorn main:app --reload --port 8000
```

Backend sẽ chạy tại: **http://localhost:8000**
- Swagger docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 3. Setup Frontend

```bash
# Di chuyển vào thư mục client
cd client

# Cài đặt dependencies
npm install
```

### 4. Chạy Frontend

```bash
cd client
npm run dev
```

Frontend sẽ chạy tại: **http://localhost:3000**

## 🔑 Biến Môi trường

### Backend (`server/.env`)

| Biến | Mô tả | Mặc định |
|---|---|---|
| `DATABASE_URL` | Connection string database | `sqlite:///./examine.db` |
| `GEMINI_API_KEY` | API key Google Gemini | _(bắt buộc)_ |
| `UPLOAD_DIR` | Thư mục lưu file upload | `./uploads` |
| `CORS_ORIGINS` | Allowed CORS origins | `["http://localhost:3000"]` |

### Frontend (`client/.env.local`)

| Biến | Mô tả | Mặc định |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL backend API | `http://localhost:8000` |

## 📖 API Endpoints

### Documents
| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/upload` | Upload file (PDF/DOCX/PPTX) |

### AI Generation
| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/generate/summary` | Tạo tóm tắt lý thuyết bằng AI |
| `POST` | `/api/generate/quiz` | Tạo câu hỏi trắc nghiệm bằng AI |

### Chapters
| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/chapters` | Danh sách chương |
| `POST` | `/api/chapters` | Tạo chương mới |
| `GET` | `/api/chapters/{id}/learn` | Nội dung lý thuyết theo chương |
| `GET` | `/api/chapters/{id}/quiz` | Câu hỏi quiz theo chương |

### Quiz
| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/quiz/submit` | Chấm đáp án |
| `POST` | `/api/quiz/bookmark` | Toggle đánh dấu câu hỏi |
| `GET` | `/api/quiz/practice-wrong` | Lấy câu sai + đã đánh dấu |

## 🎯 Luồng sử dụng

1. **Tạo chương** → Trên trang Dashboard, nhấn "Tạo chương mới"
2. **Upload tài liệu** → Vào trang "Tải tài liệu", chọn chương, kéo thả file
3. **Tạo tóm tắt** → Sau upload, nhấn "Tạo tóm tắt lý thuyết"
4. **Tạo quiz** → Nhấn "Tạo câu hỏi trắc nghiệm"
5. **Học lý thuyết** → Vào chương → "Học lý thuyết"
6. **Làm quiz** → Vào chương → "Làm bài quiz"
7. **Ôn luyện** → Vào trang "Ôn luyện" để luyện lại câu sai / đã đánh dấu

## 🗄️ Database Migration (PostgreSQL)

Để chuyển sang PostgreSQL cho production:

1. Cài đặt driver: `pip install psycopg2-binary`
2. Đổi `DATABASE_URL` trong `.env`:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/examine_db
   ```
3. Restart server — tables sẽ được tự động tạo.

## 📝 License

MIT
