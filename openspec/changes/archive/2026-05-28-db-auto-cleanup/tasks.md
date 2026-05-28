# Tasks: DB Auto-Cleanup

## Delivery Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~195 (5 + 95 + 2 + 75 + 20) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All three layers combined | Single PR | Independent layers, ~195 lines total, well under 400-line budget |

## Tasks

### T1: Message DELETE on game FINISHED (Edge Function)

**Status**: Complete
**Priority**: High
**Layer**: 1
**Files**: `supabase/functions/game/index.ts`

**Description**: In `handleGameAction`, when `newState.phase === 'FINISHED'`, add a `DELETE FROM messages WHERE room_id = game.room_id` BEFORE the room status update to COMPLETED. If DELETE fails, throw the error to prevent room update (caught by outer try/catch → 500).

**Implementation Notes**:
- Insert ~5 lines at line 178; current block is 2 lines (room update only)
- DELETE must execute BEFORE the `rooms.update()` call
- Error propagation: `if (msgErr) throw msgErr` — room stays PLAYING on failure

**Testing**:
- Mock `handleGameAction` with FINISHED transition; assert `supabase.from('messages').delete()` called before `rooms.update()`
- Verify error path: mock DELETE to fail, assert room NOT updated and 500 returned

**Dependencies**: None

---

### T2: Create migration 000005 — pg_cron + cleanup_expired_data()

**Status**: Complete
**Priority**: High
**Layer**: 2
**Files**: `supabase/migrations/000005_cleanup.sql` (new)

**Description**: Create migration with `CREATE EXTENSION IF NOT EXISTS pg_cron`, a `cleanup_expired_data()` SECURITY DEFINER function, and `cron.schedule('cleanup-db', '0 * * * *', ...)`.

**Implementation Notes**:
- Function deletes: (a) anonymous auth.users inactive >24h not in active PLAYING rooms, (b) COMPLETED/CANCELLED rooms >24h, (c) WAITING rooms >24h
- Each DELETE in its own `BEGIN ... EXCEPTION ... END` subblock so failures are isolated
- `SECURITY DEFINER SET search_path = ''` — prevents search-path injection, cross-schema access to `auth.users`
- `auth.users` accessible via SECURITY DEFINER running as superuser/owner
- `rooms.status` uses CHECK constraint: `IN ('WAITING', 'PLAYING', 'COMPLETED', 'CANCELLED')` per 000001_init.sql
- CASCADE FK: `rooms → games` (ON DELETE CASCADE), `rooms → messages` (ON DELETE CASCADE), `auth.users → profiles` (ON DELETE CASCADE)

**Testing**:
- Execute migration against test DB; verify function exists: `SELECT cleanup_expired_data()`
- Insert test records with various timestamps/statuses; run function; assert only expired records deleted
- Verify cron schedule registered: `SELECT * FROM cron.job WHERE jobname = 'cleanup-db'`
- Test isolation: mock failure in step (a), verify steps (b) and (c) still execute

**Dependencies**: None

---

### T3: Add clientId field to Player type (shared + Edge Function)

**Status**: Complete
**Priority**: Medium
**Layer**: 3
**Files**:
- `libs/shared/src/types.ts`
- `supabase/functions/game/game-handler.ts`

**Description**: Add `clientId?: string` as an optional field to the `Player` interface in both the shared library (used by Angular frontend) and the Edge Function mirror (game-handler.ts).

**Implementation Notes**:
- Simple one-line addition in each file
- Shared Player: line 88-94 in types.ts
- EDGE Player: line 26-33 in game-handler.ts

**Testing**:
- TypeScript compilation: `ng build` passes with Strict TypeScript 5.9
- No runtime changes — this is purely additive, existing code unchanged

**Dependencies**: None

---

### T4: Create join_room RPC for atomic clientId dedup

**Status**: Complete
**Priority**: Medium
**Layer**: 3
**Files**: `supabase/migrations/000006_join_room.sql` (new, or merge into 000005_cleanup.sql)

**Description**: Create `join_room(p_room_id UUID, p_client_id TEXT DEFAULT NULL)` RPC function. It locks the room row (`FOR UPDATE`), checks if clientId already exists in `players` JSONB → if so, replaces that entry (keeping color, host status); if not, appends a new player with the next available color.

**Implementation Notes**:
- Uses `auth.uid()` for authenticated user context
- `FOR UPDATE` row lock prevents race conditions on concurrent joins
- Fetch display name from `public.profiles`
- Dedup: find existing player index by `elem->>'clientId' = p_client_id`; use `jsonb_set()` to replace at that index
- Color assignment: first unused of `['RED', 'BLUE', 'GREEN', 'YELLOW']`
- Returns updated room as JSONB

**Testing**:
- Isolated SQL test: INSERT room + 2 existing players, call `join_room` with new clientId, assert player appended (3 total)
- Dedup test: INSERT room + player with `clientId = 'abc'`, call `join_room` with same clientId, assert player replaced (still 2 total)
- Color assignment: join sequentially with different clientIds, assert colors: RED, BLUE, GREEN, YELLOW

**Dependencies**: None (pure SQL, no TS type dependency)

---

### T5: Update room.service.ts with clientId generation and RPC join

**Status**: Complete
**Priority**: Medium
**Layer**: 3
**Files**: `src/app/services/room/room.service.ts`

**Description**: Add a `getClientId()` helper that reads/generates UUID v4 in localStorage under `parches_client_id`. Replace `joinRoom()`'s read-modify-write pattern with a single `supabase.rpc('join_room', ...)` call. Add `clientId` to the player data in `createRoom()`.

**Implementation Notes**:
- Helper: `function getClientId(): string { const KEY = 'parches_client_id'; let id = localStorage.getItem(KEY); if (!id) { id = crypto.randomUUID(); localStorage.setItem(KEY, id); } return id; }`
- Service field: `private clientId = getClientId();`
- `joinRoom()` replace lines 119-159 (read → check → append → update) with: `this.supabase.client.rpc('join_room', { p_room_id: roomId, p_client_id: this.clientId })`
- `createRoom()` (line 89-117): add `clientId: this.clientId` to the initial player object in the insert payload
- `rowToRoom()` unchanged — clientId is stored in JSONB `players` array automatically
- Remove the color-assignment logic from joinRoom (RPC handles it)

**Testing**:
- Vitest: mock localStorage, call joinRoom with room ID, assert `supabase.rpc` called with correct params
- Vitest: verify clientId persists across subsequent calls (returns same value)
- E2E: join room, clear session/localStorage via test helper, rejoin with fresh session — if localStorage is cleared, generates new clientId; dedup not expected since clientId is new

**Dependencies**: T3 (types), T4 (RPC must exist in DB before deploy)
