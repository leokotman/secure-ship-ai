# Week 4 Known Issues

Issues found during Week 4 testing that Week 5 closes.

---

## Issue #1 — Specific shipment query dumps all cards

**Status:** Resolving in Week 5 (two-tool + UI filter)

**Symptom:** When a verified customer asks about one tracking number (e.g. “Tell me about ADMIN-TEST-002”), the UI often shows **every** shipment as cards.

**Root cause (historical doc drift):** Early Week 5 drafts assumed `lookup_shipments(tracking_number=...)` would filter. In code, the design evolved to a **two-tool** split:

| Tool | When | Result |
|------|------|--------|
| `lookup_shipments()` | “all my shipments / my orders” | All shipments for `session.customer_id` |
| `get_shipment_status(tracking_number)` | Specific tracking mentioned | One ownership-scoped shipment (or empty) |

Forced tool-calling in `chat.py` already routes by tracking extraction. Remaining gaps:

1. Prompt examples / tests must match the two-tool path (not a fictional `tracking_number` arg on `lookup_shipments`).
2. Frontend may still render the full shipment list from stream metadata when the LLM focuses on one tracking — needs card filtering + “Show all”.

**Week 5 fix:**

- Backend: keep two-tool design; strengthen tests and prompt “all vs specific” wording.
- Frontend: if metadata/response mentions exactly one tracking among many, show that card only + “Showing 1 of N” + “Show all”.

**Not doing:** Adding `tracking_number` to `lookup_shipments`.

---

**Last Updated:** 2026-08-25
