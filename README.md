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

## Built by

[entrape](https://github.com/entrape), [rsn026](https://github.com/rsn026), [yazeedbarakat](https://github.com/yazeedbarakat) — for 42 Irbid
