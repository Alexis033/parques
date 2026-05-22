import { Component, input, output, computed } from '@angular/core';
import type { SquareInfo } from '@parchis/shared';
import type { EngineToken } from '@parchis/engine';
import { TokenComponent } from '../token/token.component';

@Component({
  selector: 'app-board-cell',
  standalone: true,
  imports: [TokenComponent],
  host: {
    '[style.grid-column]': 'col()',
    '[style.grid-row]': 'row()',
  },
  template: `
    <div
      class="paso"
      [class.verti]="isVertical()"
      [class.start-rojo]="startColor() === 'RED'"
      [class.start-azul]="startColor() === 'BLUE'"
      [class.start-verde]="startColor() === 'GREEN'"
      [class.start-amarillo]="startColor() === 'YELLOW'"
      [class.seguro]="sq().type === 'SAFE_ZONE'"
      [class.cielo-rojo]="sq().type === 'CIELO' && sq().color === 'RED'"
      [class.cielo-azul]="sq().type === 'CIELO' && sq().color === 'BLUE'"
      [class.cielo-verde]="sq().type === 'CIELO' && sq().color === 'GREEN'"
      [class.cielo-amarillo]="sq().type === 'CIELO' && sq().color === 'YELLOW'"
      [class.valid]="isValid()"
      [class.jail]="sq().type === 'JAIL'"
    >
      @if (cellNumber(); as num) {
        <p>{{ num }}</p>
      } @else if (sq().type === 'SAFE_ZONE') {
        <span class="star">★</span>
      }

      @for (token of tokens(); track token.id) {
        <app-token
          [token]="token"
          [isSelected]="selectedTokenId() === token.id"
          [isValidMove]="validTokenIds().has(token.id)"
          [stackIndex]="getStackIndex(token)"
          (select)="tokenClick.emit($event)"
        />
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .paso {
      width: 70px;
      height: 30px;
      border: 1px solid #333;
      box-sizing: border-box;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      transition: box-shadow 0.2s;
      flex-shrink: 0;
    }

    .paso.verti {
      transform: rotate(90deg);
    }

    .paso.start-rojo    { background: #E84837; }
    .paso.start-azul   { background: #1D91FF; }
    .paso.start-verde  { background: #22CA57; }
    .paso.start-amarillo { background: #FBC71F; }

    .paso.seguro { background: #AEA4A9; }

    .paso.cielo-rojo    { background: #E84837; }
    .paso.cielo-azul   { background: #1D91FF; }
    .paso.cielo-verde  { background: #22CA57; }
    .paso.cielo-amarillo { background: #FBC71F; }
    .paso[class*="cielo"] { opacity: 0.7; }

    .paso.jail { display: none; }

    .paso.valid {
      box-shadow: 0 0 0 3px #2ecc71, 0 0 10px rgba(46, 204, 113, 0.6);
      z-index: 5;
      cursor: pointer;
    }

    p {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      color: #333;
      white-space: nowrap;
      z-index: 1;
    }
    .start-rojo p, .start-azul p, .start-verde p, .start-amarillo p,
    .seguro p,
    .cielo-rojo p, .cielo-azul p, .cielo-verde p, .cielo-amarillo p {
      color: white;
    }

    .star {
      font-size: 16px;
      color: #555;
      pointer-events: none;
      z-index: 1;
    }

    app-token {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
  `],
})
export class BoardCellComponent {
  sq = input.required<SquareInfo>();
  col = input.required<number>();
  row = input.required<number>();
  isValid = input(false);
  tokens = input<EngineToken[]>([]);
  selectedTokenId = input<string | null>(null);
  validTokenIds = input<Set<string>>(new Set());

  tokenClick = output<string>();

  /** Mapeo de colores de salida para que coincida con el layout visual del otro proyecto */
  private static readonly START_COLORS: Record<number, string> = {
    0: 'RED',   // pos 1 en el otro proyecto → rojo
    17: 'GREEN', // pos 18 → verde
    34: 'YELLOW', // pos 35 → amarillo
    51: 'BLUE',  // pos 52 → azul
  };

  /** Color visual de la celda de salida (según layout, no según engine) */
  protected startColor = computed(() => {
    if (this.sq().type !== 'EXIT') return null;
    return BoardCellComponent.START_COLORS[this.sq().id] ?? null;
  });

  /** Número solo para casillas de circuito comunes, no seguras (seguras muestran ★) */
  protected cellNumber = computed(() => {
    if (this.sq().type === 'COMMON') {
      return this.sq().id + 1;
    }
    return null;
  });

  /** Vertical: rows 9-11 y cols 1-8 o 12-19 */
  protected isVertical = computed(() => {
    const r = this.row();
    const c = this.col();
    return r >= 9 && r <= 11 && (c <= 8 || c >= 12);
  });

  protected getStackIndex(token: EngineToken): number {
    return this.tokens().filter(
      t => t.position === token.position && t.id !== token.id && t.color === token.color
    ).length;
  }
}
