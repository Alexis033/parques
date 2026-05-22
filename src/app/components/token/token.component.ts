import { Component, input, output, computed } from '@angular/core';
import type { EngineToken } from '@parchis/engine';
import { getCoordinates } from '@parchis/engine';

const TOKEN_RADIUS = 14;
const STACK_OFFSET = 6;

const COLOR_MAP: Record<string, string> = {
  RED: '#e74c3c',
  BLUE: '#3498db',
  GREEN: '#2ecc71',
  YELLOW: '#f1c40f',
};

@Component({
  selector: 'app-token',
  standalone: true,
  template: `
    <svg
      class="token-svg"
      [attr.viewBox]="'0 0 600 600'"
      (click)="onClick()"
    >
      <circle
        [attr.cx]="cx()"
        [attr.cy]="cy()"
        [attr.r]="radius()"
        [attr.fill]="fillColor()"
        [attr.opacity]="opacity()"
        [attr.filter]="filterStyle()"
        stroke="white"
        stroke-width="2"
        [class.selected]="isSelected()"
        [class.valid-move]="isValidMove()"
      />
      @if (token().state === 'JAIL') {
        <text
          [attr.x]="cx()"
          [attr.y]="cy() + 5"
          text-anchor="middle"
          font-size="10"
          fill="white"
          font-weight="bold"
        >J</text>
      }
      @if (token().state === 'CROWNED') {
        <text
          [attr.x]="cx()"
          [attr.y]="cy() + 6"
          text-anchor="middle"
          font-size="16"
          fill="#d4a017"
        >&#x265b;</text>
      }
      @if (token().state === 'IN_SKY') {
        <circle
          [attr.cx]="cx()"
          [attr.cy]="cy()"
          [attr.r]="radius() - 2"
          fill="none"
          stroke="gold"
          stroke-width="1.5"
          stroke-dasharray="3 2"
          class="sparkle-ring"
        />
      }
    </svg>
  `,
  styles: [`
    .token-svg {
      width: 100%;
      height: auto;
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: auto;
      cursor: default;
    }
    circle {
      transition: all 0.3s ease;
    }
    circle.selected {
      stroke: #fff;
      stroke-width: 3;
      filter: drop-shadow(0 0 5px rgba(255,255,255,0.8));
    }
    circle.valid-move {
      stroke: #2ecc71;
      stroke-width: 3;
      filter: drop-shadow(0 0 6px rgba(46,204,113,0.7));
      animation: token-pulse 1s ease-in-out infinite;
    }
    .sparkle-ring {
      animation: rotate-ring 1.5s linear infinite;
      transform-origin: center;
    }
    @keyframes token-pulse {
      0%, 100% { opacity: 0.7; }
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

  protected fillColor = computed(() => {
    return COLOR_MAP[this.token().color] ?? '#888';
  });

  protected cx = computed(() => {
    return getCoordinates(this.token().position).x;
  });

  protected cy = computed(() => {
    return getCoordinates(this.token().position).y + this.stackIndex() * STACK_OFFSET;
  });

  protected radius = computed(() => {
    if (this.token().state === 'JAIL') return TOKEN_RADIUS * 0.8;
    return TOKEN_RADIUS;
  });

  protected opacity = computed(() => {
    return this.token().state === 'JAIL' ? 0.5 : 1;
  });

  protected filterStyle = computed(() => {
    const state = this.token().state;
    if (state === 'IN_SKY') return 'drop-shadow(0 0 3px gold)';
    if (state === 'CROWNED') return 'drop-shadow(0 0 4px #d4a017)';
    return 'none';
  });

  onClick(): void {
    if (this.isValidMove() || this.isSelected()) {
      this.select.emit(this.token().id);
    }
  }
}
