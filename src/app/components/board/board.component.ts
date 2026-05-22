import { Component, input, output, computed } from '@angular/core';
import type { SquareInfo, BoardPosition } from '@parchis/shared';
import type { PlayerColor } from '@parchis/shared';
import type { EngineToken } from '@parchis/engine';
import { COLORS } from '@parchis/shared';
import { BOARD_LAYOUT } from '@parchis/engine';
import { BoardCellComponent } from './board-cell.component';
import { BoardGoalComponent } from './board-goal.component';
import { PlayerZoneComponent } from './player-zone.component';
import { getCellGridPosition, ZONE_GRID, GOAL_GRID } from './grid.config';

export { getCellGridPosition } from './grid.config';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
    BoardCellComponent,
    BoardGoalComponent,
    PlayerZoneComponent,
  ],
  template: `
    <div class="tablero">
      <!-- Player zones -->
      @for (color of playerColors; track color) {
        <app-player-zone
          [color]="color"
          [style.grid-column]="zoneGrid[color].col"
          [style.grid-row]="zoneGrid[color].row"
        />
      }

      <!-- Board cells + tokens inside them -->
      @for (sq of visibleLayout(); track sq.id) {
        @if (gridPos(sq.id); as pos) {
          <app-board-cell
            [sq]="sq"
            [col]="pos.col"
            [row]="pos.row"
            [isValid]="validSquares().has(sq.id) && hasTokens(sq.id)"
            [tokens]="cellTokens(sq.id)"
            [selectedTokenId]="selectedTokenId()"
            [validTokenIds]="validTokenIds()"
            (tokenClick)="onTokenClick($event)"
            (click)="onCellClick(sq.id)"
          />
        }
      }

      <!-- Center goal -->
      <app-board-goal
        [style.grid-column]="goalGrid.col"
        [style.grid-row]="goalGrid.row"
      />
    </div>
  `,
  styles: [`
    .tablero {
      display: grid;
      grid-template-columns: repeat(8, 30px) repeat(3, 70px) repeat(8, 30px);
      grid-template-rows: repeat(8, 30px) repeat(3, 70px) repeat(8, 30px);
      width: 690px;
      height: 690px;
      margin: 0 auto;
      position: relative;
    }
  `],
})
export class BoardComponent {
  layout = input<SquareInfo[]>(BOARD_LAYOUT);
  validSquares = input<Set<BoardPosition>>(new Set());
  highlightPath = input<BoardPosition[] | null>(null);
  tokens = input<EngineToken[]>([]);
  selectedTokenId = input<string | null>(null);
  validTokenIds = input<Set<string>>(new Set());

  squareClick = output<BoardPosition>();
  tokenClick = output<string>();

  protected readonly playerColors: PlayerColor[] = COLORS;
  protected readonly zoneGrid = ZONE_GRID;
  protected readonly goalGrid = GOAL_GRID;
  protected readonly gridPos = getCellGridPosition;

  protected visibleLayout = computed(() => {
    return this.layout().filter(sq => getCellGridPosition(sq.id) !== undefined);
  });

  protected cellTokens(pos: BoardPosition): EngineToken[] {
    return this.tokens().filter(t => t.position === pos);
  }

  protected hasTokens(pos: BoardPosition): boolean {
    return this.tokens().some(t => t.position === pos);
  }

  protected onCellClick(pos: BoardPosition): void {
    if (this.validSquares().has(pos) && this.hasTokens(pos)) {
      this.squareClick.emit(pos);
    }
  }

  protected onTokenClick(tokenId: string): void {
    this.tokenClick.emit(tokenId);
  }
}
