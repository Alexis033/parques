import { Component, input, output, computed } from '@angular/core';
import type { EngineToken } from '@parchis/engine';

const COLOR_MAP: Record<string, string> = {
  RED: '#E84837',
  BLUE: '#1D91FF',
  GREEN: '#22CA57',
  YELLOW: '#FBC71F',
};

@Component({
  selector: 'app-token',
  standalone: true,
  template: `
    <div
      class="token"
      [class.selected]="isSelected()"
      [class.valid-move]="isValidMove()"
      [class.in-jail]="token().state === 'JAIL'"
      [class.crowned]="token().state === 'CROWNED'"
      [class.in-sky]="token().state === 'IN_SKY'"
      (click)="onClick($event)"
    >
      <div class="piece" [style.background]="bgColor()">
        <div class="shadow" [style.background]="bgColor()"></div>
      </div>
      @if (token().state === 'JAIL') {
        <span class="label">J</span>
      }
      @if (token().state === 'CROWNED') {
        <span class="crown">&#x265b;</span>
      }
      @if (token().state === 'IN_SKY') {
        <div class="sparkle"></div>
      }
    </div>
  `,
  styles: [`
    .token {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: default;
      width: 100%;
      height: 100%;
      z-index: 10;
      pointer-events: none;
    }

    .piece {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      box-shadow: rgba(50, 50, 105, 0.15) 0px 2px 5px 0px,
                  rgba(0, 0, 0, 0.05) 0px 1px 1px 0px;
      position: relative;
      pointer-events: auto;
      transition: transform 0.2s, box-shadow 0.2s;
      z-index: 2;
    }
    .piece:hover {
      transform: scale(1.15);
    }

    .shadow {
      width: 24px;
      height: 26px;
      border-radius: 50%;
      box-shadow: rgba(50, 50, 93, 0.3) 0px 30px 60px -12px inset,
                  rgba(0, 0, 0, 0.1) 0px 18px 36px -18px inset;
      position: absolute;
      top: 3px;
      left: 0;
      z-index: -1;
    }

    /* JAIL state */
    .in-jail .piece {
      opacity: 0.5;
      transform: scale(0.85);
    }

    /* Selected */
    .selected .piece {
      box-shadow: 0 0 0 3px white, 0 0 0 5px #3498db, 0 0 12px rgba(52, 152, 219, 0.6);
      transform: scale(1.1);
    }

    /* Valid move */
    .valid-move .piece {
      box-shadow: 0 0 0 3px white, 0 0 0 5px #2ecc71, 0 0 12px rgba(46, 204, 113, 0.6);
      animation: token-pulse 1s ease-in-out infinite;
      cursor: pointer;
    }

    /* CROWNED */
    .crowned .piece {
      box-shadow: 0 0 0 2px #d4a017, 0 0 8px rgba(212, 160, 23, 0.4);
    }

    /* IN_SKY glow */
    .in-sky .piece {
      box-shadow: 0 0 0 2px gold, 0 0 10px rgba(255, 215, 0, 0.5);
    }

    .label {
      position: absolute;
      font-size: 10px;
      font-weight: bold;
      color: white;
      pointer-events: none;
      top: 50%;
      left: 52%;
      transform: translate(-50%, -50%);
      z-index: 3;
    }

    .crown {
      position: absolute;
      font-size: 16px;
      color: #d4a017;
      pointer-events: none;
      top: 2px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 3;
    }

    .sparkle {
      position: absolute;
      width: 28px;
      height: 28px;
      border: 2px dashed gold;
      border-radius: 50%;
      animation: rotate-ring 1.5s linear infinite;
      pointer-events: none;
    }

    @keyframes token-pulse {
      0%, 100% { opacity: 0.8; }
      50% { opacity: 1; }
    }
    @keyframes rotate-ring {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `],
})
export class TokenComponent {
  token = input.required<EngineToken>();
  isSelected = input(false);
  isValidMove = input(false);
  stackIndex = input(0);

  select = output<string>();

  protected bgColor = computed(() => {
    return COLOR_MAP[this.token().color] ?? '#888';
  });

  onClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isValidMove() || this.isSelected()) {
      this.select.emit(this.token().id);
    }
  }
}
