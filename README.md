# Companion

Companion is a travel planning workspace for families. It includes a web app for managing traveler profiles and preferences, an API server, and a Chrome extension called TripProfile that can help fill travel forms and score reviews.

This project was originally built in Replit and then moved to GitHub. The notes below are meant to make the GitHub version easier to understand and run outside of Replit.

## What is in this repository

- `artifacts/travel-widget` - React/Vite web app for the travel dashboard.
- `artifacts/api-server` - Express API server used by the web app and extension.
- `artifacts/browser-extension` - Chrome Manifest V3 extension. This can be loaded into Chrome without a build step.
- `lib/db` - PostgreSQL database schema and Drizzle setup.
- `lib/api-*` - shared API specification, validation, and generated client helpers.
- `scripts` - project utility scripts.

## Requirements

To run the full project locally, install:

- Node.js 24 or newer
- pnpm
- PostgreSQL, or a hosted PostgreSQL database

This computer currently has Node installed, but pnpm may still need to be installed.

## Environment variables

Copy `.env.example` to `.env` and fill in the values for your own services.

Important values include:

- `DATABASE_URL` - PostgreSQL connection string.
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key for the web app.
- `CLERK_SECRET_KEY` - Clerk secret key for the API server.
- `ANTHROPIC_API_KEY` - Claude/Anthropic API key for AI-powered travel planning and review scoring.
- `GOOGLE_PLACES_API_KEY` - Google Places API key for place lookup features.

Never commit a real `.env` file or real API keys to GitHub.

## Common commands

Install dependencies:

```bash
pnpm install
```

Run the full type check:

```bash
pnpm run typecheck
```

Build the workspace:

```bash
pnpm run build
```

Run the API server:

```bash
pnpm --filter @workspace/api-server run dev
```

Run the travel web app:

```bash
pnpm --filter @workspace/travel-widget run dev
```

## Chrome extension

The extension lives in:

```text
artifacts/browser-extension
```

To load it locally:

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on Developer mode.
4. Click Load unpacked.
5. Select the `artifacts/browser-extension` folder.

Before publishing or using it with a different backend, update the API URLs in:

- `artifacts/browser-extension/background.js`
- `artifacts/browser-extension/content.js`
- `artifacts/browser-extension/manifest.json`

They currently point to the Replit deployment URL.

## Replit notes

The files `.replit`, `.replitignore`, and `replit.md` are still present because the project came from Replit. They may be useful if you continue running the project there. If GitHub/local development becomes the main workflow, these can eventually be removed or kept only as historical deployment notes.

## Current setup status

- GitHub copy exists.
- Local Codex workspace copy exists.
- Git is not installed on this computer yet, so this local copy was downloaded as a ZIP instead of cloned with Git.
- pnpm is not installed on this computer yet.
- A real Git-connected workflow will be easiest with GitHub Desktop.
