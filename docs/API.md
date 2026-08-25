# SecureShip API

Machine-readable contract: **[OpenAPI](http://localhost:8000/openapi.json)** (also Swagger UI at `/docs` when the backend is running).

This document summarizes auth, rate limits, and the main routes. Prefer OpenAPI for request/response schemas.

## Trust boundaries

| Surface | Auth | Gate |
|---------|------|------|
| Customer chat / SMS / session | Session cookie-less UUID (`session_id`) | Shipment tools require verified `session.customer_id` |
| Admin CRUD | Auth0 JWT `Authorization: Bearer …` | `require_admin()` on every `/admin/*` data route |

Browser customers talk to **Next.js BFF** (`/api/chat`, `/api/verify-sms`, `/api/session/…`). Admin UI calls the backend admin API with a Bearer token (SPA Auth0 or pasted test JWT).

## Customer endpoints

### `GET /health`

Unauthenticated liveness. Returns `{ "status": "ok", "version": "…" }`.

### `POST /chat`

Streams the assistant reply (plain text chunks). Final bytes after a null (`\x00`) are a JSON metadata envelope (`session` state, optional shipment tool payload).

| | |
|--|--|
| Body | `{ "message": string (1–5000), "session_id"?: UUID }` |
| Rate limit | **30 req/min** per `session_id` (fallback: client IP). Exceeded → **429** + `Retry-After` |
| Errors | **400** validation; **429** rate limit; **503** persistence / upstream failure |

Response headers may include `x-session-id` / `x-session-state`.

### `GET /session/{session_id}`

Rehydrate durable chat state + transcript after reload.

| | |
|--|--|
| Query | `requesting_session_id` must match path id (anti-IDOR) |
| 404 | Unknown session |

Ephemeral OTP states (`code_sent` / `awaiting_code`) collapse to `anonymous` on reload.

### `POST /verify-sms`

Submit the 6-digit SMS code from the verification modal.

| | |
|--|--|
| Body | `{ "session_id": UUID, "code": "^\d{6}$" }` |
| Success | `{ "verified": true, "state": "verified" }` |
| Failure | `{ "verified": false, "state": …, "reason": … }` (expired, incorrect, max attempts, …) |

## Admin endpoints (`/admin`)

All data routes require a valid Auth0 access token for `AUTH0_AUDIENCE`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/admin/shipments` | List (filters, pagination) |
| `POST` | `/admin/shipments` | Create |
| `PUT` | `/admin/shipments/{id}` | Update |
| `DELETE` | `/admin/shipments/{id}` | Soft-delete |
| `POST` | `/admin/shipments/{id}/packages` | Add package |
| `GET` | `/admin/dashboard` | Stats |

### Unused placeholders (SPA Auth0 model)

| Method | Path | Note |
|--------|------|------|
| `GET` | `/admin/login` | Do not use — SPA login at `/admin` |
| `GET` | `/admin/callback` | Do not use — SPA callback at `/admin/callback` |

JWT verification is **on every request**. There is no backend refresh-token endpoint; the SPA (or pasted test token) supplies the access token.

## CORS

`CORS_ORIGINS` — comma-separated allowlist (default localhost:3000/3001). Do not use `*` in production.

## Frontend BFF (not OpenAPI)

| Next.js route | Upstream |
|---------------|----------|
| `POST /api/chat` | `POST {BACKEND_API_URL}/chat` (streams; forwards `Retry-After` on 429) |
| `POST /api/verify-sms` | `POST …/verify-sms` |
| `GET /api/session/[session_id]` | `GET …/session/{id}` |

## Related

- [ARCHITECTURE.md](ARCHITECTURE.md) — system & data flow
- [SECURITY.md](SECURITY.md) — gates, injection, rate limits
- [DEPLOYMENT.md](DEPLOYMENT.md) — env vars & Compose
