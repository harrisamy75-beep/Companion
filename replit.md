# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

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
- **Frontend**: React + Vite (travel-widget artifact)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

### travel-widget (React + Vite, previewPath: "/")
Travel Companion app for parents traveling with kids.
- **Dashboard** (`/`) — summary of children ages + preference overview
- **Kids** (`/children`) — add/edit/delete children, auto-calculates age from birthdate
- **Preferences** (`/preferences`) — save travel preferences (seat, meal, frequent flyer, passport, hotel, insurance, etc.)

### browser-extension (Chrome Manifest V3, dir: artifacts/browser-extension/)
Load-unpacked Chrome extension — no build step required.
- **manifest.json** — MV3 manifest; host permissions for Expedia, Booking.com, Hotels.com, Google Travel, Airbnb
- **background.js** — service worker; fetches `GET /summary/:user_id` on install, caches in `chrome.storage.local`, refreshes every 30 min via `chrome.alarms`
- **content.js** — injected into travel sites; reads cached profile, auto-fills adult/child counts + ages for each supported site, shows toast confirmation, scans review text and injects AI-scored match badges via `POST /reviews/score`
- **popup.html / popup.js** — extension popup; shows family count, children names/ages, travel style tags, auto-fill preview, last sync time; "Re-sync profile" button; link to full dashboard

**To load**: Chrome → Extensions → Load unpacked → select `artifacts/browser-extension/`
**API_BASE** in `background.js` and `content.js` must be updated to the deployed API URL before publishing to Chrome Web Store.

## Auth
Simple session-based auth via `express-session`. First visit prompts for a name (stored as `session.userId`). All data is scoped to this `userId`. "Switch profile" clears the session. Swap in real OAuth (Google, Apple) later without changing any data routes.

## Database Schema
- `travelers` — each traveler (adult or child) with birthDate, food/activity prefs, accessibility needs
- `travel_preferences` — singleton row per userId storing travel style preferences
- `review_scores` — cached AI-scored reviews with composite PK (property_id, source, review_hash)
- `sessions` — express-session store for server-side sessions
- `users` — user records (unused with simple auth, reserved for future OAuth)
- `trip_profiles` — named groupings of travelers per userId (e.g. "Harris Family", "Girls Trip")
- `favorite_properties` — saved hotels/resorts/villas/restaurants with tier (loved/liked/avoid), tags, notes
- `loyalty_programs` — hotel loyalty program memberships with membership numbers and status tiers

## API Endpoints
- `GET /summary` — frontend dashboard summary (optional `?profile_id=` to filter by profile)
- `GET /summary/:userId` — rich payload for browser extension
- `GET /trip-profiles` — list all profiles
- `POST /trip-profiles` — create profile `{name, emoji, travelerIds}`
- `PUT /trip-profiles/:id` — update profile
- `DELETE /trip-profiles/:id` — delete profile
- `POST /trip-profiles/:id/duplicate` — clone a profile as "Copy of X"
- `GET /trip-profiles/:id/summary` — profile-scoped rich payload for browser extension
- `POST /reviews/score` — score review texts via Claude (cache-first, 50 calls/hr rate limit)
- `GET /reviews/match` — compute weighted match score for a property against user preferences
- `GET /auth/me` — returns `{userId}` for current session
- `POST /auth/login` — set session userId `{userId: string}`
- `POST /auth/logout` — destroy session
- `GET /properties` — list favourite properties (loved first)
- `POST /properties` — add a property
- `PUT /properties/:id` — edit property
- `DELETE /properties/:id` — remove property
- `GET /properties/brands` — deduplicated brand list (used for review scoring context)
- `GET /loyalty` — list loyalty programs
- `POST /loyalty` — add program
- `PUT /loyalty/:id` — edit program
- `DELETE /loyalty/:id` — remove program
- `GET /loyalty/programs` — static list of 12 suggested programs for quick-add

## Frontend Pages
- `/` — Dashboard (summary cards)
- `/travelers` — Travel party management + trip profiles
- `/stays` — Favourite properties + loyalty programs
- `/preferences` — Travel preferences and style

## Browser Extension Summary
`GET /summary/:userId` now also returns:
- `loyaltyPrograms` — for auto-filling membership numbers on booking sites
- `lovedBrands` — for boosting luxury_value_score in review matching
- `avoidBrands` — for showing warning badge on blacklisted properties

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
