# Troubleshooting

## Stack won’t start

| Symptom | Check |
|---------|--------|
| `make start` fails | Docker Desktop running? Use `make start-prod` for production images (no bind mounts). |
| Backend unhealthy | `docker compose logs backend` — Alembic / Postgres |
| Postgres not ready | Wait for healthcheck; `docker compose ps` |
| Port in use | Free `:3000`, `:8000`, `:5432` or change mappings |
| Frontend image build fails (SWC) | Production Dockerfile installs platform SWC from Next optionalDeps; rebuild with `docker build -f frontend/Dockerfile ./frontend` |

```bash
make stop
make nuke   # only if wiping DB is OK
make start  # or: make start-prod
make seed
make smoke  # /health, chat 422, admin 401
```

## Ollama / chat timeouts

| Symptom | Fix |
|---------|-----|
| “took too long” / empty bot | `ollama list` — need `qwen3:8b`; `ollama serve` running |
| Works on host, fails in Compose | Backend must use `OLLAMA_HOST=http://host.docker.internal:11434` |
| Slow first reply | Cold model load — retry once |

```bash
curl -s http://localhost:11434/api/tags
curl -sf http://localhost:8000/health
```

## CORS errors in the browser

- Set `CORS_ORIGINS` to the exact frontend origin (e.g. `http://localhost:3000`)
- Restart backend after env changes
- Chat should go through `/api/chat` (same origin as Next) — CORS mainly affects admin → backend

## SMS / verification

| Symptom | Fix |
|---------|-----|
| No SMS | Twilio creds in `backend/.env`; check Twilio console |
| Local without Twilio | Use project mock/log mode if enabled; never enable OTP logging in shared envs |
| Modal won’t accept code | Session must be `code_sent` / `awaiting_code`; code exactly 6 digits |
| Max attempts | Restart identity in chat (`collecting_identity`) |

## Session / “I lost my chat”

- Session id is **tab** `sessionStorage` (`secureship_session_id`), not `localStorage`
- OTP mid-flow collapses to anonymous on reload by design
- `GET /session/{id}` requires matching `requesting_session_id`

## Rate limit 429

- Default 30 `/chat` requests per minute per session (or IP)
- UI should show retry; wait for `Retry-After` seconds
- Raise `CHAT_RATE_LIMIT_PER_MINUTE` only for demos if needed

## Admin 401 / Auth0

| Symptom | Fix |
|---------|-----|
| Immediate 401 | Missing/invalid Bearer; paste fresh Auth0 API test token |
| Auth0 button missing | Set `NEXT_PUBLIC_AUTH0_*` in `frontend/.env`; for **`make start-prod`**, rebuild after changes (vars are baked at `next build`) |
| Callback error | Redirect URI must be `{origin}/admin/callback` in Auth0 app settings |
| Backend Auth0 misconfig | `AUTH0_DOMAIN` / `AUDIENCE` must match token |

Remember: backend `/admin/login` and `/admin/callback` are **unused**; use the SPA routes. See [DEPLOYMENT.md](DEPLOYMENT.md#local-production-like-with-auth0-admin).

## Shipment cards show everything

Specific tracking should show one card + “Show all”. If not:

1. Confirm backend forced tool / metadata (`get_shipment_status` vs `lookup_shipments`)
2. Confirm tracking pattern matches extractor (e.g. `ADMIN-TEST-002`)
3. See [WEEK4_KNOWN_ISSUES.md](WEEK4_KNOWN_ISSUES.md)

## Soft-delete still visible

Customer tools filter deleted rows. Re-seed / hard-refresh chat session. Admin list may still show depending on filters — confirm soft-delete flag in DB.

## Logs & debugging

- `DEBUG=true` → human-readable logs; `false` → JSON
- Phones / session IDs should appear redacted — see [LOGGING.md](LOGGING.md)
- Never paste production JWTs or Twilio tokens into tickets

## Tests locally

```bash
cd backend && make test
cd frontend && npm test && npm run type-check && npm run lint
```

## Related

- [DEPLOYMENT.md](DEPLOYMENT.md) · [API.md](API.md) · [SECURITY.md](SECURITY.md) · [CI_CD_SETUP.md](CI_CD_SETUP.md)
