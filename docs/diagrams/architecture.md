# SecureShip Architecture

```mermaid
flowchart LR
    browser[Browser UI]
    next[Next.js App + BFF /api/chat]
    api[FastAPI /chat]
    db[(Postgres)]
    ollama[Ollama on Host]

    browser --> next
    next --> api
    api --> db
    api --> ollama
```

## Notes

- Ollama runs on the macOS host and is reached from Docker containers through `host.docker.internal`.
- The browser never calls FastAPI directly; it uses the Next.js BFF route.
- FastAPI persists chat transcripts in Postgres keyed by `session_id`.
