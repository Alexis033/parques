import { Component, input, output, computed, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import type { DiceRoll } from '@parchis/shared';
import type { ValidAction, ValidMoveCombined, ValidMoveSplit, ValidExitOption, ValidSoplar, ValidSkip } from '@parchis/engine';

@Component({
  selector: 'app-move-selector',
  standalone: true,
  imports: [NgFor, NgIf],
  template: `
    <div class="move-selector">
      <div class="ms-header">
        <h3>Select Move</h3>
        @if (currentRoll(); as roll) {
          <span class="dice-info">
            {{ roll.die1 }} + {{ roll.die2 }}
            @if (roll.isPair) { <span class="pair-tag">Pair</span> }
          </span>
        }
      </div>

      <div class="moves-list">
        @for (action of sortedActions(); track actionKey(action)) {
          <button
            class="move-card"
            [class.selected]="selectedAction() === action"
            [class.combined]="action.type === 'MOVE_COMBINED'"
            [class.split]="action.type === 'MOVE_SPLIT'"
            [class.exit]="action.type === 'EXIT_TOKEN'"
            [class.soplar]="action.type === 'SOPLAR'"
            [class.skip]="action.type === 'SKIP'"
            (click)="selectMove(action)"
          >
            <span class="move-type-badge">{{ typeLabel(action) }}</span>
            <span class="move-desc">{{ action.description }}</span>
            @if (action.type === 'MOVE_SPLIT') {
              <span class="split-detail">
                {{ action.squaresA }} on token A
                @if (action.squaresB) { + {{ action.squaresB }} on token B }
              </span>
            }
          </button>
        } @empty {
          <div class="no-moves">No valid moves available</div>
        }
      </div>

      @if (selectedAction()) {
        <div class="ms-actions">
          <button class="btn-confirm" (click)="confirm()">Confirm</button>
          <button class="btn-cancel" (click)="cancel()">Cancel</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .move-selector {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 12px;
      padding: 1rem;
      max-width: 360px;
    }
    .ms-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .ms-header h3 {
      margin: 0;
      font-size: 1rem;
    }
    .dice-info {
      font-size: 0.85rem;
      color: #555;
    }
    .pair-tag {
      background: #2ecc71;
      color: white;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 0.7rem;
      margin-left: 4px;
    }
    .moves-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      max-height: 280px;
      overflow-y: auto;
    }
    .move-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      transition: all 0.15s;
      text-align: left;
    }
    .move-card:hover {
      border-color: #3498db;
      background: #f0f7ff;
    }
    .move-card.selected {
      border-color: #2ecc71;
      background: #eafaf1;
    }
    .move-card.combined { border-left: 3px solid #3498db; }
    .move-card.split { border-left: 3px solid #9b59b6; }
    .move-card.exit { border-left: 3px solid #f39c12; }
    .move-card.soplar { border-left: 3px solid #e74c3c; }
    .move-card.skip { border-left: 3px solid #95a5a6; }
    .move-type-badge {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      color: #888;
    }
    .move-desc {
      font-size: 0.85rem;
      margin-top: 2px;
    }
    .split-detail {
      font-size: 0.75rem;
      color: #888;
      margin-top: 2px;
    }
    .no-moves {
      color: #999;
      font-style: italic;
      padding: 0.5rem;
      text-align: center;
    }
    .ms-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
    .btn-confirm {
      flex: 1;
      padding: 0.5rem;
      border: none;
      border-radius: 8px;
      background: #2ecc71;
      color: white;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-confirm:hover { background: #27ae60; }
    .btn-cancel {
      flex: 1;
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 8px;
      background: white;
      color: #555;
      cursor: pointer;
    }
    .btn-cancel:hover { background: #f5f5f5; }
  `],
})
export class MoveSelectorComponent {
  validActions = input<ValidAction[]>([]);
  currentRoll = input<DiceRoll | null>(null);

  selectAction = output<ValidAction>();
  cancelSelection = output<void>();

  protected selectedAction = signal<ValidAction | null>(null);

  protected sortedActions = computed(() => {
    const order: Record<string, number> = {
      EXIT_TOKEN: 1,
      MOVE_COMBINED: 2,
      MOVE_SPLIT: 3,
      SOPLAR: 4,
      SKIP: 5,
      ROLL: 6,
    };
    return [...this.validActions()].sort((a, b) => {
      return (order[a.type] ?? 99) - (order[b.type] ?? 99);
    });
  });

  protected typeLabel(action: ValidAction): string {
    switch (action.type) {
      case 'EXIT_TOKEN': return 'Exit';
      case 'MOVE_COMBINED': return 'Combined';
      case 'MOVE_SPLIT': return 'Split';
      case 'SOPLAR': return 'Soplar';
      case 'SKIP': return 'Skip';
      case 'ROLL': return 'Roll';
      default: return '';
    }
  }

  protected actionKey(action: ValidAction): string {
    return `${action.type}_${(action as ValidMoveCombined).tokenId ?? (action as ValidMoveSplit).tokenA ?? (action as ValidExitOption).tokenIndex ?? (action as ValidSoplar).targetTokenId ?? 'none'}`;
  }

  protected selectMove(action: ValidAction): void {
    if (this.selectedAction() === action) {
      this.selectedAction.set(null);
    } else {
      this.selectedAction.set(action);
    }
  }

  protected confirm(): void {
    const action = this.selectedAction();
    if (action) {
      this.selectAction.emit(action);
      this.selectedAction.set(null);
    }
  }

  protected cancel(): void {
    this.selectedAction.set(null);
    this.cancelSelection.emit();
  }
}
