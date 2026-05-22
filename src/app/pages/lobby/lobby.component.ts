import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth/auth.service';
import { RoomService } from '../../services/room/room.service';
import { GameService } from '../../services/game/game.service';
import type { Room, HouseRules } from '@parchis/shared';
import { DEFAULT_HOUSE_RULES } from '@parchis/shared';

@Component({
    selector: 'app-lobby',
    imports: [NgIf, NgFor, AsyncPipe, FormsModule],
    template: `
    <div class="lobby">
      <h2>Lobby</h2>

      @if (!auth.isAuthenticated) {
        <div class="auth-prompt">
          <div class="auth-card">
            <h3>Welcome to Parchis Online</h3>
            <p>Play the classic Colombian board game with friends online.</p>
            <button (click)="login()" [disabled]="auth.loading()" class="play-btn">
              {{ auth.loading() ? 'Connecting...' : 'Play Anonymously' }}
            </button>
          </div>
        </div>
      }

      @if (auth.isAuthenticated) {
        <div class="profile-bar">
          Logged in as: <strong>{{ auth.profile()?.display_name ?? 'Unknown' }}</strong>
          <button (click)="logout()" class="logout-btn">Logout</button>
        </div>

        <div class="lobby-content">
          <div class="create-section">
            <h3>Create Room</h3>
            <div class="create-form">
              <label class="field">
                <span>Room Name (optional)</span>
                <input [(ngModel)]="roomName" placeholder="My Room" maxlength="40" />
              </label>

              <div class="toggles">
                <label class="toggle">
                  <input type="checkbox" [(ngModel)]="rules.soplarCorrespondiente" />
                  <span>Soplar Correspondiente</span>
                </label>
                <label class="toggle">
                  <input type="checkbox" [(ngModel)]="rules.patearSeguroSalida" />
                  <span>Patear Seguro Salida</span>
                </label>
              </div>

              <label class="field">
                <span>Exit Rule</span>
                <select [(ngModel)]="rules.exitRule">
                  <option value="ALL">All tokens can exit</option>
                  <option value="TWO">Need 2 tokens in jail</option>
                  <option value="CONDITIONAL">Only on 1 or 6</option>
                </select>
              </label>

              <button
                (click)="createRoom()"
                [disabled]="roomService.loading()"
                class="create-btn"
              >
                {{ roomService.loading() ? 'Creating...' : 'Create Room' }}
              </button>
            </div>
          </div>

          <div class="rooms-section">
            <h3>Available Rooms</h3>

            @if (roomService.rooms().length === 0 && !roomService.loading()) {
              <div class="empty-state">
                <p>No rooms available.</p>
                <p class="hint">Create one above or ask a friend for their room code!</p>
              </div>
            }

            @if (roomService.loading()) {
              <div class="loading-skeleton">
                @for (_ of [1,2,3]; track _) {
                  <div class="skeleton-card">
                    <div class="skeleton-line w-40"></div>
                    <div class="skeleton-line w-20"></div>
                    <div class="skeleton-line w-60"></div>
                  </div>
                }
              </div>
            }

            @if (error()) {
              <div class="error-state">
                <p>{{ error() }}</p>
                <button (click)="retry()" class="retry-btn">Retry</button>
              </div>
            }

            <div class="room-list">
              @for (room of roomService.rooms(); track room.id) {
                <div class="room-card">
                  <div class="room-info">
                    <span class="room-code">{{ room.code }}</span>
                    <div class="room-detail">
                      <span class="room-players">{{ room.players.length }}/{{ room.maxPlayers }}</span>
                      <span class="room-status" [class]="room.status.toLowerCase()">{{ room.status }}</span>
                    </div>
                    <div class="room-players-preview">
                      @for (p of room.players; track p.id) {
                        <span
                          class="player-mini-dot"
                          [style.background]="colorFromName(p.color)"
                          [title]="p.name"
                        ></span>
                      }
                    </div>
                  </div>
                  <button
                    class="join-btn"
                    (click)="joinRoom(room.id)"
                    [disabled]="gameService.loading() || room.players.length >= room.maxPlayers"
                  >
                    {{ room.players.length >= room.maxPlayers ? 'Full' : 'Join' }}
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
    styles: [`
    .lobby { padding: 1rem; max-width: 800px; margin: 0 auto; }
    .auth-prompt { display: flex; justify-content: center; padding: 2rem; }
    .auth-card {
      text-align: center;
      max-width: 360px;
      padding: 2rem;
      border: 1px solid #dee2e6;
      border-radius: 12px;
      background: #f8f9fa;
    }
    .auth-card h3 { margin: 0 0 0.5rem; }
    .auth-card p { color: #666; font-size: 0.9rem; margin: 0 0 1rem; }
    .play-btn {
      padding: 0.75rem 2rem;
      border: none;
      border-radius: 8px;
      background: #3498db;
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    .play-btn:hover { background: #2980b9; }
    .play-btn:disabled { background: #bdc3c7; cursor: not-allowed; }
    .profile-bar {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.5rem 0;
      margin-bottom: 1rem;
      border-bottom: 1px solid #eee;
    }
    .logout-btn {
      padding: 0.25rem 0.75rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      font-size: 0.8rem;
    }
    .logout-btn:hover { background: #f5f5f5; }
    .lobby-content { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    @media (max-width: 640px) {
      .lobby-content { grid-template-columns: 1fr; }
    }
    .create-section {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 12px;
      padding: 1rem;
    }
    .create-section h3 { margin: 0 0 1rem; }
    .create-form { display: flex; flex-direction: column; gap: 0.75rem; }
    .field { display: flex; flex-direction: column; gap: 0.25rem; }
    .field span { font-size: 0.8rem; color: #555; }
    .field input, .field select {
      padding: 0.4rem 0.6rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 0.9rem;
    }
    .toggles { display: flex; flex-direction: column; gap: 0.3rem; }
    .toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .create-btn {
      padding: 0.6rem;
      border: none;
      border-radius: 8px;
      background: #2ecc71;
      color: white;
      font-weight: 600;
      cursor: pointer;
    }
    .create-btn:hover:not(:disabled) { background: #27ae60; }
    .create-btn:disabled { background: #bdc3c7; cursor: not-allowed; }
    .rooms-section h3 { margin: 0 0 0.75rem; }
    .empty-state { text-align: center; padding: 2rem 1rem; color: #888; }
    .empty-state p { margin: 0; }
    .empty-state .hint { font-size: 0.8rem; margin-top: 0.25rem; }
    .loading-skeleton { display: flex; flex-direction: column; gap: 0.5rem; }
    .skeleton-card {
      padding: 0.75rem;
      border: 1px solid #eee;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .skeleton-line {
      height: 12px;
      background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }
    .skeleton-line.w-40 { width: 40%; }
    .skeleton-line.w-20 { width: 20%; }
    .skeleton-line.w-60 { width: 60%; }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .error-state {
      text-align: center;
      padding: 1rem;
      color: #e74c3c;
    }
    .retry-btn {
      margin-top: 0.5rem;
      padding: 0.3rem 1rem;
      border: 1px solid #e74c3c;
      border-radius: 6px;
      background: white;
      color: #e74c3c;
      cursor: pointer;
    }
    .retry-btn:hover { background: #fdf2f2; }
    .room-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .room-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.75rem;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: white;
      transition: border-color 0.15s;
    }
    .room-card:hover { border-color: #bbb; }
    .room-info { display: flex; flex-direction: column; gap: 0.2rem; }
    .room-code { font-weight: bold; font-family: monospace; font-size: 1.1rem; }
    .room-detail { display: flex; gap: 0.75rem; }
    .room-players { color: #555; font-size: 0.8rem; }
    .room-status {
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 8px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .room-status.waiting { background: #fef9e7; color: #f39c12; }
    .room-status.playing { background: #eafaf1; color: #27ae60; }
    .room-players-preview { display: flex; gap: 3px; }
    .player-mini-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .join-btn {
      padding: 0.3rem 0.75rem;
      border: none;
      border-radius: 6px;
      background: #3498db;
      color: white;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .join-btn:hover:not(:disabled) { background: #2980b9; }
    .join-btn:disabled { background: #bdc3c7; cursor: not-allowed; }
  `]
})
export class LobbyComponent implements OnInit, OnDestroy {
  protected auth = inject(AuthService);
  protected roomService = inject(RoomService);
  protected gameService = inject(GameService);
  private router = inject(Router);

  protected roomName = signal('');
  protected rules: HouseRules = { ...DEFAULT_HOUSE_RULES };
  protected error = signal<string | null>(null);

  private unsubRooms: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    if (this.auth.isAuthenticated) {
      await this.loadRooms();
    }
    this.unsubRooms = this.roomService.subscribeToRoomsList(() => {});
  }

  async login(): Promise<void> {
    try {
      this.error.set(null);
      await this.auth.signInAnonymously();
      await this.loadRooms();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Login failed');
    }
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    this.error.set(null);
  }

  private async loadRooms(): Promise<void> {
    try {
      this.error.set(null);
      await this.roomService.listRooms();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load rooms');
    }
  }

  async retry(): Promise<void> {
    await this.loadRooms();
  }

  async createRoom(): Promise<void> {
    try {
      this.error.set(null);
      const room = await this.roomService.createRoom(this.rules);
      await this.router.navigate(['/game', room.id]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to create room');
    }
  }

  async joinRoom(roomId: string): Promise<void> {
    try {
      this.error.set(null);
      const room = await this.roomService.joinRoom(roomId);
      await this.router.navigate(['/game', room.id]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to join room');
    }
  }

  protected colorFromName(color: string): string {
    const map: Record<string, string> = {
      RED: '#e74c3c', BLUE: '#3498db',
      GREEN: '#2ecc71', YELLOW: '#f1c40f',
    };
    return map[color] ?? '#888';
  }

  ngOnDestroy(): void {
    this.unsubRooms?.();
  }
}
