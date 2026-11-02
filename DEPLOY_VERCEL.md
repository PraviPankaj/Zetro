# Deploy Zetro on Vercel (web + API + database)

Everything runs on Vercel, as **two projects from the same repo**:

| Project | Root Directory | What it runs |
|---------|----------------|--------------|
| `zetro-api` | `backend` | FastAPI (`app/main.py`) as Python serverless functions |
| `zetro-web` | `apps/web` | Next.js shop + admin UI; proxies `/api` and `/media` to `zetro-api` |

You add the storage from the **Storage** tab of the `zetro-api` project:

| Store | Used for | Env var Vercel injects |
|-------|----------|------------------------|
| **Neon** (Postgres) | All app data | `DATABASE_URL` |
| **Blob** (public) | Product images, logos, theme HTML/assets | `BLOB_READ_WRITE_TOKEN` |
| **Upstash Redis** (optional) | Server OTP codes. Only needed if `AUTH_PROVIDER=console` | `REDIS_URL` |

## 1. Create the API project

1. [vercel.com/new](https://vercel.com/new), then import the repo.
2. Name it `zetro-api` and set **Root Directory** to `backend`. Vercel detects FastAPI from `app/main.py`.
3. Before the first deploy, open **Storage** and connect the stores:
   - **Neon**: create the database and connect it to `zetro-api`.
   - **Blob**: create a store with **public** access and connect it.
   - **Upstash Redis**: only if you use server OTP.
4. Add these environment variables (Settings → Environment Variables):

| Name | Value |
|------|-------|
| `DATABASE_URL` | Neon's **pooled** connection string (its host contains `-pooler`). Neon sets this for you. |
| `DB_INIT_ON_STARTUP` | `false` |
| `ENVIRONMENT` | `production` |
| `DEBUG` | `false` |
| `JWT_SECRET` | Long random string (`openssl rand -hex 32`) |
| `ENCRYPTION_KEY` | Long random string. **Keep it**: changing it breaks stored encrypted values. |
| `PLATFORM_DEFAULT_USERNAME` / `PLATFORM_DEFAULT_PASSWORD` | Platform admin login. Don't keep `admin`/`admin`. |
| `AUTH_PROVIDER` | `firebase` (or `console`) |
| `FIREBASE_CREDENTIALS_JSON` | Full contents of the Firebase service-account JSON, as one line |
| `SMS_PROVIDER`, `FAST2SMS_*`, `MSG91_*` | Only if you send SMS |
| `USE_MEMORY_OTP` | `false` if you added Redis, otherwise `true` (OTP may fail across instances) |
| `DEMO_BYPASS_ENABLED`, `DEMO_SHOP_SLUG`, `DEMO_SHOP_PHONE` | As you use them locally |
| `CHATGPT_API_KEY` | Optional |
| `FRONTEND_URL` | `https://zetro-web.vercel.app` (fill in after step 3) |

5. Deploy. Then check `https://zetro-api.vercel.app/health`.

## 2. Create the tables (once, and after schema changes)

Serverless functions don't run a reliable one-time boot step, so the API doesn't create tables on cold start (`DB_INIT_ON_STARTUP=false`). Run the init yourself against Neon. Use Neon's **direct** (non-pooled) URL:

```bash
cd backend
DATABASE_URL="postgresql://USER:PASS@HOST/neondb?sslmode=require" .venv/bin/python -m app.db.init
```

This runs `create_all`, the lightweight migrations in `app/db/migrate.py`, and the seed (plans, demo shop, platform admin).

### Moving existing data off Render (optional)

```bash
pg_dump --no-owner --no-acl "$RENDER_DATABASE_URL" > zetro.sql
psql "$NEON_DIRECT_URL" < zetro.sql
```

Images uploaded on Render were stored on Render's disk. Their `/media/...` URLs won't resolve on Vercel, so re-upload them through the admin.

## 3. Create the web project

1. [vercel.com/new](https://vercel.com/new), then import the same repo again.
2. Name it `zetro-web` and set **Root Directory** to `apps/web` (Next.js).
3. Environment variables:

| Name | Value |
|------|-------|
| `API_URL` | `https://zetro-api.vercel.app` (no trailing slash) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` … `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Same as local, if using Firebase login |

Leave **`NEXT_PUBLIC_API_URL` unset**. The browser then calls `/api/...` on the web domain and Next.js rewrites it to `zetro-api`.

4. Deploy, then set `FRONTEND_URL` on `zetro-api` to this URL and redeploy the API.
5. In the Firebase Console, go to Authentication → Settings → **Authorized domains** and add the web domain.

## 4. Open it

| URL | What |
|-----|------|
| `https://zetro-web.vercel.app/abc` | Demo storefront |
| `https://zetro-web.vercel.app/platform/login` | Platform admin |

## Limits to know

- **Uploads are capped at 4 MB.** Vercel rejects request bodies over 4.5 MB.
- **Cold starts**: the first API request after idle takes a second or two.
- **Local dev is unchanged.** Without `BLOB_READ_WRITE_TOKEN`, files are written to `backend/uploads` and served at `/media`, and tables are created on startup.

## Custom domain

Add it to `zetro-web` (Settings → Domains), and create the CNAME it shows in your DNS provider (e.g. HostGator's Zone Editor). Then update `FRONTEND_URL` on `zetro-api` and the Firebase authorized domains.
