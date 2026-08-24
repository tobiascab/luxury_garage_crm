# Project: Luxury Garage 🏎️

This `AGENTS.md` file provides context for OpenCode to better understand this repository.

## Project Overview
Luxury Garage is a management system for a garage, likely including membership management, scanning services, and a React-based frontend.

## Tech Stack
- **Backend**: Node.js / Express (Prisma ORM)
- **Frontend**: React / Vite / TypeScript
- **Database**: PostgreSQL
- **Tools**: Prisma

## Repository Layout
The root holds nothing but these directories (plus `AGENTS.md` and `.gitignore`):

- `backend/` — API, business logic and jobs.
  - `backend/prisma/` — schema and migrations.
  - `backend/scripts/` — maintenance and repair scripts.
  - `backend/scripts/verificacion/` — end-to-end checks against a running API.
- `frontend/` — React application (`frontend/public/` holds the assets the app ships).
- `docs/` — project documentation.
  - `docs/negocio/` — operations manual, business model and processes.
  - `docs/integraciones/arizar/` — ARIZAR IA / GoHighLevel integration.
  - `docs/integraciones/masfazzil/` — Masfazzil integration and its API docs.
  - `docs/facturacion/` — electronic invoicing options.
- `assets/` — design source files, NOT used by the build.
  - `assets/marca/` — original logo and membership card artwork.
  - `assets/landing/` — landing page reference images.
- `infra/` — deployment infrastructure.
  - `infra/docker/` — docker-compose.
  - `infra/backups/` — local database dumps (git-ignored, they hold customer data).

## Development Tasks
- **Start Backend**: `npm run start` (in backend)
- **Start Frontend**: `npm run dev` (in frontend)
- **Prisma Studio**: `npx prisma studio` (in backend)

## Coding Standards
- Use functional components in React.
- Use explicit types in TypeScript.
- Follow Clean Code principles.

## Boundaries
- Do not modify `.gemini` or `.opencode` directories unless specifically asked.
- Be careful with `node_modules`.
- Never install dependencies at the repository root: `backend/` and `frontend/` each own their
  `package.json`. A root-level `package.json` shadows them and hides what every app really needs.
- Do not add loose files to the root — everything belongs in one of the directories above.
