# Nairobi Rentals 🏠

A Zillow-style rental marketplace for **Nairobi, Kenya** — browse apartments, filter by size/price/neighbourhood, save favourites, leave anonymous star reviews, and contact realtors on WhatsApp.

**Status: Phase 0 (foundations) in progress.** The full build plan lives in [`PLAN.md`](./PLAN.md).

## Stack (per PLAN.md)

| Layer | Choice |
|---|---|
| Mobile app | **Expo** (SDK 57, React Native, expo-router) — `apps/mobile` |
| API + admin dashboard | **Next.js** on Vercel (planned — `apps/web`) |
| Database | **Neon** Postgres + Drizzle ORM |
| Auth | **Clerk** (Google + Apple) |
| Images | **Cloudinary** (signed uploads) |
| Maps | Google Maps / Places (cached) |
| Background jobs | **trigger.dev** |
| Email | Resend |
| Payments | **IntaSend** (M-Pesa STK push, monthly realtor subscription) |
| Monitoring | Sentry |

## Repo layout

```
apps/
  mobile/     # Expo app — browsing + realtor dashboard
web/          # (planned) Next.js API + admin
trigger/      # (planned) trigger.dev tasks
packages/     # (planned) shared types/schemas
```

## Run the mobile app

```bash
npm install          # from the repo root (npm workspaces)
npm run mobile       # starts Expo (or: cd apps/mobile && npm start)
```

You'll need a development build (EAS) for Clerk + Google Maps — see PLAN.md Phase 0.

## Docs

- `PLAN.md` — product spec, data model, API surface, background jobs, and the M1–M4 milestone plan.
