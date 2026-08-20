# 2nd Brain — Developer Setup Guide (for OpenAI Codex / Local Development)

This document explains how to set up, run, and extend the 2nd Brain project locally or on OpenAI Codex.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 22.x |
| Package Manager | pnpm | 10.x |
| Frontend | React 19 + Tailwind CSS 4 + Vite 7 | — |
| Backend | Express 4 + tRPC 11 | — |
| Database | MySQL 8 / TiDB (MySQL-compatible) | — |
| ORM | Drizzle ORM | 0.44.x |
| Auth | Manus OAuth (custom) | — |
| LLM | OpenAI-compatible API via `invokeLLM` helper | — |
| Voice | Whisper API via `transcribeAudio` helper | — |
| Storage | S3-compatible (via AWS SDK) | — |
| Testing | Vitest | 2.x |
| Language | TypeScript 5.9 (strict) | — |

---

## Prerequisites

1. **Node.js 22+** — Install via [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm)
2. **pnpm 10+** — `npm install -g pnpm@10`
3. **MySQL 8** (or TiDB) — Local instance or cloud (PlanetScale, TiDB Cloud, etc.)
4. **Environment variables** — See section below

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/Huiyuhere/2nd-brain-arhic.git
cd 2nd-brain-arhic

# 2. Install dependencies
pnpm install

# 3. Set up environment variables (see below)
cp .env.example .env  # then fill in values

# 4. Push database schema
pnpm db:push

# 5. Start dev server (frontend + backend on port 3000)
pnpm dev

# 6. Run tests
pnpm test

# 7. Type check
pnpm check
```

---

## Environment Variables

Create a `.env` file at the project root with these variables:

```env
# Database (required)
DATABASE_URL=mysql://user:password@host:port/dbname?ssl={"rejectUnauthorized":true}

# Auth (required for login to work)
JWT_SECRET=your-random-secret-string
VITE_APP_ID=your-manus-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://login.manus.im
OWNER_OPEN_ID=your-owner-open-id
OWNER_NAME=YourName

# LLM (required for AI features: Ask Manus, Insights, Voice cleanup)
BUILT_IN_FORGE_API_URL=https://your-llm-proxy-url
BUILT_IN_FORGE_API_KEY=your-api-key

# Frontend LLM access (for client-side features if any)
VITE_FRONTEND_FORGE_API_URL=https://your-llm-proxy-url
VITE_FRONTEND_FORGE_API_KEY=your-frontend-api-key

# S3 Storage (required for file uploads, voice recordings)
# These are configured inside server/_core/sdk.ts — check that file for exact var names

# Google Calendar (optional — only if you want calendar sync)
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

> **Note:** If you're running without Manus OAuth, you'll need to stub the auth layer or replace `protectedProcedure` with a pass-through for local dev.

---

## Project Structure

```
├── client/                  # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/           # Route-level page components
│   │   ├── components/      # Reusable UI components (shadcn/ui based)
│   │   ├── contexts/        # React contexts (AppContext, ThemeContext)
│   │   ├── hooks/           # Custom hooks
│   │   ├── lib/             # Utilities (trpc client, store, utils)
│   │   ├── App.tsx          # Route definitions
│   │   ├── main.tsx         # Entry point + tRPC provider
│   │   └── index.css        # Global styles + design tokens
│   └── index.html           # HTML shell
├── server/                  # Backend
│   ├── _core/               # Framework plumbing (DO NOT EDIT unless extending infra)
│   │   ├── index.ts         # Express server entry + Vite middleware
│   │   ├── llm.ts           # invokeLLM helper
│   │   ├── voiceTranscription.ts  # Whisper transcription helper
│   │   ├── context.ts       # tRPC context builder
│   │   ├── oauth.ts         # Manus OAuth handler
│   │   └── ...
│   ├── routers.ts           # Main tRPC router (imports sub-routers)
│   ├── routers/             # Sub-routers (voice.ts, googleCalendar.ts)
│   ├── db.ts                # Database query helpers
│   ├── askManus.ts          # Ask Manus AI advisor logic
│   ├── insights.ts          # AI reflection insights generation
│   ├── googleCalendar.ts    # Google Calendar sync logic
│   ├── storage.ts           # S3 storage helpers
│   └── *.test.ts            # Test files
├── drizzle/                 # Database schema + migrations
│   ├── schema.ts            # Table definitions (source of truth)
│   └── 0001_*.sql ...       # Generated migration files
├── shared/                  # Shared types + constants
├── data-backup/             # Personal data export (JSON files)
├── vitest.config.ts         # Test configuration
├── vite.config.ts           # Vite + dev server config
├── drizzle.config.ts        # Drizzle ORM config
└── package.json             # Scripts + dependencies
```

---

## Key Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start dev server (Express + Vite HMR on port 3000) |
| `pnpm build` | Build for production (Vite frontend + esbuild backend) |
| `pnpm start` | Run production build |
| `pnpm check` | TypeScript type check (no emit) |
| `pnpm test` | Run all Vitest tests |
| `pnpm db:push` | Generate + run Drizzle migrations against DATABASE_URL |
| `pnpm format` | Prettier format all files |

---

## Database

- **ORM:** Drizzle ORM with MySQL dialect
- **Schema file:** `drizzle/schema.ts` — this is the single source of truth
- **Migrations:** Auto-generated by `drizzle-kit generate`, applied by `drizzle-kit migrate`
- **Connection:** Via `DATABASE_URL` env var (MySQL connection string with SSL)

### Tables

| Table | Purpose |
|---|---|
| `users` | Auth users (Manus OAuth) |
| `categories` | Task categories (Work, Personal, etc.) with colors |
| `tasks` | Kanban tasks with columns, subtasks, time estimates |
| `time_blocks` | Calendar time blocks with recurrence |
| `habits` | Habit definitions |
| `habit_completions` | Daily habit check-offs |
| `mood_entries` | Morning/evening mood + sleep ratings |
| `evening_entries` | Evening journal (title, highlights, freeWrite) |
| `reflections` | Weekly/monthly/quarterly reflection answers |
| `reflection_insights` | Cached AI-generated insights per period |
| `goals` | Binary goals |
| `projects` | Active projects with milestones |
| `project_tasks` / `project_milestones` | Project breakdown |
| `google_tokens` | Google OAuth tokens for calendar sync |
| `google_calendar_events` | Mirrored Google Calendar events |
| `google_sync_calendars` | Which Google calendars to sync |

---

## Architecture Notes

### tRPC
- All API calls go through tRPC (no REST endpoints except OAuth callback and voice upload)
- `protectedProcedure` requires auth; `publicProcedure` is open
- Frontend uses `trpc.*.useQuery()` and `trpc.*.useMutation()` hooks

### LLM Integration
- `invokeLLM()` from `server/_core/llm.ts` — server-side only
- Supports structured JSON output via `response_format`
- Used for: Ask Manus advisor, reflection insights, voice transcript cleanup, evening dump parsing

### Voice Transcription
- `transcribeAudio()` from `server/_core/voiceTranscription.ts`
- Accepts a URL to an audio file, returns text + segments
- Audio uploaded via `/api/voice/upload` (multer multipart)

### Scheduled Jobs
- Uses Manus Heartbeat system (cron-like)
- 3 registered jobs: `insights-weekly` (Mon 01:00 UTC), `insights-monthly`, `insights-quarterly`
- 1 job: `google-sync` (every 15 min)
- Handlers in `server/scheduledInsights.ts` and `server/scheduledGoogleSync.ts`

### Design System
- **Theme:** Light mode with sky blue (`--sky`) and gold (`--gold`) accents
- **Font:** Playfair Display for headings, system sans for body
- **Components:** shadcn/ui (Radix primitives + Tailwind)
- **Animations:** Framer Motion for page transitions and micro-interactions

---

## Running on OpenAI Codex

OpenAI Codex provides a sandboxed environment. Key considerations:

1. **Install dependencies first:**
   ```bash
   pnpm install
   ```

2. **Database:** You'll need an external MySQL instance (Codex doesn't run MySQL locally). Use a cloud provider:
   - TiDB Cloud (free tier available)
   - PlanetScale
   - Railway MySQL
   - Any MySQL 8+ instance

3. **Environment variables:** Set them via Codex's environment configuration or a `.env` file.

4. **LLM calls:** The `invokeLLM` helper calls an OpenAI-compatible endpoint. You can point `BUILT_IN_FORGE_API_URL` to:
   - OpenAI API directly (`https://api.openai.com/v1`)
   - Any OpenAI-compatible proxy
   - Set `BUILT_IN_FORGE_API_KEY` to your API key

5. **Voice transcription:** Similarly, `transcribeAudio` calls a Whisper-compatible endpoint. Point it to OpenAI's Whisper API or a self-hosted instance.

6. **S3 Storage:** For voice uploads and file storage, you need S3-compatible storage:
   - AWS S3
   - Cloudflare R2
   - MinIO (self-hosted)
   - Configure via the SDK env vars in `server/_core/sdk.ts`

7. **Auth bypass for local dev:** If you don't have Manus OAuth set up, you can temporarily modify `server/_core/context.ts` to return a hardcoded user for all requests.

---

## Extending the Project

### Adding a new feature (typical flow):

1. **Schema:** Add/modify tables in `drizzle/schema.ts`
2. **Migrate:** Run `pnpm db:push`
3. **DB helpers:** Add query functions in `server/db.ts`
4. **tRPC procedures:** Add to `server/routers.ts` or create a sub-router in `server/routers/`
5. **Frontend:** Create page in `client/src/pages/`, wire route in `App.tsx`, call `trpc.*` hooks
6. **Tests:** Add Vitest specs in `server/*.test.ts`
7. **Type check:** `pnpm check`

### Adding a new AI feature:

```typescript
import { invokeLLM } from "./server/_core/llm";

const response = await invokeLLM({
  messages: [
    { role: "system", content: "Your system prompt here" },
    { role: "user", content: userInput },
  ],
  // Optional: structured JSON output
  response_format: {
    type: "json_schema",
    json_schema: { name: "my_schema", strict: true, schema: { ... } }
  }
});
```

---

## Data Backup / Restore

### Export (backup):
```bash
npx tsx export-data.mjs
# Creates data-backup/*.json files
```

### Import (restore):
You can write a seed script that reads the JSON files and inserts them back:
```bash
# Example: restore tasks
npx tsx -e "
import data from './data-backup/tasks.json' assert { type: 'json' };
// ... insert into database
"
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `DATABASE_URL` not found | Ensure `.env` file exists at project root |
| SSL connection error | Add `?ssl={"rejectUnauthorized":true}` to DATABASE_URL |
| Port 3000 in use | The dev server auto-finds next available port |
| TypeScript errors | Run `pnpm check` — all code must pass strict mode |
| Tests fail | Run `pnpm test` — ensure mocks match current db.ts exports |
| Voice upload 413 | Audio files must be under 16MB |
| Google Calendar 403 | Add your email as a test user in Google Cloud Console |

---

## Key Design Decisions

- **Single-owner app** — not multi-tenant. One user, one database.
- **Mon–Sun weeks** — ISO week standard, all date math uses SGT (UTC+8).
- **Ephemeral chat** — Ask Manus history clears on page leave (not persisted to DB).
- **No images in repo** — All media uploaded via `manus-upload-file` and referenced by URL.
- **CEO-mentor AI voice** — Insights use a direct, no-nonsense tone with emoji headers.
- **Voice-first journaling** — Designed for mobile; speak naturally, AI cleans up.
