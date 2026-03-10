# Stage 1: Build React frontend
FROM node:20-alpine@sha256:09e2b3d9726018aecf269bd35325f46bf75046a643a66d28360ec71132750ec8 AS frontend-build

WORKDIR /build

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ .

ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

RUN npm run build

# Stage 2: Python runtime
FROM python:3.12-slim@sha256:d51616d5860ba60aa1786987d93b6aaebc05dd70f59f4cc36b008e9768cb88f1 AS runtime

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser \
    && mkdir -p /app/content /app/logs /app/data /app/data/events /app/secrets \
    && chown -R appuser:appgroup /app/content /app/logs /app/data /app/secrets

COPY --chown=appuser:appgroup backend/ ./backend/

COPY --chown=appuser:appgroup --from=frontend-build /build/dist ./static/

ENV CONTENT_ROOT=/app/content
ENV PERMISSIONS_CONFIG=/app/content/permissions.json
ENV CHAT_DB_PATH=/app/data/chat_logs.db
ENV USAGE_DB_PATH=/app/data/usage.db

EXPOSE 8001

USER appuser

CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8001"]
