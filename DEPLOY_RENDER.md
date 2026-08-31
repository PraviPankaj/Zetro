# Deploy Zetro on Render (single URL — like localhost)

One service serves both the shop UI and the API:

- Shop: `https://zetro.onrender.com/abc`
- Admin: `https://zetro.onrender.com/abc/admin/login`
- API: `https://zetro.onrender.com/api/v1/...`

## Switch existing `zetro` service to Docker

Your current service is Python-only (shows JSON). Switch it to the Docker image:

1. Open **zetro** → **Settings**
2. **Build & Deploy** / **Environment**:
   - Set **Language** / runtime to **Docker**
   - **Dockerfile Path:** `./Dockerfile`
   - **Docker Context:** `.`
3. Clear custom **Build Command** and **Start Command** (Docker uses the Dockerfile `CMD`)
4. Keep env vars: `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `SMS_PROVIDER=console`, `DEMO_BYPASS_ENABLED=true`, etc.
5. Add if missing:
   - `CORS_ORIGINS` = `https://zetro.onrender.com`
   - `NEXT_PUBLIC_API_URL` = *(empty)*
   - `API_INTERNAL_URL` = `http://127.0.0.1:8000`
6. **Manual Deploy** → **Deploy latest commit**

First Docker build can take **10–15 minutes**.

## After deploy

| URL | What |
|-----|------|
| `/` | Redirects to ABC Kids |
| `/abc` | Storefront |
| `/abc/admin/login` | Demo admin (no OTP) |
| `/platform/login` | Platform (`admin` / `admin`) |
| `/health` | Health check |

## Local (unchanged)

```bash
# API
cd backend && PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# Web
cd apps/web && npm run dev
```

Or both together: `bash start-all.sh` (API :8000, web :3000).
