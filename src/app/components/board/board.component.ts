import { Component, input, output } from '@angular/core';
import type { SquareInfo, BoardPosition, PlayerColor } from '@parchis/shared';
import { BOARD_LAYOUT, CIELO_END, getCoordinates, VIEWBOX_SIZE } from '@parchis/engine';

const PLAYER_COLORS: Record<PlayerColor, string> = {
  RED: '#e74c3c',
  BLUE: '#3498db',
  GREEN: '#2ecc71',
  YELLOW: '#f1c40f',
};

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [],
  template: `
    <svg
      class="board-svg"
      [attr.viewBox]="'0 0 ' + VIEWBOX_SIZE + ' ' + VIEWBOX_SIZE"
    >
      <!-- SVG original del tablero como fondo -->
      <image
        href="tablero.svg"
        x="0" y="0"
        [attr.width]="VIEWBOX_SIZE"
        [attr.height]="VIEWBOX_SIZE"
        preserveAspectRatio="xMidYMid meet"
      />

      <!-- Capa interactiva: detección de clicks y estado del juego -->
      @for (sq of layout(); track sq.id) {
        <g
          class="board-square"
          [class.valid]="isValid(sq.id)"
          (click)="onSquareClick(sq.id)"
        >
          <!-- Hit area transparente -->
          <circle
            [attr.cx]="getX(sq.id)"
            [attr.cy]="getY(sq.id)"
            r="18"
            fill="transparent"
          />

          <!-- Indicador de jugada válida (anillo verde) -->
          @if (isValid(sq.id)) {
            <circle
              [attr.cx]="getX(sq.id)"
              [attr.cy]="getY(sq.id)"
              r="20"
              fill="none"
              stroke="#2ecc71"
              stroke-width="4"
              class="valid-ring"
            />
          }

          <!-- Indicador de coronación -->
          @if (isCoronationSquare(sq.id)) {
            <circle
              [attr.cx]="getX(sq.id)"
              [attr.cy]="getY(sq.id)"
              r="22"
              fill="none"
              stroke="#d4a017"
              stroke-width="3"
              stroke-dasharray="6 4"
              opacity="0.7"
            />
          }

          <!-- Número de posición (debug -- ocultar en prod) -->
          <!--
          <text
            [attr.x]="getX(sq.id)"
            [attr.y]="getY(sq.id) + 4"
            text-anchor="middle"
            font-size="10"
            fill="rgba(0,0,0,0.3)"
          >{{ sq.id }}</text>
          -->
        </g>
      }

      <!-- Camino destacado -->
      @if (highlightPath(); as path) {
        @for (pos of path; track pos) {
          <circle
            [attr.cx]="getX(pos)"
            [attr.cy]="getY(pos)"
            r="12"
            fill="none"
            stroke="#2ecc71"
            stroke-width="3"
            class="path-dot"
          />
        }
      }
    </svg>
  `,
  styles: [`
    .board-svg {
      width: 100%;
      max-width: 800px;
      height: auto;
      display: block;
      margin: 0 auto;
      cursor: default;
      user-select: none;
    }
    .board-square {
      cursor: pointer;
    }
    .board-square:hover > circle:first-child {
      fill: rgba(0, 0, 0, 0.08);
    }
    .valid-ring {
      animation: pulse-ring 1.2s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes pulse-ring {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
    .path-dot {
      animation: pulse 1s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }
  `],
})
export class BoardComponent {
  protected readonly VIEWBOX_SIZE = VIEWBOX_SIZE;
  protected readonly PLAYER_COLORS = PLAYER_COLORS;

  layout = input<SquareInfo[]>(BOARD_LAYOUT);
  validSquares = input<Set<BoardPosition>>(new Set());
  highlightPath = input<BoardPosition[] | null>(null);

  squareClick = output<BoardPosition>();

  getX(pos: number): number {
    return getCoordinates(pos).x;
  }

  getY(pos: number): number {
    return getCoordinates(pos).y;
  }

  isCoronationSquare(pos: number): boolean {
    return Object.values(CIELO_END).includes(pos);
  }

  isValid(pos: number): boolean {
    return this.validSquares().has(pos);
  }

  onSquareClick(pos: number): void {
    if (this.isValid(pos)) {
      this.squareClick.emit(pos);
    }
  }
}
