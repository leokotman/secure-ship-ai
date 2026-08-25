# Diagrams — Tool ownership gate

![Tool ownership gate](tool-gate.svg)

## Rules

1. **Never** accept a client-supplied `customer_id` on tools.
2. Cross-customer tracking → `not_found` / empty (same as missing).
3. Soft-deleted shipments are invisible to customers.
4. Prompt injection strings in the user message do not bypass `execute_tool` gates.
