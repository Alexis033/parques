# Design: Fix Realtime Reliability

## Technical Approach

Three-layer defense using existing Supabase infrastructure — no new dependencies. The broadcast channel (primary) is supplemented by a `postgres_changes` subscription on `games` (fallback), version-gated to prevent duplicates. Auth initialization is serialized via `initPromise` to eliminate sign-in races. `myColor` resolution falls back through room state when engine state hasn't arrived yet.

All changes are already implemented in uncommitted code (except `index.dashboard.ts` which is a new file) — this design validates the approach and defines the testing strategy.

## Architecture Decisions

### Decision: postgres_changes as fallback (not polling, not heartbeat)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Polling GET /games | Always-on HTTP cost, 1s latency, more 429 errors | ❌ |
| Heartbeat-ping fallback | Requires server-side ack, adds complexity | ❌ |
| **postgres_changes (chosen)** | Already bundled in Supabase client, zero new infra, DB-generated events | ✅ |

**Rationale**: postgres_changes uses the existing Supabase Realtime WebSocket connection. When the broadcast channel drops (ERR_CONNECTION_CLOSED), the same underlying WS transport typically still receives DB change events because they use a different channel subscription. Zero additional infrastructure, zero config.

### Decision: Version-gated dedup

**Choice**: Strict-greater (`>`), not `>=`. Both broadcast and postgres_changes handlers check `version > currentVersion` before applying.

**Alternatives considered**: Event timestamps (clock skew risk), content hash diff (expensive for large state), UUID ordering (not comparable).

**Rationale**: `version` is a monotonically increasing integer maintained by the Edge Function with optimistic concurrency (version check on DB update). Strict `>` naturally handles all cases: stale replay, dual delivery, reconnection.

### Decision: Auth initPromise design

**Choice**: Constructor-initialized `Promise<void>` from `getSession()`, awaited in `signInAnonymously()` before any sign-in attempt.

**Alternatives considered**: `async` constructor via init() method (race window), flag-based guard with setTimeout (brittle), deferred init in root component (component coupling).

**Rationale**: The constructor runs before any Angular lifecycle hook, so `initPromise` is guaranteed to exist before any component calls `signInAnonymously()`. The promise resolves when `getSession()` completes, then `signInAnonymously()` checks `sessionW()` — if session exists from localStorage, skip entirely.

### Decision: myColor fallback resolution order

**Choice**: Engine state → currentRoom() players → null.

**Alternatives considered**: Single source (fails if engine state delayed), always-room (wrong during gameplay if player disconnects/reconnects).

**Rationale**: During gameplay, engine state is authoritative. During waiting/loading/reconnection, the room's player list has the assigned color. This matches the two states the component manages (`loading → waiting → playing`).

## Data Flow

```
  Edge Function                          Client
  ─────────────                   ──────────────
  Game action → DB update ──────→ postgres_changes (fallback)
       │                                 │
       └──→ broadcast ──────────────→ broadcast (primary)
                                           │
                                    Version > current?
                                      ├── Yes → apply
                                      └── No → discard
```

**Broadcast OK flow**: Edge Function calls `broadcastGameState()` → client receives `broadcast/state_update` → checks version → updates `gameW()` signal → UI reactively updates.

**Broadcast FAILED flow**: Broadcast connection drops → Edge Function still writes to DB → Supabase Realtime delivers `postgres_changes` with same payload → client checks `version > current` → applies state if newer → UI updates. No duplicate because version is identical.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/services/game/game.service.ts` | Already Modified | Added `gameDbChannel` postgres_changes subscription (L252-267), version dedup in both channels |
| `src/app/services/auth/auth.service.ts` | Already Modified | Added `initPromise` (L21), await in `signInAnonymously` (L60), skip-if-authed check (L63) |
| `src/app/pages/game/game.component.ts` | Already Modified | `myColor` computed signal falls back to `currentRoom()` players when engine state null (L471-490) |
| `supabase/functions/game/index.standalone.ts` | Already Modified | Ported DELETE-before-COMPLETED order (L602-610) matching `index.ts` |
| `supabase/functions/game/index.dashboard.ts` | Create | Self-contained Edge Function using raw fetch REST (no npm deps). Dashboard-pasteable copy with DELETE ordering ported (L671-675) |

## Interfaces / Contracts

No new interfaces. Existing contracts unchanged — both subscription handlers receive the same `{ state, version }` shape broadcast emits.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Version dedup logic | Mock both channels, assert version-gated apply/discard |
| Integration | Dual subscription lifecycle | `subscribeToRoom()` creates both channels, `leaveGame()` unsubscribes both |
| E2E | Reconnection resilience | Kill broadcast, verify state arrives via DB fallback |
| Manual | Auth race on refresh | Rapid page reload, verify no duplicate anonymous sign-in |

### Specific test cases (STRICT TDD — write tests first)
- **Dedup**: Fire broadcast v5, then postgres_changes v5 → state unchanged (version not >)
- **Fallback**: Fire postgres_changes v6 (no broadcast) → state applied
- **Stale discard**: Apply v7, receive late v6 → discarded
- **Auth race**: Call `signInAnonymously()` twice concurrently → only one session
- **myColor fallback**: Engine state null → color resolves from `currentRoom()` players
- **initPromise guard**: `signInAnonymously()` never calls Supabase if session already exists

## Migration / Rollout

No migration required. All changes are additive:
- postgres_changes subscription runs alongside existing broadcast
- `initPromise` only adds a wait — no behavior change for healthy flows
- myColor fallback only triggers when engine state is null (same as before)
- DELETE order is a server-side fix with no data migration

Existing tests must pass (267+ unit tests). Feature-gated: the postgres_changes fallback activates on next `subscribeToRoom()` call — existing game sessions pick it up on reconnect.

## Open Questions

- [ ] Verify `postgres_changes` is enabled on the `games` table in the Supabase project dashboard (Replication → postgres_changes)
