# Week 4 Tasks

## Status: In progress

Week 4 builds the Auth0-gated admin panel: staff can create, update, and soft-delete shipments and packages, and see them appear immediately in the customer-facing chat via the existing tool-calling path. This is the first place in the codebase where a second, separate trust boundary is introduced — admin endpoints are gated by Auth0 JWTs, not by the conversational `session.customer_id` gate that protects customer data in [tools.py](../backend/src/secureship/tools.py).

Neither `auth.py` nor `admin.py` exist yet in `backend/src/secureship/`; both are new files. `Customer`, `Shipment`, and `Package` SQLAlchemy models already exist in [models.py](../backend/src/secureship/models.py) — no new tables required, only new endpoints and (for soft-delete) a schema change. `backend/.env.example` already has placeholders for `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`; an `AUTH0_AUDIENCE` var will need to be added. No JWT library is installed yet on the backend, and no Auth0 SDK exists on the frontend.

---

## What Is Being Built

### Backend (Python/FastAPI)

- [x] **Auth0 JWT Verification Middleware** — `backend/src/secureship/auth.py`
  - Fetch and cache Auth0 JWKS (`https://{AUTH0_DOMAIN}/.well-known/jwks.json`)
  - Verify JWT signature, `aud` (against `AUTH0_AUDIENCE`), `iss`, and expiry on every admin request
  - FastAPI dependency (e.g. `require_admin()`) applied to all `/admin/*` routes — a completely separate enforcement point from the `session.customer_id` gate used by chat tools
  - Add `AUTH0_AUDIENCE` to `.env.example`; add JWT/JWKS library (e.g. `python-jose[cryptography]` or `pyjwt[crypto]`) to `pyproject.toml`

- [x] **Admin API Endpoints** — `backend/src/secureship/admin.py`, all behind `require_admin()`
  - `GET /admin/shipments` — list all shipments, with filters (status, customer, tracking number)
  - `POST /admin/shipments` — create shipment (validates `customer_id` exists)
  - `PUT /admin/shipments/{id}` — update status/carrier/address/estimated_delivery
  - `DELETE /admin/shipments/{id}` — soft delete (requires `deleted_at` column — see migration below)
  - `POST /admin/packages` — add package to a shipment
  - `GET /admin/dashboard` — summary stats (counts by status, recent shipments)
  - Auth0 login/callback: `GET /admin/login` (redirect to Auth0 Universal Login), `GET /admin/callback` (exchange code, set session/cookie)

- [x] **Soft Delete Migration** — Alembic revision adding `deleted_at` (nullable timestamp) to `shipments` ✅ **COMPLETE**
  - ✅ Migration file: `backend/alembic/versions/0002_add_deleted_at_to_shipments.py`
  - ✅ `deleted_at` column added to `Shipment` model with index
  - ✅ `DELETE /admin/shipments/{id}` sets `deleted_at` rather than removing the row
  - ✅ `lookup_shipments()` / `get_shipment_status()` / `get_shipment_details()` in `tools.py` filter out soft-deleted rows
  - ✅ Admin endpoints support `include_deleted` parameter
  - ✅ Comprehensive test suite: `backend/tests/test_soft_delete.py`
  - ✅ Documentation: `docs/SOFT_DELETE_IMPLEMENTATION.md`

- [ ] **Test: Admin Endpoint Authorization**
  - No token / invalid token / expired token → 401 on every `/admin/*` route
  - Valid admin token → CRUD succeeds
  - Regression check: customer chat tools still only return non-deleted, `customer_id`-scoped shipments (existing Week 3 tests must keep passing)

### Frontend (Next.js/TypeScript)

- [ ] **Auth0 Integration** — add `@auth0/nextjs-auth0`, configure `AUTH0_*` vars in `frontend/.env.example`
  - `/admin` routes wrapped in an auth check; unauthenticated visitors redirected to Auth0 login
  - Session/token attached to all admin API calls (BFF pattern consistent with existing `frontend/src/lib/api.ts` — backend URL never exposed to the browser)

- [ ] **Admin Dashboard** — `frontend/src/pages/admin/index.tsx`
  - Shipment list/table: tracking number, customer, status, last update — with status filter
  - Create/edit shipment form — `frontend/src/components/ShipmentForm.tsx`
  - Add-package form (attached to a shipment)
  - Bulk action: mark selected shipments delivered

- [ ] **Admin API Client** — `frontend/src/lib/adminApi.ts` (or extend Orval config to also generate hooks for `/admin/*` from the backend OpenAPI schema, consistent with Week 1's Orval setup)

### Infrastructure

- [ ] **Env vars** — `AUTH0_AUDIENCE` (backend), Auth0 app registration values (frontend) documented in both `.env.example` files
- [ ] **Tests** — extend backend test suite
  - `test_admin_auth.py` — missing/invalid/expired token rejected; valid token allowed
  - `test_admin_shipments.py` — create/update/soft-delete CRUD correctness
  - [x] `test_soft_delete.py` — ✅ **COMPLETE**: soft-deleted shipment invisible to all customer-facing tools

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Auth0 JWT verification is a separate enforcement point from `session.customer_id` | Admin and customer trust boundaries are different identities (staff vs. shipment owner) — must not share a gate |
| Soft delete (`deleted_at`) instead of hard delete | Preserves audit trail; avoids breaking FK relationships to `packages`; customer-facing tools filter it out with one added clause |
| Admin dashboard is a normal CRUD UI, not bot-driven | Unlike customer chat (Week 3), admin work is inherently structured data entry — a form is the right interface here |
| Reuse Orval codegen for admin API client | Consistent with Week 1 decision to avoid hand-written fetch calls; extends existing pattern rather than introducing a new one |
| New shipments/packages visible to customers immediately | No caching layer between admin writes and the `lookup_shipments` tool query — same DB, same transaction semantics |

---

## Gaps vs. DEV_PLAN

| Item | Status |
|---|---|
| Auth0 JWT middleware | [ ] New: `auth.py` |
| Admin CRUD endpoints (shipments, packages) | [ ] New: `admin.py` |
| Admin login/callback flow | [ ] New: `/admin/login`, `/admin/callback` |
| Admin dashboard UI | [ ] New: `frontend/src/pages/admin/` |
| Soft delete support | [x] ✅ **COMPLETE**: Migration + model + tool updates + admin API + tests |
| Customer visibility of new shipments | [ ] Manual test: admin creates shipment → customer immediately sees it via `lookup_shipments` |

---

## Running (Week 4)

```bash
make nuke   # if schema changed (deleted_at migration)
make start  # docker-compose: frontend :3000, backend :8000, Postgres
make seed   # seed sample customers + shipments (if fresh DB)
```

Backend runs the new `deleted_at` migration automatically on startup (same Alembic-on-boot pattern as Week 3).

Admin panel: http://localhost:3000/admin (redirects to Auth0 login if not authenticated).

```bash
make stop
```

---

## Validation Checklist

- [ ] `/admin/*` routes reject requests with no token, invalid token, or expired token (401)
- [ ] Admin can log in via Auth0 Universal Login and reach `/admin` dashboard
- [ ] Admin creates a shipment → appears in `GET /admin/shipments`
- [ ] Admin updates shipment status → change reflected immediately
- [ ] Admin soft-deletes a shipment → disappears from `/admin/shipments` list (or shown as deleted) AND from customer's `lookup_shipments` result
- [ ] Admin adds a package to a shipment → package appears when a verified customer asks about that shipment
- [ ] Verified customer chat session sees a newly admin-created shipment without backend restart
- [ ] `cd backend && make lint` passes
- [ ] `cd backend && make test` passes (including new admin auth + soft-delete tests)
- [ ] `cd frontend && make lint` passes

---

## Manual Testing Guide (Demo Script)

### Prerequisites

```bash
make nuke && make start   # fresh DB, run migrations (incl. deleted_at)
make seed                 # seed customers + shipments
```

Have an Auth0 test admin account ready (or the dev tenant's test user).

### Scenario 1 — Admin login gate

1. Open http://localhost:3000/admin without logging in
2. **Expected:** redirected to Auth0 Universal Login, not the dashboard
3. Log in with admin test account
4. **Expected:** redirected back to `/admin`, dashboard loads

### Scenario 2 — Create shipment, customer sees it immediately

5. In admin dashboard, create a new shipment for a seeded customer (use a customer from `make seed`)
6. Open http://localhost:3000 in a second browser/incognito window, verify identity as that same customer
7. Ask: `"What shipments do I have?"`
8. **Expected:** the newly created shipment appears in the bot's answer, no restart needed

### Scenario 3 — Update status

9. In admin, change that shipment's status to `delivered`
10. In the customer chat, ask: `"What's the status of shipment X?"`
11. **Expected:** bot reports `delivered`

### Scenario 4 — Soft delete respected by customer tools ⭐ (security/consistency highlight)

12. In admin, delete that shipment
13. In the customer chat, ask: `"What shipments do I have?"` again
14. **Expected:** deleted shipment no longer appears; `lookup_shipments()` filters `deleted_at IS NOT NULL`
15. Confirm in DB the row still exists with `deleted_at` set (not hard-deleted)

### Scenario 5 — Admin endpoint auth enforcement

16. `curl -X GET http://localhost:8000/admin/shipments` with no `Authorization` header
17. **Expected:** 401, no data leaked
18. Repeat with an expired/garbage bearer token
19. **Expected:** 401

---

## Key Files

| File | Role |
|---|---|
| `backend/src/secureship/auth.py` | New: Auth0 JWKS fetch/cache, JWT verification, `require_admin()` dependency |
| `backend/src/secureship/admin.py` | New: admin CRUD endpoints, login/callback routes |
| `backend/src/secureship/models.py` | Extended: `deleted_at` column on `Shipment` |
| `backend/alembic/versions/` | New migration: add `deleted_at` to `shipments` |
| `backend/src/secureship/tools.py` | Updated: `lookup_shipments()`/`get_shipment_status()` exclude soft-deleted shipments |
| `backend/tests/test_admin_auth.py` | New: token validation tests |
| `backend/tests/test_admin_shipments.py` | New: CRUD correctness tests |
| `frontend/src/pages/admin/index.tsx` | New: admin dashboard |
| `frontend/src/components/ShipmentForm.tsx` | New: create/edit shipment form |
| `frontend/src/lib/adminApi.ts` | New: admin API client (or Orval-generated) |

---

## Testing Strategy

### Unit Tests (Backend)

- JWT verification: valid, expired, malformed, wrong audience/issuer tokens
- Admin CRUD: create/update/soft-delete correctness, including FK validation (`customer_id` must exist)
- `lookup_shipments()` / `get_shipment_status()` exclude soft-deleted rows

```bash
cd backend
make test
```

### Integration Tests (Backend)

- Full admin request cycle: no token → 401; valid token → 200 with expected payload
- Admin creates shipment → same DB session/transaction visible to a subsequent customer tool-call test

### Manual Testing (All)

See "Manual Testing Guide" above.

---

## Common Gotchas & Mitigations

| Issue | Mitigation |
|---|---|
| Auth0 JWKS fetch fails or is slow | Cache JWKS in memory with a reasonable TTL; don't fetch on every request |
| Admin token accepted despite wrong audience | Explicitly verify `aud` claim against `AUTH0_AUDIENCE`, not just signature |
| Soft-deleted shipment still visible to customer | Check every customer-facing query (`lookup_shipments`, `get_shipment_status`, `get_shipment_details`) filters `deleted_at IS NULL` — easy to miss one |
| Admin panel accessible without auth in dev | Don't bypass `require_admin()` "temporarily" — mock Auth0 in tests instead |
| Frontend admin routes render before auth check resolves | Use Auth0 SDK's server-side session check (getServerSideProps or middleware), not a client-side-only redirect |

---

## Deployment Readiness

By end of Week 4, the following should be true:

- [ ] `docker-compose up` runs all three services with no manual migration step
- [ ] Admin panel fully functional (CRUD shipments/packages) behind Auth0
- [ ] No admin endpoint reachable without a valid Auth0 token
- [ ] Customer-facing data never includes soft-deleted shipments
- [ ] All tests pass, all code lints and type-checks
- [ ] No secrets (Auth0 client secret, etc.) committed to code

---

**Last Updated:** 2026-08-21
**Branch:** `feat/week-4`
