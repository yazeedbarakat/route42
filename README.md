# route42 🚌

> A smart shuttle booking system built for **42 Irbid** students, drivers, and admins.

**🌐 Live site:** https://workspaceapi-server-production-5db6.up.railway.app

---

## Overview

route42 makes it easy for 42 Irbid students to book shuttle rides to and from campus. No more group chats or guessing — just open the app, pick your slot, and you're in.

<!-- Screenshot: Landing / Login page -->
![Login](screenshots/login.png)

---

## Features

### For Students
- Sign in with your **@learner.42.tech** Google account
- Book a ride **to campus** (today) or **from campus** (tomorrow)
- A slot **auto-confirms** once 6 riders join — no admin needed
- Cancel anytime before the ride
- Get notified when your booking is confirmed or cancelled
- View your full booking history

<!-- Screenshot: Student dashboard -->
![Dashboard](screenshots/dashboard.png)

<!-- Screenshot: Booking page -->
![Book a Ride](screenshots/book.png)

### For Admins
- Full overview of all bookings across all slots
- Manage drivers — add, view, and remove driver accounts
- Manage pickup terminals and schedule
- View and manage all student accounts

<!-- Screenshot: Admin dashboard -->
![Admin Dashboard](screenshots/admin.png)

### For Drivers
- See assigned trips for the day
- View the route map

---

## How Booking Works

1. Log in with your 42 Google account
2. Choose a direction — **To Campus** or **From Campus**
3. Pick an available time slot
4. Your booking starts as **pending**
5. Once **6 students** book the same slot → status becomes **confirmed** ✅
6. If someone cancels and the count drops below 6 → slot goes back to pending

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React, Vite, Tailwind CSS, TanStack Query |
| Routing | Wouter |
| Backend | Node.js, Express |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Neon) |
| Auth | JWT + Google OAuth 2.0 |
| Deployment | Railway |

---

## Running Locally

This is a pnpm workspace monorepo (Node.js, TypeScript, Express API + Vite frontend, PostgreSQL/Drizzle).

### 1. Install dependencies

```bash
pnpm install
```

### 2. Database

Needs a PostgreSQL database. If you don't already have one running, you can
spin up a standalone instance owned by your own user (no root/sudo needed):

```bash
mkdir -p ~/.local/share/route42-pgdata
initdb -D ~/.local/share/route42-pgdata -U "$USER" -A trust
pg_ctl -D ~/.local/share/route42-pgdata -l ~/.local/share/route42-pgdata/logfile -o "-p 5433 -k /tmp" start
psql -h /tmp -p 5433 -U "$USER" -d postgres -c "CREATE DATABASE route42;"
```

(Only run `initdb` once — after that, just `pg_ctl ... start` to bring it back up.)

### 3. Environment variables

Create `.env.local` in the repo root:

```bash
DATABASE_URL=postgresql://YOUR_USER@localhost:5433/route42?host=/tmp
SESSION_SECRET=some-local-dev-secret
PORT=8080
NODE_ENV=development
```

Google OAuth login (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) is
configured in the Railway deployment's secrets, not in the repo, so it
won't work out of the box locally. Email/username+password and driver
login work fine without it. See `replit.md` for demo credentials.

### 4. Run

Push the DB schema, build, and start the API server (port 8080):

```bash
set -a; source .env.local; set +a
pnpm --filter @workspace/api-server run dev
```

In a second terminal, start the frontend (Vite dev server, proxies `/api` to the API server):

```bash
cd artifacts/shuttle
PORT=5000 BASE_PATH=/ pnpm run dev
```

Open **http://localhost:5000**.

### Stop

```bash
lsof -ti:5000,8080 -sTCP:LISTEN | xargs -r kill
pg_ctl -D ~/.local/share/route42-pgdata stop
```

---

## Built by

[entrape](https://github.com/entrape), [rsn026](https://github.com/rsn026), [yazeedbarakat](https://github.com/yazeedbarakat) — for 42 Irbid
