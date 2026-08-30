# Purplexity

An AI-powered search engine that combines real-time web search with LLM reasoning — think Perplexity, but open-source and self-hosted.

<!-- PROJECT PREVIEW -->
<p align="center">
  <img src="https://github.com/user-attachments/assets/52912223-7735-432b-a547-5b63a6ddadfd" alt="Purplexity — AI Search Engine" width="800" />
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/github/license/0xJoy07/Purplexity" />
  <img alt="Stars" src="https://img.shields.io/github/stars/0xJoy07/Purplexity?style=social" />
  <img alt="Last Commit" src="https://img.shields.io/github/last-commit/0xJoy07/Purplexity" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js" />
  <img alt="Bun" src="https://img.shields.io/badge/Bun-1.3-f9f1e1?logo=bun" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-pgvector-336791?logo=postgresql" />
</p>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Usage](#-usage)
- [API Reference](#-api-reference)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Author](#-author)

---

## 🧠 Overview

Purplexity is a full-stack AI search engine that accepts natural language queries, searches the web in real-time using Tavily, and synthesizes comprehensive answers powered by LLMs via OpenRouter. It supports multi-turn conversations, file uploads with deep content analysis (PDF, DOCX, images via OCR), and a semantic caching layer backed by pgvector to avoid redundant API calls. Users get 100K daily token allowances with per-request context window management.

---

## ✨ Features

- **Real-time web search** — Tavily advanced search with up to 10 results per query, scored by relevance
- **LLM-powered answers** — OpenRouter auto-routing to the best available model, with structured JSON responses and follow-up suggestions
- **Semantic caching** — pgvector-based similarity search (cosine, 0.85 threshold) using local `all-MiniLM-L6-v2` embeddings to skip redundant web searches
- **Multi-turn conversations** — Persistent chat threads with auto-generated titles, full message history, and context carry-over
- **File upload & analysis** — Supports PDF, DOCX, RTF, ODT, images (OCR via Tesseract.js), CSV, Markdown, JSON, and code files
- **Context window management** — Pre-flight token estimation with intelligent trimming (drops oldest turns → least-relevant results → truncates file content)
- **Daily token budgets** — 100K tokens/day per user with IST-based midnight resets, usage history charts, and per-request tracking
- **Multi-provider auth** — Email/password with email verification, Google OAuth, and GitHub OAuth via Supabase
- **Cross-device session management** — Persistent session tracking with human-readable device names, `lastActive` timestamps, and "sign out all devices" with real JWT revocation
- **Profile management** — Avatar upload, name editing, password changes, account deletion with email confirmation
- **Dark/Light/System themes** — Smooth theme switching with `next-themes`
- **Responsive sidebar** — Conversation history, search, mobile-friendly collapse

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16.2 (Turbopack) | React server/client components, routing |
| Styling | Tailwind CSS 4 | Utility-first responsive design |
| Animations | Framer Motion, GSAP | Page transitions, typewriter effects |
| Charts | Recharts | Token usage history visualization |
| Icons | Lucide React | Consistent icon system |
| Backend | Bun + Express 5 | HTTP server, API routing |
| ORM | Prisma 6.10 | Type-safe database access |
| Database | PostgreSQL (Supabase) | Primary data store |
| Vector Search | pgvector extension | Semantic cache similarity search |
| Embeddings | Xenova/all-MiniLM-L6-v2 | Local 384-dim sentence embeddings |
| Web Search | Tavily API | Real-time search with relevance scoring |
| LLM | OpenRouter (auto model) | AI response generation |
| Auth | JWT + bcrypt + Supabase OAuth | Session tokens, password hashing, OAuth flows |
| File Parsing | pdf-parse, mammoth, Tesseract.js | PDF, DOCX, OCR extraction |
| Email | Nodemailer | Verification & password reset emails |
| UA Parsing | ua-parser-js | Human-readable session device names |

---

## 📁 Project Structure

```
Purplexity/
├── client/                         # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Main chat interface
│   │   │   ├── layout.tsx          # Root layout with theme provider
│   │   │   ├── globals.css         # Design tokens & Tailwind config
│   │   │   ├── profile/            # User settings (5-tab layout)
│   │   │   ├── signin/             # Login page
│   │   │   ├── signup/             # Registration page
│   │   │   ├── documents/          # File manager
│   │   │   ├── forgot-password/    # Password recovery
│   │   │   ├── reset-password/     # Password reset
│   │   │   └── verify-email/       # Email verification
│   │   ├── components/
│   │   │   ├── AnimatedAIChat.tsx   # Core chat component (23KB)
│   │   │   ├── Sidebar.tsx         # Conversation history sidebar
│   │   │   ├── MarkdownRenderer.tsx # Rich markdown display
│   │   │   ├── TokenUsageIndicator.tsx # Usage bar & stats
│   │   │   └── TypewriterText.tsx  # Streaming text effect
│   │   └── lib/
│   │       ├── api.ts              # Server API client
│   │       ├── auth.tsx            # Auth context provider
│   │       └── supabase.ts         # Supabase client init
│   └── package.json
├── server/                         # Bun + Express backend
│   ├── index.ts                    # App entry, route mounting, startup
│   ├── prompt.ts                   # System prompt & template
│   ├── config/
│   │   └── db.config.ts            # Prisma client singleton
│   ├── middleware/
│   │   ├── auth.middleware.ts      # JWT verification + session lastActive
│   │   └── tokenLimit.middleware.ts # Daily token budget enforcement
│   ├── routes/
│   │   ├── auth.routes.ts          # Register, login, OAuth, profile, password
│   │   ├── session.routes.ts       # GET sessions, sign-out-all
│   │   └── analyze.routes.ts       # File analysis endpoints
│   ├── services/
│   │   ├── ai.service.ts           # OpenRouter LLM integration
│   │   ├── auth.service.ts         # JWT signing, session persistence, UA parsing
│   │   ├── webSearch.service.ts    # Tavily web search
│   │   ├── semanticCache.service.ts # pgvector similarity cache
│   │   ├── embedding.service.ts    # Local transformer embeddings
│   │   ├── contentAnalyzer.service.ts # Multi-format file extraction
│   │   ├── conversation.service.ts # CRUD for conversations & messages
│   │   ├── token.service.ts        # Usage tracking, context trimming
│   │   ├── database.service.ts     # User & query persistence
│   │   └── guest.service.ts        # Guest/test user management
│   ├── prisma/
│   │   └── schema.prisma           # 10 models, pgvector, enums
│   └── package.json
└── uploads/                        # Temporary file upload directory
```

---

## 🚀 Getting Started

### Prerequisites

- **Bun** ≥ 1.3 — [Install](https://bun.sh)
- **Node.js** ≥ 20 — Required for Next.js client
- **PostgreSQL** with `pgvector` extension — [Supabase](https://supabase.com) provides this out of the box
- **Tavily API key** — [Get one](https://tavily.com)
- **OpenRouter API key** — [Get one](https://openrouter.ai)

### Installation

```bash
# Clone the repository
git clone https://github.com/0xJoy07/Purplexity.git
cd Purplexity

# ── Server setup ──
cd server
cp .env.example .env
# Fill in your API keys and database URL in .env (see Environment Variables below)

bun install
bunx prisma db push
bunx prisma generate

# ── Client setup ──
cd ../client
npm install

# ── Run both ──
# Terminal 1 — Server
cd server && bun run dev

# Terminal 2 — Client
cd client && npm run dev
```

The server runs on `http://localhost:5000` and the client on `http://localhost:3000`.

---

## 🔐 Environment Variables

Create a `.env` file in the `server/` directory:

```env
# API Keys
TAVILY_API_KEY=your_tavily_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# Content Analysis (File Uploads)
LLM_API_KEY=your_openrouter_api_key
LLM_ENDPOINT=https://openrouter.ai/api/v1/chat/completions
LLM_MODEL=openrouter/free
MAX_UPLOAD_SIZE=10485760

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# Database
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Server
PORT=5000

# Authentication
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
AUTH_COOKIE_NAME=purplexity_session
CLIENT_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Email (Nodemailer SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM=Purplexity <no-reply@example.com>
```

| Variable | Required | Description |
|----------|----------|-------------|
| `TAVILY_API_KEY` | ✅ | Tavily web search API key |
| `OPENROUTER_API_KEY` | ✅ | OpenRouter API key for LLM access |
| `DATABASE_URL` | ✅ | PostgreSQL connection string (must have pgvector) |
| `JWT_SECRET` | ✅ | Secret for signing session JWTs |
| `SUPABASE_URL` | ✅ | Supabase project URL (for OAuth) |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `GOOGLE_CLIENT_ID` | ❌ | Google OAuth client ID (optional) |
| `GITHUB_CLIENT_ID` | ❌ | GitHub OAuth client ID (optional) |
| `SMTP_HOST` | ❌ | SMTP server for email verification (optional) |
| `PORT` | ❌ | Server port (default: `5000`) |

---

## 📖 Usage

### Search with web results
Type any question into the chat. Purplexity searches the web, synthesizes an answer with citations, and suggests follow-up questions.

### Upload files for analysis
Attach PDFs, DOCX, images, or code files to your message. Purplexity extracts content (including OCR for scanned documents), combines it with web search results, and generates a contextual response.

### Manage conversations
Use the sidebar to browse, search, and switch between conversations. Each conversation auto-generates a title from the first message.

### Monitor token usage
Visit **Profile → Usage & Limits** to see daily consumption, 7-day history charts, and context window limits.

### Session management
Check **Profile → Security → Active Sessions** to see all logged-in devices across browsers. Use "Sign out all devices" to revoke all sessions instantly.

---

## 📡 API Reference

All endpoints are prefixed with `http://localhost:5000`. Auth-protected routes require `Authorization: Bearer <token>`.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register with email/password |
| `POST` | `/auth/login` | Login, returns JWT |
| `POST` | `/auth/oauth-sync` | Sync OAuth user from Supabase |
| `GET` | `/auth/verify-email?token=` | Verify email address |
| `POST` | `/auth/forgot-password` | Send password reset email |
| `POST` | `/auth/reset-password` | Reset password with token |
| `GET` | `/auth/me` | Get current user profile 🔒 |
| `POST` | `/auth/logout` | Logout + revoke session 🔒 |
| `PUT` | `/auth/profile` | Update name/email/avatar 🔒 |
| `PUT` | `/auth/password` | Change password 🔒 |

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/auth/sessions` | List all active sessions 🔒 |
| `POST` | `/auth/sessions/sign-out-all` | Revoke all sessions 🔒 |

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/conversations` | Create a new conversation 🔒 |
| `GET` | `/conversations/user/:userId` | Get user's conversations 🔒 |
| `GET` | `/conversations/:id` | Get conversation with messages 🔒 |
| `POST` | `/conversations/:id/messages` | Send message (supports file uploads) 🔒 |
| `PATCH` | `/conversations/:id` | Update conversation title 🔒 |
| `DELETE` | `/conversations/:id` | Delete a conversation 🔒 |

### Tokens & Usage

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/tokens/:userId` | Get today's token usage 🔒 |
| `GET` | `/tokens/:userId/history?days=7` | Get usage history 🔒 |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/files` | List user's uploaded files 🔒 |
| `GET` | `/api/files/:id` | Download/view a file 🔒 |
| `DELETE` | `/api/files/:id` | Delete a file 🔒 |

---

## 🗺 Roadmap

- [x] Real-time web search with Tavily
- [x] LLM-powered answer synthesis via OpenRouter
- [x] Semantic caching with pgvector embeddings
- [x] Multi-turn conversation support
- [x] File upload & multi-format analysis (PDF, DOCX, OCR)
- [x] JWT auth with email/password + Google/GitHub OAuth
- [x] Cross-device session tracking & management
- [x] Token usage tracking with daily budgets & history charts
- [x] Dark/Light/System theme support
- [ ] Streaming responses (SSE/WebSocket)
- [ ] Conversation sharing & export
- [ ] Custom model selection per query
- [ ] RAG over user's uploaded document library
- [ ] Mobile-native app (React Native)

---

## 🤝 Contributing

```
1. Fork the repo
2. Create a feature branch: git checkout -b feat/your-feature
3. Commit: git commit -m "feat: add your feature"
4. Push: git push origin feat/your-feature
5. Open a Pull Request
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 👤 Author

**Gojo (Joy Sengupta)**

- GitHub: [@0xJoy07](https://github.com/0xJoy07)
- Portfolio: [0xjoy.vercel.app](https://0xjoy.vercel.app)
- LinkedIn: [beinggojo](https://linkedin.com/in/beinggojo)
