# Zetro

Multi-tenant shop network: one platform, many shops, one API for web and future mobile apps.

## Architecture

- **API:** FastAPI at `http://localhost:8000` (`/api/v1`, OpenAPI at `/docs`)
- **Web:** Next.js at `http://localhost:3001`
  - Platform admin: `/platform` (username `admin` / password `admin`)
  - Shop admin: `/{slug}/admin` (mobile OTP — demo shop `abc`, phone `9999999999`)
  - Storefront: `/{slug}`
- **DB:** SQLite by default (`backend/zetro.db`). Postgres via `DATABASE_URL` / `docker-compose.yml`
- **Client:** [`packages/api-client`](packages/api-client) — reuse from Android/iOS later

## Run locally

```bash
# API
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# Web (second terminal)
cd apps/web
npm install
npm run dev
```

Optional: `docker compose up -d` for Postgres, Redis, MinIO, then set `DATABASE_URL=postgresql://zetro:zetro@localhost:5432/zetro`.

## Demo

1. Sign in at `/platform/login`
2. Shop `abc` is seeded. Open `/abc/admin/login`, request OTP for `9999999999` (shown in the UI in development)
3. Activate the 7-day trial, add products, then shop at `/abc`
