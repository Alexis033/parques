import { Component, OnInit, OnDestroy, HostListener, signal, computed, inject, effect, Injector } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService, type GameInfo } from '../../services/game/game.service';
import { RoomService } from '../../services/room/room.service';
import { AuthService } from '../../services/auth/auth.service';
import { BoardComponent } from '../../components/board';
import { DiceComponent } from '../../components/dice';
import { MoveSelectorComponent } from '../../components/move-selector';
import { WaitingRoomComponent } from '../../components/waiting-room';
import { PlayerPanelComponent } from '../../components/player-panel';
import { GameInfoComponent } from '../../components/game-info';
import { ChatComponent } from '../../components/chat';
import { ChatService } from '../../services/chat/chat.service';
import type { Room, PlayerColor } from '@parchis/shared';
import type { EngineState, EngineToken, ValidAction } from '@parchis/engine';
import { getValidActions, isGameOver, getPlayerTokens, BOARD_LAYOUT } from '@parchis/engine';
import { calculatePlayerRankings, type PlayerRanking } from '../../services/game/game-utils';
import type { SquareInfo, BoardPosition } from '@parchis/shared';

type ViewState = 'loading' | 'waiting' | 'playing' | 'error';

@Component({
    selector: 'app-game',
    imports: [
        BoardComponent, DiceComponent, MoveSelectorComponent,
        WaitingRoomComponent, PlayerPanelComponent, GameInfoComponent, ChatComponent,
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
                [tokens]="myTokens()"
                [allTokens]="allEngineTokens()"
                [selectedTokenId]="selectedToken()"
                [validTokenIds]="validTokenIds()"
                (squareClick)="onSquareClick($event)"
                (tokenClick)="onTokenSelect($event)"
              />
            </div>

            <app-dice
              [diceRoll]="currentRoll()"
              [enabled]="canRoll()"
              [rolling]="actionLoading()"
              (roll)="onRoll()"
            />

            @if (validActions().length > 0 && showMoveSelector()) {
              <div class="move-selector-area">
                <app-move-selector
                  [validActions]="validActions()"
                  [currentRoll]="currentRoll()"
                  (selectAction)="onActionSelected($event)"
                  (cancelSelection)="onMoveCancel()"
                />
              </div>
            }
          </div>

          <div class="game-sidebar">
            <div class="turn-indicator">
              <div class="my-color-indicator">
                <span class="color-dot" [style.background]="colorHex(myColor())"></span>
                <span class="color-label">You are <strong>{{ colorName(myColor()) }}</strong></span>
              </div>
              @if (isMyTurn()) {
                <span class="my-turn-badge">Your Turn</span>
              } @else {
                <span class="waiting-badge">Waiting...</span>
              }
            </div>

            <div class="players-sidebar">
              @for (panel of playerPanels(); track panel.id) {
                <app-player-panel
                  [name]="panel.name"
                  [colorHex]="panel.colorHex"
                  [isActive]="panel.isActive"
                  [isMe]="panel.isMe"
                  [isConnected]="panel.isConnected"
                  [isHost]="panel.isHost"
                  [crownedCount]="panel.crownedCount"
                  [jailCount]="panel.jailCount"
                  [activeCount]="panel.activeCount"
                />
              }
            </div>

            <div class="sidebar-actions">
              <button class="leave-btn" (click)="onBackToLobby()">
                🚪 Leave Game
              </button>
            </div>

            <app-chat
              [roomId]="gameId!"
              [currentUserId]="auth.userId"
              [currentDisplayName]="currentDisplayName()"
            />
          </div>
        </div>

        @if (isGameOverSignal()) {
          <div class="game-over-modal">
            <div class="game-over-content">
              <div class="trophy-icon">🏆</div>
              <h2>Game Over!</h2>
              <p class="winner-text">{{ winnerLabel() }} wins!</p>

              <div class="rankings-container">
                <h3>Player Rankings</h3>
                @for (ranking of playerRankings(); track ranking.color) {
                  <div
                    class="ranking-row"
                    [class.ranking-winner]="ranking.position === 1"
                    [class.ranking-disconnected]="!ranking.isConnected"
                  >
                    <span class="ranking-medal">
                      @switch (ranking.position) {
                        @case (1) { 🥇 }
                        @case (2) { 🥈 }
                        @case (3) { 🥉 }
                        @case (4) { 4th }
                      }
                    </span>
                    <span class="ranking-name">{{ ranking.name }}</span>
                    <span class="ranking-score">{{ ranking.crownedCount }}/4 👑</span>
                    @if (!ranking.isConnected) {
                      <span class="disconnected-badge">Disconnected</span>
                    }
                  </div>
                }
              </div>

              <div class="go-actions">
                <button
                  (click)="onRematch()"
                  class="go-btn go-btn-primary"
                  [disabled]="gameService.loading()"
                >
                  @if (gameService.loading()) {
                    <span class="btn-spinner"></span>
                  } @else {
                    🔄 Rematch
                  }
                </button>
                <button (click)="onBackToLobby()" class="go-btn go-btn-secondary">
                  🚪 Back to Lobby
                </button>
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
      width: 100%;
      display: flex;
      justify-content: center;
    }

    .move-selector-area {
      min-height: 60px;
      width: 100%;
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
    .my-color-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      margin-bottom: 0.5rem;
      font-size: 0.85rem;
      color: #555;
    }
    .color-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
    }
    .color-label strong { text-transform: uppercase; }
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

    .sidebar-actions {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .leave-btn {
      width: 100%;
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 8px;
      background: #ecf0f1;
      color: #555;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.3rem;
    }
    .leave-btn:hover {
      background: #dde4e6;
      color: #333;
    }
    .leave-btn:active {
      transform: scale(0.97);
    }

    .game-over-modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .game-over-content {
      background: white;
      border-radius: 20px;
      padding: 2rem;
      text-align: center;
      min-width: 320px;
      max-width: 400px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.3);
    }
    .trophy-icon {
      font-size: 3rem;
      margin-bottom: 0.5rem;
    }
    .game-over-content h2 {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
      color: #2c3e50;
    }
    .winner-text {
      font-size: 1.25rem;
      font-weight: 700;
      color: #d4a017;
      margin: 0 0 1.5rem;
    }

    .rankings-container {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }
    .rankings-container h3 {
      margin: 0 0 0.75rem;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #7f8c8d;
    }
    .ranking-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0.75rem;
      border-radius: 8px;
      margin-bottom: 0.25rem;
    }
    .ranking-row:last-child {
      margin-bottom: 0;
    }
    .ranking-winner {
      background: linear-gradient(135deg, #fff9c4 0%, #fff59d 100%);
      font-weight: 600;
    }
    .ranking-disconnected {
      opacity: 0.5;
    }
    .ranking-medal {
      font-size: 1.25rem;
      width: 28px;
      text-align: center;
    }
    .ranking-name {
      flex: 1;
      text-align: left;
      color: #2c3e50;
    }
    .ranking-score {
      font-weight: 600;
      color: #7f8c8d;
      font-size: 0.9rem;
    }
    .disconnected-badge {
      font-size: 0.7rem;
      color: #e74c3c;
      background: #fdf2f2;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }

    .go-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
    }
    .go-btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.95rem;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .go-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .go-btn-primary {
      background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
      color: white;
    }
    .go-btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(52, 152, 219, 0.4);
    }
    .go-btn-secondary {
      background: #ecf0f1;
      color: #555;
    }
    .go-btn-secondary:hover {
      background: #dde4e6;
    }

    @keyframes spin-btn {
      to { transform: rotate(360deg); }
    }
    .btn-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin-btn 0.6s linear infinite;
      display: inline-block;
    }
  `]
})
export class GameComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected gameService = inject(GameService);
  protected roomService = inject(RoomService);
  protected auth = inject(AuthService);
  private chatService = inject(ChatService);
  private injector = inject(Injector);

  protected gameId: string | null = null;

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
  protected myColor = computed(() => {
    const uid = this.auth.userId;
    if (!uid) return null;

    // Try engine state first (during gameplay)
    const state = this.engineStateC();
    if (state) {
      const me = state.players.find(p => p.id === uid);
      if (me?.color) return me.color;
    }

    // Fallback: read from currentRoom (waiting room or engine state mismatch)
    const room = this.currentRoom();
    if (room) {
      const me = room.players.find(p => p.id === uid);
      return me?.color ?? null;
    }

    return null;
  });

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
  protected playerPanels = computed(() => {
    const state = this.engineStateC();
    const uid = this.auth.userId;
    if (!state) return [];
    const map: Record<string, string> = {
      RED: '#e74c3c', BLUE: '#3498db',
      GREEN: '#2ecc71', YELLOW: '#f1c40f',
    };
    return state.players.map(p => {
      const playerTokens = state.tokens.filter(t => t.color === p.color);
      return {
        id: p.id,
        name: p.name,
        colorHex: map[p.color] ?? '#888',
        isActive: state.players[state.currentPlayerIndex]?.color === p.color,
        isMe: p.id === uid,
        isConnected: p.isConnected,
        isHost: p.isHost,
        crownedCount: playerTokens.filter(t => t.state === 'CROWNED').length,
        jailCount: playerTokens.filter(t => t.state === 'JAIL').length,
        activeCount: playerTokens.filter(t => t.state === 'IN_TRANSIT' || t.state === 'IN_SKY').length,
      };
    });
  });
  protected currentRoll = computed(() => this.engineStateC()?.currentRoll ?? null);
  protected isGameOverSignal = computed(() => {
    const state = this.engineStateC();
    return state ? isGameOver(state) : false;
  });

  protected currentDisplayName = computed(() => {
    const uid = this.auth.userId;
    if (!uid) return '';
    const me = this.players().find(p => p.id === uid);
    return me?.name ?? '';
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

  protected playerRankings = computed((): PlayerRanking[] => {
    const state = this.engineStateC();
    if (!state) return [];
    return calculatePlayerRankings(state);
  });

  private unsubRoom: (() => void) | null = null;

  /** Tracks whether the winner system message has been sent for the current game. */
  private winnerMessageSent = false;

  async ngOnInit(): Promise<void> {
    // Watch for winner detection to send system message
    effect(() => {
      if (this.isGameOverSignal() && !this.winnerMessageSent) {
        this.winnerMessageSent = true;
        const winner = this.winnerLabel();
        if (winner && this.gameId) {
          this.chatService.sendSystemMessage(this.gameId, `${winner} won the game!`).catch(() => {});
        }
      }
    }, { injector: this.injector });

    // Auto-end-turn when server sends MOVE phase with no valid actions
    effect(() => {
      const state = this.engineStateC();
      if (!state || !this.isMyTurn()) return;
      if (state.turnPhase === 'MOVE' && this.validActions().length === 0) {
        this.gameService.endTurn().catch(() => {});
      }
    }, { injector: this.injector });
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
        // Fix 1: Auto-transition non-host players when game starts
        if (updated.status === 'PLAYING' && this.view() === 'waiting') {
          this.gameService.findGameByRoomId(roomId).then(game => {
            if (game) {
              this.onGameReady(game);
              this.gameService.startHeartbeat(roomId);
            }
          }).catch(() => {});
        }
      });

      const existingGame = await this.gameService.findGameByRoomId(roomId);
      if (existingGame) {
        this.onGameReady(existingGame);
        // Reconnection: start heartbeat for existing game
        this.gameService.startHeartbeat(roomId);
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
      // Start heartbeat for the active game
      this.gameService.startHeartbeat(this.gameId);
      // System message: game started
      this.chatService.sendSystemMessage(this.gameId, 'Game started!').catch(() => {});
    } catch (err) {
      this.view.set('error');
      this.errorMessage.set('Failed to start game');
    }
  }

  async onLeaveRoom(): Promise<void> {
    if (!this.gameId) return;
    try {
      await this.gameService.sendDisconnect(this.gameId);
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

  async onRematch(): Promise<void> {
    if (!this.gameId) return;
    try {
      const gameInfo = await this.gameService.rematch(this.gameId);
      this.onGameReady(gameInfo);
      // Heartbeat continues (same roomId, already running)
    } catch (err) {
      console.error('Rematch failed', err);
      this.errorMessage.set('Failed to start rematch');
    }
  }

  async onBackToLobby(): Promise<void> {
    if (!this.gameId) return;
    try {
      await this.gameService.sendDisconnect(this.gameId);
      this.gameService.leaveGame();
      await this.roomService.leaveRoom(this.gameId);
      this.unsubRoom?.();
      this.unsubRoom = null;
    } catch {
      // Ignore cleanup errors, still navigate
    }
    this.router.navigate(['/lobby']);
  }

  async onRoll(): Promise<void> {
    try {
      await this.gameService.roll();
      // If no valid moves after rolling, auto-end turn
      if (this.validActions().length === 0) {
        if (this.engineStateC()?.turnPhase === 'ROLL') return; // jail: wait for next roll
        await this.gameService.endTurn();
        return;
      }
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
  protected colorHex(color: PlayerColor | null): string {
    const map: Record<string, string> = {
      RED: '#e74c3c', BLUE: '#3498db',
      GREEN: '#2ecc71', YELLOW: '#f1c40f',
    };
    return color ? (map[color] ?? '#888') : '#888';
  }

  protected colorName(color: PlayerColor | null): string {
    const map: Record<string, string> = {
      RED: 'Red', BLUE: 'Blue',
      GREEN: 'Green', YELLOW: 'Yellow',
    };
    return color ? (map[color] ?? 'Unknown') : '-';
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

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(_event: Event): void {
    // Fire-and-forget: page is closing, no time to await
    if (this.gameId) {
      const roomId = this.gameId;
      this.roomService.leaveRoom(roomId).catch(() => {});
      this.gameService.sendDisconnect(roomId).catch(() => {});
    }
  }

  ngOnDestroy(): void {
    if (this.gameId) {
      this.gameService.sendDisconnect(this.gameId);
      // Fix 3: Also remove player from room so it doesn't accumulate stale rooms
      this.roomService.leaveRoom(this.gameId).catch(() => {});
    }
    this.unsubRoom?.();
    this.gameService.leaveGame();
  }
}
