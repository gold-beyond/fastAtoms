# REASONIX.md — Project Knowledge

## Stack

- **Frontend**: Vite 5 + React 18 + TypeScript + Tailwind CSS 3.4 + shadcn/ui
- **Backend**: FastAPI + SQLAlchemy (async) + Pydantic v2
- **Database**: PostgreSQL via asyncpg, migrations via Alembic
- **Auth**: JWT (python-jose) + OIDC
- **Infrastructure**: AWS Lambda via Mangum, S3-compatible storage (ObjectStorage)
- **Package manager**: pnpm (frontend), pip (backend)

## Layout

- `app/frontend/` — Vite React app with shadcn/ui components under `src/components/ui/`
- `app/backend/` — FastAPI app with auto-discovered routers under `routers/`
- `app/backend/core/` — **PROTECTED**: config, enums, crypto — do not edit
- `app/backend/models/` — **PROTECTED**: auto-generated ORM models — do not edit
- `app/backend/schemas/` — Pydantic request/response models
- `app/backend/services/` — Business logic
- `app/backend/routers/` — API routes (auto-discovered, prefix `/api/v1/`)
- `app/backend/alembic/` — Database migrations
- `.atoms/` — Agent playbooks and skill definitions for development workflow

## Commands

| Context | Command | Action |
|---------|---------|--------|
| frontend | `pnpm run dev` | Dev server (Vite) |
| frontend | `pnpm run build` | Production build |
| frontend | `pnpm run lint` | ESLint check (`--quiet ./src`) |
| backend | `uvicorn main:app --reload` | Dev server (from `app/backend/`) |

## Conventions

- **Router auto-discovery**: Files under `backend/routers/` are auto-imported — no `include_router()` call needed. All routes use prefix `/api/v1/`.
- **Protected paths**: `backend/core/`, `backend/models/`, `backend/main.py`, and `backend/lambda_handler.py` must never be modified.
- **Auto-managed timestamps**: `created_at` / `updated_at` are added by the ORM — never define, validate, or assign them in schemas or payloads.
- **Frontend `@/` alias**: Maps to `src/` directory. Import like `@/components/ui/button`.
- **`index.html` is read-only**: Title/description/logo come from deployment env vars (`%VITE_APP_TITLE%` etc.).
- **ESLint config**: TypeScript + react-hooks + react-refresh. `no-unused-vars` is off; `no-explicit-any` is warn.
- **Package manager**: Use `pnpm`, not npm, for frontend operations.

## Watch out for

- **Schema user_id**: The system-managed `user_id` is injected automatically by `BackendManager` — omit it from JSON schemas and mock data.
- **Database first**: Tables must be created via `BackendManager.create_tables` before any code implementation — check existing schemas before adding new models.
- **No test files found**: `*.test.*` files don't exist yet in either frontend or backend.
