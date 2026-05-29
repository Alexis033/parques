import { Component, input, output, computed } from '@angular/core';
import type { DiceRoll } from '@parchis/shared';
import { computeDiceValues } from './dice-utils';

const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

@Component({
  selector: 'app-dice',
  standalone: true,
  template: `
    <div class="dice-container" [class.rolling]="rolling()" [class.enabled]="enabled()">
      <div class="dice-row">
        @for (die of diceValues(); track $index) {
          <div
            class="die"
            [class.highlight]="isPair() && !isParques()"
            [class.parques]="isParques()"
            [class.rolling-die]="rolling()"
            [style.--roll-delay]="$index * 0.1 + 's'"
          >
            <svg viewBox="0 0 100 100" class="die-face">
              <rect
                width="96" height="96" x="2" y="2" rx="12"
                fill="white"
                stroke="#333"
                stroke-width="2"
              />
              @for (pos of getDots(die); track pos) {
                <circle
                  [attr.cx]="pos[0]"
                  [attr.cy]="pos[1]"
                  r="9"
                  fill="#222"
                  class="dot"
                />
              }
            </svg>
            <span class="die-value">{{ die }}</span>
          </div>
        }
        @if (diceRoll()) {
          <div class="dice-sum">
            Total: {{ diceTotal() }}
          </div>
        }
      </div>
      @if (isPair()) {
        <div class="pair-badge">{{ isParques() ? 'PARQUES!' : 'Pair!' }}</div>
        @if (isParques()) {
          <div class="parques-effect">Cada dado vale 20! (Movés 40)</div>
        }
      }
      @if (enabled() && !rolling()) {
        <button class="roll-btn" (click)="onRoll()">Roll Dice</button>
      }
    </div>
  `,
  styles: [`
    .dice-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem;
    }
    .dice-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .die {
      position: relative;
      width: 56px;
      height: 56px;
      transition: transform 0.3s ease;
    }
    .die-face {
      width: 100%;
      height: 100%;
    }
    .die-value {
      display: none;
    }
    .highlight .die-face rect {
      stroke: #2ecc71;
      stroke-width: 3;
    }
    .highlight .die-face {
      filter: drop-shadow(0 0 6px rgba(46,204,113,0.5));
    }
    .parques .die-face rect {
      fill: #ffe066;
      stroke: #d4a017;
      stroke-width: 3;
    }
    .parques .die-face {
      filter: drop-shadow(0 0 10px rgba(212,160,23,0.6));
    }
    .dice-container.rolling .die {
      animation: rollDie 0.6s ease-out;
    }
    .rolling-die {
      animation: shakeDie 0.4s ease-in-out infinite;
    }
    @keyframes rollDie {
      0% { transform: rotateX(0deg) rotateY(0deg); }
      25% { transform: rotateX(180deg) rotateY(90deg); }
      50% { transform: rotateX(360deg) rotateY(180deg); }
      75% { transform: rotateX(540deg) rotateY(270deg); }
      100% { transform: rotateX(720deg) rotateY(360deg); }
    }
    @keyframes shakeDie {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-3px) rotate(-5deg); }
      75% { transform: translateX(3px) rotate(5deg); }
    }
    .dice-sum {
      font-size: 0.9rem;
      font-weight: 500;
      color: #555;
    }
    .pair-badge {
      background: #2ecc71;
      color: white;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: bold;
    }
    .parques-effect {
      color: #d4a017;
      font-weight: bold;
      font-size: 0.9rem;
      animation: pulse-text 0.5s ease-in-out infinite alternate;
    }
    @keyframes pulse-text {
      from { transform: scale(1); }
      to { transform: scale(1.1); }
    }
    .roll-btn {
      padding: 0.5rem 1.5rem;
      font-size: 1rem;
      border: none;
      border-radius: 8px;
      background: #3498db;
      color: white;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.2s, transform 0.1s;
    }
    .roll-btn:hover { background: #2980b9; }
    .roll-btn:active { transform: scale(0.96); }
    .dice-container.enabled .die {
      cursor: pointer;
    }
  `],
})
export class DiceComponent {
  diceRoll = input<DiceRoll | null>(null);
  enabled = input(false);
  rolling = input(false);

  roll = output<void>();

  protected diceValues = computed<[number, number]>(() => {
    const roll = this.diceRoll();
    if (!roll) return [1, 1];
    if (roll.isParques) return [20, 20];
    return computeDiceValues(roll);
  });

  protected diceTotal = computed(() => {
    const roll = this.diceRoll();
    if (!roll) return 0;
    if (roll.isParques) return 40;
    return roll.die1; // die1 is combined sum (die1+die2)
  });

  protected isPair = computed(() => this.diceRoll()?.isPair ?? false);
  protected isParques = computed(() => this.diceRoll()?.isParques ?? false);

  protected getDots(value: number): [number, number][] {
    return DOT_POSITIONS[value] ?? DOT_POSITIONS[1];
  }

  onRoll(): void {
    if (this.enabled() && !this.rolling()) {
      this.roll.emit();
    }
  }
}
