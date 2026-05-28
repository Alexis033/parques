# Proposal: Auto-cleanup System for Parchis Online MVP

## Intent

Three accumulation problems in the fully anonymous MVP: (1) chat messages persist after games end, (2) auth.users/profiles/rooms/games accumulate indefinitely, (3) stale player entries multiply when anonymous sessions reset (localStorage cleared).

## Scope

### In Scope
- Delete messages on game FINISHED detection in Edge Function
- pg_cron-based periodic RPC cleanup (hourly): expired rooms, games, messages, orphan users
- Persistent clientId (localStorage) to detect and replace stale player entries on rejoin

### Out of Scope
- Admin dashboard or user-facing retention controls
- Soft-delete / archival before hard delete
- Anti-abuse or rate-limiting on clientId

## Capabilities

### New Capabilities
- `data-cleanup`: automated periodic purge of expired DB records
- `client-identity`: persistent localStorage clientId for session continuity

### Modified Capabilities
- `game-engine`: game end flow now includes DELETE messages for the room
- `room-management`: player join deduplicates by clientId before inserting

## Approach

Three independent layers: (1) immediate message cleanup in Edge Function when phase transitions to FINISHED, (2) SQL migration `000005_cleanup.sql` with `cleanup_expired_data()` RPC scheduled via `pg_cron` every hour, (3) clientId generation/stored in localStorage, passed on room join for server-side dedup.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/functions/game/index.ts` | Modified | Add DELETE messages.on FINISHED + clientId dedup in join/start-game |
| `supabase/migrations/000005_cleanup.sql` | New | RPC function + pg_cron schedule |
| `src/app/services/room/room.service.ts` | Modified | Pass clientId on join payload |
| `supabase/functions/game/game-handler.ts` | Modified | Add clientId to Player type |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| pg_cron not enabled in Supabase project | Med | Enable via SQL; fallback to Edge Function timer |
| auth.users delete needs elevated perms | Med | Use service_role in pg_cron function; test staging |
| clientId dedup replaces wrong player | Low | Match on clientId + roomId; log before replace |

## Rollback Plan

- **Layer 1**: revert DELETE messages addition in game handler
- **Layer 2**: `DROP FUNCTION cleanup_expired_data(); SELECT cron.unschedule('cleanup-job'); DROP EXTENSION IF EXISTS pg_cron;`
- **Layer 3**: revert clientId additions; existing clientId columns are harmless

## Dependencies

- `pg_cron` extension enabled in Supabase project
- Elevated DB grants (service_role) for auth.users DELETE

## Success Criteria

- [ ] Messages table empties within 1 min of game FINISHED
- [ ] Rooms with COMPLETED/CANCELLED status >24h removed within 1h of schedule
- [ ] Stale player entries no longer accumulate on session loss + rejoin
- [ ] All cleanup operations respect FK cascades (no orphan rows)
- [ ] Existing game play unaffected by clientId changes
