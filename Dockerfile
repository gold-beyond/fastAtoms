# ── Stage 1: Build frontend (Node.js - pnpm) ───────────────────────
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend

# Install pnpm via corepack (bundled with Node 20+)
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY app/frontend/package.json app/frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY app/frontend/ ./
RUN pnpm run build

# ── Stage 2: Run backend + serve frontend (Python) ──────────────────
FROM python:3.11-slim

# Copy EVERYTHING first, then work with it
COPY . /src
WORKDIR /src/app/backend

RUN ls -la /src/app/backend/requirements.txt \
    && pip install --no-cache-dir -r /src/app/backend/requirements.txt

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist /src/app/frontend/dist

ENV FRONTEND_DIST=/src/app/frontend/dist
ENV DATABASE_URL=sqlite:////var/data/fastatoms.db
RUN mkdir -p /var/data

EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
