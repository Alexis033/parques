# Verification Report: fix-ui-gameplay-bugs

## Change

**Name**: fix-ui-gameplay-bugs  
**Mode**: hybrid  
**Date**: 2026-05-29T18:47Z  
**Verification tool**: sdd-verify sub-agent

---

## Completeness Table

| Task | Status | Evidence |
|------|--------|----------|
| Fix 1: Leave button during gameplay | ✅ Complete | Template button at `game.component.ts:118-122`, wired to `onBackToLobby()` at `game.component.ts:772-784` |
| Fix 2: Jail tokens visible in player zones | ✅ Complete | `player-zone.component.ts:82-88` (jailTokens input + slotTokens computed), `board.component.ts:78,89-96` (allTokens + jailedByColor), `game-utils.ts:114-116` (getJailedTokens), 4 tests passing |
| Fix 3: Dice values display | ✅ Complete | `dice-utils.ts:14-20` (computeDiceValues), `dice.component.ts:50,172` (uses computeDiceValues, sum shows die1), 7 tests passing |

**3/3 tasks complete** — all core tasks.

---

## Build Evidence

| Command | Result | Details |
|---------|--------|---------|
| `pnpm ng build` | ✅ PASS | Application bundle generation complete (8.4s). Strict mode compiles. |

**Warnings**: 1 CSS budget warning — `game.component.ts` styles exceed 4.00 kB budget by 341 bytes (total 4.34 kB). Pre-declared in apply-progress.

---

## Test Evidence

| Command | Result | Detail |
|---------|--------|--------|
| `npx vitest run` | ✅ PASS | 19 test files, 306 tests passed (0 failed) |

### New Tests

| Test File | Tests | Layer | All Passing |
|-----------|-------|-------|-------------|
| `dice-utils.test.ts` | 7 | Unit | ✅ |
| `game-utils.test.ts` (getJailedTokens) | 4 | Unit | ✅ |
| **Total new** | **11** | **Unit** | ✅ |

All new tests pass. Existing tests unbroken (295 original + 11 new = 306).

---

## Spec Compliance Matrix

Based on the proposal's success criteria:

| Success Criterion | Status | Evidence |
|-------------------|--------|----------|
| Leave button appears during PLAYING phase and navigates to lobby on click | ✅ PASS | `<button class="leave-btn" (click)="onBackToLobby()">` in `game.component.ts:118-122` inside `@if (view() === 'playing')` block. `onBackToLobby()` calls `sendDisconnect` + `leaveGame` + `leaveRoom` + `navigate`. |
| Player zone renders colored tokens for jailed tokens, empty circles for free slots | ✅ PASS | `player-zone.component.ts:85-88` maps 4 slots to jailed token array (null = empty slot). `app-token` component renders when token present. |
| Dice component shows two values 1-6 that sum to the displayed total | ✅ PASS | `computeDiceValues()` recovers `[die1-die2, die2]`. Sum display uses `die1` (combined total). Both values rendered as SVG dice. |

**Compliance**: 3/3 PASS — fully spec-compliant.

---

## Correctness Table

| File | Change | Correctness Assessment |
|------|--------|-----------------------|
| `dice-utils.ts` | Created `computeDiceValues()` | ✅ Correct — pure function, guards null/die2=0, recovers both dice values from server encoding |
| `dice-utils.test.ts` | Created 7 tests | ✅ Correct — covers null, doubles, single die, parques, min values, edge case (1,1) |
| `dice.component.ts` | Modified diceValues computed | ✅ Correct — imports `computeDiceValues`, sum display shows `die1` (raw total) |
| `game-utils.ts` | Added `getJailedTokens()` | ✅ Correct — filters by color + JAIL state |
| `game-utils.test.ts` | Added 4 jail token tests | ✅ Correct — empty, filter by color, multiple colors |
| `player-zone.component.ts` | Added `jailTokens` input, slot tokens | ✅ Correct — input defaults to `[]`, computed maps 4 slots with null for empty |
| `board.component.ts` | Added `allTokens` + `jailedByColor` | ✅ Correct — groups tokens by color, passes to each PlayerZoneComponent |
| `game.component.ts` | Added `[allTokens]` binding + Leave button | ✅ Correct — binding uses existing `allEngineTokens()` computed |

---

## Design Coherence Table

| Proposal Design | Implementation | Status |
|-----------------|---------------|--------|
| Leave button in sidebar, `onBackToLobby()` | Yes — template button in `.sidebar-actions` div | ✅ Match |
| `@Input() jailedTokens: TokenState[]` in PlayerZoneComponent | Yes — `input<EngineToken[]>([])` | ✅ Match |
| Pipe jailed tokens from parent game state in `game.component.ts` | No — routed through `BoardComponent` instead (due to template hierarchy: Board renders PlayerZone, not game) | ⚠️ Deviation (documented in apply-progress) |
| `diceValues` computed: `firstDie = die1 - die2`, `secondDie = die2`, `sum = die1` | Yes — `computeDiceValues()` returns `[die1-die2, die2]`, sum uses `die1` | ✅ Match |
| Guard: only apply fix when `die2 > 0`, fallback to raw values | Yes — `if (roll.die2 > 0)` guard | ✅ Match |

**Design coherence**: 4/5 match. 1 documented deviation (routing via BoardComponent) — non-breaking, functionally equivalent, and necessary for the template hierarchy.

---

## Issues

### CRITICAL

None.

### WARNING

1. **CSS budget exceeded** — `game.component.ts` inline styles are 4.34 kB, exceeding the 4.00 kB budget by 341 bytes. Pre-declared in apply-progress. Low impact — app still builds and runs.

### SUGGESTION

1. **Extract game.component styles** — Move inline styles to a separate CSS file and increase the component's `styleUrl` reference resolution to resolve the CSS budget warning cleanly.

---

## Final Verdict

**PASS WITH WARNINGS**

- ✅ All 3 fixes implemented and tested
- ✅ 306/306 tests passing (19 files)
- ✅ `ng build` succeeds (strict mode)
- ✅ All spec success criteria met
- ⚠️ 1 pre-declared CSS budget warning (non-blocking)
- ✅ 3/3 core tasks complete
