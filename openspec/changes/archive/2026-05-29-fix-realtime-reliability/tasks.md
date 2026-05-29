# Tasks: Fix Realtime Reliability

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~315 (4 modified + 1 new file + 5 test files) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

> Code already implemented but uncommitted. Tasks focus on: test-first execution (strict TDD), new `index.dashboard.ts` file, and final verification.

## Phase 1: Auth Layer Tests (RED → GREEN)

- [x] 1.1 Write `src/app/services/auth/auth.service.test.ts`: test `initPromise` blocks `signInAnonymously()` until session resolves
- [x] 1.2 Write test: `signInAnonymously()` skips Supabase call when session already exists (guard check)
- [x] 1.3 Write test: concurrent `signInAnonymously()` calls produce single `signInAnonymously` call
- [x] 1.4 GREEN: verify existing `auth.service.ts` passes all 3 tests

## Phase 2: Game Service Tests (RED → GREEN)

- [x] 2.1 Write `src/app/services/game/game.service.test.ts`: test `subscribeToRoom()` creates both broadcast + postgres_changes channels
- [x] 2.2 Write test: broadcast v5 received → applied. Later postgres_changes v5 received → discarded (version not > current)
- [x] 2.3 Write test: postgres_changes v6 received (no broadcast) → applied (version > current)
- [x] 2.4 Write test: stale v6 discarded after v7 already applied
- [x] 2.5 Write test: `leaveGame()` unsubscribes both channels + cleanup
- [x] 2.6 GREEN: verify existing `game.service.ts` passes all 5 tests

## Phase 3: Component + Edge Function Tests (RED → GREEN)

- [x] 3.1 Write `src/app/pages/game/game.component.test.ts`: test `myColor` resolves from engine state when available
- [x] 3.2 Write test: `myColor` falls back to `currentRoom()` players when engine state is null
- [x] 3.3 Extend `supabase/functions/game/game-handler.test.ts`: test DELETE-before-COMPLETED message ordering
- [x] 3.4 GREEN: verify `game.component.ts` + `index.standalone.ts` pass all 3 tests

## Phase 4: New File + Full Verification

- [x] 4.1 Create `supabase/functions/game/index.dashboard.ts` — self-contained Edge Function with DELETE ordering ported
- [x] 4.2 Run `pnpm vitest` — all test suites green (295 total, 23 new)
- [x] 4.3 Run `ng build` — strict-mode TypeScript compiles with zero errors
- [x] 4.4 Commit all changes with conventional commit message
