---
description: "Use when writing, editing, or reviewing Python backend code in backend/src/secureship/. Covers FastAPI patterns, tool-calling security, pydantic schemas, and test conventions."
applyTo: "backend/**/*.py"
---

# Backend Conventions

- All functions need type annotations. Run `cd backend && make lint` (ruff + mypy) before committing.
- Use `pydantic` `BaseModel` for every request/response schema; never raw `dict` at API boundaries.
- Config values always come from `settings` in `config.py` (pydantic-settings). Never read `os.environ` directly.

## FastAPI Patterns

```python
# Route handler shape
@app.post("/endpoint")
async def handler(request: RequestModel) -> ResponseModel:
    ...
```

- Return typed response models, not raw dicts.
- Use `StreamingResponse` with `media_type="text/event-stream"` for SSE streaming (see `main.py`).
- CORS origins are hardcoded in `main.py`—add to both lists when changing ports.

## Tool-Calling Security Gate

Every tool in `tools.py` must check `session.verified` before returning any data:

```python
def get_shipment_status(tracking_number: str, session: Session) -> dict:
    if not session.verified:
        return {}  # empty — never raise, never leak
    # ... actual lookup
```

This is a non-negotiable security boundary. Do not refactor it away.

## Testing

- Tests live in `backend/tests/`. Run with `cd backend && make test`.
- Tests-first is required: add/update failing tests for the behavior before editing backend implementation code.
- Prefer `pytest` fixtures over setup/teardown classes.
- Test the security gate explicitly: unverified session → empty result, verified session → real data.
