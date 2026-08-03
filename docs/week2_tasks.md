# Week 2 Tasks

## Status: In Progress

Week 2 implements the identity-gating state machine from DEV_PLAN Section 6.2: conversational identity collection, SMS 2FA, and session state that gates all subsequent tool calls. No shipment data is accessible this week — that's Week 3.

---

## What Is Being Built

### Backend (Python/FastAPI)
- ✓ In-memory session state machine (`session.py`) — `anonymous → collecting_identity → code_sent → awaiting_code → verified | escalated_to_human`
- ✓ Identity verification tool (`identity.py`) — ORM/parameterized lookup against `customers` table; neutral failure (no "customer not found" wording)
- ✓ SMS 2FA (`sms.py`) — mock to console by default; Twilio if `TWILIO_ACCOUNT_SID` is set; `secrets` module for code generation
- ✓ Tool definitions + dispatcher (`tools.py`) — single `execute_tool()` enforcement point; all tools operate on server-side session only
- ✓ System prompt rewritten with full SECURITY RULES block (`chat.py`)
- ✓ Ollama tool-calling loop (`chat.py`) — non-streaming first call (tool detection), streaming follow-up (final response)
- ✓ Full conversation history loaded from DB on each request (FC #2 — retrofitting prevented)
- ✓ `POST /verify-sms` endpoint — explicit modal verification path
- ✓ Session state synced to `ChatSession` in Postgres after each request

### Frontend (Next.js/TypeScript)
- ✓ Zustand `sessionStore` — shared `sessionId`, `chatState`, `firstName`
- ✓ `VerificationFlow` component — on-demand 6-digit code modal (not pre-rendered on load)
- ✓ BFF proxy `/api/verify-sms` — keeps backend URL server-side
- ✓ `streamChat()` updated — parses inline state event from stream (`\x00` delimiter), returns `{ sessionId, sessionState }`
- ✓ `ChatWindow.tsx` — renders `<VerificationFlow>` when state reaches `code_sent`; color shift on `escalated_to_human`

### Extra (above DEV_PLAN)
- ✓ **Persistent case facts block** — transactional facts (tracking numbers, order IDs, issue type, claimed amounts, expected delivery dates) extracted by the model via `update_case_facts` tool, stored in `chat_sessions.case_facts` (JSONB), and re-injected into every system prompt outside the conversation transcript — survives context summarisation and server restarts

### Infrastructure
- ✓ Backend tests for tool security gate (`backend/tests/test_tools.py`)
- ✓ `ChatSession` model extended: `state` (String) + `customer_id` (UUID) + `case_facts` (JSONB)

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| In-memory session store this week | Migrates to PostgreSQL in Week 3 per DEV_PLAN |
| Non-streaming first call for tool detection | Ollama streams tool_calls only in final chunk; non-streaming call + streaming follow-up is cleaner |
| `\x00` delimiter for state propagation | SSE format change not needed; null byte doesn't appear in normal UTF-8 text; BFF forwards raw bytes |
| `text()` with bound params for Customer lookup | Customer ORM model lands in Week 3; parameterized queries satisfy security constraint |
| `secrets.choice()` for code generation | `random` is not cryptographically secure |
| `execute_tool()` ignores caller-supplied IDs | Tools always operate on `session_manager.get(session_id)` — never on model- or user-supplied IDs (Epic F3) |
| Case facts block outside transcript | Injected as `## CASE FACTS` in system prompt on every call — the LLM sees it even if earlier turns are summarized; persisted to Postgres so it survives server restarts |

---

## Gaps vs. DEV_PLAN

All Phase 2 items are implemented. Nothing deferred.

| Item | Status |
|---|---|
| Conversational identity collection (name, address, phone) | ✅ via `verify_identity` tool |
| Identity matching against Customer table — neutral failure | ✅ `identity.py` |
| Mock 6-digit code generation, expiry (10 min), attempt limit (3) | ✅ `sms.py` + `tools.py` |
| On-demand modal triggers when conversation reaches `code_sent` | ✅ `VerificationFlow.tsx` |
| Code verification endpoint — session transitions to `verified` | ✅ `/verify-sms` + `check_verification_code` tool |
| Human escalation theater (Epic G) — both Anonymous and Verified | ✅ `escalate_to_human` tool + frontend color shift + scripted message |
| Full conversation history on each request (FC #2) | ✅ `get_transcript()` loaded in `/chat` handler |
| `ChatSession.state` updated on every state transition | ✅ synced after each request |
| **Persistent case facts block** (above DEV_PLAN) | ✅ `update_case_facts` tool + `case_facts` JSONB column + prompt injection |

---

## Running (Week 2)

```bash
# First run / fresh start
make start   # starts Ollama + Docker Compose (frontend :3000, backend :8000, Postgres)
make seed    # seed sample customers + shipments (run once while stack is up)

# Wipe DB and start fresh (e.g. upgrading from a Week 1 database)
make nuke    # stops stack + removes DB volume
make start
make seed

# Stop everything
make stop
```

> **`make start` is the single command for the whole stack.** `make dev` (two-terminal manual mode) is only needed when hot-reloading outside Docker. `make nuke` is required when upgrading from a Week 1 DB — `chat_sessions` gained `state`, `customer_id`, and `case_facts` columns; `create_tables()` does not ALTER existing tables (Alembic migrations land in Week 3).

Open http://localhost:3000.

---

## Validation Checklist

- [ ] Anonymous user asks about a shipment → bot asks for identity details, returns **no** shipment data
- [ ] Provide name/address/phone → mock SMS code logged to backend console, state = `code_sent`
- [ ] Enter wrong code × 3 → all rejected; state stays `awaiting_code`
- [ ] Enter correct code via modal → `{verified: true}`, modal closes, chat continues
- [ ] Ask about shipments as verified → bot acknowledges verification (data lookup deferred to Week 3)
- [ ] "I want to talk to a human" (from Anonymous state) → escalation sequence, **no** shipment data leaked
- [ ] "I want to talk to a human" (from Verified state) → escalation sequence, gating rules still apply
- [ ] Mention a tracking number mid-conversation → appears in `case_facts` column in DB after the turn
- [ ] Restart backend mid-session → facts still present in next reply's system prompt
- [ ] `cd backend && make lint` passes
- [ ] `cd backend && make test` passes (tool security gate tests)
- [ ] `cd frontend && make lint` passes

---

## Manual Testing Guide (Demo Script)

### Prerequisites

```bash
make nuke && make start   # fresh DB
make seed                 # seed customers
```

Get a real customer to use:
```bash
docker exec -it secureship-db-1 psql -U postgres secureship \
  -c "SELECT first_name, last_name, phone_number, address FROM customers LIMIT 3;"
```
Copy one row — you'll use it in the chat.

---

### Scenario 1 — Identity gate blocks unverified user

1. Open http://localhost:3000
2. Type: `"What's the status of my delivery?"`
3. **Expected:** bot asks for name, address, phone — returns no shipment data

### Scenario 2 — Full identity verification flow

4. Reply with your seeded customer's details (can be one message or split across turns):
   `"My name is Liam Smith, I live at 123 Main St Austin TX, phone +15551234567"`
5. **Expected:** bot calls `verify_identity`, gets `ready_for_code`, immediately calls `send_verification_code`
6. **Find the code:** in the backend logs (`docker logs secureship-backend-1 --tail 20`) look for:
   `[MOCK SMS] To +15551234567: Your SecureShip code is 482917`
7. A 6-digit modal appears in the UI — enter the code
8. **Expected:** modal closes, chat state turns `verified`, bot greets by first name

### Scenario 3 — Wrong code + attempt limit

9. Start a fresh session (reload the page)
10. Repeat steps 4–6 to get a code
11. Enter `000000` three times
12. **Expected:** each rejected with remaining-attempts count; after 3rd the session stays locked

### Scenario 4 — Case facts persistence ⭐ (demo highlight)

13. After verifying (Scenario 2), say:
    `"I'm worried about tracking number 1Z999AA10123456784 — it was supposed to arrive March 3rd and I paid $247.83"`
14. **Expected:** bot acknowledges and calls `update_case_facts` in the background
15. Confirm in the DB:
    ```bash
    docker exec -it secureship-db-1 psql -U postgres secureship \
      -c "SELECT session_id, case_facts FROM chat_sessions ORDER BY updated_at DESC LIMIT 1;"
    ```
    You should see `{"tracking_numbers": ["1Z999AA10123456784"], "claimed_amount": "$247.83", ...}`
16. **Restart the backend:** `docker restart secureship-backend-1`
17. Send any new message in the same browser session
18. **Expected:** bot still knows the tracking number — it was reloaded from DB into the system prompt

### Scenario 5 — Human escalation

19. Start a new session (don't verify)
20. Type: `"I just want to talk to a real person"`
21. **Expected:** chat header turns green, bot plays the escalation script, no shipment data is shared
22. Repeat from a **verified** session — same escalation should fire, gating rules still apply

---

## Key Files

| File | Role |
|---|---|
| `backend/src/secureship/session.py` | `SessionState` dataclass + `SessionManager` singleton |
| `backend/src/secureship/identity.py` | `verify_identity_db()` — parameterized Customer lookup |
| `backend/src/secureship/sms.py` | Code generation (`secrets`), mock + Twilio dispatch |
| `backend/src/secureship/tools.py` | Tool schemas + `execute_tool()` — **single enforcement point** |
| `backend/src/secureship/chat.py` | SECURITY RULES system prompt + async tool-calling loop |
| `backend/src/secureship/main.py` | `/verify-sms` endpoint; session wiring; state event in stream |
| `backend/src/secureship/database.py` | Extended `ChatSession`; `get_transcript()`; `update_session_state()` |
| `backend/tests/test_tools.py` | Tool gate: unverified → empty result; verified → real data |
| `frontend/src/stores/sessionStore.ts` | Zustand: `sessionId`, `chatState`, `firstName` |
| `frontend/src/components/VerificationFlow.tsx` | On-demand 6-digit code modal |
| `frontend/src/pages/api/verify-sms.ts` | BFF proxy for `/verify-sms` |
| `frontend/src/lib/api.ts` | `streamChat()` with state-event parsing |
| `frontend/src/components/ChatWindow.tsx` | Modal integration + escalation color shift |
| `backend/src/secureship/session.py` | `case_facts: dict` field on `Session` |
| `backend/src/secureship/tools.py` | `update_case_facts` tool + `_update_case_facts()` impl |
| `backend/src/secureship/chat.py` | `## CASE FACTS` block injected into every system prompt |
| `backend/src/secureship/database.py` | `case_facts` JSONB column; `load_session_data()`; updated `update_session_state()` |
| `backend/src/secureship/main.py` | Hydrates `session.case_facts` from DB on every request |

---

**Last Updated:** 2026-08-03
**Branch:** `feat/week2`
