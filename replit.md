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

## Database Schema
- `children` — stores child name and birthdate; ages computed dynamically on every fetch
- `travel_preferences` — singleton row storing all travel preferences

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
