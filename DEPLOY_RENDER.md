# Deploy Zetro on Render

No SMS keys required for the first deploy. The **ABC Kids** demo shop is seeded automatically with sample products and a one-click admin login.

## One-time setup

1. Push this repo to **GitHub** (or GitLab/Bitbucket).
2. Go to [render.com](https://render.com) → **New** → **Blueprint**.
3. Connect the repo — Render reads `render.yaml` and creates:
   - **zetro-db** — Postgres (free)
   - **zetro-api** — FastAPI backend
   - **zetro-web** — Next.js frontend
4. Click **Apply** and wait for both web services to go live (~5–10 min first time).

## After deploy

| What | URL |
|------|-----|
| Homepage | `https://zetro-web.onrender.com` |
| ABC storefront | `https://zetro-web.onrender.com/abc` |
| ABC admin (no OTP) | `https://zetro-web.onrender.com/abc/admin/login` → **Enter ABC Kids admin (demo)** |
| Platform admin | `https://zetro-web.onrender.com/platform/login` → `admin` / `admin` |

On first API startup the database is seeded with:
- Platform admin user
- Subscription plans
- **ABC Kids** shop (`/abc`) with owner phone `9999999999`
- 5 demo products (if catalog is empty)
- 7-day free trial for ABC

## Demo login (no OTP)

For the `abc` shop only, click **Enter ABC Kids admin (demo)** on `/abc/admin/login`.  
This uses `POST /api/v1/shops/abc/auth/demo` — no phone or OTP step.

Controlled by env vars (already set in `render.yaml`):

```env
DEMO_BYPASS_ENABLED=true
DEMO_SHOP_SLUG=abc
SMS_PROVIDER=console
USE_MEMORY_OTP=true
```

## Optional: change platform password

In Render → **zetro-api** → **Environment**:

- Set `PLATFORM_DEFAULT_PASSWORD` to a strong password (only applies on **first** seed; change via platform UI after login if already seeded).

## Notes

- **Free tier**: services sleep after inactivity; first load may take ~30s.
- **Uploads** (logos, product images) use ephemeral disk on free tier — files may reset on redeploy. Add a [Render disk](https://render.com/docs/disks) later if needed.
- **Shop registration** (`/register`) works without SMS in console mode — OTP appears in the UI as “Dev OTP”.
- When you add real SMS later, set `SMS_PROVIDER=fast2sms` or `msg91` and the API keys in **zetro-api** environment.

## Manual deploy (without Blueprint)

**API** (Web Service, Python):
- Root directory: leave **empty** (repo root) — build uses `backend/requirements.txt`
- Build: `pip install -r backend/requirements.txt`
- Start: `cd backend && PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Link Postgres → `DATABASE_URL`

**Web** (Web Service, Node):
- Root directory: leave **empty** (repo root)
- Build: `cd apps/web && npm install && npm run build`
- Start: `cd apps/web && npm start`
- Env: `NEXT_PUBLIC_API_URL=https://<your-api>.onrender.com`

**API env (minimum):**

```env
DATABASE_URL=<from Render Postgres>
JWT_SECRET=<random string>
ENCRYPTION_KEY=<random string>
ENVIRONMENT=production
DEBUG=false
SMS_PROVIDER=console
USE_MEMORY_OTP=true
DEMO_BYPASS_ENABLED=true
CORS_ORIGINS=https://<your-web>.onrender.com
```
