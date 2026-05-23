import { Component, input, computed } from '@angular/core';
import type { EngineState } from '@parchis/engine';
import { isGameOver, getCurrentPlayerColor } from '@parchis/engine';
import type { PlayerColor } from '@parchis/shared';

const COLOR_NAMES: Record<PlayerColor, string> = {
  RED: 'Red',
  BLUE: 'Blue',
  GREEN: 'Green',
  YELLOW: 'Yellow',
};

@Component({
    selector: 'app-game-info',
    imports: [],
    template: `
    <div class="game-info" [class.game-over]="isOver()">
      <div class="gi-round">Round {{ state().round }}</div>

      <div class="gi-turn">
        @if (isOver()) {
          <div class="gi-winner">
            Winner: {{ currentColorLabel() }}!
          </div>
        } @else {
          <div class="gi-current">
            Current Turn: {{ currentColorLabel() }}
          </div>
          <div class="gi-phase">Phase: {{ state().turnPhase }}</div>
        }
      </div>

      @if (state().consecutivePairs > 0) {
        <div class="gi-pairs">
          Consecutive Pairs: {{ state().consecutivePairs }}
        </div>
      }
      @if (state().extraTurnsRemaining > 0) {
        <div class="gi-extra">
          Extra Turns: {{ state().extraTurnsRemaining }}
        </div>
      }
      @if (state().isLastTokenMode) {
        <div class="gi-last-token">Last Token Mode!</div>
      }
    </div>
  `,
    styles: [`
    .game-info {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.5rem;
      font-size: 0.85rem;
    }
    .game-info.game-over {
      border-color: #d4a017;
      background: #fef9e7;
    }
    .gi-round { font-weight: 600; color: #555; }
    .gi-turn { margin: 0.25rem 0; }
    .gi-winner { color: #d4a017; font-weight: 700; font-size: 1rem; }
    .gi-current { font-weight: 500; }
    .gi-phase { font-size: 0.75rem; color: #888; }
    .gi-pairs { color: #e67e22; font-size: 0.8rem; }
    .gi-extra { color: #3498db; font-size: 0.8rem; }
    .gi-last-token {
      background: #e74c3c;
      color: white;
      padding: 1px 8px;
      border-radius: 8px;
      font-size: 0.7rem;
      font-weight: 700;
      display: inline-block;
    }
  `]
})
export class GameInfoComponent {
  state = input.required<EngineState>();

  protected isOver = computed(() => isGameOver(this.state()));
  protected currentColorLabel = computed(() => {
    try {
      return COLOR_NAMES[getCurrentPlayerColor(this.state())] ?? 'Unknown';
    } catch {
      return 'Unknown';
    }
  });
}
