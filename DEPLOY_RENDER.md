# Deploy Zetro on Render (testing — no Docker)

Zetro is two apps in one repo:

| App | Tech | Local | Render service |
|-----|------|-------|----------------|
| API | Python / FastAPI | `:8000` | **zetro-api** |
| Shop UI | Next.js | `:3000` | **zetro** |

On localhost you run both. Render’s **native** runtimes run **one process per service**, so for the full shop you need **two free web services** (still $0 on free tier).

---

## Why Docker was suggested (and removed)

Docker was only a way to run **API + Next.js in one Render service** so everything could live on `zetro.onrender.com/abc`.

You don’t need that for testing. Native Python + Node is simpler and matches how you’ll likely deploy long term (separate API and frontend).

---

## Recommended for testing (follow these steps)

### 1. Push latest code to GitHub

```bash
cd /Users/praveenpk/work/projects/zetro
git push origin main
```

### 2. Create services from Blueprint (easiest)

Render → **New** → **Blueprint** → repo `PraviPankaj/Zetro` → **Apply**.

Creates: Postgres + **zetro-api** (Python) + **zetro** (Node).

### 3. Or create manually (if Blueprint isn’t used)

**Service A — API (`zetro-api`)**

| Setting | Value |
|---------|--------|
| Runtime | Python |
| Build | `pip install -r backend/requirements.txt` |
| Start | `bash start-api.sh` |
| Env | Link Postgres → `DATABASE_URL`, plus `SMS_PROVIDER=console`, `DEMO_BYPASS_ENABLED=true` |

**Service B — Web (`zetro`)** — name it `zetro` so URL is `https://zetro.onrender.com`

| Setting | Value |
|---------|--------|
| Runtime | Node |
| Build | `npm run build` |
| Start | `npm start` |
| Env | `NEXT_PUBLIC_API_URL` = `https://zetro-api.onrender.com` |

On **zetro-api**, set `CORS_ORIGINS` = `https://zetro.onrender.com`.

### 4. Open the shop

| URL | What |
|-----|------|
| `https://zetro.onrender.com` | → ABC shop |
| `https://zetro.onrender.com/abc` | Storefront |
| `https://zetro.onrender.com/abc/admin/login` | Demo admin |
| `https://zetro-api.onrender.com/health` | API health |
| `https://zetro-api.onrender.com/docs` | API docs |

---

## Other options (later / production)

| Approach | When to use |
|----------|-------------|
| **Render API + Vercel web** | Production; Vercel is built for Next.js |
| **API only on Render** | Backend testing; UI stays on localhost |
| **Docker single service** | Only if you must have one URL for both (not needed now) |
| **Railway / Fly.io** | Alternative hosts; similar split or monorepo deploy |

---

## Local dev (unchanged)

```bash
# Terminal 1 — API
cd backend && source .venv/bin/activate
PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# Terminal 2 — Web
cd apps/web && npm run dev
```

Open `http://localhost:3000/abc`.

---

## If your current `zetro` service is Python-only

That service is **API only** (JSON). Either:

1. Rename it to **zetro-api** and add a **new Node** service named **zetro** for the UI, or  
2. Delete it and use **Blueprint** to recreate both.

Do **not** keep Python runtime on the service where you want `/abc` — that path is served by **Next.js**, not FastAPI.
