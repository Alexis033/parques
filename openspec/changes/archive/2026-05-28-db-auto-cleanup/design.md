# Design: DB Auto-Cleanup

## Overview

Three independent layers: (1) immediate message DELETE in the Edge Function on game FINISHED, (2) hourly pg_cron RPC that purges expired rooms/users, (3) persistent clientId to deduplicate stale player entries on rejoin.

## Architecture Decisions

### Decision: Server-side dedup via DB RPC (not Edge Function)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| A: Client-side dedup in room.service.ts | Simple but racy — two tabs same clientId could both append | ❌ |
| B: Edge Function `join-room` handler | Centralized but adds HTTP hop to every join + new Deno deploy | ❌ |
| C: Postgres RPC `join_room()` | Atomic (row-level `FOR UPDATE`), zero infra, follows existing pattern | ✅ |

**Rationale**: RPC is server-side, atomic, and requires no new Edge Function. The `supabase.rpc('join_room', ...)` call replaces the current direct `rooms.update()` in joinRoom. Row lock prevents concurrent join races.

### Decision: Message DELETE before room COMPLETED

| Scenario | Design |
|----------|--------|
| DELETE succeeds | Room updates to COMPLETED |
| DELETE fails | Room stays PLAYING, error propagates to client (500) |

**Rationale**: Spec mandates delete-before-update atomicity. If messages can't be cleaned, the room should not show COMPLETED.

### Decision: Hourly schedule, overlaps tolerated

pg_cron guarantees at most one execution at a time — subsequent runs queue if previous is still running. Hourly is aggressive enough to keep DB lean without constant churn on a small MVP.

## Layer 1: Edge Function — Message Cleanup on Game End

**File**: `supabase/functions/game/index.ts`, lines 178-180

Replace the current FINISHED block:

```typescript
if (newState.phase === 'FINISHED' && currentState.phase !== 'FINISHED') {
  // DELETE before room update — per spec: delete MUST precede room status change
  const { error: msgErr } = await supabase
    .from('messages')
    .delete()
    .eq('room_id', game.room_id);
  if (msgErr) throw msgErr; // Room update is skipped, error surfaces as 500

  await supabase.from('rooms').update({ status: 'COMPLETED' }).eq('id', game.room_id);
}
```

Flow: messages DELETE → if error, throw (stops execution, caught by outer try/catch → 500) → room update → broadcast. The DELETE is a no-op if zero messages exist.

## Layer 2: pg_cron — Periodic Cleanup

**New file**: `supabase/migrations/000005_cleanup.sql`

```sql
-- Enable pg_cron (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Cleanup function: purges expired anonymous users, completed/cancelled/waiting rooms
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- 1. Delete anonymous users inactive >24h with no active PLAYING room
  DELETE FROM auth.users
  WHERE is_anonymous = true
    AND last_sign_in_at < now() - interval '1 day'
    AND id NOT IN (
      SELECT DISTINCT (p->>'id')::uuid
      FROM public.rooms,
      jsonb_array_elements(public.rooms.players) AS p
      WHERE public.rooms.status = 'PLAYING'
    );

  -- 2. Delete COMPLETED / CANCELLED rooms older than 24h (games + messages cascade)
  DELETE FROM public.rooms
  WHERE status IN ('COMPLETED', 'CANCELLED')
    AND updated_at < now() - interval '24 hours';

  -- 3. Delete WAITING rooms older than 24h (no games, no messages)
  DELETE FROM public.rooms
  WHERE status = 'WAITING'
    AND updated_at < now() - interval '24 hours';
END;
$$;

-- Schedule: every hour
SELECT cron.schedule('cleanup-db', '0 * * * *', 'SELECT cleanup_expired_data()');
```

**Key design points**:
- Each DELETE is independent — if step 1 fails (e.g., permission issue on auth.users), steps 2 and 3 still run. Wrap in subblocks if stricter isolation needed.
- `auth.users` cross-schema access works because SECURITY DEFINER runs as superuser/owner. `search_path = ''` prevents search-path injection.
- CASCADE FKs: `rooms` → `games` (`ON DELETE CASCADE`), `rooms` → `messages` (`ON DELETE CASCADE`), `auth.users` → `profiles` (`ON DELETE CASCADE`).
- "Active game" check: user is in a `rooms.players` array where `status = 'PLAYING'`.

**Fallback**: If pg_cron isn't available, the function exists and can be called manually via SQL editor. The Edge Function Layer 1 still deletes messages immediately; only the periodic purge is affected.

## Layer 3: Client Identity (clientId)

### Type Changes

**`libs/shared/src/types.ts`** — Player interface:
```typescript
export interface Player {
  id: string;
  color: PlayerColor;
  name: string;
  isHost: boolean;
  isConnected: boolean;
  clientId?: string;  // ADDED
}
```

**`supabase/functions/game/game-handler.ts`** — Player interface (mirror):
```typescript
export interface Player {
  // ... existing fields ...
  clientId?: string;  // ADDED
}
```

### Client-Side: room.service.ts

Add module-level helper + service field:

```typescript
function getClientId(): string {
  const KEY = 'parches_client_id';
  let id = localStorage.getItem(KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(KEY, id); }
  return id;
}
```

Service field: `private clientId = getClientId();`

In `joinRoom()`, replace the direct `rooms.update()` with:

```typescript
const { data, error } = await this.supabase.client.rpc('join_room', {
  p_room_id: roomId,
  p_client_id: this.clientId,
});
if (error) throw error;
const updated = rowToRoom(data as RoomRow);
this.currentRoomW.set(updated);
return updated;
```

Remove the old read → modify → write block (lines 123-159). The RPC handles all join logic atomically.

### Server-Side: DB RPC join_room()

**Add to `000005_cleanup.sql`** (or a separate `000006_join_room.sql`):

```sql
CREATE OR REPLACE FUNCTION join_room(
  p_room_id UUID,
  p_client_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_name TEXT;
  v_room RECORD;
  v_players JSONB;
  v_idx INT;
  v_colors TEXT[];
  v_color TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT display_name INTO v_name FROM public.profiles WHERE id = v_user_id;
  IF v_name IS NULL THEN v_name := 'Player_' || substring(v_user_id::text, 1, 6); END IF;

  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;

  v_players := v_room.players;

  -- Already in room → return as-is
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_players) AS p WHERE p->>'id' = v_user_id::text) THEN
    RETURN (SELECT row_to_json(r)::jsonb FROM public.rooms r WHERE r.id = p_room_id);
  END IF;

  IF jsonb_array_length(v_players) >= v_room.max_players THEN
    RAISE EXCEPTION 'Room is full';
  END IF;

  -- Dedup by clientId: replace entry (keep old color, host status)
  IF p_client_id IS NOT NULL AND p_client_id <> '' THEN
    SELECT (idx - 1) INTO v_idx
    FROM jsonb_array_elements(v_players) WITH ORDINALITY AS a(elem, idx)
    WHERE elem->>'clientId' = p_client_id LIMIT 1;

    IF v_idx IS NOT NULL THEN
      v_players := jsonb_set(v_players, ARRAY[v_idx::text], jsonb_build_object(
        'id', v_user_id::text,
        'color', v_players->v_idx->>'color',
        'name', v_name,
        'isHost', (v_players->v_idx->>'isHost')::boolean,
        'isConnected', true,
        'clientId', p_client_id
      ));
      UPDATE public.rooms SET players = v_players, updated_at = now() WHERE id = p_room_id;
      RETURN (SELECT row_to_json(r)::jsonb FROM public.rooms r WHERE r.id = p_room_id);
    END IF;
  END IF;

  -- New player: find first unused color
  SELECT array_agg(p->>'color') INTO v_colors FROM jsonb_array_elements(v_players) AS p;
  v_color := CASE
    WHEN NOT ('RED' = ANY(v_colors)) THEN 'RED'
    WHEN NOT ('BLUE' = ANY(v_colors)) THEN 'BLUE'
    WHEN NOT ('GREEN' = ANY(v_colors)) THEN 'GREEN'
    ELSE 'YELLOW'
  END;

  v_players := v_players || jsonb_build_object(
    'id', v_user_id::text, 'color', v_color, 'name', v_name,
    'isHost', false, 'isConnected', true, 'clientId', p_client_id
  );

  UPDATE public.rooms SET players = v_players, updated_at = now() WHERE id = p_room_id;
  RETURN (SELECT row_to_json(r)::jsonb FROM public.rooms r WHERE r.id = p_room_id);
END;
$$;
```

## Data Flow Diagrams

### Game End Cleanup
```
handleGameAction() → newState.phase === 'FINISHED'
  │
  ├── DELETE FROM messages WHERE room_id = :roomId
  │     └── Error? → throw → caught by try/catch → 500 response
  │
  └── UPDATE rooms SET status = 'COMPLETED'
        └── broadcastGameState()
```

### Periodic Cleanup (pg_cron)
```
cron: '0 * * * *' → cleanup_expired_data()
  │
  ├── DELETE auth.users WHERE is_anonymous AND stale AND not in active PLAYING room
  ├── DELETE rooms WHERE COMPLETED|CANCELLED AND updated_at < 24h
  └── DELETE rooms WHERE WAITING AND updated_at < 24h
        └── CASCADE to games and messages
```

### Join Room with clientId dedup
```
roomService.joinRoom(roomId)
  │
  ├── clientId from localStorage (generated on first load)
  │
  └── supabase.rpc('join_room', { p_room_id, p_client_id })
        │
        ├── auth.uid() → get display name from profiles
        ├── FOR UPDATE row lock on rooms
        ├── Already in room? → return as-is
        ├── clientId match? → REPLACE entry (keep color, host)
        └── No match? → APPEND new player (assign next color)
              │
              └── RETURN updated room JSON
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/game/index.ts` | Modify | Add DELETE messages before room COMPLETED update |
| `supabase/migrations/000005_cleanup.sql` | Create | pg_cron extension, cleanup RPC, schedule, join_room RPC |
| `libs/shared/src/types.ts` | Modify | Add `clientId?: string` to Player interface |
| `supabase/functions/game/game-handler.ts` | Modify | Add `clientId?: string` to Player interface |
| `src/app/services/room/room.service.ts` | Modify | Add clientId generation/persistence, switch joinRoom to RPC call |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | clientId generation + localStorage round-trip | Vitest: mock localStorage, verify UUID generation and persistence |
| Unit | join_room RPC logic | Isolated SQL test: INSERT room+players, call join_room, assert dedup behavior |
| Unit | message DELETE on FINISHED | Mock Edge Function handler, assert DELETE called before update |
| E2E | Full cleanup lifecycle | Start game, finish it, verify messages deleted, verify pg_cron job runs |
| E2E | Rejoin with same clientId | Join room, clear session, rejoin with same clientId, verify single entry |

## Rollout Plan

1. **Migration first**: Run `000005_cleanup.sql` — creates functions and schedules cron. Existing join flow unaffected.
2. **Edge Function**: Deploy updated `index.ts` — message cleanup activates immediately for new games.
3. **Client code**: Deploy updated `room.service.ts` + types — clientId generation starts; join_room RPC replaces direct update.
4. **Monitor**: After 24h verify pg_cron job ran and stale rooms were purged.

## Rollback

- **Layer 1**: Revert `index.ts` change — remove DELETE + keep only room update.
- **Layer 2**: `SELECT cron.unschedule('cleanup-db'); DROP FUNCTION cleanup_expired_data(); DROP EXTENSION IF EXISTS pg_cron;`
- **Layer 3**: Revert types and room.service.ts changes. Keep migration (join_room RPC is harmless if unused; `clientId` column in JSONB is ignored by existing code).
