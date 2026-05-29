# Proposal: Fix Realtime Reliability

## Intent

`ERR_CONNECTION_CLOSED` on Edge Function broadcast drops game state updates client-side. Adds a fallback `postgres_changes` channel, fixes auth race conditions during reconnection, and stabilizes `myColor` resolution when engine state is null.

## Scope

### In Scope
- Fallback `postgres_changes` channel on `games` table (client subscribe + version dedup)
- Auth race fix: `initPromise` in `getSession()`, skip `signInAnonymously()` if authed
- `myColor` signal fallback to `currentRoom()` players when engine state is null
- Port message DELETE-before-COMPLETED from `index.ts` to `index.standalone.ts`

### Out of Scope
- Deno integration tests for Edge Function (deferred)
- SQL integration tests for pg_cron cleanup (deferred)
- Full E2E reconnection tests (deferred)
- New features beyond reliability

## Capabilities

### New Capabilities
None — reliability fix using existing Supabase client infrastructure (`postgres_changes`).

### Modified Capabilities
- `game-engine`: Client MUST subscribe to `postgres_changes` on `games` table as fallback. On broadcast failure, game state updates reach clients via DB change events. Dedup by version — only apply if version > current.

## Approach

Three-layer defense: (T1) dual subscription — broadcast primary, `postgres_changes` fallback, version-gated dedup. (T2) auth init await — prevents racing `signInAnonymously` against session restore. (T3) resilient color resolution — fallback through room state when engine not ready. Already partially coded in uncommitted changes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/services/game/game.service.ts` | Modified | Add postgres_changes fallback |
| `src/app/services/auth/auth.service.ts` | Modified | Add initPromise, skip if authed |
| `src/app/pages/game/game.component.ts` | Modified | myColor fallback to room players |
| `supabase/functions/game/index.standalone.ts` | Modified | Port message DELETE order fix |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Double state updates (broadcast + fallback) | Low | Version-gated dedup — only apply newer |
| postgres_changes adds RLS cost | Low | Already authed — RLS passthrough |
| Auth initPromise breaks existing flows | Low | Only adds await, no logic change |

## Rollback Plan

Revert the 4 modified files to HEAD. The fallback channel is additive — removing it returns to single-channel behavior.

## Dependencies

- Supabase Realtime client (already in project)
- `postgres_changes` enabled on `games` table (Supabase project config)

## Success Criteria

- [ ] Game state updates reach clients even when broadcast fails
- [ ] Reconnection works without auth race conditions
- [ ] `myColor` always resolves regardless of engine state timing
- [ ] All 267+ existing tests pass
- [ ] `ng build` compiles in strict mode
