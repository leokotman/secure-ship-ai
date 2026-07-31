# Week 1 Tasks

## Status: Remediation Implemented — Final Backend Validation Pending

Week 1 scaffolding is operational, but the DEV_PLAN was updated after initial delivery. Several items were **not implemented** and must be completed before Week 1 is truly done.

---

## What Was Delivered

### Backend (Python/FastAPI)
- ✓ FastAPI server running on port 8000
- ✓ CORS configured for localhost:3000
- ✓ `/chat` endpoint with streaming responses
- ✓ Health check endpoint (`/health`)
- ✓ `.env` management, mypy + ruff passing

### Frontend (Next.js/React/TypeScript)
- ✓ Next.js app on port 3000
- ✓ Chat UI with real-time streaming, auto-scroll, loading/error states
- ✓ BFF proxy (`/api/chat` → backend; backend URL never exposed to browser)
- ✓ Tailwind CSS, TypeScript strict mode, ESLint passing

### Infrastructure
- ✓ Monorepo structure, separate Makefiles, root `make dev`
- ✓ `.env.example` files, `.gitignore`, initial commit

---

## Gaps vs. Updated DEV_PLAN

The plan was updated to require Ollama (not Anthropic), Postgres from day 1, Docker Compose, a seed script, and Orval codegen. These have now been implemented in code.

| Gap | Severity | Status |
|-----|----------|--------|
| `chat.py` uses Anthropic SDK — must use Ollama | **Critical** | ✅ Implemented |
| No DB / `ChatSession` persistence | **Critical** | ✅ Implemented |
| No `docker-compose.yml` | High | ✅ Implemented |
| No seed script (`scripts/seed_data.py`) | High | ✅ Implemented |
| No Orval codegen (`orval.config.ts`) | Medium | ✅ Implemented |
| No GitHub Actions CI | Low | ✅ Implemented |
| No `docs/diagrams/` | Low | ✅ Implemented |

---

## Remediation Plan

### Phase 1: Backend — Ollama + Config
**Files:** `backend/src/secureship/chat.py`, `config.py`, `.env.example`, `pyproject.toml`

- Replace `anthropic.Anthropic` client in `chat.py` with `httpx` streaming calls to `{ollama_host}/api/chat`. Keep same `stream_chat_response(messages)` signature — `main.py` stays untouched.
- In `config.py`: replace `anthropic_api_key` with `ollama_host` (default `http://localhost:11434`) and `ollama_model` (default `qwen3:8b`).
- Update `.env.example`: replace `ANTHROPIC_API_KEY` with `OLLAMA_HOST` and `OLLAMA_MODEL`.
- Remove `anthropic` from `pyproject.toml` deps (`httpx` already present).

### Phase 2: Database + ChatSession Persistence *(depends on Phase 1)*
**Files:** new `backend/src/secureship/database.py`, `main.py`, `pyproject.toml`

- Create `database.py`: SQLAlchemy async engine + `Base`. `ChatSession` model: `id` (uuid PK), `session_id` (str, indexed), `transcript` (JSONB), `created_at`, `updated_at`.
- Update `main.py`: upsert each chat turn into `ChatSession.transcript` after streaming, keyed by `session_id`. Call `create_tables()` on startup.
- Add deps: `sqlalchemy[asyncio]`, `asyncpg`, `alembic`.

### Phase 3: Docker Compose *(depends on Phase 2)*
**Files:** new root `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`

- `postgres`: `postgres:16-alpine`, volume `pgdata`, `POSTGRES_DB=secureship`, port 5432
- `backend`: build `./backend`, env from `.env`, `depends_on: postgres`, port 8000. Set `OLLAMA_HOST=http://host.docker.internal:11434`.
- `frontend`: build `./frontend`, `depends_on: backend`, port 3000.
- **Ollama is NOT in Docker** — runs on macOS host for Metal GPU, reached via `host.docker.internal`.

### Phase 4: Seed Script *(parallel with Phase 3)*
**Files:** new `scripts/seed_data.py`

Idempotent (truncate + insert). Connects via `DATABASE_URL` env var. Pre-creates the full schema (Customer/Shipment/Package tables) so seeding works before Week 3 models land.

- **25 Customer records**: `id` (uuid), `first_name`, `last_name`, `phone_number` (E.164), `address`
- **40–60 Shipment records**: `id`, `customer_id` (FK), `tracking_number`, `status` (enum: `label_created|in_transit|out_for_delivery|delivered|exception`), `carrier`, `origin`, `destination`, `estimated_delivery`, `last_update`
- **1–3 Package records per shipment**: `id`, `shipment_id` (FK), `description`, `weight_kg`, `declared_value`

### Phase 5: Frontend — Orval Codegen *(parallel with Phase 3/4)*
**Files:** new `frontend/orval.config.ts`, `package.json`, `_app.tsx`

- Add `orval`, `@orval/cli` to devDeps; `@tanstack/react-query` to deps.
- `orval.config.ts`: input from `http://localhost:8000/openapi.json`, output to `src/lib/generated/`.
- Add `"orval": "orval"` script to `package.json`.
- Wrap `_app.tsx` with `QueryClientProvider`.
- **`streamChat` in `api.ts` stays hand-written** — Orval doesn't generate SSE streaming clients. Orval covers non-streaming endpoints only.

### Phase 6: GitHub Actions CI *(parallel)*
**Files:** new `.github/workflows/ci.yml`

- `backend-lint` job: `ruff check` + `mypy`
- `frontend-lint` job: `eslint` + `tsc --noEmit`
- Triggers: push and PR to `main`

### Phase 7: Docs Diagrams
**Files:** new `docs/diagrams/architecture.md`

Mermaid system diagram: browser → Next.js BFF → FastAPI → Ollama (host) + Postgres.

---

## Running (Current State)

### Prerequisites
- Python 3.11+, Node.js 18+
- Ollama running on host (`ollama serve`) with `qwen3:8b` pulled

```bash
# Terminal 1
cd backend && PYTHONPATH=src python3 -m uvicorn secureship.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2
cd frontend && npm run dev
```

Open http://localhost:3000.

---

## Validation Notes

- Frontend lint and type-check pass.
- Backend static editor diagnostics are clean.
- Local backend `make lint` could not be executed in this environment due Python package build issues with the active interpreter/toolchain; CI uses Python 3.11 and is configured to validate backend lint/type checks.

---

## Running (Target State — after remediation)

```bash
# Requires: Ollama running on host with qwen3:8b pulled
ollama pull qwen3:8b
docker-compose up
```

Open http://localhost:3000.

---

**Last Updated:** 2026-07-31  
**Remediation target:** Week 1 completion gate
