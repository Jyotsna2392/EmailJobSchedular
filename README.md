# 🚀 ReachInbox - Production-Grade Full-Stack Email Job Scheduler

A high-throughput, persistent email job scheduling and sending engine built for **ReachInbox**. 

This system accepts email send requests via REST APIs, schedules delayed jobs with **BullMQ + Redis**, sends fake SMTP emails via **Ethereal Email**, indexes emails into **Elasticsearch** for full-text search, enforces **concurrency, provider throttling, and hourly rate limits**, dispatches real-time **Slack alerts**, and **survives server restarts** without re-sending or losing queued jobs.

---

## 📸 Features & Requirement Mapping

| Feature | Backend Implementation | Frontend UI |
|---|---|---|
| **No Cron Jobs** | BullMQ delayed jobs (`delay = scheduledAt - now`) | Instant scheduling feedback & queue status |
| **Persistence on Restart** | State in DB + Redis job ID idempotency check on boot | Visual job state persistence |
| **Worker Concurrency** | Configurable worker concurrency level (`WORKER_CONCURRENCY`) | Metrics dashboard & live queue indicator |
| **Provider Throttling** | Enforces minimum delay between emails (`MIN_SEND_DELAY_MS`) | Configurable per email batch |
| **Hourly Rate Limiting** | Redis sliding window atomic counter (`ratelimit:sender:window`) | Reschedules job & updates state in real-time |
| **Slack Alerts** | Dispatches live Slack notifications when rate cap is reached | "Connect Slack" Webhook/OAuth integration |
| **Fake SMTP** | Ethereal Email transport returning preview URLs | Clickable Ethereal preview links for every email |
| **Elasticsearch** | Multi-match indexing over subject, body, lead email, status | Dedicated Elasticsearch search bar with live pill |
| **Live Queue Dashboard** | Integrated `@bull-board/express` on `/admin/queues` | One-click header button to open BullMQ Admin |

---

## 🏗 System Architecture

```
 ┌─────────────────────────────────────────────────────────────────┐
 │                      Frontend (React + Vite)                    │
 │   Google OAuth | Dashboard | CSV Uploader | Search | Slack Connect│
 └────────────────────────────────┬────────────────────────────────┘
                                  │ REST APIs
 ┌────────────────────────────────▼────────────────────────────────┐
 │                      Express Backend (TypeScript)               │
 ├───────────────────┬───────────────────┬─────────────────────────┤
 │  Email Controller │  Slack Controller │  Elasticsearch Router   │
 └─────────┬─────────┴─────────┬─────────┴────────────┬────────────┘
           │                   │                      │
 ┌─────────▼─────────┐ ┌───────▼─────────┐ ┌──────────▼──────────┐
 │  PostgreSQL / DB  │ │  Redis (BullMQ) │ │  Elasticsearch 8+    │
 │ (Persistence/Logs)│ │(Job Scheduling) │ │(Email Search Index)  │
 └───────────────────┘ └───────┬─────────┘ └─────────────────────┘
                               │
                       ┌───────▼─────────┐
                       │ BullMQ Workers  │
                       │ Rate Limiter &  │
                       │ Throttling Check│
                       └───────┬─────────┘
                               ├──────────────────────┐
                      ┌────────▼────────┐    ┌────────▼────────┐
                      │ Ethereal SMTP   │    │ Slack Webhook/  │
                      │ Fake Mail Send  │    │ OAuth Alert API │
                      └─────────────────┘    └─────────────────┘
```

---

## ⚡ Core Engineering Details

### 1️⃣ Server Restart Resilience & Idempotency
- When an email request is received, a record is created in the database with status `SCHEDULED` and a unique UUID `emailId`.
- The BullMQ job is added with `jobId = emailId`. BullMQ natively deduplicates jobs matching existing IDs.
- On server startup (`reconcileJobsOnServerStart`), the backend queries the DB for any pending `SCHEDULED` or `RATE_LIMITED` jobs and re-establishes their delayed timers in BullMQ.
- If a job was already `SENT`, the worker detects `status === 'SENT'` and terminates immediately without duplicating sends.

### 2️⃣ Concurrency, Delay & Rate Limiting Strategy
- **Worker Concurrency**: Set via `WORKER_CONCURRENCY=5`. Multiple emails process in parallel safely.
- **Min Delay Between Sends**: Enforces a minimum pause (e.g. 2 seconds) in the worker before issuing the SMTP command.
- **Hourly Cap**: Managed via Redis atomic `INCRBY` keys formatted as `ratelimit:{sender}:{YYYY-MM-DD-HH}`.
- **Behavior Under Load**: When 1000+ emails exceed the hourly limit:
  1. The worker calculates the start timestamp of the next hour window (`nextHour`).
  2. Postpones the job delay by `nextHour - now`.
  3. Updates DB status to `RATE_LIMITED`.
  4. Triggers a **live Slack alert** payload via HTTP POST to the user's Slack webhook.
  5. Jobs are never dropped or failed permanently; they queue gracefully into the next window.

---

## 🚦 Quick Start Guide

### Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **Docker Compose** (optional for Redis, PostgreSQL, Elasticsearch):
  ```bash
  docker-compose up -d
  ```
  *(Note: Backend automatically runs with Prisma SQLite fallback and in-memory search if external DB/Redis are offline)*

---

### 1️⃣ Run Backend

```bash
cd backend

# Install dependencies (if not done)
npm install

# Push database schema (Prisma)
npx prisma db push

# Start backend dev server
npm run dev
```

Backend will run on **http://localhost:5000**.
- **Live BullMQ Queue Admin**: [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues)
- **API Health Check**: [http://localhost:5000/health](http://localhost:5000/health)

---

### 2️⃣ Run Frontend

```bash
cd frontend

# Install dependencies (if not done)
npm install

# Start Vite dev server
npm run dev
```

Frontend will run on **http://localhost:3000**.

---

## 🧪 Verification Walkthrough

### Test 1: Compose & Schedule Email
1. Click **"Compose New Email"** in the top right.
2. Upload a CSV file or paste lead email addresses.
3. Enter subject and body content.
4. Set start time, inter-email delay (e.g. 2s), and hourly limit cap.
5. Click **"Schedule Email(s)"**. Watch jobs appear in the **Scheduled Emails** tab.

### Test 2: Verify Server Restart Resilience
1. Schedule an email for 2 minutes in the future.
2. Stop the backend server process (`Ctrl+C`).
3. Wait 1 minute, then restart backend (`npm run dev`).
4. Notice log: `Server restart check complete: Re-enqueued pending jobs`.
5. The email will send at its exact scheduled time!

### Test 3: Slack Notification on Rate Limit Hit
1. Click **"Connect Slack"** in the header.
2. Enter your Slack Incoming Webhook URL and save.
3. Schedule 5 emails with `Hourly Limit = 2`.
4. After 2 emails send, the 3rd email hits the limit:
   - Status changes to `RATE_LIMITED`.
   - Job is delayed to the next hour window.
   - **Check your Slack channel** - a live rich Slack notification card will arrive!

---

## 📂 Project Structure

```
EmailJobSchedular/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   ├── src/
│   │   ├── config/               # DB, Redis, Elasticsearch & Env config
│   │   ├── controllers/          # Express API controllers
│   │   ├── queue/                # BullMQ Queue producer & worker logic
│   │   ├── routes/               # REST API endpoints
│   │   ├── services/             # Ethereal, Search & Slack services
│   │   └── server.ts             # Server entry point
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/           # Header, ComposeModal, EmailTable, SlackConnect
│   │   ├── services/             # Axios API client
│   │   ├── types/                # TypeScript definitions
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```
