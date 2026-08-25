# Logging

SecureShip uses **structlog** for structured JSON logs (console renderer when `DEBUG=true`).

## Principles

- Prefer structured key/value events over free-form printf strings.
- **Never log secrets:** API keys, Auth0/Twilio tokens, JWT bearer tokens, SMS codes (unless `SMS_LOG_VERIFICATION_CODE=true` for local-only mock).
- **Redact PII in shared log streams:** phone numbers, session IDs, authorization headers.

## Redaction

The `redact_sensitive` processor in `backend/src/secureship/logging_config.py` runs on every log event:

| Field / pattern | Replacement |
|-----------------|-------------|
| Keys: `phone`, `phone_number`, `session_id`, `sid`, `authorization`, `*_token`, `api_key`, `secret`, … | `[REDACTED]` |
| E.164 phones embedded in message strings | `[REDACTED]` |
| UUID session IDs embedded in message strings | `[REDACTED]` |

After Week 5, prefer logging `session=<redacted>` style events via structlog rather than interpolating raw IDs into format strings. Existing `logger.exception("…")` calls without IDs are preferred; stack traces must not be returned to clients.

## Security events worth logging

- Rate limit hits (`429` on `/chat`) — log key type (`session` / `ip`) only, not the raw key value when it contains a session UUID
- Failed admin JWT verification (already in auth path)
- Tool gate denials are usually silent at INFO (empty tool results); use DEBUG for tool diagnostics in local only

## Configuration

Logging is configured at app import via `configure_logging()` in `main.py`:

- `DEBUG=false` → JSON to stdout
- `DEBUG=true` → human-readable console

## Related

- [SECURITY.md](SECURITY.md) — threat model (Week 5 docs pack)
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — common failures
