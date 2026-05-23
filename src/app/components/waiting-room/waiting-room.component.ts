import { Component, input, output } from '@angular/core';
import type { Room } from '@parchis/shared';

const COLORS_MAP: Record<string, string> = {
  RED: '#e74c3c',
  BLUE: '#3498db',
  GREEN: '#2ecc71',
  YELLOW: '#f1c40f',
};

@Component({
    selector: 'app-waiting-room',
    imports: [],
    template: `
    <div class="waiting-room">
      <div class="wr-header">
        <h2>Waiting Room</h2>
        <div class="room-code-section">
          <span class="room-code-label">Room Code:</span>
          <span class="room-code">{{ room().code }}</span>
          <button class="copy-btn" (click)="copyCode()">
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>
        </div>
      </div>

      <div class="players-section">
        <h3>Players ({{ room().players.length }}/{{ room().maxPlayers }})</h3>
        <div class="players-list">
          @for (player of room().players; track player.id) {
            <div class="player-row" [style.border-left-color]="COLORS_MAP[player.color]">
              <span
                class="player-color-dot"
                [style.background]="COLORS_MAP[player.color]"
              ></span>
              <span class="player-name">{{ player.name }}</span>
              @if (player.isHost) {
                <span class="host-badge">Host</span>
              }
              <span class="status-dot" [class.online]="player.isConnected"></span>
              @if (isHost() && player.id !== currentUserId()) {
                <button class="kick-btn" (click)="onKick(player.id)">Kick</button>
              }
            </div>
          }
        </div>

        @if (room().players.length < room().maxPlayers) {
          <div class="waiting-msg">Waiting for more players...</div>
        } @else {
          <div class="full-msg">Room is full!</div>
        }
      </div>

      <div class="rules-section">
        <h4>House Rules</h4>
        <div class="rules-list">
          <div class="rule">
            <span class="rule-name">Soplar Correspondiente:</span>
            <span class="rule-value">{{ room().houseRules.soplarCorrespondiente ? 'On' : 'Off' }}</span>
          </div>
          <div class="rule">
            <span class="rule-name">Patear Seguro Salida:</span>
            <span class="rule-value">{{ room().houseRules.patearSeguroSalida ? 'On' : 'Off' }}</span>
          </div>
          <div class="rule">
            <span class="rule-name">Exit Rule:</span>
            <span class="rule-value">{{ room().houseRules.exitRule }}</span>
          </div>
        </div>
      </div>

      <div class="wr-actions">
        @if (isHost()) {
          <button
            class="start-btn"
            [disabled]="room().players.length < 2"
            (click)="onStartGame()"
          >
            {{ room().players.length < 2 ? 'Need 2+ Players' : 'Start Game' }}
          </button>
        }
        <button class="leave-btn" (click)="onLeave()">Leave Room</button>
      </div>
    </div>
  `,
    styles: [`
    .waiting-room {
      max-width: 420px;
      margin: 0 auto;
      padding: 1.5rem;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 12px;
    }
    .wr-header {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .wr-header h2 { margin: 0 0 0.5rem; }
    .room-code-section {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .room-code-label { font-size: 0.85rem; color: #888; }
    .room-code {
      font-family: monospace;
      font-size: 1.4rem;
      font-weight: bold;
      letter-spacing: 3px;
      color: #2c3e50;
    }
    .copy-btn {
      padding: 2px 10px;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      font-size: 0.75rem;
    }
    .copy-btn:hover { background: #f0f0f0; }
    .players-section { margin-bottom: 1.5rem; }
    .players-section h3 { margin: 0 0 0.5rem; font-size: 1rem; }
    .players-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .player-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.5rem 0.75rem;
      background: white;
      border: 1px solid #e0e0e0;
      border-left: 4px solid #ccc;
      border-radius: 8px;
    }
    .player-color-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .player-name { flex: 1; font-weight: 500; }
    .host-badge {
      font-size: 0.65rem;
      background: #f39c12;
      color: white;
      padding: 1px 6px;
      border-radius: 8px;
      font-weight: 600;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ccc;
    }
    .status-dot.online { background: #2ecc71; }
    .kick-btn {
      border: 1px solid #e74c3c;
      background: white;
      color: #e74c3c;
      padding: 2px 8px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.7rem;
    }
    .kick-btn:hover { background: #fdf2f2; }
    .waiting-msg, .full-msg {
      text-align: center;
      padding: 0.5rem;
      font-style: italic;
      color: #888;
      font-size: 0.85rem;
    }
    .full-msg { color: #2ecc71; font-weight: 600; }
    .rules-section { margin-bottom: 1.5rem; }
    .rules-section h4 { margin: 0 0 0.5rem; font-size: 0.9rem; color: #555; }
    .rules-list { display: flex; flex-direction: column; gap: 0.3rem; }
    .rule {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
    }
    .rule-name { color: #666; }
    .rule-value { font-weight: 600; }
    .wr-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .start-btn {
      padding: 0.75rem;
      border: none;
      border-radius: 8px;
      background: #2ecc71;
      color: white;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
    }
    .start-btn:hover:not(:disabled) { background: #27ae60; }
    .start-btn:disabled { background: #bdc3c7; cursor: not-allowed; }
    .leave-btn {
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .leave-btn:hover { background: #f5f5f5; }
  `]
})
export class WaitingRoomComponent {
  room = input.required<Room>();
  isHost = input(false);
  currentUserId = input('');

  startGame = output<void>();
  leaveRoom = output<void>();
  kickPlayer = output<string>();

  protected readonly COLORS_MAP = COLORS_MAP;
  protected copied = false;

  copyCode(): void {
    navigator.clipboard.writeText(this.room().code).then(() => {
      this.copied = true;
      setTimeout(() => { this.copied = false; }, 2000);
    });
  }

  onStartGame(): void {
    if (this.room().players.length >= 2 && this.isHost()) {
      this.startGame.emit();
    }
  }

  onLeave(): void {
    this.leaveRoom.emit();
  }

  onKick(playerId: string): void {
    this.kickPlayer.emit(playerId);
  }
}
