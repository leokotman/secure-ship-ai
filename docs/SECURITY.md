# Security

SecureShip’s core promise: **shipment data is only available to a verified customer session**, and **admins are a separate Auth0 trust boundary**.

## Customer identity gate

1. Chat starts anonymous; the model collects first name, last name, phone (E.164).
2. `verify_identity` binds the session to a DB customer when details match.
3. SMS OTP via Twilio (`send_verification_code` / `check_verification_code` or `POST /verify-sms`).
4. On success, `session.customer_id` is set server-side.
5. Shipment tools refuse or return empty/`not_verified` without that id.

**Never** trust a user-supplied customer or shipment owner id. Ownership is always `WHERE customer_id = session.customer_id` (plus soft-delete filters).

## Tool layer (hard boundary)

| Tool | Gate |
|------|------|
| `lookup_shipments` | Verified `customer_id`; returns that customer’s shipments only |
| `get_shipment_status` | Same + tracking match; other customers → not_found |
| `get_shipment_details` | Same + `shipment_id` ownership |

Prompt injection (“ignore rules”, “pretend I’m verified”) is handled by:

- System prompt refuse rules (soft)
- **Tool execution gates** (hard) — covered by `backend/tests/test_prompt_injection.py` and tool tests
- Live Ollama adversarial checks are optional/manual when CI has no Ollama

## Admin Auth0

- SPA Universal Login → `/admin/callback` stores access token → dashboard.
- Local/demo fallback: paste Auth0 API test JWT on `/admin`.
- Backend verifies JWT (issuer, audience, signature via JWKS) on **each** admin request.
- No backend refresh-token endpoint (by design for this program).
- `GET /admin/login` and `GET /admin/callback` are **unused placeholders** under the SPA model.

## Rate limiting & input validation

| Control | Detail |
|---------|--------|
| `/chat` rate limit | 30/min per session (IP fallback); **429** + `Retry-After` |
| Message length | max **5000** |
| `session_id` | UUID when provided |
| Phone | E.164 on identity path |
| SMS code | exactly 6 digits |

## CORS

`CORS_ORIGINS` allowlist. Do not use wildcard origins with credentials in production.

## Logging & secrets

Structured JSON logs (`structlog`) with redaction of phones, session IDs, tokens. See [LOGGING.md](LOGGING.md).

Never log SMS codes unless `SMS_LOG_VERIFICATION_CODE=true` (local mock only). Never return stack traces to clients.

## Soft-delete

Admin `DELETE /admin/shipments/{id}` soft-deletes. Customer tools must not return deleted rows.

## Escalation

`escalate_to_human` is UI theater. It does **not** widen data access.

## Known risks / limitations

| Risk | Mitigation / status |
|------|---------------------|
| Prompt soft-boundary bypass | Tools enforce; injection tests in CI |
| In-memory rate limiter | Per-process; fine for demo; use shared store for multi-replica prod |
| Admin token in `localStorage` | Demo/SPA tradeoff; prefer short-lived tokens + HTTPS |
| Twilio / Ollama outages | Retries + user-facing timeout copy; no secret leakage |
| IDOR on session GET | `requesting_session_id` must match path |
| No end-user passwords | Intentional (program NFR) |

## HTTPS

Production deployments should terminate TLS at the edge and set `CORS_ORIGINS` to HTTPS frontends. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Related

- [API.md](API.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [RUNBOOK_NEW_TOOL.md](RUNBOOK_NEW_TOOL.md) · [diagrams/tool-gate.md](diagrams/tool-gate.md)
