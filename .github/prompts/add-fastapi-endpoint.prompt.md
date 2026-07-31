---
description: "Scaffold a new FastAPI endpoint in the SecureShip backend. Generates route handler, pydantic request/response models, and test stub."
argument-hint: "endpoint description (e.g. 'POST /verify-sms — accepts phone + code, marks session verified')"
agent: "agent"
---

Add a new FastAPI endpoint to `backend/src/secureship/main.py` following SecureShip conventions.

## Endpoint to add

$input

## Requirements

1. **Pydantic models** — Define `*Request` and `*Response` `BaseModel` classes for the endpoint's payload and return value. Place them near the top of `main.py` (or in a dedicated `schemas.py` if that file exists).

2. **Route handler** — Use `async def`. Return the typed response model. Example shape:
   ```python
   @app.post("/your-endpoint", response_model=YourResponse)
   async def your_endpoint(request: YourRequest) -> YourResponse:
       ...
   ```

3. **Config/secrets** — Load any required keys from `settings` in `config.py`. If a new env var is needed, add it to `Settings` in `config.py` **and** to `backend/.env.example`.

4. **Error handling** — Raise `HTTPException` with appropriate status codes for expected error cases. Do not let internal exceptions propagate.

5. **Test stub** — Add a test in `backend/tests/` using `httpx.AsyncClient` (FastAPI test client). Cover the happy path and at least one error case.

Follow existing endpoint patterns in [main.py](../../backend/src/secureship/main.py).
