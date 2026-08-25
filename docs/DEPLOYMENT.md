# Deployment

SecureShip’s supported demo path is **local Docker Compose + host Ollama**. Cloud staging/prod hosts are stretch goals.

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
  ```

### Start / seed / stop

```bash
make start   # Ollama (if needed) + compose: frontend :3000, backend :8000, Postgres
make seed    # customers + shipments (idempotent)
make stop    # keep volumes
make nuke    # wipe Postgres volume
```

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

## CORS & HTTPS

- Configure `CORS_ORIGINS` to exact frontend origins (scheme + host + port).
- Production should terminate **HTTPS** at a reverse proxy / platform load balancer; set CORS to `https://…` origins only.
- Cookies are not used for customer sessions; still use HTTPS to protect admin Bearer tokens in transit.

## Compose layout

See [diagrams/architecture.md](diagrams/architecture.md). Notable Compose env:

- Backend: `DATABASE_URL=…@postgres:5432/secureship`, `OLLAMA_HOST=http://host.docker.internal:11434`
- Frontend: `BACKEND_API_URL=http://backend:8000`

Alembic runs on backend container start (`alembic upgrade head`).

## Images & CI/CD

- CI: lint, typecheck, pytest, frontend tests, Trivy (see `.github/workflows`).
- CD: build/push GHCR images. Prefer **Compose-based** deploy + smoke (`/health`, chat, admin 401) over fake staging URLs until real hosts exist.
- Frontend production Dockerfile (multi-stage `next build` + `next start`) is a Week 5 DevOps item if not already merged.

## Orval / OpenAPI clients

With the backend up:

```bash
cd frontend && make generate
```

## Smoke checklist

1. `curl -sf http://localhost:8000/health`
2. Open http://localhost:3000 — send a chat message
3. `make seed` — verify a known tracking in chat after SMS flow
4. `/admin` without token → login; invalid Bearer → **401**

## Related

- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) · [SECURITY.md](SECURITY.md) · [API.md](API.md) · [LOGGING.md](LOGGING.md)
