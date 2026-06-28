# Purplexity — System Architecture

> A Perplexity clone built with Next.js, Bun, Tavily, Supabase, and a streaming LLM API.

---

## Table of Contents

- [Overview](#overview)
- [Data Flow](#data-flow)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Performance & Caching](#performance--caching)
- [Auth Flow](#auth-flow)

---

## Overview

Purplexity is an AI-powered search interface that combines real-time web search with LLM-generated answers. For every query, it fetches live web results via Tavily, builds a rich context window, and streams a grounded response back to the user — along with sources and follow-up suggestions.

```
User Query → Web Search → Context Engineering → LLM → Streamed Response
```

---

## Data Flow

1. User types a query in the Next.js frontend and submits.
2. Frontend fires `POST /conversation` to the Bun backend.
3. Backend validates the request via **JWT auth middleware** (Supabase-issued token).
4. Request is handed to the **Agent Orchestration layer**:
   - **Step 1 — Query rewrite:** Normalises and clarifies the raw query.
   - **Step 2 — Web search:** Calls Tavily API → returns top 10 results with page summaries.
   - **Step 3 — Context build:** Assembles system prompt + search summaries + chat history into a single context window.
5. Context is forwarded to the **LLM API** (OpenAI / Claude / Gemini / DeepSeek).
6. LLM streams tokens back through Bun to the frontend via **SSE (Server-Sent Events)**.
7. On stream completion, the full conversation is **persisted to Supabase Postgres**.
8. Frontend renders the response with inline source citations and follow-up question chips.

> **Optional:** A Redis cache layer (Upstash) intercepts repeat queries before they hit Tavily, reducing latency and API costs.

---

## Tech Stack

### Frontend

| Tool | Purpose |
|---|---|
| Next.js 14 + TypeScript | App Router, SSR, API Routes, file-based routing |
| TailwindCSS | Utility-first styling |
| shadcn/ui | Component library |
| `useChat` / SSE | Consuming the streamed LLM response (Vercel AI SDK hook) |
| Supabase JS SDK | Auth token management + direct DB reads |
| Next.js Route Handlers | `/api/*` endpoints — optionally replaces separate Bun server |

### Backend

| Tool | Purpose |
|---|---|
| Bun | TypeScript runtime (faster cold starts than Node) |
| Hono or Elysia | Bun-native web framework |
| JWT middleware | Validates Supabase-issued tokens on every request |

### Agent / AI Layer

| Tool | Purpose |
|---|---|
| Tavily API | Web search + per-page text summaries |
| Vercel AI SDK | Unified streaming interface across LLM providers |
| OpenAI / Claude / Gemini / DeepSeek | Interchangeable LLM backends |

### Database & Auth

| Tool | Purpose |
|---|---|
| Supabase Postgres | Primary data store — users, conversations, messages |
| pgvector | Semantic vector search on past queries (optional) |
| Supabase Auth | Google + GitHub OAuth, JWT issuance |
| Supabase Storage | File attachment support (future) |

### Optional / Performance

| Tool | Purpose |
|---|---|
| Redis (Upstash) | Cache Tavily results for repeated queries |
| Supabase Edge Functions | Run server logic closer to the database |

---

## Database Schema

### `users`
Managed by Supabase Auth. Extended with a public profile table if needed.

```sql
-- Supabase handles this via auth.users
-- Optionally extend with:
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);
```

### `conversations`

```sql
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text,
  model text default 'gpt-4o',
  created_at timestamptz default now()
);
```

### `messages`

```sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations on delete cascade not null,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  sources jsonb,         -- array of { title, url, snippet }
  follow_ups jsonb,      -- array of suggested follow-up strings
  created_at timestamptz default now()
);
```

### `query_cache` _(optional)_

```sql
create table query_cache (
  id uuid primary key default gen_random_uuid(),
  query_hash text unique not null,
  query_text text not null,
  results jsonb not null,    -- Tavily response
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
```

> Enable Row Level Security (RLS) on all tables. Users should only be able to read and write their own conversations and messages.

---

## Environment Variables

### Backend (Bun)

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Tavily
TAVILY_API_KEY=tvly-...

# LLM
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...

# Redis (optional)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Server
PORT=3000
```

### Frontend (Next.js)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

---

## Project Structure

```
purplexity/
├── apps/
│   ├── web/                              # Next.js 14 frontend (App Router)
│   │   ├── app/
│   │   │   ├── layout.tsx                # Root layout + Supabase provider
│   │   │   ├── page.tsx                  # Home / search landing
│   │   │   ├── search/
│   │   │   │   └── [id]/page.tsx         # Conversation page
│   │   │   └── api/
│   │   │       ├── conversation/
│   │   │       │   └── route.ts          # POST /api/conversation (SSE stream)
│   │   │       └── history/
│   │   │           └── route.ts          # GET /api/history
│   │   ├── components/
│   │   │   ├── SearchInput.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── SourceCard.tsx
│   │   │   ├── FollowUpChips.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── hooks/
│   │   │   ├── useStream.ts
│   │   │   └── useConversation.ts
│   │   ├── lib/
│   │   │   └── supabase.ts               # Supabase client (browser + server)
│   │   └── next.config.ts
│   │
│   └── server/                           # Bun backend (if kept separate)
│       ├── src/
│       │   ├── routes/
│       │   │   ├── conversation.ts
│       │   │   └── history.ts
│       │   ├── agent/
│       │   │   ├── rewrite.ts
│       │   │   ├── search.ts
│       │   │   └── context.ts
│       │   ├── middleware/
│       │   │   └── auth.ts
│       │   ├── db/
│       │   │   └── supabase.ts
│       │   └── index.ts
│       └── package.json
│
├── packages/
│   └── types/                            # Shared TypeScript types
│       └── index.ts
│
└── package.json                          # Monorepo root (Bun workspaces)
```

---

## API Endpoints

### `POST /conversation`

Starts or continues a conversation. Streams the LLM response via SSE.

**Request**
```json
{
  "query": "What is Rust and why should I learn it?",
  "conversation_id": "uuid | null",
  "model": "gpt-4o"
}
```

**Response** — `text/event-stream`
```
data: {"type":"sources","data":[{"title":"...","url":"...","snippet":"..."}]}

data: {"type":"token","data":"Rust is a"}
data: {"type":"token","data":" systems programming"}
...
data: {"type":"follow_ups","data":["How does Rust handle memory?","..."]}
data: {"type":"done","conversation_id":"uuid"}
```

### `GET /history`

Returns all conversations for the authenticated user.

**Response**
```json
[
  {
    "id": "uuid",
    "title": "What is Rust?",
    "model": "gpt-4o",
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

### `GET /conversation/:id`

Returns all messages for a specific conversation.

---

## Performance & Caching

- **Tavily cache:** Hash the normalised query string. On a cache hit, skip the Tavily call entirely and go straight to LLM with cached results. TTL: 1 hour (configurable).
- **pgvector (optional):** Embed past queries and perform a similarity search before hitting Tavily. If a semantically close query already has results stored, reuse them.
- **Streaming first:** Sources are emitted as the first SSE event — before LLM tokens start — so the UI can render citations immediately.
- **Model selector:** Expose a model dropdown so users can pick a cheaper/faster model for casual queries and a more capable one for deep research.

---

## Auth Flow

```
1. User clicks "Login with Google / GitHub"
2. Supabase Auth handles the OAuth redirect
3. On success, Supabase issues a JWT stored in localStorage via the JS SDK
4. Every API request includes:  Authorization: Bearer <jwt>
5. Bun middleware validates the JWT against the Supabase public key
6. Supabase RLS policies enforce row-level data isolation per user
```

---

> Built for the Purplexity project. Architecture designed to be modular — swap any LLM provider, search API, or cache layer without touching the rest of the stack.