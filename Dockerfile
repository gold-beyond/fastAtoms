# ── Stage 1: Build frontend (Node.js) ──────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY app/frontend/package.json app/frontend/package-lock.json ./
RUN npm ci
COPY app/frontend/ ./
RUN npm run build

# ── Stage 2: Run backend + serve frontend (Python) ──────────────────
FROM python:3.11-slim
WORKDIR /app

# Install backend dependencies
COPY app/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY app/backend/ ./

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Tell main.py where the frontend is
ENV FRONTEND_DIST=/app/frontend/dist

# Persistent SQLite data (Render recommends /var/data/)
ENV DATABASE_URL=sqlite:////var/data/fastatoms.db
RUN mkdir -p /var/data

EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
