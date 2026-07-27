# SecureShip Development Plan - 5 Week Build

A detailed week-by-week plan for building SecureShip: an AI-gated shipment support chat with identity verification and tool-calling.

---

## Overview

**Project:** SecureShip — Customer-facing chat for verified shipment lookups, backed by a local Claude API model for conversational AI and tool-calling.

**Stack:**
- **Backend:** Python (FastAPI), Claude Anthropic API, Twilio (SMS 2FA), Auth0 (admin)
- **Frontend:** Next.js (TypeScript), React
- **Database:** PostgreSQL (Week 3+)

**Team:** 1–2 engineers (full-stack or split frontend/backend)

**Delivery Model:** Weekly milestones, Monday morning reviews of prior week's work

---

## Week 1: Project Setup & Chat Skeleton

**Goal:** Operational infrastructure, repos, CI/CD pipelines, and a working chat UI shell wired to a backend that accepts messages.

### Backend (Python/FastAPI)
- [ ] FastAPI server running locally on port 8000
- [ ] CORS configured for localhost:3000 (frontend)
- [ ] Basic `/chat` endpoint accepting POST messages (in-memory for now, no persistence)
- [ ] Claude API integration (streaming messages back; no tool-calling yet)
- [ ] `.env` management (API keys for Anthropic)
- [ ] Health check endpoint (`/health`)
- [ ] Docker setup (Dockerfile, can build and run locally)

### Frontend (Next.js)
- [ ] Next.js app running on localhost:3000
- [ ] Chat UI component: input field, message list, send button
- [ ] Fetch messages from `/chat` endpoint
- [ ] Display bot responses in the chat
- [ ] Basic styling (Tailwind CSS)

### DevOps / Project Setup
- [ ] Git repo initialized, `.gitignore`, initial commit
- [ ] Monorepo structure (backend/, frontend/) with separate Makefiles
- [ ] `Makefile` at root level with `make dev` to run both services
- [ ] GitHub Actions workflow (or equivalent) for linting/type-checking on push
- [ ] `CLAUDE.md` with how to run, project structure, key concepts
- [ ] `.env.example` files in both backend and frontend

### Success Criteria
- [ ] Backend server and frontend UI running together
- [ ] Send a message, see bot respond (stateless, no identity verification yet)
- [ ] All code compiles, linters pass, no warnings

### Key Files Created
- `backend/src/secureship/chat.py` (message handling, Claude API calls)
- `frontend/src/components/ChatWindow.tsx` (main chat UI)
- `frontend/src/lib/api.ts` (API client)
- `Makefile` (root level, orchestrates dev environment)

---

## Week 2: Identity Verification & SMS 2FA

**Goal:** Build the identity-gating flow: collect name/address/phone, send SMS 2FA code, verify identity before granting access.

### Backend Enhancements
- [ ] Session management (store in-memory for now, not DB)
  - Session schema: `session_id`, `phone`, `verified`, `name`, `address`, `start_time`
- [ ] Identity collection flow (prompt logic to extract user details)
  - Endpoint: `POST /chat` accepts message, routes through identity-gate logic
  - If unverified: bot asks for name, address, phone (conversationally)
  - If phone collected: trigger SMS 2FA
- [ ] Twilio integration: send SMS code to phone
  - Endpoint: `POST /verify-sms` validates the code
  - On success, mark session as verified
- [ ] Guard all chat operations behind verification check
  - Unverified users see only identity-collection prompts, no shipment data
- [ ] System prompt engineering:
  - Prompt instructs Claude: "Only ask for name, address, phone until verified. Once verified, answer shipment questions. Never leak data to unverified users."

### Frontend Enhancements
- [ ] Track session state (verified/unverified)
- [ ] Hide shipment query UI until verified
- [ ] Show SMS code input when prompted
- [ ] Display appropriate messaging for verification flow

### Database Placeholder
- [ ] Schema for sessions table (not yet created, documented for Week 3)
- [ ] Note: will migrate from in-memory to PostgreSQL in Week 3

### Testing
- [ ] Manual test: unverified user can't see shipment data, only sees identity questions
- [ ] Manual test: verified user can ask about shipments

### Success Criteria
- [ ] Unverified users can't access shipment data (verified check gates all queries)
- [ ] SMS 2FA flow works end-to-end
- [ ] Session state persists across messages (in-memory is fine)

### Key Files Created
- `backend/src/secureship/identity.py` (identity verification logic)
- `backend/src/secureship/sms.py` (Twilio integration)
- `backend/src/secureship/session.py` (session management)
- `frontend/src/components/VerificationFlow.tsx` (SMS code input)
- `frontend/src/stores/sessionStore.ts` (Zustand session state)

---

## Week 3: Tool-Calling & Shipment Lookups

**Goal:** Implement tool-calling so Claude can fetch shipment data for verified users. Add database persistence.

### Database
- [ ] PostgreSQL setup (local Docker container or managed service)
- [ ] Schema:
  - `sessions` (id, phone, verified, name, address, created_at, verified_at)
  - `shipments` (id, tracking_number, customer_phone, status, created_at, delivered_at)
  - `packages` (id, shipment_id, item, weight, dimensions)
- [ ] Migrations (Alembic or SQLAlchemy)

### Backend Enhancements
- [ ] SQLAlchemy models for sessions, shipments, packages
- [ ] Migrate session storage from in-memory to PostgreSQL
- [ ] Tool definitions (JSON schemas) for Claude:
  - `get_shipment_status(tracking_number)` — fetch shipment by tracking number
  - `get_customer_shipments(phone)` — list all shipments for a customer
  - `get_shipment_details(shipment_id)` — full shipment details, packages, timeline
- [ ] Tool-calling loop in Claude integration:
  - Message → Claude → detects tool calls → execute (if user verified) → return results → continue conversation
  - Guard: tools only execute if session is verified
- [ ] API endpoints:
  - `POST /chat` (enhanced with tool-calling)
  - `GET /shipments/{tracking_number}` (API for tools to call internally)
  - `GET /customer-shipments` (requires verified session)

### Frontend Enhancements
- [ ] Once verified, show shipment query interface (optional, bot-driven is fine too)
- [ ] Display shipment details when bot provides them

### Testing
- [ ] Manual: verified user asks about a shipment, Claude fetches data via tool-calling
- [ ] Manual: unverified user asks about shipment, Claude refuses

### Success Criteria
- [ ] Claude can call tools (shipment lookups)
- [ ] Tools only execute for verified users
- [ ] Session data persists in DB
- [ ] Can query shipments by tracking number or customer phone

### Key Files Created
- `backend/src/secureship/models.py` (SQLAlchemy models)
- `backend/src/secureship/tools.py` (tool definitions and execution)
- `backend/src/secureship/database.py` (DB connection, migrations)
- Migrations folder: `backend/alembic/versions/`

---

## Week 4: Admin Panel & Package Management

**Goal:** Build admin interface for Auth0-gated user (admin) to manage shipments and packages.

### Backend Enhancements
- [ ] Auth0 integration:
  - Middleware to verify JWT tokens (only for admin endpoints)
  - Endpoint: `POST /admin/login` (redirects to Auth0)
  - Auth0 callback endpoint
- [ ] Admin API endpoints (all Auth0-protected):
  - `POST /admin/shipments` (create new shipment)
  - `PUT /admin/shipments/{id}` (update status, address, etc.)
  - `DELETE /admin/shipments/{id}` (soft delete)
  - `POST /admin/packages` (add package to shipment)
  - `GET /admin/shipments` (list all, with filters)
  - `GET /admin/dashboard` (summary stats)

### Frontend Enhancements
- [ ] New route: `/admin`
- [ ] Admin login flow (Auth0 redirect)
- [ ] Admin dashboard:
  - Shipment list view (table: tracking number, status, customer phone)
  - Create/edit shipment form
  - Add packages to shipment form
  - Bulk actions (mark delivered, etc.)
- [ ] Role-based UI (only visible if admin is authenticated)

### Testing
- [ ] Manual: admin can CRUD shipments
- [ ] Manual: new shipments immediately queryable by verified customer

### Success Criteria
- [ ] Admin interface is fully functional (CRUD shipments)
- [ ] Auth0 flow works (login, logout, token refresh)
- [ ] Customer can see newly-created shipments

### Key Files Created
- `backend/src/secureship/auth.py` (Auth0 JWT verification)
- `backend/src/secureship/admin.py` (admin endpoints)
- `frontend/src/pages/admin/index.tsx` (admin dashboard)
- `frontend/src/components/ShipmentForm.tsx`
- `frontend/src/lib/adminApi.ts`

---

## Week 5: Hardening, Docs, Final Polish

**Goal:** Security review, documentation, edge-case handling, and go-live readiness.

### Security & Hardening
- [ ] Prompt injection hardening: test Claude with adversarial inputs
  - Verify bot doesn't leak data to unverified users even with special prompts
  - Verify bot doesn't execute unauthorized tool calls
- [ ] Rate limiting: `/chat` endpoint (prevent abuse)
- [ ] Input validation: all user inputs sanitized
- [ ] HTTPS enforcement (if deployed)
- [ ] JWT token expiry / refresh handling
- [ ] Logging & monitoring (basic: structured logs, no sensitive data)
- [ ] SQL injection prevention (use parameterized queries, verify)
- [ ] CORS hardening (restrict to deployed frontend URL)

### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Architecture diagram (system diagram: frontend → backend → Claude → tools → DB)
- [ ] Deployment guide (how to run in Docker, environment setup)
- [ ] Design decisions doc (why tool-calling, why SMS 2FA, why PostgreSQL, etc.)
- [ ] Runbook: how to add a new tool, how to debug a Claude issue

### Frontend Polish
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Loading states, error handling, retry logic
- [ ] Accessibility (WCAG 2.1 AA): alt text, keyboard nav, ARIA labels
- [ ] Dark mode toggle (optional, nice-to-have)

### Backend Polish
- [ ] Error handling: graceful failures, user-facing error messages
- [ ] Retry logic for external APIs (Twilio, Claude)
- [ ] Request timeouts, circuit breakers

### DevOps
- [ ] Docker Compose: single `docker-compose.yml` to run frontend + backend + database
- [ ] CI/CD: ensure all tests pass, linters pass, before merge
- [ ] Deployment: Dockerfile, environment vars, secrets management

### Final Demos & Testing
- [ ] End-to-end test flow: new user → identity verification → shipment query → update admin → user sees update
- [ ] Stress test: multiple concurrent users
- [ ] Retro: team review of lessons learned, what went well, what could be better

### Success Criteria
- [ ] Code passes security review (no major findings)
- [ ] All endpoints documented
- [ ] Deployment-ready (can run `docker-compose up` and everything works)
- [ ] Team demo covers: identity verification, shipment lookup, admin panel, edge cases

---

## Development Workflow

### Daily Standup (Monday–Friday, ~15 min)
- What did you complete yesterday?
- What are you working on today?
- Any blockers?

### Code Review
- All code merged via pull requests (no direct pushes to `main`)
- At least one reviewer (can be teammate or mentor)
- Automated checks: linters, type checking, tests must pass

### Testing
- Unit tests for business logic (tools, identity verification, DB queries)
- Integration tests for API endpoints
- Manual testing before milestone demos

### Git Workflow
```bash
git checkout -b feature/week-1-chat-skeleton
# Work...
git add .
git commit -m "add chat skeleton"
git push origin feature/week-1-chat-skeleton
# Open PR, get review, merge
```

### Monorepo Notes
- Backend and frontend are independent; changes to one don't block the other
- Shared CI/CD: both must pass before merge
- Deployment: both are containerized, run via Docker Compose

---

## Key Dependencies & External Services

| Service | When | Who | Notes |
|---------|------|-----|-------|
| Anthropic API | Week 1 | Backend | API key provided by user (free tier OK for dev) |
| Twilio | Week 2 | Backend | SMS 2FA; free trial has limitations |
| Auth0 | Week 4 | Backend + Frontend | Free tier supports 1 application, 7k users |
| PostgreSQL | Week 3 | Backend | Local Docker container, or managed (RDS, Neon) |

---

## Milestone Reviews

Each Monday, the team presents the prior week's work. Format:

1. **Demo** (10 min): Live walkthrough of new features
2. **Code Tour** (5 min): Highlight key files, decisions
3. **Blockers & Learnings** (5 min): What went well, what's next

Mentors provide feedback, flag rework if needed, unblock if stuck.

---

## Stretch Goals (if time permits)

- [ ] WebSocket support for real-time chat (typing indicators, server-pushed updates)
- [ ] Shipment timeline visualization
- [ ] Notification system (email updates for customers)
- [ ] Multi-language support (Spanish, etc.)
- [ ] Admin analytics dashboard (shipment trends, response times)
- [ ] Voice chat interface (optional, advanced)

---

## Common Gotchas & Mitigations

| Issue | Mitigation |
|-------|-----------|
| Claude leaks data to unverified users | Prompt engineering: include explicit instruction to gate data. Test adversarially. |
| SMS codes expire too fast | Use 10-minute expiry by default; configurable. |
| Database migrations fail | Always test migrations locally before committing. Use Alembic's revision system. |
| CORS errors during development | Correctly configure `allow_origins` in FastAPI CORS middleware. |
| Frontend loses session after refresh | Use localStorage to persist session ID; validate on app load. |
| Tool-calling timeouts | Set reasonable timeouts on Claude API calls; gracefully degrade. |

---

## Resources & References

- **Anthropic API Docs:** https://docs.anthropic.com
- **FastAPI:** https://fastapi.tiangolo.com
- **Next.js:** https://nextjs.org
- **SQLAlchemy:** https://www.sqlalchemy.org
- **Auth0:** https://auth0.com/docs
- **Twilio Python SDK:** https://www.twilio.com/docs/python
- **Docker:** https://docs.docker.com

---

## Final Notes

This plan is a **living document**—adjust based on actual progress, team size, and blockers. If a week falls behind, the following week's scope can shift. The core milestones (identity verification, tool-calling, admin panel) are non-negotiable; stretch goals are flexible.

The SecureShip project is deliberately a **conversational identity-gating problem**, not a CRUD app with a chatbot. Focus on making the identity flow conversational and natural, and on ensuring Claude's tool-calling is secure and guardrailed. That's the real learning.

---

**Version:** 1.0  
**Last Updated:** 2025-07-27  
**Next Review:** Monday, Week 2
