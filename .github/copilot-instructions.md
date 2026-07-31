# SecureShip – Copilot Instructions

Full context: [CLAUDE.md](../CLAUDE.md) | Dev plan: [DEV_PLAN.md](../DEV_PLAN.md)

## Project

AI-gated shipment support chat. Customers verify identity (name + address + SMS 2FA), then chat with Claude to look up their shipments. The chat conversation *is* the auth flow—no separate login.

**Stack:** FastAPI (Python 3.11+) · Anthropic Claude API · Twilio SMS · Auth0 (admin) · PostgreSQL · Next.js / TypeScript · Tailwind CSS

## Security: Non-Negotiable Rules

- Claude tools (`get_shipment_status`, `get_customer_shipments`, `get_shipment_details`) must **only return data when `session.verified == True`**. Unverified callers get empty/no results—never raise an exception that leaks data.
- The Claude system prompt is the primary security boundary. Changes to `chat.py` system prompts need adversarial review (prompt injection, identity bypass attempts).
- Never hardcode secrets. All keys loaded from `.env` via `config.py` (`pydantic-settings`).
- Sanitize all user inputs at API boundaries. No SQL string interpolation—use SQLAlchemy ORM or parameterized queries.

## Build & Test Commands

```bash
# Backend
cd backend && make install   # install deps
cd backend && make dev       # uvicorn --reload on :8000
cd backend && make test      # pytest
cd backend && make lint      # ruff + mypy
cd backend && make format    # black + ruff --fix

# Frontend
cd frontend && make install  # npm install
cd frontend && make dev      # next dev on :3000
cd frontend && make lint     # eslint
cd frontend && make build    # production build

# Root
make dev                     # runs both (two terminals)
```

## Architecture Boundaries

| Layer | Path | Responsibility |
|-------|------|---------------|
| FastAPI routes | `backend/src/secureship/main.py` | Request handling, CORS, streaming |
| Claude integration | `backend/src/secureship/chat.py` | System prompt, tool-calling loop |
| Tools | `backend/src/secureship/tools.py` | Tool definitions + execution (gated by session.verified) |
| Identity/2FA | `backend/src/secureship/identity.py` | Verification state machine |
| Session | `backend/src/secureship/session.py` | In-memory → PostgreSQL |
| DB models | `backend/src/secureship/models.py` | SQLAlchemy models |
| Admin API | `backend/src/secureship/admin.py` | Auth0-protected CRUD |
| API client | `frontend/src/lib/api.ts` | `streamChat()` — all backend calls go here |
| Chat UI | `frontend/src/components/ChatWindow.tsx` | Single chat component |
| BFF proxy | `frontend/src/pages/api/chat.ts` | Next.js API route; keeps backend URL server-side |

## Conventions

- **Python:** ruff for lint/format, mypy for types. All new functions need type annotations. Use `pydantic` models for request/response schemas.
- **TypeScript:** strict mode on. Interfaces over `type` for object shapes. No `any`.
- **Branch naming:** `feature/week-{N}-{description}` (e.g., `feature/week-2-sms-2fa`)
- **Commits:** imperative tense ("add SMS verification endpoint")
- **Env vars:** always add to `backend/.env.example` and `frontend/.env.example` when introducing new ones.
- Week-scoped implementation: check [DEV_PLAN.md](../DEV_PLAN.md) before adding features—don't implement Week 3+ items in Week 1–2 code.
