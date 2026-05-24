# MeetMind — Complete Project Explainer

> A Fireflies.ai / Otter.ai clone built entirely on Cloudflare's edge platform.  
> Live: https://meeting-intelligence.arunnewpage.workers.dev

---

## Table of Contents
1. [What is MeetMind?](#1-what-is-meetmind)
2. [Why Cloudflare?](#2-why-cloudflare)
3. [Architecture Overview](#3-architecture-overview)
4. [Tech Stack](#4-tech-stack)
5. [Database Schema](#5-database-schema)
6. [End-to-End Flows](#6-end-to-end-flows)
7. [Features — What the App Does](#7-features--what-the-app-does)
8. [Code Walkthrough — Every File](#8-code-walkthrough--every-file)
9. [Cloudflare Services Used](#9-cloudflare-services-used)
10. [Microsoft Graph API Integration](#10-microsoft-graph-api-integration)
11. [AI Pipeline](#11-ai-pipeline)
12. [Deployment](#12-deployment)
13. [Presentation Script](#13-presentation-script)

---

## 1. What is MeetMind?

MeetMind is an AI meeting intelligence platform that automatically:
- Pulls your Microsoft Teams meeting transcripts via the Microsoft Graph API
- Runs them through an AI model (Llama 3.1 70B) to generate summaries, key decisions, and action items
- Lets you search across all your meetings using natural language + AI Q&A
- Tracks action items on a Kanban board across all meetings
- Answers direct questions about your meetings using RAG (Retrieval-Augmented Generation)

**The problem it solves:** After a meeting, you have to manually write notes, assign tasks, and remember what was decided. MeetMind does all of that automatically — every meeting you have becomes searchable, summarized, and actionable within minutes.

**Comparable products:** Fireflies.ai, Otter.ai, Avoma, Gong

---

## 2. Why Cloudflare?

This project was deliberately built to use Cloudflare's full platform. Here is the justification for each choice:

### Cloudflare Workers (Compute)
- **What:** Serverless JavaScript runtime running at 300+ edge locations worldwide
- **Why over AWS Lambda/Vercel:** Zero cold starts, runs at the edge closest to the user, free tier is generous (100K requests/day), no region lock-in
- **Justification:** A meeting app needs fast API responses when users search or view summaries. Edge compute delivers sub-100ms response times globally.

### Cloudflare D1 (Database)
- **What:** Serverless SQLite database distributed to the edge
- **Why over Postgres/PlanetScale:** No connection pooling complexity, SQLite is simple and fast for this data shape, runs at the edge alongside Workers, generous free tier (5GB)
- **Justification:** Meeting data is structured (users, meetings, action items) and relational — SQL is the right tool. D1 gives SQL without managing a server.

### Cloudflare KV (Key-Value Store)
- **What:** Global key-value store with millisecond reads at the edge
- **Why:** Session tokens and Microsoft OAuth tokens need fast lookup on every authenticated request. D1 SQL would be slower for this hot-path.
- **What it stores:**
  - `user:{id}` → Microsoft access token + refresh token (expires in 1 hour)
  - `graph:subscription:meetings` → Active Microsoft Graph webhook subscription details

### Cloudflare Workers AI
- **What:** Serverless AI inference — run ML models without managing GPUs
- **Why over OpenAI API:** No external API calls leaving Cloudflare's network, no per-token cost at scale, data stays within the infrastructure
- **Models used:**
  - `@cf/meta/llama-3.1-70b-instruct` — for meeting analysis (summary + decisions + action items in one call)
  - `@cf/meta/llama-3.1-70b-instruct` — for AI Q&A over meeting data

### OpenNext for Cloudflare (`@opennextjs/cloudflare`)
- **What:** Adapter that compiles a Next.js app to run on Cloudflare Workers instead of Node.js
- **Why Next.js:** Full-stack React framework with App Router, server components, and API routes in one codebase
- **Why OpenNext:** Cloudflare Workers doesn't run Node.js — OpenNext converts Next.js output to the Workers runtime format

---

## 3. Architecture Overview

```
Browser
  │
  ├─► Cloudflare Workers (Edge Runtime)
  │     ├─► Next.js App Router (via @opennextjs/cloudflare)
  │     │     ├─► Page Routes: /, /dashboard, /analytics, /board
  │     │     │                /dashboard/meetings/[id]
  │     │     └─► API Routes: /api/auth/*, /api/meetings, /api/kanban,
  │     │                     /api/search, /api/ai/ask, /api/analytics, ...
  │     │
  │     ├─► Cloudflare D1 (SQLite) ← users, meetings, action_items (with kanban_column)
  │     ├─► Cloudflare KV ← auth tokens, webhook subscriptions
  │     └─► Cloudflare Workers AI ← Llama 3.1 70B inference
  │
  └─► Microsoft Graph API (external)
        ├─► /me/calendarView → fetch meetings
        ├─► /me/onlineMeetings → get meeting details
        ├─► /me/onlineMeetings/{id}/transcripts → get transcript
        └─► /subscriptions → webhook for real-time events
```

**Request flow for a page load:**
1. Browser hits `https://meeting-intelligence.arunnewpage.workers.dev`
2. Cloudflare routes to the nearest Worker instance (300+ locations globally)
3. Worker runs the Next.js handler (compiled by OpenNext)
4. Page components fetch from `/api/*` routes
5. API routes query D1/KV, call Microsoft Graph if needed, or invoke Workers AI

---

## 4. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js | 16.2.6 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | v4 |
| Language | TypeScript | 5 |
| Runtime | Cloudflare Workers | — |
| Database | Cloudflare D1 (SQLite) | — |
| Key-Value | Cloudflare KV | — |
| AI Inference | Cloudflare Workers AI (Llama 3.1 70B) | — |
| Build adapter | @opennextjs/cloudflare | 1.19.11 |
| Deployment | Wrangler CLI | 4.93.0 |
| Auth | Microsoft OAuth 2.0 (multi-tenant) | — |
| External API | Microsoft Graph API v1.0 | — |

---

## 5. Database Schema

Four migrations, defined in `migrations/`:

### `users` — (migrations/001_create_users.sql)
```sql
CREATE TABLE users (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    email                   TEXT UNIQUE NOT NULL,
    name                    TEXT NOT NULL,
    microsoft_access_token  TEXT,       -- fallback, real token is in KV
    microsoft_refresh_token TEXT,
    token_expires_at        DATETIME,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `meetings` — (migrations/002_create_meetings.sql + 003_add_key_decisions.sql)
```sql
CREATE TABLE meetings (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    teams_meeting_id TEXT UNIQUE NOT NULL,   -- Microsoft's event/meeting ID
    title            TEXT NOT NULL,
    description      TEXT,
    start_time       DATETIME NOT NULL,
    end_time         DATETIME,
    duration_minutes INTEGER,
    organizer        TEXT,
    attendees        TEXT,                   -- JSON array of strings
    recording_url    TEXT,
    transcript       TEXT,                   -- raw WebVTT or plain text
    summary          TEXT,                   -- AI-generated paragraph
    key_decisions    TEXT,                   -- AI-generated JSON array of strings
    status           TEXT DEFAULT 'pending',
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Status lifecycle:**
```
pending
  ├─► no_transcript          (transcript not available in Teams)
  ├─► transcript_failed      (transcript download failed)
  └─► transcript_fetched     (transcript pulled from Graph API)
        └─► processing       (AI running)
              ├─► processed  (summary + action items stored ✓)
              └─► failed     (AI error)
```

### `action_items` — (migrations/003_create_action_items.sql + 004_add_kanban_column.sql)
```sql
CREATE TABLE action_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id     INTEGER NOT NULL REFERENCES meetings(id),
    description    TEXT NOT NULL,
    assigned_to    TEXT,
    due_date       DATETIME,
    status         TEXT DEFAULT 'open',    -- open | done
    priority       TEXT DEFAULT 'medium',  -- low | medium | high
    kanban_column  TEXT DEFAULT NULL,      -- NULL = not on board; backlog | todo | in_progress | done
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**`kanban_column` values:**
- `NULL` — item not added to the board yet
- `'backlog'` — added to board, not started
- `'todo'` — queued up
- `'in_progress'` — being worked on
- `'done'` — completed on the board (separate from `status = 'done'` which is the checkbox state)

---

## 6. End-to-End Flows

### Flow A: First Sign-In

```
User clicks "Sign in with Microsoft"
  │
  ▼
GET /api/auth/microsoft
  └─► Builds Microsoft OAuth URL with scopes:
      openid, profile, email, User.Read,
      Calendars.Read, OnlineMeetings.Read,
      OnlineMeetingTranscript.Read.All
  └─► Redirects browser to Microsoft login page

User logs in at Microsoft
  │
  ▼
GET /api/auth/microsoft/callback?code=xxx
  └─► Exchanges code for access_token + id_token
  └─► Decodes id_token JWT to get name + email
  └─► Upserts user row in D1 (INSERT OR IGNORE + UPDATE tokens)
  └─► Stores tokens in KV: key="user:{id}", value={access_token,...}
  └─► Sets cookie: mi_uid={userId} (HttpOnly, SameSite=Lax)
  └─► Redirects to /dashboard
```

### Flow B: Sync Meetings

```
User clicks "Sync Meetings"
  │
  ▼
POST /api/meetings
  └─► Reads mi_uid cookie → gets userId
  └─► Fetches access_token from KV
  └─► Calls Microsoft Graph:
      GET /me/calendarView?startDateTime=30 days ago&endDateTime=7 days future
  └─► For each online meeting event:
      ├─► Upsert meeting row in D1
      ├─► GET /me/onlineMeetings?$filter=JoinWebUrl eq '{joinUrl}'
      │   (translates calendar join URL → onlineMeeting.id)
      ├─► GET /me/onlineMeetings/{id}/transcripts
      ├─► GET /me/onlineMeetings/{id}/transcripts/{tId}/content?$format=text/vtt
      │   └─► Parse WebVTT format → plain readable text
      └─► If transcript found → processMeeting(transcript) via Workers AI
          └─► Single Llama 3.1 70B call extracts all three:
              summary, keyDecisions[], actionItems[]
          └─► Store results in D1, update status to "processed"
  └─► Return { success: true, count: N, meetings: [...] }
```

### Flow C: AI Search + Q&A

```
User types a question and hits Search
  │
  ▼
Two parallel fetch() calls:

1. POST /api/search { query: "what did we decide about budget?" }
   └─► SQL LIKE query on title, summary, transcript columns
   └─► Returns matching meeting cards

2. POST /api/ai/ask { question: "what did we decide about budget?" }
   └─► Fetches all processed meetings from D1
       (summaries + key_decisions + action items)
   └─► Builds context string:
       "Meeting: 'Q2 Planning' (2026-05-20)
        Summary: ...
        Decisions: ...
        Action items: - Finalize budget (assigned to: Arun)"
   └─► Sends to Llama 3.1 70B:
       System: "Answer using only the meeting data provided."
       User: "{context}\n\nQuestion: {question}"
   └─► Returns direct natural language answer

UI shows: meeting cards + violet AI Answer box above results
```

### Flow D: Real-Time Webhook (Auto-Sync)

```
User clicks "Enable Auto-Sync"
  │
  ▼
POST /api/webhooks/teams/subscribe
  └─► POST https://graph.microsoft.com/v1.0/subscriptions
      { changeType: "created,updated",
        resource: "me/events",
        notificationUrl: "https://{host}/api/webhooks/teams",
        expirationDateTime: 3 days from now }
  └─► Store { subscriptionId, expiresAt, userId } in KV

When Microsoft detects a calendar event change:
  │
  ▼
POST /api/webhooks/teams  ← called BY Microsoft Graph
  └─► Immediately return 202 Accepted
      (Microsoft requires response within 3 seconds)
  └─► ctx.waitUntil(processEvent(eventId, userId, env))
      └─► Check: has meeting ended? (end_time < now)
      └─► Check: did it end within last 24h? (transcript window)
      └─► Skip if already "processed" (prevent reprocessing)
      └─► Runs full transcript + AI pipeline in background
      └─► D1 updated while response already sent
```

### Flow E: Manual Transcript Upload

```
User clicks "+ Transcript" on any meeting card
  │
  ▼
Modal opens with textarea
  └─► If meeting already has a summary → amber warning banner:
      "This will erase existing summary, decisions, and action items"
  └─► User pastes text from Zoom, Google Meet, any meeting notes

User clicks "Process with AI"
  │
  ▼
PATCH /api/meetings/{id} { transcript: "..." }
  └─► DELETE old action_items WHERE meeting_id = ?
  └─► UPDATE meeting: transcript, summary, key_decisions, status = 'processed'
  └─► Run processMeeting(transcript) via Workers AI (single 70B call)
  └─► Store summary, key_decisions, action items in D1
  └─► Return { success: true, actionItemsCount: N }
```

### Flow F: Kanban Board

```
User views meeting detail → sees action items
  │
  ▼
Click "+ Board" next to an action item
  └─► PATCH /api/kanban { id: itemId, kanban_column: "backlog" }
  └─► Optimistic UI: button becomes "✓ On Board"

  OR

Click "Add all to Board"
  └─► PATCH /api/kanban { meetingId: meeting.id, kanban_column: "backlog" }
  └─► All action items from this meeting moved to Backlog at once

User navigates to /board
  │
  ▼
GET /api/kanban
  └─► Returns all action_items WHERE kanban_column IS NOT NULL (for this user)
  └─► Joined with meetings.title as meeting_title

User drags card from Backlog → In Progress
  │
  ▼
PATCH /api/kanban { id: itemId, kanban_column: "in_progress" }
  └─► Optimistic update (instant UI)
  └─► Rollback + error toast if request fails
```

---

## 7. Features — What the App Does

### Landing Page (`/`)
- Fixed glassmorphism navbar (blur + semi-transparent bg)
- Violet gradient hero with product mockup built from divs (no screenshots)
- 6-feature grid with inline SVG icons
- 4-step how-it-works section
- Dark CTA band + footer
- Full dark mode support (`dark:` Tailwind classes throughout)

### Dashboard (`/dashboard`)
- **List view** — all meetings as cards, sorted by date
- **Calendar view** — month grid showing meeting dots per day; click any day to filter; month navigation
- Meeting cards show: title (links to detail), date/time, status badge with colored dot, summary (line-clamped), decisions count
- **Expandable action items** per card — click card to show/hide inline checklist
- **Action item checkboxes** — toggle open/done, progress tracked per meeting
- **+ Board** button on each action item — add to Kanban Backlog
- **+ Transcript** button on every meeting — opens paste modal with overwrite warning if meeting already has data
- **Sync Meetings** — fetches from Microsoft Graph + runs AI
- **Enable Auto-Sync** — creates Microsoft Graph webhook subscription
- **AI Search bar** — SQL text search + AI Q&A in parallel; AI answer shown in violet card above results
- Floating toast notifications (bottom-right)
- Skeleton loading state (animated placeholder cards)

### Meeting Detail (`/dashboard/meetings/[id]`)
- Meeting header: title, status badge, date, duration, organizer, attendee chips
- **Search within meeting** — search bar highlights matches in yellow across summary, decisions, action items, and transcript lines; auto-expands and scrolls to transcript when matches found; shows total match count
- AI summary card
- Key decisions (violet dot bullet list)
- Action items with:
  - Checkbox toggle (open / done) with strikethrough + progress bar
  - Assignee badge (violet), due date, priority badge (red = high)
  - **+ Board** / **✓ On Board** toggle per item
  - **Add all to Board** button in header
- No-transcript warning (amber box)
- Collapsible transcript section (full text, monospace, scroll-limited)

### Kanban Board (`/board`)
- 4 columns: **Backlog** → **Todo** → **In Progress** → **Done**
- Each card shows: description, assignee badge, due date, priority, source meeting title (links to meeting)
- **HTML5 drag-and-drop** — drag cards between columns
  - Optimistic UI update (instant)
  - Visual feedback: dragging card goes 50% transparent, drop target column highlights with violet ring
  - Automatic rollback + error toast if server call fails
- Empty state: guides user to meeting detail to add items
- Skeleton loading (4-column pulse)
- Full dark mode

### Analytics (`/analytics`)
- 6 stat cards: Total meetings, Processed, Action items, This week, This month, Key decisions
- **Meetings by Status** — horizontal bar chart (pure CSS, no library)
- **Top Assignees** — bar chart showing action item count per person
- **Recent meetings** table with date, title, status dot
- Skeleton loading state

---

## 8. Code Walkthrough — Every File

### `src/lib/db.ts` — Database Helper
Central database module. Uses `getCloudflareContext()` to get the D1 binding at runtime — required because Cloudflare bindings are injected per-request, not at import time.

**Key functions:**
- `getDb()` → returns the D1 database instance from Cloudflare context
- `createUser(email, name)` → INSERT OR IGNORE into users
- `updateUserTokens(userId, accessToken, refreshToken, expiresAt)` → UPDATE after login
- `createMeeting(userId, teamsMeetingId, title, startTime)` → INSERT meeting row, returns new ID
- `createActionItems(meetingId, items[])` → batch INSERT action items in a loop
- `getActionItemsByMeetingId(meetingId)` → SELECT * (returns `kanban_column` automatically)

### `src/lib/session.ts` — Cookie Session
Reads the `mi_uid` cookie from every request to identify the logged-in user.

```typescript
export function getSessionUserId(request: Request): number | null {
    const cookies = request.headers.get("cookie") ?? "";
    const match = cookies.match(/mi_uid=(\d+)/);
    return match ? parseInt(match[1]) : null;
}
```

Simple numeric cookie — no JWT, no sessions table. The user's D1 row ID is stored directly. Every API route calls this first; if it returns `null`, the route responds 401.

### `src/lib/graph.ts` — Microsoft Graph API Client
Wraps all Microsoft Graph API calls. No SDK — pure `fetch()` calls.

**Key functions:**
- `getCalendarEvents(accessToken, start, end)` → `GET /me/calendarView` — list calendar events
- `getOnlineMeetingByJoinUrl(accessToken, joinUrl)` → `GET /me/onlineMeetings?$filter=JoinWebUrl eq '...'` — translates join URL to meeting object
- `getMeetingTranscript(accessToken, meetingId)` → lists transcripts, downloads VTT, parses to text
- `parseVttToText(vttContent)` → strips WebVTT timestamp markers, returns readable text with speaker labels

**Why the two-step meeting lookup?**  
Calendar events (`/me/events`) have a `joinUrl` but transcripts live under `onlineMeetings`. These use different IDs. The filter-by-JoinWebUrl query bridges them.

### `src/lib/ai.ts` — AI Processing Pipeline
Calls Workers AI to process a meeting transcript into structured data.

**Design decision: single 70B call instead of 3 separate calls.**

Old approach (abandoned): 3 separate model calls — 8B for summary, 70B for action items, 8B for decisions — via `Promise.all`. This had 3× API overhead and each call analyzed the transcript independently (inconsistent results).

New approach: one call to `@cf/meta/llama-3.1-70b-instruct` that returns all three in structured JSON:

```typescript
// Prompt template (MEETING_ANALYSIS_PROMPT):
`Return ONLY valid JSON with this exact structure:
{
  "summary": "2-3 sentence factual summary",
  "keyDecisions": ["Decision made as a clear statement"],
  "actionItems": [{
    "description": "Specific task",
    "assignedTo": "Person's name",
    "dueDate": "YYYY-MM-DD or null",
    "priority": "high|medium|low"
  }]
}`
```

Extraction rules in the prompt:
- `summary`: factual, captures the meeting outcome
- `keyDecisions`: only DEFINITIVE decisions (not proposals), `[]` if none
- `actionItems`: only EXPLICIT tasks with a clear action verb, `[]` if none
- `assignedTo`: infer from "Arun will do X" → "Arun"
- `priority`: "high" if urgent/blocker/deadline mentioned

Robust parsing: strips markdown fences, extracts JSON with regex, validates array shapes, falls back gracefully.

`generateAIAnswer(question, context)` — second exported function used by `/api/ai/ask` for RAG Q&A.

### `src/app/api/auth/microsoft/route.ts` — OAuth Start
Builds the Microsoft OAuth authorization URL and redirects. Scopes include `Calendars.Read`, `OnlineMeetings.Read`, and `OnlineMeetingTranscript.Read.All`. Tenant is `common` — supports both personal and work/school Microsoft accounts.

### `src/app/api/auth/microsoft/callback/route.ts` — OAuth Callback
Called by Microsoft after user approves permissions. Exchanges `code` for tokens via `POST /token`, decodes the `id_token` JWT (base64 split, no verification needed for name/email), upserts user in D1, stores access token in KV, sets `mi_uid` cookie, redirects to `/dashboard`.

### `src/app/api/auth/logout/route.ts` — Logout
Sets `mi_uid` cookie with `Max-Age=0` (immediate expiry). Redirects to `/`.

### `src/app/api/dashboard/route.ts` — Dashboard Data
Returns `{ user, meetings }`. Authenticated via `mi_uid` cookie. Queries D1: `SELECT * FROM meetings WHERE user_id = ? ORDER BY start_time DESC`.

### `src/app/api/meetings/route.ts` — Sync Meetings
POST endpoint. Runs the full Graph API → transcript → AI pipeline for all calendar events in the past 30 days + next 7 days. Returns summary of what was synced. The most compute-heavy endpoint.

### `src/app/api/meetings/[id]/route.ts` — Meeting Detail + Transcript Upload
- **GET** → Returns full meeting row + all action items, `key_decisions` JSON parsed into array
- **PATCH** → Accepts `{ transcript }`, deletes old action items, runs `processMeeting()`, stores AI results, returns `{ success, actionItemsCount }`

### `src/app/api/action-items/route.ts` — Action Items
- **GET** `?meetingId=N` → `SELECT * FROM action_items WHERE meeting_id = ?` (includes `kanban_column`)
- **PATCH** `{ id, status }` → toggle `open` / `done` on a single item, validates ownership

### `src/app/api/kanban/route.ts` — Kanban Board Data
- **GET** → Returns all `action_items WHERE kanban_column IS NOT NULL` for the user, joined with `meetings.title`
- **PATCH** — two modes:
  - Single: `{ id, kanban_column }` → move or remove one item from the board
  - Bulk: `{ meetingId, kanban_column }` → add all action items from a meeting to a column at once
  - Both validate ownership via subquery; allowed columns: `backlog | todo | in_progress | done | null`

### `src/app/api/search/route.ts` — Text Search
SQL LIKE search: `WHERE title LIKE ? OR summary LIKE ? OR transcript LIKE ?`. Returns up to 10 results. Simple and effective at this data scale.

### `src/app/api/ai/ask/route.ts` — AI Q&A (RAG)
Implements RAG without vector embeddings:
1. Fetch all processed meetings + their action items from D1
2. Build a text context (meeting title, date, summary, decisions, action items concatenated)
3. Send to `generateAIAnswer(question, context)` from `src/lib/ai.ts` which calls Llama 3.1 70B
4. Return the answer as plain text

No Vectorize/embeddings — all meeting data fits in the model's context window at this scale.

### `src/app/api/analytics/route.ts` — Analytics Data
Runs aggregate SQL queries:
- `COUNT(*)` total meetings, processed count, action items
- `COUNT(*) WHERE start_time >= date('now', '-7 days')` for weekly/monthly counts
- `GROUP BY status` for status distribution
- `GROUP BY assigned_to ORDER BY COUNT(*) DESC LIMIT 10` for top assignees
- `SELECT` last 10 meetings for recent meetings table

### `src/app/api/webhooks/teams/route.ts` — Webhook Receiver
Two behaviors:
- **GET** with `?validationToken=...` → return the token as plain text (Microsoft handshake)
- **POST** → respond 202 immediately, then `ctx.waitUntil(processEvent(...))` for background AI processing

**Timing guard in `processEvent()`:**
```typescript
const endTime = new Date(event.end.dateTime);
const now = new Date();
// Skip if meeting hasn't ended yet (no transcript available)
if (endTime > now) return;
// Skip if meeting ended more than 24h ago (transcript window closed)
if ((now - endTime) / 3600000 > 24) return;
// Skip if already processed
if (existing?.status === "processed") return;
```

`ctx.waitUntil()` is a Cloudflare Workers API — it keeps the Worker alive to finish async work even after the HTTP response is sent.

### `src/app/api/webhooks/teams/subscribe/route.ts` — Subscribe to Webhooks
Creates a Microsoft Graph subscription for `me/events` (calendar changes). Stores `{ subscriptionId, expiresAt, userId }` in KV so the webhook receiver knows which user's token to use when processing.

### `src/app/(app)/layout.tsx` — Sidebar Shell
Client component (`"use client"`) shared by all routes inside the `(app)` route group — `/dashboard`, `/dashboard/meetings/[id]`, `/analytics`, and `/board`. Uses `usePathname()` to apply the active violet highlight. Dark mode toggle in footer — reads/writes `localStorage` key `meetmind-theme` and toggles `.dark` class on `document.documentElement`.

**Nav items:**
| Label | Route | Icon |
|-------|-------|------|
| Meetings | `/dashboard` | Calendar icon |
| Analytics | `/analytics` | Bar chart icon |
| Board | `/board` | Kanban columns icon |

### `src/app/(app)/dashboard/page.tsx` — Dashboard Page
Main app screen. Client component managing ~12 pieces of state:
- Loads user + meetings on mount via `GET /api/dashboard`
- **View toggle**: `viewMode` — "list" or "calendar"
- **Calendar state**: `calendarDate` (current month), `selectedDay` (YYYY-MM-DD filter)
- Sync button → `POST /api/meetings`
- Search box → parallel calls to `/api/search` + `/api/ai/ask`
- Click meeting card → load action items via `GET /api/action-items?meetingId=N`
- `addToBoard(itemId)` → `PATCH /api/kanban` with `{ id, kanban_column: "backlog" }`
- "+ Transcript" on any meeting → opens modal (with overwrite warning if has existing data)
- "Enable Auto-Sync" → `POST /api/webhooks/teams/subscribe`

### `src/app/(app)/dashboard/meetings/[id]/page.tsx` — Meeting Detail
Fetches `GET /api/meetings/{id}`. State includes:
- `searchQuery` — drives `highlight()` function applied to all text sections
- `transcriptRef` — DOM ref for auto-scroll when search matches transcript
- `actionItems` — local copy with optimistic updates for checkbox + board toggles

**`highlight(text, query)`** helper: escapes the query for regex safety, splits text on matches, wraps matched substrings in `<mark className="bg-yellow-200 dark:bg-yellow-800/60">`. Returns plain text when query is empty.

**`countMatches(text, query)`** helper: counts regex occurrences for the "N matches" display.

### `src/app/(app)/board/page.tsx` — Kanban Board
Fetches `GET /api/kanban` on mount. HTML5 drag-and-drop:
- Card gets `draggable` + `onDragStart` → stores item ID in `dataTransfer`
- Column gets `onDragOver` (preventDefault) + `onDragEnter` / `onDragLeave` + `onDrop`
- `dragLeaveTimers` ref — debounces `onDragLeave` to prevent flickering when cursor crosses card boundaries within a column
- Optimistic update on drop, rollback with error toast if `PATCH /api/kanban` fails

### `src/app/(app)/analytics/page.tsx` — Analytics Page
Fetches `GET /api/analytics`. Renders 6 stat cards, horizontal bar charts (pure CSS width percentages), recent meetings table. No charting library — all Tailwind divs.

### `src/app/page.tsx` — Landing Page
Pure server component (no `"use client"`). Static marketing page. Full dark mode support (`dark:` classes throughout). Sections: fixed glass navbar (backdrop-blur), violet gradient hero with product mockup, 6-feature grid, 4-step how-it-works, dark CTA band, footer.

### `src/app/layout.tsx` — Root HTML Shell
Anti-flash dark mode script in `<head>`:
```html
<script>
  try {
    var t = localStorage.getItem('meetmind-theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
</script>
```
Runs before React hydrates — prevents white flash on dark mode page loads.

### `src/app/globals.css` — Global Styles
```css
@import "tailwindcss";
@variant dark (&:where(.dark, .dark *));  /* Tailwind v4 dark mode via .dark class */
html { scroll-behavior: smooth; }
/* Custom scrollbar (6px, themed for light/dark) */
```

---

## 9. Cloudflare Services Used

| Service | Binding in wrangler.jsonc | Purpose |
|---|---|---|
| **Workers** | `name: meeting-intelligence` | Runs the entire Next.js app at the edge |
| **D1** | `MY_DB` | Relational SQLite DB: users, meetings, action_items |
| **KV** | `MEETING_TOKENS` | Fast token lookup: OAuth tokens + webhook subscription |
| **Workers AI** | `AI` | Llama 3.1 70B inference for meeting analysis + Q&A |
| **Assets** | `ASSETS` | Static file serving: JS bundles, CSS, favicon |

Bindings declared in `wrangler.jsonc`:
```jsonc
{
  "name": "meeting-intelligence",
  "main": ".open-next/worker.js",
  "d1_databases": [{ "binding": "MY_DB", "database_name": "meeting-intelligence", "database_id": "ff79ba38-e613-4a03-8e7a-1f01be20dfe5" }],
  "kv_namespaces": [{ "binding": "MEETING_TOKENS", "id": "c6924f4513dd4d11b919cfad7d46dde0" }],
  "ai": { "binding": "AI" },
  "assets": { "binding": "ASSETS", "directory": ".open-next/assets" }
}
```

In code, bindings are accessed via:
```typescript
const { env } = await getCloudflareContext({ async: true });
const db = env.MY_DB;            // D1Database
const kv = env.MEETING_TOKENS;   // KVNamespace
const ai = env.AI;               // Ai
```

---

## 10. Microsoft Graph API Integration

### OAuth 2.0 Authorization Code Flow
```
App (Azure Registration)
  Client ID: f6ec38bc-b3fc-43de-96ca-5aa11dc9e502
  Tenant:    common (personal + work accounts)
  Redirect:  /api/auth/microsoft/callback

Scopes requested:
  openid profile email          → identity
  User.Read                     → profile name/email
  Calendars.Read                → list calendar events
  OnlineMeetings.Read           → get Teams meeting details
  OnlineMeetingTranscript.Read.All → download transcripts
```

### Why user-delegated (not app-only)?
App-only permissions require an IT admin to grant consent for the whole organization. User-delegated means each user consents for themselves — the app is self-service, no IT involvement needed.

### API Endpoints Called
| Endpoint | Purpose |
|---|---|
| `GET /me/calendarView?startDateTime=...&endDateTime=...` | List calendar events |
| `GET /me/onlineMeetings?$filter=JoinWebUrl eq '...'` | Bridge: join URL → meeting ID |
| `GET /me/onlineMeetings/{id}/transcripts` | List transcript records |
| `GET /me/onlineMeetings/{id}/transcripts/{tId}/content?$format=text/vtt` | Download VTT transcript |
| `POST /subscriptions` | Create webhook subscription |

### Transcript Requirements
- Teams transcription must be **enabled by the meeting organizer** before the meeting starts
- **Free personal Microsoft accounts** → transcription NOT supported
- **Microsoft 365 Business Basic** (or higher) → transcription supported
- Transcripts appear in the Graph API after the meeting ends (usually within a few minutes)
- MeetMind's webhook only processes meetings that ended 0–24 hours ago (transcript window)

---

## 11. AI Pipeline

### Step 1 — Transcript Ingestion
WebVTT format is parsed by `parseVttToText()` in `src/lib/graph.ts`:
- Strips timestamp lines (`00:01:23.456 --> 00:01:25.789`)
- Strips `NOTE`, `WEBVTT` header lines
- Preserves speaker names and their spoken text
- Output: clean readable text like `"Arun: Let's finalize the Q2 budget..."`
- Transcript truncated at 12,000 characters before sending to AI (context window management)

### Step 2 — AI Summarization (Single Call)
`processMeeting()` in `src/lib/ai.ts`:
- **One** LLM call to `@cf/meta/llama-3.1-70b-instruct` on Cloudflare Workers AI
- Returns all three outputs in one JSON response
- `max_tokens: 1500`

```
Prompt → single JSON response:
{
  "summary": "2-3 sentence factual summary...",
  "keyDecisions": ["Decision 1", "Decision 2"],
  "actionItems": [
    { "description": "...", "assignedTo": "Arun", "dueDate": "2026-06-01", "priority": "high" }
  ]
}
```

Why 70B over 8B: The 70B model produces significantly more accurate structured extraction, especially for inferring task assignment from natural language ("Arun will take care of the vendor contract" → `assignedTo: "Arun"`).

### Step 3 — Storage
Results stored in D1:
- `meetings.summary` ← AI paragraph
- `meetings.key_decisions` ← JSON stringified array (`JSON.stringify(keyDecisions)`)
- `action_items` table ← one row per action item with `status = 'open'`, `kanban_column = NULL`

### Step 4 — RAG Q&A
`/api/ai/ask` implements context-stuffing RAG via `generateAIAnswer()` in `src/lib/ai.ts`:
```
Context = all processed meetings concatenated:
  "Meeting: 'Q2 Planning' (2026-05-20)
   Summary: The team discussed the Q2 roadmap...
   Decisions: Approved $50K budget; Moved launch to June
   Action items:
   - Finalize vendor contract (assigned to: Arun)
   - Update roadmap slides (assigned to: Sarah)"

  "Meeting: 'API Review' (2026-05-18)
   ..."

Question: "Who is responsible for the vendor contract?"
Answer: "Arun is responsible for finalizing the vendor contract,
         as decided in the Q2 Planning meeting on May 20, 2026."
```

No vector embeddings — works well for up to ~100 meetings within a single context.

### Step 5 — Search Within Meeting (Client-side)
The `highlight(text, query)` function on the meeting detail page does client-side search — no server call needed since all data is already loaded:
1. Escape the query string for regex safety
2. Split text on regex matches
3. Wrap matched substrings in `<mark>` tags
4. Count total matches across summary + decisions + action items + transcript
5. Auto-expand transcript section and scroll to it if matches found there

---

## 12. Deployment

### Local Development
```bash
npm run dev
```
- Runs `next dev` with the OpenNext dev shim (`initOpenNextCloudflareForDev()` in `next.config.ts`)
- D1 and KV use local SQLite files stored in `.wrangler/state/v3/`
- Workers AI calls go to Cloudflare's remote AI service even in dev (AI binding is always remote)

### Production Deployment
```bash
npm run deploy
# Expands to: opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

Step by step:
1. `opennextjs-cloudflare build` → runs `next build`, then wraps output for Workers → `.open-next/worker.js`
2. `opennextjs-cloudflare deploy` → runs `wrangler deploy` using `wrangler.jsonc` config
3. Wrangler uploads `.open-next/worker.js` + all static assets to Cloudflare

**Important:** Always use `npm run deploy`, not `npx @cloudflare/next-on-pages` — that's a different (incompatible) adapter with a different output path.

### Apply Database Migrations
```bash
# Apply each migration file to local dev:
npx wrangler d1 execute meeting-intelligence --local --file=migrations/001_create_users.sql
npx wrangler d1 execute meeting-intelligence --local --file=migrations/002_create_meetings.sql
npx wrangler d1 execute meeting-intelligence --local --file=migrations/003_create_action_items.sql
npx wrangler d1 execute meeting-intelligence --local --file=migrations/003_add_key_decisions.sql
npx wrangler d1 execute meeting-intelligence --local --file=migrations/004_add_kanban_column.sql

# Apply to remote (production):
npx wrangler d1 execute meeting-intelligence --remote --file=migrations/001_create_users.sql
# ... (same for each migration)

# Or apply a raw SQL command directly (e.g., for ALTER TABLE):
npx wrangler d1 execute meeting-intelligence --remote --command="ALTER TABLE action_items ADD COLUMN kanban_column TEXT DEFAULT NULL;"
```

### Environment Variables
`.dev.vars` for local, Cloudflare Secrets for production:
```
MICROSOFT_CLIENT_ID=f6ec38bc-b3fc-43de-96ca-5aa11dc9e502
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=common
```

---

## 13. Presentation Script

Use this to explain the project in 5 minutes:

---

### Opening (30 seconds)
> "MeetMind is an AI meeting intelligence tool — think Fireflies.ai or Otter.ai, but built entirely on Cloudflare's edge platform. The idea is simple: you connect your Microsoft account, and every Teams meeting you have gets automatically transcribed, summarized, and turned into tracked action items by AI."

### The Problem (30 seconds)
> "After every meeting, someone has to write up notes, extract action items, and remember what was decided. Most people either skip this or spend 20 minutes doing it manually. MeetMind does it in seconds, automatically — and then gives you a Kanban board to track those action items across all your meetings."

### Live Demo Flow (2 minutes)
1. **Landing page** → "This is the marketing page. Server component served from Cloudflare's edge — no traditional web server, no container, running at 300+ locations globally."
2. **Sign in** → "OAuth 2.0 with Microsoft. User-delegated permissions, so no IT admin approval needed — anyone can connect their own account."
3. **Dashboard** → "After logging in, you see all your Teams meetings. I can switch between list view and calendar view — the calendar shows colored dots per day based on meeting status."
4. **Calendar** → "Click a day and the list below filters to just those meetings. Standard Teams-style calendar navigation."
5. **Meeting detail** → "Here's the full view: AI-generated summary, key decisions as a bullet list, action items with assignees and due dates. I can type in this search box and it highlights matches across the transcript in real time — no server call, all client-side."
6. **Add to Board** → "See this '+ Board' button? I can push individual action items to the Kanban board, or hit 'Add all to Board' to move everything at once."
7. **Kanban Board** → "Here's the board — four columns: Backlog, Todo, In Progress, Done. Full drag-and-drop. Changes persist instantly via the API with optimistic updates."
8. **Search + AI** → "Back on the dashboard, I can ask a natural language question. It hits two endpoints in parallel: SQL text search for matching meeting cards, and an AI Q&A endpoint that reads all my meeting data as context. No OpenAI — running on Cloudflare's own GPU infrastructure."
9. **Transcript upload** → "For meetings without a Teams transcript — say from Zoom or Google Meet — I can click '+ Transcript', paste the text, and the AI processes it. If I do it on a meeting that already has data, I get a warning that it'll overwrite everything."

### Why Cloudflare (1 minute)
> "Everything runs on Cloudflare. Compute is Workers — serverless JavaScript, zero cold starts, 300+ edge locations. Database is D1 — serverless SQLite, runs at the edge alongside Workers, no connection pooling. AI is Workers AI — Llama 3.1 70B running on Cloudflare's GPUs, no separate AI server."

> "The key advantage: zero infrastructure to manage. No EC2, no RDS, no GPU server. One `wrangler.jsonc` file declares D1, KV, and AI bindings. One command — `npm run deploy` — and it's live globally."

### Technical Highlight (30 seconds)
> "One interesting piece is the real-time webhook integration. When a Teams meeting ends and a transcript becomes available, Microsoft Graph calls our `/api/webhooks/teams` endpoint. We respond in under 200ms — which Microsoft requires — then use `ctx.waitUntil()` to process the transcript with AI in the background. We also guard against processing meetings that haven't ended yet, or ended more than 24 hours ago, since the transcript window closes."

### Closing (30 seconds)
> "This is a working production app at meeting-intelligence.arunnewpage.workers.dev. The entire stack — frontend, backend, database, AI, real-time webhooks — runs at Cloudflare's edge. On AWS, infrastructure like this would take weeks to set up and cost significantly more. On Cloudflare, it's one config file and a single deploy command."

---

## Quick Reference — File Map

```
src/
├── app/
│   ├── page.tsx                           ← Landing page (server component, dark mode)
│   ├── layout.tsx                         ← Root HTML shell + anti-flash dark mode script
│   ├── globals.css                        ← Tailwind v4 + dark variant + scrollbar
│   └── (app)/                             ← Route group: all authenticated pages
│       ├── layout.tsx                     ← Sidebar (Meetings, Analytics, Board) + dark toggle
│       ├── dashboard/
│       │   ├── page.tsx                   ← List/Calendar view, search, sync, Kanban add
│       │   └── meetings/[id]/
│       │       └── page.tsx               ← Detail: search, highlight, board buttons
│       ├── analytics/
│       │   └── page.tsx                   ← Stats, bar charts, recent meetings
│       └── board/
│           └── page.tsx                   ← Kanban board with HTML5 drag-and-drop
│
├── api/
│   ├── auth/
│   │   ├── microsoft/route.ts             ← Redirect to Microsoft OAuth
│   │   ├── microsoft/callback/route.ts    ← Handle callback, set session cookie
│   │   └── logout/route.ts               ← Clear cookie, redirect to /
│   ├── dashboard/route.ts                 ← GET: user + meetings
│   ├── meetings/
│   │   ├── route.ts                       ← POST: sync from Microsoft Graph + AI
│   │   └── [id]/route.ts                  ← GET: detail | PATCH: upload transcript
│   ├── action-items/route.ts              ← GET by meetingId | PATCH: toggle status
│   ├── kanban/route.ts                    ← GET: board items | PATCH: move item/bulk add
│   ├── search/route.ts                    ← POST: SQL LIKE text search
│   ├── ai/
│   │   ├── ask/route.ts                   ← POST: RAG Q&A via generateAIAnswer()
│   │   └── process/route.ts              ← POST: re-process meetings with AI
│   ├── analytics/route.ts                 ← GET: aggregate stats
│   └── webhooks/teams/
│       ├── route.ts                       ← Receive Graph webhooks, background AI
│       └── subscribe/route.ts             ← Create Graph webhook subscription
│
└── lib/
    ├── db.ts                              ← D1 helpers: getDb, createMeeting, etc.
    ├── graph.ts                           ← Microsoft Graph API client
    ├── ai.ts                              ← processMeeting() + generateAIAnswer()
    └── session.ts                         ← Read mi_uid cookie → userId

migrations/
    ├── 001_create_users.sql
    ├── 002_create_meetings.sql
    ├── 003_create_action_items.sql
    ├── 003_add_key_decisions.sql
    └── 004_add_kanban_column.sql          ← kanban_column TEXT DEFAULT NULL

wrangler.jsonc                             ← Cloudflare bindings + deployment config
next.config.ts                             ← Next.js config + OpenNext dev init
package.json                               ← Scripts: dev, deploy, build
.dev.vars                                  ← Local secrets (not committed)
```

---

## Design System

All UI uses a consistent design language:

| Element | Light | Dark |
|---|---|---|
| Page background | `bg-white` / `bg-slate-50` | `dark:bg-slate-900` / `dark:bg-slate-950` |
| Card background | `bg-white` | `dark:bg-slate-800` |
| Card border | `border-slate-200` | `dark:border-slate-700` |
| Primary text | `text-slate-900` | `dark:text-slate-100` |
| Secondary text | `text-slate-500` | `dark:text-slate-400` |
| Accent / active | `bg-violet-600` | `bg-violet-600` (same) |
| Success | `text-emerald-600 bg-emerald-50` | `dark:text-emerald-400 dark:bg-emerald-900/30` |
| Warning | `text-amber-600 bg-amber-50` | `dark:text-amber-400 dark:bg-amber-900/20` |
| Danger | `text-red-600 bg-red-50` | `dark:text-red-400 dark:bg-red-900/20` |
| Search highlight | `bg-yellow-200` | `dark:bg-yellow-800/60` |

No UI component library — everything is built with Tailwind classes and inline SVG icons.

Dark mode is toggled via `.dark` class on `document.documentElement`, persisted to `localStorage` under key `meetmind-theme`, and initialized before React hydrates via an inline `<script>` in `<head>` to prevent flash.
