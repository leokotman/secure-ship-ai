# SecureShip

An AI-gated shipment support chat application built with:
- **Backend:** Python (FastAPI), Claude Anthropic API
- **Frontend:** Next.js, React, TypeScript
- **Identity:** Conversational verification + SMS 2FA
- **Tool-Calling:** Claude calls shipment lookup functions

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — must be running before any command below
- [Ollama](https://ollama.com/) — must be running with the `qwen3:8b` model pulled.
  Pull is a **one-time download**:
  ```bash
  ollama pull qwen3:8b
  ```
  You only need to do this once. The model is stored locally and persists across restarts.

### Start the app

```bash
make start
```

This starts Ollama (if not already running) and brings up the full Docker stack. If Ollama was already running you may see a harmless error in the background — ignore it.

Visit **http://localhost:3000**

### Seed the database (first run only)

```bash
make seed
```

Run this once while the stack is up. It's idempotent — safe to run again.

### Stop the app

```bash
make stop          # stop everything, keep your data
make nuke          # stop everything AND wipe the database volume
```

## Documentation

- **[DEV_PLAN.md](DEV_PLAN.md)** — Week-by-week development plan (5 weeks)
- **[CLAUDE.md](CLAUDE.md)** — Architecture, structure, key patterns for AI-assisted development

## Key Commands

| Command | What it does |
|---------|---|
| `make install` | Install backend + frontend dependencies |
| `make dev-backend` | Run FastAPI server (localhost:8000) |
| `make dev-frontend` | Run Next.js dev server (localhost:3000) |
| `make lint` | Run linters |
| `make format` | Format code |
| `make test` | Run tests |
| `make clean` | Clean build artifacts |

## Setup Environment

1. Copy `.env` templates:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

2. Add your Anthropic API key to `backend/.env`:
   ```
   ANTHROPIC_API_KEY=your_key_here
   ```

3. (Week 2+) Add Twilio credentials:
   ```
   TWILIO_ACCOUNT_SID=...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=...
   ```

4. (Week 4+) Add Auth0 credentials:
   ```
   AUTH0_DOMAIN=...
   AUTH0_CLIENT_ID=...
   AUTH0_CLIENT_SECRET=...
   ```

## Architecture

**Week 1:** Basic chat skeleton + Claude integration  
**Week 2:** Identity verification + SMS 2FA  
**Week 3:** Tool-calling + shipment lookups + database  
**Week 4:** Admin panel + Auth0 + CRUD operations  
**Week 5:** Security hardening, docs, final polish  

See [DEV_PLAN.md](DEV_PLAN.md) for detailed week-by-week breakdown.

## Project Structure

```
.
├── backend/                # Python FastAPI server
├── frontend/               # Next.js React app
├── docs/                   # Documentation & assets
├── DEV_PLAN.md             # Week-by-week plan
├── CLAUDE.md               # Architecture guide
└── README.md               # This file
```

## License

Internal use only
