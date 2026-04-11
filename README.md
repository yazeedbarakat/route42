# route42

A shuttle booking system for 42 Irbid students.

**Live site:** https://workspaceapi-server-production-5db6.up.railway.app

---

## What it does

- Students log in with their `@learner.42.tech` Google account
- Book a shuttle ride to or from campus
- A slot confirms automatically once 6 riders join
- Admins manage bookings, drivers, schedules, and pickup terminals
- Drivers see their assigned trips and route map

## Tech stack

- **Frontend:** React, Vite, Tailwind CSS, Wouter, TanStack Query
- **Backend:** Node.js, Express, Drizzle ORM
- **Database:** PostgreSQL (Neon)
- **Deployment:** Railway

## Running locally

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp artifacts/api-server/.env.example artifacts/api-server/.env
# Fill in DATABASE_URL, SESSION_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# Start the API server
pnpm --filter @workspace/api-server run dev

# In a separate terminal, start the frontend
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/shuttle run dev
```
