import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from '../auth/auth.service';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { EngineState } from '@parchis/engine';
import type { PlayerColor } from '@parchis/shared';

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
      this.subscribeToGame(result.gameId);
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
      this.subscribeToGame(game.id);
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
    this.subscribeToGame(game.id);
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

  subscribeToGame(gameId: string): void {
    this.gameChannel?.unsubscribe();
    // Real-time via broadcast from Edge Function
    this.gameChannel = this.supabase.client
      .channel(`game:${gameId}`)
      .on('broadcast', { event: 'state_update' }, (payload) => {
        const { state, version } = payload as unknown as { state: EngineState; version: number };
        const current = this.gameW();
        if (current && version <= current.version) return; // Stale broadcast
        if (current) {
          this.gameW.set({ ...current, state, version });
        }
      })
      // Also listen for DB changes as fallback
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload: RealtimePostgresChangesPayload<GameRow>) => {
          if (!payload.new) return;
          const row = payload.new as unknown as GameRow;
          const current = this.gameW();
          if (current && row.version <= current.version) return;
          this.gameW.set({ id: row.id, roomId: row.room_id, state: row.state, version: row.version });
        },
      )
      .subscribe();
  }

  leaveGame(): void {
    this.gameChannel?.unsubscribe();
    this.gameChannel = null;
    this.gameW.set(null);
    this.errorW.set(null);
  }

  private async callFunction<T>(action: string, params: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase.client.functions.invoke('game', {
      body: { action, ...params },
    });
    if (error) throw new Error(error.message || 'Function call failed');
    if (data && typeof data === 'object' && 'error' in data) {
      throw new Error((data as { error: string }).error);
    }
    return data as T;
  }
}
