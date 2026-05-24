# Tasks: PR5 — Final Integration

## PR5.1 — Broadcast Fix + Reconnection (T30)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Fix Broadcast Channel (`subscribeToGame` → `subscribeToRoom`) | ✅ Done | Renamed method, changed channel to `game:${roomId}` |
| 2 | Automatic Retry on 409 Conflict | ✅ Done | Added `withRetry` to `callFunction` with exponential backoff |
| 3 | Heartbeat Mechanism | ✅ Done | Client sends heartbeat every 30s; Edge Function processes and checks timeout |
| 4 | Disconnect Detection + Visual | ✅ Done | 60s timeout in Edge Function; grey-out visual on player panel |
| 5 | Reconnection Flow | ✅ Done | `initializeRoom` re-establishes subscription and restarts heartbeat |
| 6 | Rematch Action (Edge Function only) | ✅ Done | `handleRematch` creates new game state in same room |

## PR5.2 — Game Results + Rematch UI (T29)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7 | Results Modal with rankings | 🔲 Pending | PR5.2 |
| 8 | Rematch Button UI | 🔲 Pending | PR5.2 |
| 9 | Back to Lobby navigation | 🔲 Pending | PR5.2 |

## PR5.3 — Chat (T31)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10 | Messages table + schema | 🔲 Pending | PR5.3 |
| 11 | Chat component | 🔲 Pending | PR5.3 |
| 12 | System messages | 🔲 Pending | PR5.3 |
