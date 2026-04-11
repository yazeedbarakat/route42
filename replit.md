# Smart Shuttle Solution — 42 Irbid

## Overview

Full-stack shuttle booking web app for 42 Irbid students. Students book rides, trips auto-confirm when minimum demand (5 bookings) is reached. Includes admin/driver dashboards, interactive Leaflet map, and a dark terminal aesthetic.

pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + Wouter routing
- **Map**: Leaflet + react-leaflet

## Design

Terminal dark aesthetic: deep black background (#0a0a0a), terminal green (#00FF00), monospace fonts (Courier New / Space Mono), zero border-radius, ASCII-style borders.

## Demo Credentials

- **Admin**: username `admin` / password `admin123` (or email admin@42irbid.com)
- **Driver**: Driver ID `DRV-001`
- **Student**: ali@learner.42.tech / student123
- **Mock students**: s1/s1 through s6/s6 — seed via `GET /api/dev/seed-students`

## Pickup Points

- Al-Shamali Complex (32.5568, 35.8502)
- Sheikh Khalil Complex (32.5487, 35.8433)
- Amman Complex (32.5421, 35.8394)

## Architecture

- `artifacts/shuttle` — React/Vite frontend (dark terminal UI)
- `artifacts/api-server` — Express REST API (port 8080, proxied via Vite)
- `lib/db` — Drizzle ORM schema (users, trips, bookings, pickup_points, notifications)
- `lib/api-spec` — OpenAPI YAML spec
- `lib/api-client-react` — Generated React Query hooks + Zod schemas (via Orval)

## Auth

JWT stored in `localStorage` as `shuttle_token`. Token passed via `setAuthTokenGetter` from api-client-react. Roles: student / admin / driver.

### Auth Flows
- **Student login**: Google OAuth (domain restricted to `@learner.42.tech`) OR email/username + password. Login form accepts email or username in one text field.
- **Student Google OAuth**: `GET /api/auth/google` → Google → callback at `/api/auth/google/callback` → domain check → if new user, redirect to `/complete-profile?token=<temp_jwt>` for profile setup (name, phone, password) → final JWT issued.
- **Admin login**: Standard form, supports username `admin` or email `admin@42irbid.com`.
- **Driver login**: Driver ID only — untouched.
- **DB columns added**: `username` (unique), `google_id` (unique), `profile_complete` (bool, default true).
- **Google OAuth secrets required**: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Replit Secrets.
- **Mock student seed**: `GET /api/dev/seed-students` — creates s1–s6 with bcrypt-hashed passwords.

## Auto-Confirm Logic

When `bookedSeats >= minBookingsToConfirm` (default 5), trip status changes to "confirmed" and all booked students receive a notification.

## Driver Routing

The Driver Dashboard `Start Trip` action opens `/map` with the selected trip id/date. The driver-only route view fetches that trip, resolves fixed pickup points plus custom pickup coordinates, and passes them to the shared Leaflet/OSRM `RouteMap` component for live driver navigation.

## Admin Driver Management

Admins can manage driver accounts at `/admin/drivers`. The page lists all drivers, registers new drivers with name/phone/Driver ID, and deletes driver accounts through admin-only API routes.

## Admin Pickup Terminal Management

Admins can manage official pickup terminals at `/admin/terminals`. The page supports searching locations through OpenStreetMap/Nominatim, clicking the Leaflet map to drop a pin, saving the terminal to `pickup_points`, and deleting saved terminals. Student and driver maps fetch these database terminals and display them as official markers.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
