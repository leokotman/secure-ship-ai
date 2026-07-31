---
description: "Add a new Claude tool to SecureShip's tool-calling system. Scaffolds the tool definition, security gate, and test stubs."
argument-hint: "tool name and what it does (e.g. 'get_delivery_estimate - returns estimated delivery date for a shipment')"
agent: "agent"
---

Add a new Claude tool to `backend/src/secureship/tools.py` following SecureShip conventions.

## Tool to add

$input

## Requirements

1. **Tool definition** — Add a function with this shape:
   ```python
   def <tool_name>(<params>, session: Session) -> dict:
       if not session.verified:
           return {}  # security gate — never leak data to unverified sessions
       # ... implementation
   ```

2. **Anthropic tool schema** — Add an entry to the `TOOLS` list (or equivalent registry in `tools.py`) with `name`, `description`, and `input_schema` matching the Anthropic tool-calling format.

3. **Tool dispatcher** — Register the tool in the dispatcher/router that `chat.py` calls when Claude requests a tool execution.

4. **Tests** — Add two test cases in `backend/tests/`:
   - Unverified session → returns `{}`
   - Verified session → returns expected data (use a fixture or mock)

5. **Update system prompt** — Add a one-line description of the new tool to the `TOOLS:` section in the Claude system prompt in `chat.py`.

Follow the existing tool patterns in [tools.py](../../backend/src/secureship/tools.py) and the architecture described in [CLAUDE.md](../../CLAUDE.md#tool-calling-flow).
