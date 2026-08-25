# SecureShip

AI-gated shipment support chat. Customers verify identity conversationally (name + phone + SMS 2FA), then chat with a **local Ollama** model that tool-calls into Postgres — only for verified sessions. An Auth0-gated admin panel manages shipments.

**Stack:**
- **Backend:** Python (FastAPI), Ollama (`qwen3:8b`), Twilio (SMS 2FA), Auth0 (admin JWT), PostgreSQL
- **Frontend:** Next.js, React, TypeScript (BFF proxies — browser never talks to the backend directly)
- **Runtime note:** Claude / Anthropic is used only via Claude Code to *build* the app. The chat brain is Ollama, not a cloud LLM API.

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — running before any command below
- [Ollama](https://ollama.com/) — running with `qwen3:8b` pulled (one-time):

  ```bash
  ollama pull qwen3:8b
  ```

### Start the app

```bash
make start
```

Starts Ollama (if needed) and the Docker stack (frontend, backend, Postgres).

- Frontend: http://localhost:3000  
- Backend health: http://localhost:8000/health  
- OpenAPI: http://localhost:8000/openapi.json  

Frontend bind-mount + Next.js dev mode: UI edits hot-reload without rebuilding containers.

### Seed the database (first run)

```bash
make seed
```

Idempotent — safe to re-run.

### Stop

```bash
make stop          # keep data
make nuke          # wipe DB volume
```

## Setup Environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Configure as needed:

| Area | Vars |
|------|------|
| Ollama | `OLLAMA_HOST`, `OLLAMA_MODEL` (defaults work for local) |
| Database | `DATABASE_URL` (Compose sets this for containers) |
| SMS 2FA | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (or use mock/log mode if enabled) |
| Admin Auth0 | `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_AUDIENCE` (+ frontend Auth0 vars) |

Never commit `.env` files.

## Shipment lookups (two tools)

| Tool | Use |
|------|-----|
| `lookup_shipments()` | All shipments for the verified `session.customer_id` |
| `get_shipment_status(tracking_number)` | One ownership-scoped shipment |

See [docs/WEEK4_KNOWN_ISSUES.md](docs/WEEK4_KNOWN_ISSUES.md) and [docs/week5_tasks.md](docs/week5_tasks.md).

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/week5_tasks.md](docs/week5_tasks.md) | Current week checklist (program finish) |
| [docs/DEV_PLAN.md](docs/DEV_PLAN.md) | Week-by-week plan |
| [CLAUDE.md](CLAUDE.md) | Architecture & conventions for AI-assisted work |
| [docs/WEEK4_KNOWN_ISSUES.md](docs/WEEK4_KNOWN_ISSUES.md) | Known issues closed in Week 5 |
| docs/API.md, ARCHITECTURE.md, DEPLOYMENT.md, SECURITY.md, … | Written during Week 5 docs pack |

## Key Commands

| Command | What it does |
|---------|--------------|
| `make start` / `make stop` / `make nuke` | Compose stack lifecycle |
| `make seed` | Seed customers + shipments |
| `make install` | Install backend + frontend deps |
| `make test` | Run tests |
| `make lint` / `make format` | Lint / format |

Backend: `cd backend && make dev|test|lint`  
Frontend: `cd frontend && make dev|lint|test|generate`

Regenerate Orval types from a running backend OpenAPI:

```bash
cd frontend && make generate
# or: ORVAL_OPENAPI_TARGET=http://localhost:8000/openapi.json npm run generate
```

Chat BFF request types use generated `ChatRequest` from `src/lib/generated/schemas`. Browser traffic still goes through Next.js `/api/*` proxies — never call the backend directly from the client.

## Architecture (by week)

1. Chat skeleton + Ollama  
2. Identity + SMS 2FA  
3. Tool-calling + shipment DB  
4. Admin panel + Auth0 + soft-delete  
5. Hardening, docs, polish, demo readiness  

## Project Structure

```
.
├── backend/          # FastAPI + tools + Auth0 admin API
├── frontend/         # Next.js chat + admin UI
├── docs/             # Plans, guides, diagrams
├── docker-compose.yml
├── CLAUDE.md
└── README.md
```

## License

Internal use only
