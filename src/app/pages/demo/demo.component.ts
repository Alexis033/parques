import { Component, signal } from '@angular/core';
import { BoardComponent } from '../../components/board/board.component';
import { DiceComponent } from '../../components/dice/dice.component';
import { MoveSelectorComponent } from '../../components/move-selector/move-selector.component';
import { PlayerPanelComponent } from '../../components/player-panel/player-panel.component';
import { WaitingRoomComponent } from '../../components/waiting-room/waiting-room.component';
import { BOARD_LAYOUT } from '@parchis/engine';
import type { SquareInfo, BoardPosition, PlayerColor, DiceRoll, Player, Room } from '@parchis/shared';
import type { EngineToken, ValidAction } from '@parchis/engine';

@Component({
    selector: 'app-demo',
    imports: [
        BoardComponent,
        DiceComponent,
        MoveSelectorComponent,
        PlayerPanelComponent,
        WaitingRoomComponent,
    ],
    template: `
    <div class="demo-container">
      <h1>Parchis UI Demo</h1>
      <p class="subtitle">Componentes visuales con datos mock</p>

      <div class="demo-grid">
        <!-- Board + Tokens -->
        <section class="demo-section">
          <h2>Board + Tokens</h2>
          <div class="board-wrapper">
            <app-board
              [layout]="boardLayout()"
              [validSquares]="validSquares()"
              [tokens]="mockTokens()"
              [selectedTokenId]="'r1'"
              [validTokenIds]="validTokenIds()"
            />
          </div>
        </section>

        <!-- Dice -->
        <section class="demo-section">
          <h2>Dice</h2>
          <div class="dice-demo">
            <div class="dice-item">
              <h3>Normal roll (3+5=8)</h3>
              <app-dice [diceRoll]="normalRoll()" [enabled]="true" [rolling]="false" />
            </div>
            <div class="dice-item">
              <h3>Pair (4+4)</h3>
              <app-dice [diceRoll]="pairRoll()" [enabled]="true" [rolling]="false" />
            </div>
            <div class="dice-item">
              <h3>Parques (6+6)</h3>
              <app-dice [diceRoll]="parquesRoll()" [enabled]="true" [rolling]="false" />
            </div>
          </div>
        </section>

        <!-- Move Selector -->
        <section class="demo-section">
          <h2>Move Selector</h2>
          <app-move-selector
            [validActions]="mockActions()"
            [currentRoll]="normalRoll()"
          />
        </section>

        <!-- Player Panels -->
        <section class="demo-section">
          <h2>Player Panels</h2>
          <div class="panels-grid">
            @for (player of mockPlayers(); track player.id) {
              <app-player-panel
                [player]="player"
                [tokens]="mockTokens()"
                [isActive]="player.color === 'RED'"
                [isMe]="player.color === 'BLUE'"
              />
            }
          </div>
        </section>

        <!-- Waiting Room -->
        <section class="demo-section full-width">
          <h2>Waiting Room</h2>
          <app-waiting-room
            [room]="mockRoom()"
            [isHost]="true"
            [currentUserId]="'u1'"
          />
        </section>
      </div>
    </div>
  `,
    styles: [`
    .demo-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
      font-family: system-ui, -apple-system, sans-serif;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .subtitle { color: #666; margin-bottom: 1.5rem; }
    .demo-grid {
      display: grid;
      gap: 2rem;
    }
    .demo-section {
      background: #f8f8f8;
      border-radius: 8px;
      padding: 1rem;
    }
    .demo-section.full-width { grid-column: 1 / -1; }
    .demo-section h2 { font-size: 1.1rem; margin-bottom: 0.75rem; color: #333; }
    .board-wrapper {
      max-width: 690px;
      margin: 0 auto;
    }
    .dice-demo { display: flex; flex-direction: column; gap: 1.5rem; }
    .dice-item h3 { font-size: 0.9rem; color: #555; margin: 0 0 0.5rem; }
    .panels-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
  `]
})
export class DemoComponent {
  boardLayout = signal<SquareInfo[]>(BOARD_LAYOUT);
  validSquares = signal<Set<BoardPosition>>(new Set([10, 11, 27, 28, 44, 45, 61]));
  validTokenIds = signal<Set<string>>(new Set(['r1', 'r2', 'r3']));

  normalRoll = signal<DiceRoll>({ die1: 3, die2: 5, isPair: false, isParques: false, timestamp: Date.now() });
  pairRoll = signal<DiceRoll>({ die1: 4, die2: 4, isPair: true, isParques: false, timestamp: Date.now() });
  parquesRoll = signal<DiceRoll>({ die1: 6, die2: 6, isPair: true, isParques: true, timestamp: Date.now() });

  mockTokens = signal<EngineToken[]>([
    // RED: tokens in circuit + one jailed
    { id: 'r1', color: 'RED', position: 10, state: 'IN_TRANSIT', totalSteps: 10, index: 0 },
    { id: 'r2', color: 'RED', position: 25, state: 'IN_TRANSIT', totalSteps: 25, index: 1 },
    { id: 'r3', color: 'RED', position: 63, state: 'IN_TRANSIT', totalSteps: 63, index: 2 },
    { id: 'r4', color: 'RED', position: -1, state: 'JAIL', totalSteps: 0, index: 3 },
    // BLUE: one at same pos as r1 to show stacking
    { id: 'b1', color: 'BLUE', position: 42, state: 'IN_TRANSIT', totalSteps: 42, index: 0 },
    { id: 'b2', color: 'BLUE', position: -1, state: 'JAIL', totalSteps: 0, index: 1 },
    // GREEN: one in cielo, one crowned
    { id: 'g1', color: 'GREEN', position: 86, state: 'IN_SKY', totalSteps: 86, index: 0 },
    { id: 'g2', color: 'GREEN', position: 75, state: 'CROWNED', totalSteps: 91, index: 1 },
    // YELLOW: one crowned — coronation goes to center goal
    { id: 'y1', color: 'YELLOW', position: 99, state: 'CROWNED', totalSteps: 71, index: 0 },
  ]);

  mockActions = signal<ValidAction[]>([
    { type: 'EXIT_TOKEN', tokenIndex: 3, description: 'Exit token from jail' } as ValidAction,
    { type: 'MOVE_COMBINED', tokenId: 'r1', squares: 8, description: 'Move r1 8 squares (to 18)' } as ValidAction,
    { type: 'MOVE_COMBINED', tokenId: 'r2', squares: 8, description: 'Move r2 8 squares (to 33)' } as ValidAction,
    { type: 'MOVE_COMBINED', tokenId: 'r3', squares: 5, description: 'Move r3 5 squares into cielo (to 72)' } as ValidAction,
    { type: 'SKIP', description: 'Skip turn' } as ValidAction,
  ]);

  mockPlayers = signal<Player[]>([
    { id: 'u1', color: 'RED', name: 'Alice', isHost: false, isConnected: true },
    { id: 'u2', color: 'BLUE', name: 'Bob', isHost: false, isConnected: true },
    { id: 'u3', color: 'GREEN', name: 'Charlie', isHost: false, isConnected: true },
    { id: 'u4', color: 'YELLOW', name: 'Diana', isHost: true, isConnected: false },
  ]);

  mockRoom = signal<Room>({
    id: 'room-1',
    code: '4827',
    players: [
      { id: 'u1', color: 'RED', name: 'Alice', isHost: true, isConnected: true },
      { id: 'u2', color: 'BLUE', name: 'Bob', isHost: false, isConnected: true },
      { id: 'u3', color: 'GREEN', name: 'Charlie', isHost: false, isConnected: true },
    ],
    maxPlayers: 4,
    status: 'IN_PROGRESS',
    houseRules: { soplarCorrespondiente: true, patearSeguroSalida: false, exitRule: 'ALL' },
    createdAt: new Date().toISOString(),
  });
}
