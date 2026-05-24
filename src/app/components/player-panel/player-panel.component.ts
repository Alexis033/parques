import { Component, input, computed } from '@angular/core';
import type { Player, PlayerColor } from '@parchis/shared';
import type { EngineToken } from '@parchis/engine';

const COLOR_VALUES: Record<PlayerColor, string> = {
  RED: '#e74c3c',
  BLUE: '#3498db',
  GREEN: '#2ecc71',
  YELLOW: '#f1c40f',
};

@Component({
    selector: 'app-player-panel',
    imports: [],
    template: `
    <div class="player-panel" [class.active]="isActive()" [class.me]="isMe()" [class.disconnected]="!player().isConnected">
      <div class="pp-header">
        <span class="pp-color" [style.background]="colorHex()"></span>
        <span class="pp-name">{{ player().name }}</span>
        @if (isMe()) {
          <span class="me-badge">You</span>
        }
        @if (player().isHost) {
          <span class="host-badge">Host</span>
        }
      </div>

      <div class="pp-stats">
        <div class="stat">
          <span class="stat-label">Crowned</span>
          <span class="stat-value">{{ crownedCount() }}/4</span>
        </div>
        <div class="stat">
          <span class="stat-label">Jail</span>
          <span class="stat-value">{{ jailCount() }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Active</span>
          <span class="stat-value">{{ activeCount() }}</span>
        </div>
      </div>

      @if (!player().isConnected) {
        <div class="disconnected">Disconnected</div>
      }
    </div>
  `,
    styles: [`
    .player-panel {
      padding: 0.5rem 0.75rem;
      background: #f8f9fa;
      border: 2px solid transparent;
      border-radius: 8px;
      margin-bottom: 0.4rem;
      transition: all 0.2s;
    }
    .player-panel.active {
      border-color: #2ecc71;
      background: #eafaf1;
    }
    .player-panel.me {
      background: #f0f7ff;
    }
    .player-panel.disconnected {
      opacity: 0.5;
      filter: grayscale(80%);
    }
    .pp-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.4rem;
    }
    .pp-color {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .pp-name {
      font-weight: 600;
      font-size: 0.85rem;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .me-badge {
      font-size: 0.6rem;
      background: #3498db;
      color: white;
      padding: 1px 5px;
      border-radius: 6px;
    }
    .host-badge {
      font-size: 0.6rem;
      background: #f39c12;
      color: white;
      padding: 1px 5px;
      border-radius: 6px;
    }
    .pp-stats {
      display: flex;
      gap: 0.75rem;
    }
    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .stat-label {
      font-size: 0.6rem;
      color: #888;
      text-transform: uppercase;
    }
    .stat-value {
      font-size: 0.85rem;
      font-weight: 700;
    }
    .disconnected {
      font-size: 0.7rem;
      color: #e74c3c;
      font-style: italic;
      margin-top: 0.25rem;
    }
  `]
})
export class PlayerPanelComponent {
  player = input.required<Player>();
  tokens = input<EngineToken[]>([]);
  isActive = input(false);
  isMe = input(false);

  protected colorHex = computed(() => COLOR_VALUES[this.player().color]);

  protected playerTokens = computed(() =>
    this.tokens().filter(t => t.color === this.player().color)
  );

  protected crownedCount = computed(() =>
    this.playerTokens().filter(t => t.state === 'CROWNED').length
  );

  protected jailCount = computed(() =>
    this.playerTokens().filter(t => t.state === 'JAIL').length
  );

  protected activeCount = computed(() =>
    this.playerTokens().filter(t => t.state === 'IN_TRANSIT' || t.state === 'IN_SKY').length
  );
}
