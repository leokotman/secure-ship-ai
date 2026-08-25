# Runbook: Add a new tool safely

Use this checklist whenever you expose a new capability to Ollama. **Prompt text is not enough** — the tool executor is the security boundary.

## 1. Define the tool schema

In `backend/src/secureship/tools.py` (tool list / JSON schema):

- Clear `name` and `description` (what the model should call it for)
- Explicit `parameters` — prefer minimal args
- **Do not** accept `customer_id` (or any owner id) from the model; use `session.customer_id`

## 2. Implement `execute_tool` branch

- Gate first: if the tool touches customer data and `session.customer_id` is missing → return a structured `not_verified` / empty result (no stack traces, no other customers’ rows).
- Scope every DB query to that customer (and respect soft-delete).
- Cross-tenant lookups must look like “not found”, not “forbidden with hint”.

## 3. Update the system prompt

In `backend/src/secureship/chat.py`:

- When to call the new tool vs existing ones
- What **not** to invent if the tool returns empty / error statuses
- Keep “all vs specific” shipment guidance consistent if related

If the tool must always run for certain intents, extend forced routing carefully (same file) and document why.

## 4. Tests (required before merge)

Add/extend tests under `backend/tests/`:

| Case | Expect |
|------|--------|
| Unverified session | No data leak |
| Verified owner | Happy path |
| Other customer’s id/tracking | Empty / not_found |
| Soft-deleted row | Invisible |
| Adversarial user text | Gate still holds (`test_prompt_injection.py` patterns) |

Prefer tests-first: failing tests → implement → green.

## 5. Frontend (if results surface in UI)

- Stream metadata shape (`tool` + `data`) must be understood by `streamChat` / ChatWindow
- Cards: reuse `filterShipmentsForDisplay` patterns if multiple entities can appear
- Keep BFF proxies — do not call FastAPI from the browser for chat

## 6. Docs & OpenAPI

- Mention the tool in [ARCHITECTURE.md](ARCHITECTURE.md) / [SECURITY.md](SECURITY.md) if it changes the trust model
- Regenerate Orval if request/response types change: `cd frontend && make generate`
- Update [API.md](API.md) only if you add HTTP routes (tools alone are not HTTP)

## 7. Demo sanity

```bash
cd backend && make test
make start && make seed
# Manual: unverified ask → refuse; verified ask → tool result only for that customer
```

## Anti-patterns

- “The prompt says not to call this until verified” with **no** executor check
- Returning other tenants’ rows filtered only in the LLM reply
- Logging phones, OTPs, or raw JWTs while debugging the new tool
- Skipping ownership tests because “it’s admin-only later”
