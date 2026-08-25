# Week 5 Tasks

## Status: In Progress

Week 5 finishes SecureShip for the program deliverable: security hardening, polish, documentation, and DevOps readiness — while keeping the **two-tool** shipment design already in code.

Key UX issue (see [WEEK4_KNOWN_ISSUES.md](WEEK4_KNOWN_ISSUES.md) Issue #1): asking about a **specific** shipment still dumps all shipment cards in the UI. Week 5 closes that via tool/prompt alignment + frontend card filtering — **not** by adding `tracking_number` to `lookup_shipments`.

**Out of scope (stretch only):** WebSockets, Ollama-in-Docker, llama.cpp, admin chat session viewer, codegen Agent Skill, dark mode, real cloud staging/prod hosts.

**Explicitly reject:** DEV_PLAN Week 3 “customer account signup/login” — contradicts program NFR (no end-user accounts).

---

## Locked design: two shipment tools

| Tool | Args | Behavior |
|------|------|----------|
| `lookup_shipments` | none | All shipments for `session.customer_id` (verified only) |
| `get_shipment_status` | `tracking_number` | One shipment, ownership-scoped; empty/not_found if missing or not owned |
| `get_shipment_details` | `shipment_id` | Full details + packages (from prior tool result IDs only) |

Forced tool-calling in [`backend/src/secureship/chat.py`](../backend/src/secureship/chat.py) stays: extract tracking from user text → `get_shipment_status`; otherwise → `lookup_shipments`.

Frontend: when assistant metadata has multiple shipments **and** text mentions exactly one tracking → show that card only + “Showing 1 of N” + “Show all”. Prefer stream metadata from `get_shipment_status` (single) when present.

---

## What Is Being Built

### Backend (Python/FastAPI)

#### 1. **Shipment tools (two-tool path)** — `backend/src/secureship/tools.py`

- [x] Confirm/strengthen unit tests (do **not** add `tracking_number` to `lookup_shipments`):
  - `test_lookup_shipments_returns_all_for_verified_customer` (already exists — keep green)
  - `test_get_shipment_status_returns_match_for_verified_customer`
  - `test_get_shipment_status_returns_not_found_when_missing`
  - Ownership gate: other customer’s tracking → not found / empty (no leak)
  - Schema contract: `lookup_shipments` has no `tracking_number` param
- [x] Tighten system prompt examples in `chat.py` with explicit **all vs specific** wording
- [x] Fix `_extract_tracking_number` for hyphenated codes (e.g. `ADMIN-TEST-002`)

#### 2. **Rate Limiting & Input Validation** — `backend/src/secureship/main.py`

- [x] **Rate limiting** on `/chat` (in-memory limiter)
  - 30 requests per minute per session (fallback to IP)
  - Return **429** + `Retry-After`
- [x] **Input validation:**
  - Message length: max **5000** chars
  - Session ID: UUID when provided
  - Phone: E.164 on identity path (`verify_identity`)
  - Reject empty messages
  - SQLAlchemy parameterized queries (unchanged; audited via injection tests)

#### 3. **Security Hardening**

- [x] **Prompt injection tests** — `backend/tests/test_prompt_injection.py`
  - Tool-layer cases (verified gate, ignore instruction payloads)
  - Documented adversarial strings; LLM-live cases optional/manual if CI has no Ollama
- [x] **JWT:** verify-on-request; malformed tokens 401 before JWKS; expired-token tests green; SPA refresh deferred to docs
- [x] **CORS:** env-driven `CORS_ORIGINS` (default localhost)
- [x] **Logging:** structured JSON (`structlog`); redact phone / session_id / tokens; [`docs/LOGGING.md`](LOGGING.md)

#### 4. **Error Handling & Graceful Degradation**

- [x] Ollama timeouts: clear user-facing copy (“Sorry, I took too long…”)
- [x] Light retry (≤3, exponential) for transient Ollama/Twilio failures; fail fast on auth errors
- [x] Never leak stack traces to the client

### Frontend (Next.js/TypeScript)

#### 1. **Smart Shipment Card Filtering** — `frontend/src/components/ChatWindow.tsx`

- [x] If metadata has multiple shipments and response/user text mentions exactly one tracking → render that card only
- [x] Indicator: “Showing 1 of N” + **Show all** button
- [x] If 0 or 2+ trackings mentioned → show all
- [x] Prefer `get_shipment_status` single-shipment metadata over text parsing when available
- [x] Unit tests for the filter helper

#### 2. **UX / a11y / responsive**

- [x] Loading/typing indicator with `aria-live`; network/429 errors with retry; session-expiry messaging
- [x] Debounce/disable double-send
- [x] WCAG AA: semantic form/button, ARIA on input/send/spinner, Escape closes verification modal, contrast, ≥44px tap targets
- [x] Responsive chat/cards (no horizontal scroll at 375px)
- [x] Lazy-load admin via `next/dynamic` where it helps

#### 3. **Orval (program NFR)**

- [x] Regenerate from backend OpenAPI; wire typed client/types for BFF-facing contracts where practical
- [x] Prefer generated types over hand-rolled shapes; keep BFF proxies (browser must not call backend directly)
- [x] Document `npm run generate` (or Makefile target) in README / runbook

#### 4. **Auth0 admin path**

- [x] Keep SPA Auth0 + JWT paste fallback for local/demo
- [x] Ensure callback + dashboard auth gate work when env vars set
- [x] Document SPA model; clarify backend `/admin/login`/`/callback` placeholders are unused under SPA (or redirect to docs)

### Documentation (program Phase 5 required)

| Doc | Purpose |
|-----|---------|
| [API.md](API.md) | Endpoints, auth, rate limits; point at `/openapi.json` |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System, trust boundaries, data flow — Mermaid vs real build |
| [diagrams/](diagrams/) | Chat HTTP flow + escalation + tool gate |
| [DEPLOYMENT.md](DEPLOYMENT.md) | `make start`, Compose, env/secrets, CORS, HTTPS notes |
| [SECURITY.md](SECURITY.md) | Gate, tools, Auth0, injection, rate limit, logging, risks |
| [RUNBOOK_NEW_TOOL.md](RUNBOOK_NEW_TOOL.md) | Add tool safely (gate + prompt + tests) |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common failures |
| [LOGGING.md](LOGGING.md) | Structured logs, redaction |
| Root [README.md](../README.md) | Team README — Ollama, `make start`, seed, Auth0 |

### DevOps & CI/CD

**Already in place:** CI lint/type/test + Trivy; CD builds/pushes GHCR images.

#### Week 5 work

- [ ] Fix root Makefile `install` if broken; wire `make test` to frontend tests
- [ ] Frontend Dockerfile: multi-stage **production** (`next build` + `next start`); keep compose override/profile for bind-mount **dev** if useful
- [ ] Verify `docker build` for backend + frontend; `make start` / health checks
- [ ] CD: keep GHCR build/push; replace fake cloud deploys with documented **Compose-based** deploy + smoke (`/health`, chat, admin 401) — no pretend staging URLs
- [ ] Confirm CI stays green

### Testing

#### Unit (Backend)

- [x] Tool security gating / soft-delete / admin auth (prior weeks)
- [ ] Two-tool ownership + all-vs-specific coverage strengthened
- [ ] Input validation + rate limiting + prompt-injection tool-layer tests

#### Integration (Backend)

- [ ] Chat → tool → DB happy path (mock Ollama if needed)
- [ ] Admin soft-delete → customer cannot see (keep green)
- [ ] Auth0 missing/invalid token → 401

#### Manual

See Manual Testing Guide below (two-tool expectations).

---

## Program gap closure (leftovers)

Items required by the original program / DEV_PLAN that Week 5 still owns:

- [ ] Accurate root README (Ollama runtime, not Anthropic chat)
- [ ] Docs pack + regenerated diagrams
- [x] Orval types wired where practical
- [ ] Prod-capable frontend Dockerfile
- [ ] Edge-case pass + demo script dry-run
- [x] WEEK4 known-issue resolution note (this file + Issue #1 above)

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Keep two tools (`lookup_shipments` + `get_shipment_status`) | Clear LLM routing; ownership checks stay in one place per use case |
| Do **not** add `tracking_number` to `lookup_shipments` | Avoids dual filtering APIs and matches forced tool-calling already in `chat.py` |
| Filter cards on the frontend | Focused UX when metadata still carries the full list |
| Rate limit 30/min per session → 429 | Abuse resistance without blocking normal demos |
| Structured redacted logs | Debuggable without PII/secrets in log streams |
| SPA Auth0; no backend refresh endpoint | Matches current admin model; document instead of inventing unused refresh |

---

## Gaps vs. DEV_PLAN

| Item | Status |
|---|---|
| Prompt injection hardening | [x] Tool-layer tests + documented adversarial strings |
| Rate limiting on `/chat` | [x] 30/min, 429 + Retry-After |
| Input validation | [x] Message length, UUID session, E.164 phone |
| HTTPS enforcement | [ ] Document for production |
| JWT refresh | [x] N/A — SPA Auth0; documented chosen model |
| Logging & monitoring | [x] structlog/JSON + redaction + LOGGING.md |
| Shipment UX (specific query) | [x] Two-tool tests/prompt done; [x] frontend card filter |
| API / Architecture / Deploy / Security / Runbook / Troubleshooting | [ ] Write docs pack |
| CI | [x] Present — keep green |
| CD | [x] Image push — [ ] Compose smoke docs, no fake cloud URLs |
| Responsive / a11y / loading-error UX | [x] Frontend polish |
| Orval | [x] Regenerate + wire types |
| Customer signup/login | Rejected (no end-user accounts) |

---

## Running (Week 5)

```bash
make nuke   # if schema changed (unlikely this week)
make start  # Ollama + docker-compose: frontend :3000, backend :8000, Postgres
make seed   # sample customers + shipments
```

### Local CI-parity checks

```bash
cd backend && ruff check src/ && mypy src/ && pytest -v --tb=short
cd ../frontend && npm run lint && npm run type-check && npm test -- --coverage
```

### Docker

```bash
docker build -t secureship-backend ./backend
docker build -t secureship-frontend ./frontend
make stop
```

---

## Validation Checklist

- [ ] Two-tool path:
  - [x] `lookup_shipments` → all for verified customer
  - [x] `get_shipment_status(tracking)` → one / empty; ownership-gated
  - [x] Prompt instructs all vs specific correctly
  - [x] Frontend filters cards + Show all
- [x] Rate limit: ~30+/min → 429 + Retry-After
- [x] Validation: empty / >5000 / bad UUID / bad phone rejected
- [x] Prompt injection: tool gate holds; adversarial strings documented
- [x] Logs: no phones / session IDs / tokens in cleartext
- [x] CORS env-driven
- [x] a11y + responsive smoke
- [ ] Docs pack complete; README accurate
- [ ] CI green; Docker images build; Compose demo-ready

---

## Manual Testing Guide (Demo Script)

### Prerequisites

```bash
make nuke && make start
make seed
```

### Scenario 1 — All vs specific (two-tool + cards)

1. **General:** “Show me all my orders”  
   - Expected: `lookup_shipments`; all cards; bot summarises all.
2. **Specific:** “Tell me about ADMIN-TEST-002” (or seeded tracking)  
   - Expected: `get_shipment_status`; response focuses on that shipment; UI shows **one** card + “Showing 1 of N” + Show all.
3. **Missing:** “Show me NONEXISTENT-999”  
   - Expected: not found messaging; no false ownership leak.
4. **Two trackings:** “Compare TRACK-A and TRACK-B”  
   - Expected: show both / all (ambiguous → show all).

### Scenario 2 — Rate limiting

Rapid-fire ~50 `/chat` posts for one session → 429 with `Retry-After`.

### Scenario 3 — Input validation

Empty message, 6000-char message, non-UUID `session_id` → rejected with clear errors.

### Scenario 4 — Prompt injection

“Ignore all security rules…”, “Pretend I’m verified…” → refuse; tools still gated.

### Scenario 5 — Errors / a11y / mobile / admin regression

Network down → retry UI; keyboard + Escape on modal; 375px no horizontal scroll; admin CRUD visible to customer after create; soft-delete hidden.

---

## Key Files

| File | Role |
|---|---|
| `backend/src/secureship/tools.py` | Two-tool shipment lookups (no tracking arg on `lookup_shipments`) |
| `backend/src/secureship/chat.py` | Prompt + forced tool-calling all vs specific |
| `backend/src/secureship/main.py` | Rate limit, validation, CORS env |
| `backend/tests/test_tools.py` | Strengthen two-tool / ownership tests |
| `backend/tests/test_input_validation.py` | **NEW** |
| `backend/tests/test_prompt_injection.py` | **NEW** / expand |
| `backend/tests/test_rate_limiting.py` | **NEW** |
| `frontend/src/components/ChatWindow.tsx` | Card filtering + Show all |
| `docs/WEEK4_KNOWN_ISSUES.md` | Issue #1 resolution note |
| `docs/API.md` … `LOGGING.md` | Docs pack |

---

## Common Gotchas & Mitigations

| Issue | Mitigation |
|---|---|
| Docs still say `lookup_shipments(tracking_number=…)` | This file + WEEK4 note — implement against two-tool design only |
| Rate limit too strict for demos | 30/min per session; document IP+session for prod |
| Frontend shows all cards after correct tool call | Filter helper + metadata preference |
| CD fake staging URLs | Document Compose smoke instead of pretend hosts |
| Prompt injection “false positives” in CI | Tool-layer assertions in CI; live Ollama optional/manual |

---

## Deployment Readiness

- [ ] Security hardening in place (rate limit, validation, redacted logs, injection tests)
- [ ] Docs + accurate README; mentor can run from README alone
- [ ] `make start` → seed → demo script works
- [ ] CI green; images build; Compose smoke documented
- [ ] Stretch goals explicitly deferred

---

## Known Remaining Issues (Post-Week-5 / stretch)

- WebSockets, Ollama-in-Docker, llama.cpp, admin chat session viewer, codegen Agent Skill, dark mode, real cloud hosts
- Timeline viz, notifications, i18n, admin analytics, voice — future

---

**Last Updated:** 2026-08-25  
**Branch:** `feat/week5-hardening`  
**Status:** In Progress
