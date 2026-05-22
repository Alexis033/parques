import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIf, NgFor } from '@angular/common';
import { GameService, type GameInfo } from '../../services/game/game.service';
import { RoomService } from '../../services/room/room.service';
import { AuthService } from '../../services/auth/auth.service';
import { BoardComponent } from '../../components/board';
import { TokenComponent } from '../../components/token';
import { DiceComponent } from '../../components/dice';
import { MoveSelectorComponent } from '../../components/move-selector';
import { WaitingRoomComponent } from '../../components/waiting-room';
import { PlayerPanelComponent } from '../../components/player-panel';
import { GameInfoComponent } from '../../components/game-info';
import type { Room, PlayerColor } from '@parchis/shared';
import type { EngineState, EngineToken, ValidAction } from '@parchis/engine';
import { getValidActions, isGameOver, getPlayerTokens, BOARD_LAYOUT } from '@parchis/engine';
import type { SquareInfo, BoardPosition } from '@parchis/shared';

type ViewState = 'loading' | 'waiting' | 'playing' | 'error';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [
    NgIf, NgFor,
    BoardComponent, TokenComponent, DiceComponent, MoveSelectorComponent,
    WaitingRoomComponent, PlayerPanelComponent, GameInfoComponent,
  ],
  template: `
    <div class="game-page">

      @if (view() === 'loading') {
        <div class="state-overlay">
          <div class="spinner"></div>
          <p>{{ loadingMessage() }}</p>
        </div>
      }

      @if (view() === 'error'; as errMsg) {
        <div class="state-overlay error-overlay">
          <div class="error-icon">!</div>
          <p>{{ errorMessage() }}</p>
          <button (click)="retry()" class="retry-btn">Retry</button>
          <button routerLink="/lobby" class="back-btn">Back to Lobby</button>
        </div>
      }

      @if (view() === 'waiting'; as room) {
        <app-waiting-room
          [room]="currentRoom()!"
          [isHost]="isHost()"
          [currentUserId]="auth.userId ?? ''"
          (startGame)="onStartGame()"
          (leaveRoom)="onLeaveRoom()"
          (kickPlayer)="onKickPlayer($event)"
        />
      }

      @if (view() === 'playing'; as game) {
        <div class="game-layout">
          <div class="game-main">
            <app-game-info [state]="engineState()!" />

            <div class="board-area">
              <app-board
                [layout]="boardLayout"
                [validSquares]="validSquares()"
                [highlightPath]="highlightPath()"
                (squareClick)="onSquareClick($event)"
              />

              <div class="tokens-overlay">
                <svg [attr.viewBox]="'0 0 600 600'" class="tokens-svg">
                  @for (token of myTokens(); track token.id) {
                    <app-token
                      [token]="token"
                      [isSelected]="selectedToken() === token.id"
                      [isValidMove]="validTokenIds().has(token.id)"
                      [stackIndex]="getStackIndex(token)"
                      (select)="onTokenSelect($event)"
                    />
                  }
                </svg>
              </div>
            </div>

            <app-dice
              [diceRoll]="currentRoll()"
              [enabled]="canRoll()"
              [rolling]="actionLoading()"
              (roll)="onRoll()"
            />

            @if (validActions().length > 0 && showMoveSelector()) {
              <app-move-selector
                [validActions]="validActions()"
                [currentRoll]="currentRoll()"
                (selectAction)="onActionSelected($event)"
                (cancelSelection)="onMoveCancel()"
              />
            }
          </div>

          <div class="game-sidebar">
            <div class="turn-indicator">
              @if (isMyTurn()) {
                <span class="my-turn-badge">Your Turn</span>
              } @else {
                <span class="waiting-badge">Waiting...</span>
              }
            </div>

            <div class="players-sidebar">
              @for (player of players(); track player.id) {
                <app-player-panel
                  [player]="player"
                  [tokens]="allEngineTokens()"
                  [isActive]="isPlayerActive(player.color)"
                  [isMe]="player.id === auth.userId"
                />
              }
            </div>
          </div>
        </div>

        @if (isGameOverSignal()) {
          <div class="game-over-modal" (click)="onDismissGameOver()">
            <div class="game-over-content" (click)="$event.stopPropagation()">
              <h2>Game Over!</h2>
              <p class="winner-text">{{ winnerLabel() }} wins!</p>
              <div class="go-actions">
                <button routerLink="/lobby" class="go-btn">Back to Lobby</button>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .game-page {
      min-height: 100vh;
      position: relative;
    }

    .state-overlay {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      gap: 1rem;
      color: #555;
    }
    .state-overlay p { margin: 0; }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #e0e0e0;
      border-top-color: #3498db;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-overlay .error-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #e74c3c;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      font-weight: bold;
    }
    .retry-btn, .back-btn {
      padding: 0.5rem 1.25rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }
    .retry-btn { background: #3498db; color: white; }
    .retry-btn:hover { background: #2980b9; }
    .back-btn { background: #eee; color: #555; }
    .back-btn:hover { background: #ddd; }

    .game-layout {
      display: grid;
      grid-template-columns: 1fr 220px;
      gap: 1rem;
      padding: 1rem;
      max-width: 1000px;
      margin: 0 auto;
    }
    @media (max-width: 768px) {
      .game-layout {
        grid-template-columns: 1fr;
        gap: 0.5rem;
        padding: 0.5rem;
      }
    }

    .game-main {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .board-area {
      position: relative;
      width: 100%;
      max-width: 600px;
    }

    .tokens-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .tokens-overlay .tokens-svg {
      width: 100%;
      height: auto;
    }
    .tokens-overlay app-token {
      pointer-events: auto;
    }

    .game-sidebar {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .turn-indicator {
      text-align: center;
      padding: 0.5rem;
    }
    .my-turn-badge {
      background: #2ecc71;
      color: white;
      padding: 0.3rem 1rem;
      border-radius: 20px;
      font-weight: 700;
      font-size: 0.9rem;
      animation: pulse-badge 1s ease-in-out infinite alternate;
    }
    @keyframes pulse-badge {
      from { transform: scale(1); }
      to { transform: scale(1.05); }
    }
    .waiting-badge {
      color: #999;
      font-style: italic;
      font-size: 0.85rem;
    }

    .players-sidebar {
      display: flex;
      flex-direction: column;
    }

    .game-over-modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .game-over-content {
      background: white;
      border-radius: 16px;
      padding: 2rem;
      text-align: center;
      min-width: 280px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    }
    .game-over-content h2 { margin: 0 0 0.5rem; }
    .winner-text {
      font-size: 1.2rem;
      font-weight: 700;
      color: #d4a017;
      margin: 0 0 1.5rem;
    }
    .go-actions { display: flex; gap: 0.5rem; justify-content: center; }
    .go-btn {
      padding: 0.5rem 1.5rem;
      border: none;
      border-radius: 8px;
      background: #3498db;
      color: white;
      font-weight: 600;
      cursor: pointer;
    }
    .go-btn:hover { background: #2980b9; }
  `],
})
export class GameComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected gameService = inject(GameService);
  protected roomService = inject(RoomService);
  protected auth = inject(AuthService);

  private gameId: string | null = null;

  // View state
  protected view = signal<ViewState>('loading');
  protected loadingMessage = signal('Loading...');
  protected errorMessage = signal('Something went wrong');
  protected currentRoom = signal<Room | null>(null);

  // Game state
  protected engineState = signal<EngineState | null>(null);
  protected selectedToken = signal<string | null>(null);
  protected showMoveSelector = signal(false);
  protected highlightPath = signal<BoardPosition[] | null>(null);
  protected prevGameInfo: GameInfo | null = null;

  // Computed
  protected boardLayout: SquareInfo[] = BOARD_LAYOUT;

  protected isHost = computed(() => {
    const room = this.currentRoom();
    if (!room || !this.auth.userId) return false;
    return room.players.some(p => p.id === this.auth.userId && p.isHost);
  });

  protected game = this.gameService.game;
  protected actionLoading = this.gameService.actionLoading;
  protected engineStateC = computed(() => this.game()?.state ?? null);

  protected isMyTurn = computed(() => {
    const state = this.engineStateC();
    const uid = this.auth.userId;
    if (!state || !uid) return false;
    const currentPlayer = state.players[state.currentPlayerIndex];
    return currentPlayer?.id === uid;
  });
  protected players = computed(() => this.engineStateC()?.players ?? []);
  protected allEngineTokens = computed(() => this.engineStateC()?.tokens ?? []);
  protected currentRoll = computed(() => this.engineStateC()?.currentRoll ?? null);
  protected isGameOverSignal = computed(() => {
    const state = this.engineStateC();
    return state ? isGameOver(state) : false;
  });

  protected myTokens = computed(() => {
    const state = this.engineStateC();
    if (!state || !this.auth.userId) return [];
    const me = state.players.find(p => p.id === this.auth.userId);
    if (!me) return [];
    return getPlayerTokens(state, me.color);
  });

  protected canRoll = computed(() => {
    if (this.actionLoading()) return false;
    const state = this.engineStateC();
    if (!state) return false;
    return this.isMyTurn() && state.turnPhase === 'ROLL';
  });

  protected validActions = computed<ValidAction[]>(() => {
    const state = this.engineStateC();
    if (!state) return [];
    return getValidActions(state);
  });

  protected validTokenIds = computed(() => {
    const ids = new Set<string>();
    for (const action of this.validActions()) {
      if (action.type === 'MOVE_COMBINED') {
        ids.add((action as { tokenId: string }).tokenId);
      } else if (action.type === 'MOVE_SPLIT') {
        const split = action as { tokenA: string; tokenB: string };
        ids.add(split.tokenA);
        if (split.tokenB) ids.add(split.tokenB);
      } else if (action.type === 'EXIT_TOKEN') {
        const exit = action as { tokenIndex: number };
        const state = this.engineStateC();
        if (state) {
          const jailToken = state.tokens.find(
            t => t.color === state.players[state.currentPlayerIndex]?.color && t.index === exit.tokenIndex
          );
          if (jailToken) ids.add(jailToken.id);
        }
      }
    }
    return ids;
  });

  protected validSquares = computed(() => {
    const squares = new Set<BoardPosition>();
    const state = this.engineStateC();
    if (!state) return squares;
    for (const action of this.validActions()) {
      if (action.type === 'MOVE_COMBINED') {
        const token = state.tokens.find(t => t.id === (action as { tokenId: string }).tokenId);
        if (token) squares.add(token.position);
      } else if (action.type === 'MOVE_SPLIT') {
        const split = action as { tokenA: string; tokenB: string };
        const tokenA = state.tokens.find(t => t.id === split.tokenA);
        if (tokenA) squares.add(tokenA.position);
        if (split.tokenB) {
          const tokenB = state.tokens.find(t => t.id === split.tokenB);
          if (tokenB) squares.add(tokenB.position);
        }
      } else if (action.type === 'EXIT_TOKEN') {
        const exit = action as { tokenIndex: number };
        const playerColor = state.players[state.currentPlayerIndex]?.color;
        if (playerColor) {
          const jailPos = 100 + ['RED', 'BLUE', 'GREEN', 'YELLOW'].indexOf(playerColor);
          squares.add(jailPos);
        }
      }
    }
    return squares;
  });

  protected winnerLabel = computed(() => {
    const state = this.engineStateC();
    if (!state?.winner) return '';
    const player = state.players.find(p => p.color === state.winner);
    return player?.name ?? state.winner;
  });

  private unsubRoom: (() => void) | null = null;
  private unsubGame: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/lobby']);
      return;
    }

    if (!this.auth.isAuthenticated) {
      try {
        await this.auth.signInAnonymously();
      } catch (err) {
        this.view.set('error');
        this.errorMessage.set('Authentication failed');
        return;
      }
    }

    this.gameId = id;
    await this.initializeRoom(id);
  }

  private async initializeRoom(roomId: string): Promise<void> {
    try {
      this.loadingMessage.set('Loading room...');
      const room = await this.roomService.getRoom(roomId);
      this.currentRoom.set(room);

      this.unsubRoom = this.roomService.subscribeToRoom(roomId, (updated) => {
        this.currentRoom.set(updated);
      });

      const existingGame = await this.gameService.findGameByRoomId(roomId);
      if (existingGame) {
        this.onGameReady(existingGame);
      } else {
        this.view.set('waiting');
      }
    } catch (err) {
      this.view.set('error');
      this.errorMessage.set('Failed to load room. It may not exist.');
    }
  }

  private onGameReady(gameInfo: GameInfo): void {
    this.prevGameInfo = gameInfo;
    this.engineState.set(gameInfo.state);
    this.view.set('playing');
  }

  async onStartGame(): Promise<void> {
    if (!this.gameId) return;
    try {
      this.loadingMessage.set('Starting game...');
      this.view.set('loading');
      const gameInfo = await this.gameService.startGame(this.gameId);
      this.onGameReady(gameInfo);
    } catch (err) {
      this.view.set('error');
      this.errorMessage.set('Failed to start game');
    }
  }

  async onLeaveRoom(): Promise<void> {
    if (!this.gameId) return;
    try {
      await this.roomService.leaveRoom(this.gameId);
      this.router.navigate(['/lobby']);
    } catch {
      this.router.navigate(['/lobby']);
    }
  }

  async onKickPlayer(playerId: string): Promise<void> {
    if (!this.gameId) return;
    try {
      await this.roomService.kickPlayer(this.gameId, playerId);
    } catch (err) {
      console.error('Kick failed', err);
    }
  }

  async onRoll(): Promise<void> {
    try {
      await this.gameService.roll();
      this.showMoveSelector.set(true);
    } catch {
      // error handled by service
    }
  }

  onTokenSelect(tokenId: string): void {
    if (this.validTokenIds().has(tokenId)) {
      this.selectedToken.set(tokenId);
    }
  }

  async onSquareClick(_pos: number): Promise<void> {
    // Handled via token selection + move selector
  }

  async onActionSelected(action: ValidAction): Promise<void> {
    try {
      this.showMoveSelector.set(false);
      this.highlightPath.set(null);

      switch (action.type) {
        case 'ROLL':
          await this.gameService.roll();
          break;
        case 'EXIT_TOKEN': {
          const exit = action as { tokenIndex: number };
          await this.gameService.exitToken(String(exit.tokenIndex));
          break;
        }
        case 'MOVE_COMBINED': {
          const combined = action as { tokenId: string; squares: number };
          await this.gameService.moveToken(combined.tokenId, combined.squares);
          break;
        }
        case 'MOVE_SPLIT': {
          const split = action as { tokenA: string; squaresA: number; tokenB: string; squaresB: number };
          await this.gameService.moveToken(split.tokenA, split.squaresA);
          if (split.tokenB && split.squaresB > 0) {
            await new Promise(r => setTimeout(r, 300));
            await this.gameService.moveToken(split.tokenB, split.squaresB);
          }
          break;
        }
        case 'SOPLAR': {
          const soplar = action as { targetTokenId: string };
          await this.gameService.soplar(soplar.targetTokenId);
          break;
        }
        case 'SKIP':
          await this.gameService.endTurn();
          break;
      }
    } catch (err) {
      console.error('Action failed', err);
    }
  }

  onMoveCancel(): void {
    this.showMoveSelector.set(false);
    this.selectedToken.set(null);
    this.highlightPath.set(null);
  }

  onDismissGameOver(): void {
    // Modal stays until navigated away
  }

  isPlayerActive(color: PlayerColor): boolean {
    const state = this.engineState();
    if (!state) return false;
    return state.players[state.currentPlayerIndex]?.color === color;
  }

  getStackIndex(token: EngineToken): number {
    const state = this.engineState();
    if (!state) return 0;
    const samePosition = state.tokens.filter(
      t => t.position === token.position && t.id !== token.id && t.color === token.color
    );
    return samePosition.length;
  }

  retry(): void {
    if (this.gameId) {
      this.view.set('loading');
      this.initializeRoom(this.gameId);
    } else {
      this.router.navigate(['/lobby']);
    }
  }

  ngOnDestroy(): void {
    this.unsubRoom?.();
    this.gameService.leaveGame();
  }
}
