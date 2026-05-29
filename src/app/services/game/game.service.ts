import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from '../auth/auth.service';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { EngineState } from '@parchis/engine';
import type { PlayerColor } from '@parchis/shared';
import { buildGameChannelName, withRetry } from './game-utils';

export type GameActionType =
  | 'roll-dice'
  | 'exit-token'
  | 'move-token'
  | 'end-turn'
  | 'soplar';

export interface GameActionResult {
  state: EngineState;
  version: number;
  error?: string;
}

export interface GameInfo {
  id: string;
  roomId: string;
  state: EngineState;
  version: number;
}

interface GameRow {
  id: string;
  room_id: string;
  state: EngineState;
  version: number;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);

  private gameW = signal<GameInfo | null>(null);
  private loadingW = signal(false);
  private actionLoadingW = signal(false);
  private errorW = signal<string | null>(null);

  readonly game = this.gameW.asReadonly();
  readonly loading = this.loadingW.asReadonly();
  readonly actionLoading = this.actionLoadingW.asReadonly();
  readonly error = this.errorW.asReadonly();

  private gameChannel: ReturnType<SupabaseService['client']['channel']> | null = null;
  private gameDbChannel: ReturnType<SupabaseService['client']['channel']> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  get currentState(): EngineState | null {
    return this.gameW()?.state ?? null;
  }

  get currentVersion(): number {
    return this.gameW()?.version ?? 0;
  }

  get isMyTurn(): boolean {
    const state = this.currentState;
    const uid = this.auth.userId;
    if (!state || !uid) return false;
    const currentPlayer = state.players[state.currentPlayerIndex];
    return currentPlayer?.id === uid;
  }

  get myColor(): PlayerColor | null {
    const state = this.currentState;
    const uid = this.auth.userId;
    if (!state || !uid) return null;
    const me = state.players.find((p) => p.id === uid);
    return me?.color ?? null;
  }

  async startGame(roomId: string): Promise<GameInfo> {
    this.loadingW.set(true);
    this.errorW.set(null);
    try {
      const result = await this.callFunction<{ gameId: string; state: EngineState; version: number }>(
        'start-game', { roomId },
      );
      const info: GameInfo = { id: result.gameId, roomId, state: result.state, version: result.version };
      this.gameW.set(info);
      this.subscribeToRoom(roomId);
      return info;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start game';
      this.errorW.set(msg);
      throw err;
    } finally {
      this.loadingW.set(false);
    }
  }

  async loadGame(gameId: string): Promise<GameInfo> {
    this.loadingW.set(true);
    this.errorW.set(null);
    try {
      const { data, error } = await this.supabase.client
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();
      if (error) throw error;
      const game = data as unknown as GameRow;
      const info: GameInfo = { id: game.id, roomId: game.room_id, state: game.state, version: game.version };
      this.gameW.set(info);
      this.subscribeToRoom(game.room_id);
      return info;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load game';
      this.errorW.set(msg);
      throw err;
    } finally {
      this.loadingW.set(false);
    }
  }

  async findGameByRoomId(roomId: string): Promise<GameInfo | null> {
    const { data, error } = await this.supabase.client
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const game = data as unknown as GameRow;
    const info: GameInfo = { id: game.id, roomId: game.room_id, state: game.state, version: game.version };
    this.gameW.set(info);
    this.subscribeToRoom(game.room_id);
    return info;
  }

  async dispatchAction(type: GameActionType, params: Record<string, string | number> = {}): Promise<EngineState> {
    const game = this.gameW();
    if (!game) throw new Error('No active game');
    this.actionLoadingW.set(true);
    this.errorW.set(null);
    try {
      const result = await this.callFunction<{ state: EngineState; version: number }>(
        type,
        { gameId: game.id, ...params },
      );
      const updated: GameInfo = { ...game, state: result.state, version: result.version };
      this.gameW.set(updated);
      return result.state;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      this.errorW.set(msg);
      throw err;
    } finally {
      this.actionLoadingW.set(false);
    }
  }

  async roll(): Promise<EngineState> {
    return this.dispatchAction('roll-dice');
  }

  async exitToken(tokenId: string): Promise<EngineState> {
    return this.dispatchAction('exit-token', { tokenId });
  }

  async moveToken(tokenId: string, squares: number): Promise<EngineState> {
    return this.dispatchAction('move-token', { tokenId, squares });
  }

  async endTurn(): Promise<EngineState> {
    return this.dispatchAction('end-turn');
  }

  async soplar(targetTokenId: string): Promise<EngineState> {
    return this.dispatchAction('soplar', { targetTokenId });
  }

  /**
   * Request a rematch in the same room.
   * Creates a new game instance with fresh state, same players and room.
   */
  async rematch(roomId: string): Promise<GameInfo> {
    this.loadingW.set(true);
    this.errorW.set(null);
    try {
      const result = await this.callFunction<{ gameId: string; state: EngineState; version: number }>(
        'rematch', { roomId },
      );
      const info: GameInfo = { id: result.gameId, roomId, state: result.state, version: result.version };
      this.gameW.set(info);
      // Re-subscribe (will unsubscribe old channel first if any)
      this.subscribeToRoom(roomId);
      return info;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create rematch';
      this.errorW.set(msg);
      throw err;
    } finally {
      this.loadingW.set(false);
    }
  }

  startHeartbeat(roomId: string): void {
    if (this.heartbeatInterval) return;
    const playerId = this.auth.userId;
    if (!playerId) return;

    // Send heartbeat immediately, then every 30s
    this.callFunction('heartbeat', { roomId, playerId }).catch(() => {});
    this.heartbeatInterval = setInterval(() => {
      this.callFunction('heartbeat', { roomId, playerId }).catch(() => {});
    }, 30000);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async sendDisconnect(roomId: string): Promise<void> {
    const playerId = this.auth.userId;
    if (!playerId || !roomId) return;
    try {
      await this.callFunction('disconnect', { roomId, playerId });
    } catch {
      // Fire-and-forget — disconnect is best-effort
    }
  }

  subscribeToRoom(roomId: string): void {
    this.gameChannel?.unsubscribe();
    this.gameDbChannel?.unsubscribe();
    const channelName = buildGameChannelName(roomId);
    // Real-time via broadcast from Edge Function
    this.gameChannel = this.supabase.client
      .channel(channelName)
      .on('broadcast', { event: 'state_update' }, (payload) => {
        const { state, version } = payload as unknown as { state: EngineState; version: number };
        const current = this.gameW();
        if (current && version <= current.version) return; // Stale broadcast
        if (current) {
          this.gameW.set({ ...current, state, version });
        }
      })
      .subscribe();

    // Fallback: listen for DB changes on games table
    this.gameDbChannel = this.supabase.client
      .channel(`games-db:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `room_id=eq.${roomId}` },
        (payload: RealtimePostgresChangesPayload<{ state: EngineState; version: number }>) => {
          const gameData = payload.new as unknown as { id: string; state: EngineState; version: number } | null;
          if (!gameData?.state) return;
          const current = this.gameW();
          if (current && gameData.version <= current.version) return;
          if (current) {
            this.gameW.set({ ...current, state: gameData.state, version: gameData.version });
          }
        },
      )
      .subscribe();
  }

  leaveGame(): void {
    this.stopHeartbeat();
    this.gameChannel?.unsubscribe();
    this.gameChannel = null;
    this.gameDbChannel?.unsubscribe();
    this.gameDbChannel = null;
    this.gameW.set(null);
    this.errorW.set(null);
  }

  private async callFunction<T>(action: string, params: Record<string, unknown>): Promise<T> {
    return withRetry(async () => {
      const { data, error } = await this.supabase.client.functions.invoke('game', {
        body: { action, ...params },
      });
      // Check for HTTP-level errors (non-2xx status)
      if (error) {
        const errMsg = typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'Function call failed';
        throw new Error(errMsg);
      }
      // Check for application-level errors in response body
      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error((data as { error: string }).error);
      }
      return data as T;
    }, { maxAttempts: 5, baseDelayMs: 100 });
  }
}
