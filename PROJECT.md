# AI Meeting Intelligence Platform - Project Documentation

## Overview

An AI-powered platform that integrates with Microsoft Teams to automatically capture, analyze, and summarize meetings. The platform provides actionable insights, key decisions, action items, and meeting analytics using Cloudflare's edge computing infrastructure and AI capabilities.

---

## Architecture

```
Microsoft Teams → Microsoft Graph API → Cloudflare Worker (Next.js) → Cloudflare Services
                                                                    ↓
                                                            AI Processing → D1 Database
                                                                    ↓
                                                            Dashboard UI → User
```

---

## Phase 1: Authentication & User Management ✅ (In Progress)

### What We're Doing
- Setting up OAuth 2.0 authentication with Microsoft
- Creating user accounts in the database
- Storing and managing access/refresh tokens
- Building the landing page and dashboard UI

### What We Get
- Users can sign in with their Microsoft 365 account
- Secure token storage for API access
- Basic dashboard showing user profile and meetings

### Cloudflare Services Used

| Service | Purpose | Why We Use It |
|---------|---------|---------------|
| **Workers** | Host the Next.js application at the edge | Global low-latency, serverless, no cold starts with OpenNext |
| **D1** | Store user accounts, meetings, action items | SQLite database at the edge, perfect for structured relational data, free tier generous |
| **KV** | Cache OAuth tokens for fast retrieval | Ultra-fast key-value store, ideal for token lookups (sub-millisecond reads) |

### Database Schema

```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Meetings table
CREATE TABLE meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    status TEXT DEFAULT 'pending',
    summary TEXT,
    key_decisions TEXT,
    transcript TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Action Items table
CREATE TABLE action_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    assignee TEXT,
    due_date DATETIME,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id)
);
```

### Files Created
- `src/app/page.tsx` - Landing page
- `src/app/dashboard/page.tsx` - Dashboard UI
- `src/app/api/auth/microsoft/route.ts` - OAuth initiation
- `src/app/api/auth/microsoft/callback/route.ts` - OAuth callback handler
- `src/app/api/dashboard/route.ts` - Dashboard data API
- `src/lib/db.ts` - Database helper functions
- `migrations/0001_create_tables.sql` - Database schema

---

## Phase 2: Teams Webhook Integration (Next)

### What We're Doing
- Create webhook endpoint to receive Teams meeting notifications
- Subscribe to Microsoft Graph change notifications for meetings
- Handle webhook validation and subscription renewal
- Queue incoming meeting events for processing

### What We Get
- Real-time notifications when meetings end
- Automatic triggering of meeting processing pipeline
- No need to poll the Graph API (event-driven architecture)

### Cloudflare Services Used

| Service | Purpose | Why We Use It |
|---------|---------|---------------|
| **Workers** | Host webhook endpoint | Handles incoming HTTP POST requests from Microsoft Graph |
| **Queues** | Queue meeting events for async processing | Decouples webhook reception from heavy AI processing, provides retry logic |
| **KV** | Store webhook subscription IDs and expiration | Fast lookup for subscription management and renewal |

### Webhook Flow

```
Teams Meeting Ends
       ↓
Microsoft Graph sends POST to /api/webhooks/teams
       ↓
Worker validates notification signature
       ↓
Queue the meeting ID for processing
       ↓
Return 202 Accepted to Microsoft (within 5 seconds)
       ↓
Queue consumer processes meeting asynchronously
```

### Files to Create
- `src/app/api/webhooks/teams/route.ts` - Webhook endpoint
- `src/app/api/webhooks/teams/subscribe/route.ts` - Subscription management
- `src/lib/webhooks.ts` - Webhook validation helpers
- `src/queue.ts` - Queue consumer for meeting processing

---

## Phase 3: Meeting Data Collection

### What We're Doing
- Fetch meeting details from Microsoft Graph API
- Retrieve meeting transcripts (if available)
- Get participant information and attendance
- Store raw meeting data in D1

### What We Get
- Complete meeting metadata (title, time, participants)
- Meeting transcripts for AI processing
- Attendance records for analytics

### Cloudflare Services Used

| Service | Purpose | Why We Use It |
|---------|---------|---------------|
| **Workers** | Make authenticated requests to Graph API | Runs the processing logic, handles token refresh |
| **D1** | Store raw meeting data | Persistent storage for all meeting records |
| **R2** | Store large meeting artifacts (recordings, full transcripts) | S3-compatible object storage, cheaper than storing large text in D1 |

### Graph API Endpoints Used

| Endpoint | Purpose | Required Scope |
|----------|---------|----------------|
| `GET /me/onlineMeetings` | List user's meetings | `OnlineMeetings.Read` |
| `GET /me/onlineMeetings/{id}` | Get meeting details | `OnlineMeetings.Read` |
| `GET /me/onlineMeetings/{id}/transcript` | Get meeting transcript | `OnlineMeetings.Read` |
| `GET /users/{id}/presence` | Get participant presence | `Presence.Read` |

### Files to Create
- `src/lib/graph.ts` - Microsoft Graph API client
- `src/lib/meetings.ts` - Meeting data fetchers
- `src/app/api/meetings/route.ts` - Meetings list API
- `src/app/api/meetings/[id]/route.ts` - Single meeting API

---

## Phase 4: AI Processing Pipeline

### What We're Doing
- Process meeting transcripts with Cloudflare AI
- Generate meeting summaries
- Extract key decisions and action items
- Identify topics and sentiment

### What We Get
- AI-generated meeting summaries
- Extracted action items with assignees
- Key decisions and discussion topics
- Sentiment analysis of meeting tone

### Cloudflare Services Used

| Service | Purpose | Why We Use It |
|---------|---------|---------------|
| **AI** | Run LLM models for text processing | Serverless AI inference at the edge, no GPU management, pay-per-use |
| **Queues** | Process meetings asynchronously | Handles long-running AI tasks without blocking webhooks |
| **Workers** | Orchestrate AI processing pipeline | Coordinates the flow from transcript to summary |

### AI Models Available on Cloudflare

| Model | Use Case | Why |
|-------|----------|-----|
| `@cf/meta/llama-3.1-8b-instruct` | Meeting summarization | Fast, good quality for structured text |
| `@cf/meta/llama-3.1-70b-instruct` | Complex analysis | Higher quality for detailed extraction |
| `@cf/baai/bge-large-en-v1.5` | Text embeddings | For semantic search and similarity |

### Processing Pipeline

```
Meeting Transcript (from R2/D1)
       ↓
Queue Consumer picks up job
       ↓
Step 1: Generate Summary (Llama 3.1 8B)
       ↓
Step 2: Extract Action Items (Llama 3.1 70B)
       ↓
Step 3: Identify Key Decisions (Llama 3.1 8B)
       ↓
Step 4: Analyze Sentiment (Llama 3.1 8B)
       ↓
Store results in D1
```

### Files to Create
- `src/lib/ai.ts` - AI processing functions
- `src/queue.ts` - Queue consumer with AI processing
- `src/lib/prompts.ts` - AI prompt templates

---

## Phase 5: Vector Search & Meeting Intelligence

### What We're Doing
- Create embeddings for meeting content
- Store embeddings in Vectorize
- Enable semantic search across meetings
- Find similar meetings and related content

### What We Get
- Search meetings by natural language queries
- Find related meetings and topics
- Discover patterns across meeting history
- "What was discussed about X?" type queries

### Cloudflare Services Used

| Service | Purpose | Why We Use It |
|---------|---------|---------------|
| **Vectorize** | Store and query meeting embeddings | Serverless vector database, perfect for semantic search, integrates with Workers |
| **AI** | Generate text embeddings | Creates vector representations of meeting content |

### Vectorize Index Schema

```
Index: meeting-embeddings
Dimensions: 1024 (for bge-large-en-v1.5)
Metric: cosine
Metadata: meeting_id, user_id, date, title
```

### Search Flow

```
User Query: "What did we decide about the budget?"
       ↓
Generate embedding for query (AI)
       ↓
Search Vectorize for similar embeddings
       ↓
Return matching meetings with context
       ↓
AI generates answer from context
```

### Files to Create
- `src/lib/vectorize.ts` - Vector search functions
- `src/app/api/search/route.ts` - Search API
- `src/app/search/page.tsx` - Search UI

---

## Phase 6: Scheduled Tasks & Automation

### What We're Doing
- Set up cron jobs for subscription renewal
- Refresh OAuth tokens before expiration
- Generate weekly/monthly meeting reports
- Clean up old data

### What We Get
- Automatic webhook subscription renewal (Graph subscriptions expire after 3 days)
- Continuous token refresh without user intervention
- Scheduled report generation
- Automated data maintenance

### Cloudflare Services Used

| Service | Purpose | Why We Use It |
|---------|---------|---------------|
| **Cron Triggers** | Run scheduled tasks | Serverless cron, no need for external schedulers, integrated with Workers |
| **Workers** | Execute scheduled tasks | Runs the renewal and cleanup logic |
| **KV** | Track last run times and state | Persistent state between cron invocations |

### Cron Schedule

| Task | Frequency | Purpose |
|------|-----------|---------|
| Subscription renewal | Every 2 days | Keep Graph webhooks active (expire every 3 days) |
| Token refresh | Every hour | Ensure access tokens don't expire |
| Weekly report | Every Monday 9 AM | Generate weekly meeting summary |
| Data cleanup | Daily at midnight | Remove old processed data |

### Files to Create
- `src/scheduled.ts` - Cron handler
- `src/lib/subscriptions.ts` - Subscription management
- `src/lib/reports.ts` - Report generation

---

## Phase 7: Advanced Features & Polish

### What We're Doing
- Real-time notifications via WebSockets
- Meeting analytics dashboard
- Export functionality (PDF, CSV)
- Multi-user collaboration features

### What We Get
- Live updates when meetings are processed
- Rich analytics (meeting frequency, duration trends)
- Export reports for sharing
- Team-level insights

### Cloudflare Services Used

| Service | Purpose | Why We Use It |
|---------|---------|---------------|
| **Durable Objects** | Real-time WebSocket connections | Persistent stateful connections, perfect for live updates |
| **D1** | Store analytics aggregations | Efficient queries for dashboard metrics |
| **R2** | Store exported reports | Durable storage for generated files |

### Durable Objects Use Case

```
User opens dashboard
       ↓
WebSocket connection to Durable Object
       ↓
DO tracks user's active session
       ↓
When meeting processing completes
       ↓
DO pushes update to connected WebSocket
       ↓
Dashboard updates in real-time
```

### Files to Create
- `src/durable-objects/notification.ts` - Real-time notifications
- `src/app/api/analytics/route.ts` - Analytics API
- `src/app/analytics/page.tsx` - Analytics dashboard
- `src/lib/export.ts` - Export functionality

---

## Complete Cloudflare Service Summary

| Service | Phase | Purpose | Cost |
|---------|-------|---------|------|
| **Workers** | All | Host application logic | 100K requests/day free |
| **D1** | 1, 3, 5, 7 | Relational data storage | 5M reads/day free |
| **KV** | 1, 2, 6 | Fast key-value cache | 100K reads/day free |
| **R2** | 3, 7 | Object storage for large files | 1M reads/month free |
| **AI** | 4, 5 | LLM inference and embeddings | 10K Neurons/day free |
| **Vectorize** | 5 | Vector database for search | 1M vector reads/month free |
| **Queues** | 2, 4 | Async message processing | 1M operations/month free |
| **Cron Triggers** | 6 | Scheduled task execution | Free |
| **Durable Objects** | 7 | Real-time WebSocket state | 1M requests/month free |

---

## Microsoft Graph API Permissions

| Permission | Type | Purpose | Phase |
|------------|------|---------|-------|
| `User.Read` | Delegated | Get user profile | 1 |
| `OnlineMeetings.Read` | Delegated | Access meeting data | 3 |
| `CallRecords.Read.All` | Application | Access call recordings | 4 |
| `Presence.Read` | Delegated | Get participant status | 3 |

---

## Development Workflow

### Local Development
```bash
npm run dev          # Start Next.js dev server with Cloudflare bindings
npx wrangler d1      # Manage D1 database locally
npx wrangler kv      # Manage KV namespace locally
```

### Deployment
```bash
npm run deploy       # Build and deploy to Cloudflare
npx wrangler deploy  # Deploy Worker directly
```

### Database Migrations
```bash
npx wrangler d1 migrations apply meeting-intelligence  # Apply migrations
```

---

## Next Steps

1. **Complete Phase 1**: Fix OAuth scope issue and test end-to-end authentication
2. **Start Phase 2**: Create webhook endpoint and Graph subscription
3. **Proceed through phases**: Build out the full pipeline

---

## Key Decisions & Rationale

### Why Cloudflare?
- **Edge computing**: Low latency globally
- **Serverless**: No infrastructure management
- **Integrated ecosystem**: All services work together seamlessly
- **Generous free tier**: Perfect for development and early production
- **OpenNext**: Native Next.js support on Cloudflare

### Why Microsoft Graph API?
- **Official Teams integration**: Direct access to Teams data
- **Webhook support**: Event-driven architecture
- **Comprehensive**: Meetings, chats, files, calendar all in one API

### Why OpenNext?
- **Next.js compatibility**: Run Next.js apps on Cloudflare Workers
- **Automatic optimization**: Handles routing, caching, and asset serving
- **Dev experience**: Local development with Cloudflare bindings
