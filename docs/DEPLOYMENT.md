# Deployment

SecureShip’s supported demo path is **local Docker Compose + host Ollama**. Cloud staging/prod hosts are stretch goals — you do **not** need GHCR or a remote host to finish the program demo.

## Deployment paths (pick one)

| Path | When to use | Commands |
|------|-------------|----------|
| **Local dev** (default) | Day-to-day coding; hot reload | `make start` |
| **Local production-like** | Demo prod images locally; test Auth0 in built frontend | `make start-prod` → `make seed` → `make smoke` |
| **GHCR host** (later) | After CD pushes images; deploy on a machine with Docker + Ollama | Set `SECURESHIP_*_IMAGE` in `.env` → `make pull-prod` → `make start-prod-no-build` |

For the program deliverable, **local dev or local production-like is enough**. GHCR steps are documented for when you deploy later.

See also: [CI_CD_SETUP.md](CI_CD_SETUP.md) (pipeline + GitHub Variables), [ADMIN_PANEL_SETUP.md](ADMIN_PANEL_SETUP.md), [backend/AUTH0_SETUP_GUIDE.md](../backend/AUTH0_SETUP_GUIDE.md).

---

## Local (recommended)

### Prerequisites

- Docker Desktop running
- [Ollama](https://ollama.com/) on the host with `qwen3:8b`:

  ```bash
  ollama pull qwen3:8b
  ```

- Env files:

  ```bash
  cp backend/.env.example backend/.env
  cp frontend/.env.example frontend/.env
  cp .env.example .env   # optional — GHCR image overrides + compose build args
  ```

### Start / seed / stop

```bash
make start        # Ollama + compose with docker-compose.dev.yml (bind-mount hot reload)
make start-prod   # Ollama + production images (next start, bakes NEXT_PUBLIC_* from .env)
make pull-prod    # Pull GHCR images (requires SECURESHIP_*_IMAGE in .env)
make start-prod-no-build  # Start from pulled/built images without rebuild
make seed         # customers + shipments (idempotent)
make smoke        # /health, chat 422, admin 401 (+ optional frontend check)
make stop         # keep volumes
make nuke         # wipe Postgres volume
```

| Compose file | Role |
|--------------|------|
| `docker-compose.yml` | Production-like stack (multi-stage frontend Dockerfile, healthchecks) |
| `docker-compose.dev.yml` | Override: source bind mounts + `npm run dev` / uvicorn `--reload` |

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Chat + admin UI |
| http://localhost:8000/health | Backend health |
| http://localhost:8000/openapi.json | OpenAPI |
| http://localhost:8000/docs | Swagger UI |

### Process mode (without Compose)

```bash
# Postgres must be reachable via DATABASE_URL
cd backend && make dev
cd frontend && make dev
```

Set `OLLAMA_HOST=http://localhost:11434` for host processes (Compose uses `host.docker.internal`).

### Local production-like with Auth0 admin

Use this when you want the **built** frontend (`next start`) with Universal Login — not required for chat/SMS demo, but required for admin Auth0 in prod images.

1. **Backend** — `backend/.env` (JWT verification on every admin request):

   | Variable | Purpose |
   |----------|---------|
   | `AUTH0_DOMAIN` | Tenant domain (no `https://`) |
   | `AUTH0_CLIENT_ID` | Auth0 application client id |
   | `AUTH0_CLIENT_SECRET` | Auth0 application secret |
   | `AUTH0_AUDIENCE` | API identifier — must match token `aud` |

2. **Frontend** — `frontend/.env` (baked into client bundle at **`next build`**):

   | Variable | Purpose |
   |----------|---------|
   | `NEXT_PUBLIC_AUTH0_DOMAIN` | Same tenant as backend |
   | `NEXT_PUBLIC_AUTH0_CLIENT_ID` | SPA client id (Universal Login) |
   | `NEXT_PUBLIC_AUTH0_AUDIENCE` | Same API identifier as backend |
   | `NEXT_PUBLIC_BACKEND_URL` | Browser admin API base (`http://localhost:8000` locally) |

3. **Build and run** (rebuild after any `NEXT_PUBLIC_*` change):

   ```bash
   make start-prod
   make seed
   make smoke
   open http://localhost:3000/admin
   ```

`make start-prod` automatically sources `frontend/.env` (and optional repo-root `.env`) so Auth0 vars reach Docker build args. Setting Auth0 only at container runtime does **not** enable Universal Login in production images.

For dev hot-reload (`make start`), `frontend/.env` is read at dev-server start — no rebuild needed.

---

## Environment & secrets

### Backend (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres (Compose overrides to `postgres` hostname) |
| `OLLAMA_HOST` / `OLLAMA_MODEL` | LLM endpoint |
| `CORS_ORIGINS` | Comma-separated frontend origins — **no `*` in production** |
| `CHAT_RATE_LIMIT_PER_MINUTE` | Default `30` |
| `TWILIO_*` | SMS 2FA (or enable mock/log mode for local) |
| `SMS_LOG_VERIFICATION_CODE` | Local-only: log OTP (keep `false` in shared envs) |
| `AUTH0_DOMAIN` / `CLIENT_ID` / `CLIENT_SECRET` / `AUDIENCE` | Admin JWT verification |
| `DEBUG` | `true` → human logs; `false` → JSON structured logs |

Never commit `.env`. Prefer a secrets manager for real deployments.

### Frontend (`frontend/.env`)

| Variable | Purpose |
|----------|---------|
| `BACKEND_API_URL` | Server-side BFF → FastAPI (Compose: `http://backend:8000`) |
| `NEXT_PUBLIC_BACKEND_URL` | Browser admin API base |
| `NEXT_PUBLIC_AUTH0_*` | SPA Universal Login |

**Build-time vs runtime:** Only `BACKEND_API_URL` is server-side at runtime in Compose. All `NEXT_PUBLIC_*` values are embedded during `next build` (production Dockerfile or `make start-prod`).

### Repo-root `.env` (optional)

Copy `.env.example` → `.env` when you need:

- **GHCR image overrides** (`SECURESHIP_BACKEND_IMAGE`, `SECURESHIP_FRONTEND_IMAGE`) for `make pull-prod`
- **Compose build args** without duplicating vars (otherwise `frontend/.env` is enough for local prod)

### GitHub CD — frontend image Variables (when deploying via GHCR)

Set in **GitHub → Settings → Secrets and variables → Actions → Variables** *before* CD builds the frontend image:

| Variable | When needed |
|----------|-------------|
| `NEXT_PUBLIC_AUTH0_DOMAIN` | Auth0 admin login in published frontend image |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID` | Same |
| `NEXT_PUBLIC_AUTH0_AUDIENCE` | Same |
| `NEXT_PUBLIC_API_URL` | Non-localhost deploy (browser-facing backend URL) |
| `NEXT_PUBLIC_BACKEND_URL` | Same for admin API client |

If unset, CD defaults API URLs to `http://localhost:8000` and Auth0 to empty (JWT paste fallback on `/admin` still works locally).

Details: [CI_CD_SETUP.md](CI_CD_SETUP.md#cd-pipeline).

## CORS & HTTPS

- Configure `CORS_ORIGINS` to exact frontend origins (scheme + host + port).
- Production should terminate **HTTPS** at a reverse proxy / platform load balancer; set CORS to `https://…` origins only.
- Cookies are not used for customer sessions; still use HTTPS to protect admin Bearer tokens in transit.

## Compose layout

See [diagrams/architecture.md](diagrams/architecture.md). Notable Compose env:

- Backend: `DATABASE_URL=…@postgres:5432/secureship`, `OLLAMA_HOST=http://host.docker.internal:11434`
- Frontend: `BACKEND_API_URL=http://backend:8000`
- Postgres is published on **`127.0.0.1:5432` only** (for `make seed` from the host; not exposed on all interfaces). For internet-facing hosts, keep a firewall in front of `:8000`/`:3000` and do not widen Postgres exposure.

Alembic runs on backend container start (`alembic upgrade head`).

## Images & CI/CD

- CI: lint, typecheck, pytest, frontend tests, Trivy (`.github/workflows/ci.yml`).
- CD (`.github/workflows/cd.yml`): build/push **GHCR** backend + frontend images on `main` and `v*.*.*` tags.
- **No cloud staging/prod URLs** in this program. After images publish, CD prints Compose deploy steps and validates `scripts/smoke.sh` syntax. Version tags also get a GitHub Release with the same Compose smoke notes.

### Build images locally

```bash
docker build -t secureship-backend ./backend
docker build -t secureship-frontend -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 \
  --build-arg NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 \
  --build-arg NEXT_PUBLIC_AUTH0_DOMAIN="$NEXT_PUBLIC_AUTH0_DOMAIN" \
  --build-arg NEXT_PUBLIC_AUTH0_CLIENT_ID="$NEXT_PUBLIC_AUTH0_CLIENT_ID" \
  --build-arg NEXT_PUBLIC_AUTH0_AUDIENCE="$NEXT_PUBLIC_AUTH0_AUDIENCE" \
  ./frontend
```

### Compose-based deploy (host with Docker + Ollama)

#### A. Local build (default — no GHCR)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# fill Auth0 vars if testing admin Universal Login (see above)

make start-prod
make seed    # first run
make smoke
```

#### B. GHCR pull (when you deploy later)

After CD pushes to GHCR (`main` branch or `v*.*.*` tag):

1. Create repo-root `.env` from `.env.example`:

   ```bash
   SECURESHIP_BACKEND_IMAGE=ghcr.io/<owner>/<repo>-backend:main
   SECURESHIP_FRONTEND_IMAGE=ghcr.io/<owner>/<repo>-frontend:main
   ```

   Replace `<owner>/<repo>` with your GitHub org/repo (image names match CD: `-backend` / `-frontend` suffixes).

2. Ensure `backend/.env` and `frontend/.env` exist on the host (secrets, Twilio, Auth0).

3. If admin Auth0 must work in the pulled frontend image, set GitHub **Variables** (see above) *before* the CD build that produced those images — or rebuild locally with `make start-prod` instead.

4. Deploy:

   ```bash
   make pull-prod
   make start-prod-no-build
   make seed
   make smoke
   ```

Compose uses `image:` + `build:` so services tag as `secureship-*:local` when overrides are unset; `SECURESHIP_*_IMAGE` makes `make pull-prod` fetch GHCR artifacts instead of rebuilding.

## Orval / OpenAPI clients

With the backend up:

```bash
cd frontend && make generate
```

## Smoke checklist

Automated (`make smoke` / `scripts/smoke.sh`):

1. `GET /health` → 200 with `"status"`
2. `POST /chat` with empty message → **422**
3. `GET /admin/shipments` without token → **401**
4. Frontend `:3000` reachable (skipped if down)

Manual demo extras:

1. Open http://localhost:3000 — send a chat message (needs Ollama)
2. `make seed` — verify a known tracking after SMS flow
3. `/admin` without token → login UI; invalid Bearer → **401**

## Related

- [CI_CD_SETUP.md](CI_CD_SETUP.md) · [TROUBLESHOOTING.md](TROUBLESHOOTING.md) · [SECURITY.md](SECURITY.md) · [API.md](API.md) · [LOGGING.md](LOGGING.md)
- [ADMIN_PANEL_SETUP.md](ADMIN_PANEL_SETUP.md) · [backend/AUTH0_SETUP_GUIDE.md](../backend/AUTH0_SETUP_GUIDE.md)
