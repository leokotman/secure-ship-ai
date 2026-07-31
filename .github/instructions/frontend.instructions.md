---
description: "Use when writing, editing, or reviewing TypeScript frontend code in frontend/src/. Covers Next.js patterns, API client usage, Zustand state, and Tailwind styling conventions."
applyTo: "frontend/**/*.{ts,tsx}"
---

# Frontend Conventions

- TypeScript strict mode is on. No `any`. Use interfaces (not `type`) for object shapes.
- Run `cd frontend && make lint` (ESLint) before committing. `make build` catches type errors.

## API Calls

All backend calls must go through `streamChat()` in `frontend/src/lib/api.ts`. Never call the backend URL directly from components—use the BFF proxy at `/api/chat` (see `pages/api/chat.ts`).

```typescript
// Correct pattern
await streamChat({ message, session_id }, (chunk) => { /* handle chunk */ });

// Wrong — do not call backend directly
await fetch('http://localhost:8000/chat', ...)
```

## Component Patterns

- Single source-of-truth for chat state lives in `ChatWindow.tsx`.
- Use Zustand stores (in `src/stores/`) for shared state; local `useState` for component-only state.
- `scrollToBottom` ref pattern is already established in `ChatWindow.tsx`—follow it for new scroll-dependent UI.

## Styling

- Tailwind CSS only. No inline styles, no CSS Modules unless Tailwind cannot achieve the effect.
- Global styles go in `src/styles/globals.css`.

## Session Persistence

- Persist `session_id` to `localStorage` so identity verification survives page refreshes.
- Key: `secureship_session_id`.
