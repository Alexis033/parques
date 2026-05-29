import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-player-panel',
    imports: [],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div class="player-panel" [class.active]="isActive()" [class.me]="isMe()" [class.disconnected]="!isConnected()">
      <div class="pp-header">
        <span class="pp-color" [style.background]="colorHex()"></span>
        <span class="pp-name">{{ name() }}</span>
        @if (isMe()) {
          <span class="me-badge">You</span>
        }
        @if (isHost()) {
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

      @if (!isConnected()) {
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
  name = input.required<string>();
  colorHex = input.required<string>();
  isActive = input(false);
  isMe = input(false);
  isConnected = input(true);
  isHost = input(false);
  crownedCount = input(0);
  jailCount = input(0);
  activeCount = input(0);
}
