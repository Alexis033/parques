# Proposal: Fix UI/Gameplay Bugs

## Intent

Three bugs block playability: (1) no way to leave a game mid-play, (2) jailed tokens invisible on the board, (3) dice display shows wrong values. All are client-side-only fixes with zero server or engine changes.

## Scope

### In Scope
- Leave button in game sidebar during PLAYING view, wired to existing `onBackToLobby()`
- PlayerZoneComponent accepts jailed tokens as input, renders actual token components in zone slots
- DiceComponent recovers individual values: `firstDie = die1 - die2`, `secondDie = die2`, `sum = die1`
- Test updates for changed components

### Out of Scope
- Engine logic changes (dice encoding on server is intentional)
- Any server/Edge Function changes
- New features beyond these 3 fixes

## Capabilities

### New Capabilities
None — no new spec-level capabilities introduced.

### Modified Capabilities
None — all fixes are client-side rendering/UI wiring. No behavior changes at the spec/contract level.

## Approach

Three independent, parallel-safe fixes:

1. **Leave button**: Add `<button>` in the sidebar template alongside existing player info, bound to `onBackToLobby()`. Conditionally shown only when `gamePhase === 'PLAYING'`.
2. **Jail tokens**: Add `@Input() jailedTokens: TokenState[]` to PlayerZoneComponent. Iterate over zone slots and render token components where a jailed token matches the slot index. Pipe jailed tokens from parent game state in `game.component.ts`.
3. **Dice display**: Fix `diceValues` computed property — recover individual values using `die1 - die2` for the first die. Update the sum display to use `die1` directly.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/pages/game/game.component.ts` | Modified | Add leave button, pass jailed tokens to zones |
| `src/app/components/board/player-zone.component.ts` | Modified | Add jailedTokens input, render in slots |
| `src/app/components/dice/dice.component.ts` | Modified | Fix diceValues computed + sum display |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `die1 - die2` could be negative on bad data | Low | Guard: only apply fix when `die2 > 0`; fallback to raw values |
| Leave button visible during critical moments (rolling dice) | Low | Position consistently in sidebar, no overlap with action area |

## Rollback Plan

Revert the 3 files to HEAD. Each fix is fully scoped to its file — no cross-cutting state changes.

## Dependencies

- None

## Success Criteria

- [ ] Leave button appears during PLAYING phase and navigates to lobby on click
- [ ] Player zone renders colored tokens for jailed tokens, empty circles for free slots
- [ ] Dice component shows two values 1-6 that sum to the displayed total
