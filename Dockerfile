# Single service: Next.js (public) + FastAPI (internal) — like localhost
# URLs: https://zetro.onrender.com/abc

FROM node:20-bookworm AS web
WORKDIR /src/apps/web
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm install
COPY apps/web/ ./
ENV NEXT_PUBLIC_API_URL=
ENV API_INTERNAL_URL=http://127.0.0.1:8000
RUN npm run build

FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
COPY --from=web /src/apps/web /app/apps/web
COPY start-all.sh /app/start-all.sh
RUN chmod +x /app/start-all.sh \
    && mkdir -p /app/backend/uploads

ENV PYTHONPATH=/app/backend
ENV API_INTERNAL_URL=http://127.0.0.1:8000
ENV NEXT_PUBLIC_API_URL=
ENV MEDIA_ROOT=/app/backend/uploads
ENV ENVIRONMENT=production
ENV DEBUG=false
ENV SMS_PROVIDER=console
ENV USE_MEMORY_OTP=true
ENV DEMO_BYPASS_ENABLED=true

EXPOSE 10000
CMD ["/app/start-all.sh"]
