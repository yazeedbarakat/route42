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

- **Admin**: admin@42irbid.com / admin123
- **Driver**: driver@42irbid.com / driver123
- **Student**: ali@42irbid.com / student123

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

## Auto-Confirm Logic

When `bookedSeats >= minBookingsToConfirm` (default 5), trip status changes to "confirmed" and all booked students receive a notification.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
