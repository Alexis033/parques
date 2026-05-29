# Apply Progress: fix-ui-gameplay-bugs

## Summary

Three independent UI bug fixes implemented with TDD.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/app/components/dice/dice-utils.ts` | Created | `computeDiceValues` pure function — recovers individual dice values from server-encoded sum |
| `src/app/components/dice/dice-utils.test.ts` | Created | 7 tests for computeDiceValues covering null, doubles, single die, parques, edge cases |
| `src/app/components/dice/dice.component.ts` | Modified | Uses `computeDiceValues` for diceValues computed; sum display shows `die1` (the total) |
| `src/app/services/game/game-utils.ts` | Modified | Added `getJailedTokens` — filters tokens by color + JAIL state |
| `src/app/services/game/game-utils.test.ts` | Modified | Added 4 tests for getJailedTokens |
| `src/app/components/board/player-zone.component.ts` | Modified | Added `jailTokens` input, renders `app-token` inside zone slots |
| `src/app/components/board/board.component.ts` | Modified | Added `allTokens` input, `jailedByColor` computed, passes to PlayerZoneComponent |
| `src/app/pages/game/game.component.ts` | Modified | Added `[allTokens]` binding to board; added "Leave Game" button in sidebar |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| Fix 3 (Dice) | `dice-utils.test.ts` | Unit | ✅ 295/295 | ✅ Written first | ✅ 7/7 passed | ✅ 7 cases | ➖ None needed |
| Fix 2 (Jail tokens) | `game-utils.test.ts` | Unit | ✅ 295/295 | ✅ Written first | ✅ 4/4 passed | ✅ 4 cases | ➖ None needed |
| Fix 1 (Leave btn) | N/A (template only) | N/A | ✅ 295/295 | N/A (no logic) | N/A (template) | N/A (template) | N/A (template) |

## Test Summary

- **Total tests written**: 11 (7 dice + 4 utils)
- **Total tests passing**: 306 (295 original + 11 new)
- **Layers used**: Unit (11), Integration (0), E2E (0)
- **Approval tests**: None — no refactoring tasks
- **Current totals**: 19 test files, 306 tests

## Deviations from Design

- Fix 2 implementation passes jailed tokens through BoardComponent (adding `allTokens` input) instead of directly from game.component to player-zone. This is because the template hierarchy has BoardComponent rendering PlayerZoneComponent, not game.component. The board now receives all tokens and distributes jailed ones by color.

## Issues Found

- CSS budget warning: game.component.ts styles exceed 4 kB budget by 341 bytes due to leave button styles. Can be resolved by extracting styles to a separate CSS file or increasing budget.

## Status

3/3 tasks complete. Ready for verify phase.
