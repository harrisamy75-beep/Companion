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

## Database Schema
- `children` — stores child name and birthdate; ages computed dynamically on every fetch
- `travel_preferences` — singleton row storing all travel preferences
- `review_scores` — cached AI-scored reviews with composite PK (property_id, source, review_hash)

## API Endpoints
- `GET /summary` — original summary for frontend dashboard
- `GET /summary/:userId` — rich payload for browser extension (family, preferences, autoFillPayload, reviewProfile)
- `POST /reviews/score` — score review texts via Claude (cache-first, 50 calls/hr rate limit)
- `GET /reviews/match` — compute weighted match score for a property against user preferences

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
