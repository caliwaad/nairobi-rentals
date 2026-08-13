# 🏠 Nairobi Rentals — Implementation Plan

> A Zillow-style rental marketplace for **Nairobi**. Browsers find apartments, realtors publish them, an admin moderates, and everyone pays (realtors) / contacts via WhatsApp (users).
> Status: **Phases 0–4 + most of 5 done** (Aug 2026). Built: monorepo, Neon schema (users/listings/reviews/favorites/subscriptions), Clerk auth + webhook, full browse feed + detail + favorites + reviews + Cloudinary uploads, realtor apply/approve + admin queues, EAS Android preview APK + iOS simulator build, API deployed to Vercel. **Phase 5 payments:** IntaSend M-Pesa STK push + webhook + paywall built and tested (needs sandbox keys to go live). Remaining: Phase 7 background jobs (trigger.dev), Phase 8 hardening (Sentry, account deletion, QA), maps/nearby, live-payment test.

---

## 1. Product summary

**What:** A mobile-first rental marketplace for Nairobi. Rentals only. Prices in **KES per month**.

**Who:**
- **Browsers** — anonymous browsing; auth (Google / Apple via Clerk) only at Save / Review / Contact.
- **Realtors** — apply in-app → admin approves → pay **monthly M-Pesa subscription** → post/edit/archive listings from an in-app dashboard.
- **Admin** — lightweight Next.js web dashboard: approve/reject realtor applications and listings (with reasons), monitor health/stats.

**Core flows:** Browse → filter (size, neighborhood, price, amenities) → listing detail (photo slideshow, description, unit amenities, house rules, map pin + nearby facilities from Google Places, anonymous star average) → WhatsApp / tap-to-call → save to Favourites → review (1–5 stars, one per user, editable, no self-reviews).

**Out of scope for v1:** in-app chat, all AI features, sale listings, push notifications, product analytics (PostHog), payouts to realtors, multi-market.

---

## 2. Confirmed decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Market | **Nairobi, Kenya** — KES, monthly rent, neighborhood-driven search |
| 2 | Real vs portfolio | **Real product** — real users, moderation, payments from day one |
| 3 | Platform | **Expo (React Native)** — native mobile |
| 4 | Images | **Cloudinary** (signed uploads) + Sentry for error monitoring (not images) |
| 5 | Realtor onboarding | Self-serve application, **admin approves** account |
| 6 | Listing publish | **Pending until admin approval** (admin rejection includes a visible reason) |
| 7 | Auth gating | **Browse without login**; Clerk only on Save / Review / Contact |
| 8 | Contact | **WhatsApp deep-link + tap-to-call** (no in-app chat) |
| 9 | AI | **No AI in v1** — trigger.dev for background jobs only (AI parked) |
| 10 | Listing type | **Rent only** (`listing_type` enum reserved for future sale listings) |
| 11 | Amenities | Unit amenities = realtor checkbox list; nearby facilities = derived from maps |
| 12 | Reviews | One per user per listing, editable, no self-review; reviews show the user's **self-chosen username** (no real names / PII); star average shown as an aggregate |
| 13 | Size enum | `bedsitter, studio, 1br, 2br, 3br, 4br, 4br+, maisonette, standalone` |
| 14 | Lifecycle | **Archive, not delete** (favorites/reviews intact, disappears from search) |
| 15 | Backend | **Next.js (App Router) on Vercel** — REST route handlers + web admin in one deployable |
| 16 | Monetization | **Paid from day one** — monthly realtor subscription via M-Pesa (STK push) |
| 17 | Emails | **Resend** for approval/rejection + renewal reminders |
| 18 | Maps | react-native-maps + Google **Places API** (per-listing cached results) |
| 19 | Observability | **Sentry** on mobile + web (PostHog parked) |
| 20 | App stores | Apple Developer + Google Play accounts created **at launch**; dev builds until then |
| 21 | Testing | Unit tests on critical business logic + manual QA matrix; no heavy E2E suite |
| 22 | Budget | **Free tiers first** (Neon, Cloudinary ~25 credits, trigger.dev Hobby, Resend ~3k/mo, Google near-free w/ caching) |

---

## 3. Assumptions (locked — flag if wrong)

1. Admin moderation lives in the **web dashboard**, not in-app.
2. Rejection always includes a **reason the realtor sees**.
3. Monthly subscription **price is configurable** (env var); no fixed KES number set.
4. M-Pesa has no native auto-recurring → **monthly manual STK push + in-app/email reminders**; lapsed payment = posting locked (grace period TBD).
5. Nearby facilities come from the map (Places API, cached), not typed by realtors.
6. Free-tier-first budget everywhere; Cloudinary credits are the first thing to run out.
7. App store accounts created at launch; until then the app runs via **EAS dev builds**.
8. Payment provider = **IntaSend** (decided Aug 2026 — see §5). M-Pesa has no auto-recurring: monthly renewal = re-initiated STK push via trigger.dev cron + in-app/email reminders. **Subscription price must absorb the 3% M-Pesa fee** (round up).
9. Sentry only for observability; PostHog parked.
10. **Kenya Data Protection Act applies** → minimize PII; Clerk holds auth data; phone numbers kept only for realtors.
11. Scale expectation: hundreds of listings, thousands of MAU — Neon free tier + serverless is comfortable.

---

## 4. Open risks

1. **Monthly M-Pesa subscription is the biggest operational risk** — forgotten renewals, churn, manual reminders. Mitigate with a strong reminder flow (cron 3 days before `current_period_end`).
2. **Google Places costs** — caching per listing keeps us near-free; watch key config and hot features. Billing account is mandatory even for free usage.
3. **Admin approval bottleneck** — if the founder is the only admin, approval latency hurts realtor conversion. Dashboard must be 2-taps-per-decision.
4. **Review spam / fake reviews** — anonymous stars invite gaming; monitor via Sentry alerts + admin review.
5. **Listing data quality** — map-pin picker with reverse geocoding is required in the upload flow (not free text address only).
6. **App Store review rules** (e.g. Apple mandatory account deletion) — handle at launch; Clerk supports deletion.
7. **Payment provider resilience (IntaSend)** — M-Pesa outages / failed STK pushes need retries + manual fallback. **Build-time TODO:** confirm the exact webhook signature header (docs imply HMAC SHA-256; verify at integration), and always verify + idempotent-apply by `api_ref`. IntaSend's own docs recommend a queue — our trigger.dev webhook handler IS that queue.

---

## 5. Verified toolchain (checked Aug 2026)

| Tool | Version / notes |
|---|---|
| Expo | **SDK 57, React Native 0.86, React 19.2** (scaffolded Aug 2026); **dev builds required** — `expo-dev-client` + EAS (Expo Go can't run Clerk + maps) |
| Clerk | `@clerk/clerk-expo`; Google + Apple OAuth on **both** platforms; webhooks `user.created/updated/deleted` → Neon (verify Svix signatures) |
| Maps | `react-native-maps` + config plugin (per-platform Google Maps API keys) |
| Images | `expo-image-picker` → backend-signed → `FileSystem.uploadAsync` to Cloudinary |
| trigger.dev | v3: `@trigger.dev/sdk`, `trigger.config.ts`, `task()` + cron schedules, retries, idempotency keys; Resend runs inside a task; free Hobby tier ≈ thousands of runs/mo (confirm exact quota at setup) |
| Payments | **IntaSend — DECIDED (Aug 2026).** M-Pesa STK push at **3% flat**, no setup fees, CBK-licensed, self-serve signup, sandbox, official Node SDK `intasend-node`, webhooks with 5 exponential retries. **Pesaflow ruled out** — it is a GovTech/enterprise automation company (eCitizen Kenya), not a self-serve developer gateway: no public API docs, zero npm packages, contract-based onboarding with setup fees + minimum volumes. Do not hand-roll Daraja. |
| DB | Neon Postgres + **Drizzle ORM** (typed, serverless-friendly, zero codegen) |
| Email | Resend (free tier ≈ 3k emails/mo) |
| Monitoring | Sentry (Expo + Next.js) |

---

## 6. Repo layout

```
/rentals
  apps/mobile      # Expo — browsers + realtor dashboard
  apps/web         # Next.js — REST API (route handlers) + admin dashboard
  packages/shared  # Zod schemas + shared types
  trigger/         # trigger.dev tasks (imported by apps/web)
```

**Hard rule:** the API is the only DB writer — no direct DB access from the app.

---

## 7. Data model (Drizzle on Neon)

- **`users`** — `clerk_id` UNIQUE, name, email, avatar, phone, `role` ('user'|'realtor'|'admin'), `realtor_status` ('pending'|'approved'|'rejected'|null), `rejection_reason`, `subscription_status`, timestamps.
- **`listings`** — realtor FK, title, description, `price` (KES/mo, int), `size` enum, `listing_type` ('rent', reserved), neighborhood, address_text, lat/lng, `unit_amenities` (text[]), `house_rules`, `status` ('pending'|'approved'|'rejected'|'archived'), `rejection_reason`, `featured` (bool, reserved), `views` counter.
- **`listing_images`** — FK, Cloudinary `public_id`, `url`, `sort_order`, `is_cover`.
- **`reviews`** — listing FK + user FK, `stars` 1–5, optional comment; `UNIQUE(listing_id, user_id)`; average via SQL view.
- **`favorites`** — user FK + listing FK, unique pair.
- **`subscriptions`** — realtor FK, provider_ref, status, `current_period_end`, amount, history.
- **`nearby_places_cache`** — rounded lat/lng key, raw Places payload, fetched_at (the cost-saver).

**Seed:** 25–40 realistic Nairobi listings (Kilimani, Westlands, Kasarani, Ruaka, South B…) with real coordinates, photos, reviews — demoable from day one.

---

## 8. API surface (REST route handlers, Zod-validated, Clerk session-checked)

| Route group | Endpoints |
|---|---|
| Listings | `GET /listings` (filters: size, neighborhood, price range, amenities; sort: newest/price/rating; pagination) · `GET /listings/:id` (detail + avg rating) |
| Realtor | `POST /listings` (pending) · `PATCH /listings/:id` · `POST /listings/:id/archive` |
| Admin | `GET /admin/realtors` · `POST /admin/realtors/:id/decision` · `GET /admin/listings` · `POST /admin/listings/:id/decision` |
| Reviews | `POST /reviews` (upsert, no self-review) · `GET /listings/:id/reviews` |
| Favorites | `GET /favorites` · `POST /DELETE /favorites/:listingId` |
| Images | `POST /upload-signature` (signed Cloudinary params, realtor-only) |
| Nearby | `GET /listings/:id/nearby` (Places API, cache-first) |
| Payments | `POST /subscribe` (STK push) · `POST /payments/webhook` (verify signature) · `GET /subscription/status` |
| User | `GET /me` · `PATCH /me` · `POST /clerk/webhook` (user sync) |

---

## 9. Background jobs (trigger.dev)

- Approval/rejection **emails** (Resend) on admin decision.
- **Renewal reminder** cron — 3 days before `current_period_end` → in-app + email.
- **Places cache warm** on listing approval.
- **Image cleanup** on archive (Cloudinary delete).
- Review average maintained by **SQL view** (no job — less to break).
- All idempotent by key; retries configured.

---

## 10. Build phases & milestones

| Milestone | Phases | Content | Est. |
|---|---|---|---|
| **M1** | 0–2 | Foundations, schema + seed, auth + profile | ~3 wks |
| **M2** | 3–4 | API + browsing product (home, filter, detail, favorites, reviews, WhatsApp) | ~3.5 wks |
| **M3** | 5–6 | Realtor onboarding + M-Pesa paywall + realtor dashboard + admin web dashboard | ~3 wks |
| **M4** | 7–8 | Background jobs, Sentry, QA matrix, EAS builds, launch compliance | ~2 wks |

**Phase 0 — Foundations:** monorepo (**npm workspaces** — pnpm not available on dev machine), Expo + Next.js apps, all accounts + env vars, EAS dev-build pipeline.
**Phase 1 — Schema & data layer:** Drizzle models above, migration, seed script, `packages/shared` Zod schemas.
**Phase 2 — Auth & profile:** Clerk in Expo (dev build, deep-link scheme, Google + Apple), webhook user sync, profile edit.
**Phase 3 — Backend API:** all routes above + unit tests (filtering, review upsert/avg, webhook signature validation).
**Phase 4 — Browsing experience:** home + infinite scroll + filter sheet + sort; listing detail (slideshow, map, nearby sections, reviews, save, WhatsApp/call); favourites tab; TanStack Query + zustand; optimistic updates; skeleton loaders; empty states.
**Phase 5 — Realtor & payments:** apply screen, **payment gate** (Intasend vs Pesaflow — see §5), subscribe + STK push + webhook, realtor dashboard, multi-step listing form (details → photos → map-pin picker with reverse geocode → review).
**Phase 6 — Admin dashboard:** applications + listings queues (approve/reject + reason, photo preview), quick stats.
**Phase 7 — Background jobs:** §9 tasks wired in.
**Phase 8 — Hardening & launch:** Sentry alerts, manual QA matrix (iOS + Android, empty/error/slow/loaded states), EAS production builds → TestFlight + Play internal, **account deletion** (Apple requirement), privacy policy (KDPA), realtor terms, sandbox→live payment test, Places cache primed.

---

## 11. Definition of done (v1)

1. Browse → filter → view → save → review → WhatsApp contact works end-to-end on iOS + Android dev builds.
2. A realtor can apply → get approved → pay via M-Pesa → post → see status in one sitting.
3. Admin can approve/reject realtors and listings with reasons in ≤2 taps.
4. Unit tests green for review math, filtering, webhook signature validation.
5. Sentry captures crashes + 500s; alerts on payment-webhook failures.
6. Account deletion + privacy policy (KDPA) in place before store submission.
