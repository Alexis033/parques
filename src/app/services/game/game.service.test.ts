import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Hoisted: shared mocks before any imports
// ============================================================
const { diContainer, mockChannelFn, mockOn, mockSubscribe, mockUnsubscribe, mockSupabaseClient, mockFrom } = vi.hoisted(() => {
  const container = new Map<unknown, unknown>();
  const from = vi.fn();
  const unsubscribe = vi.fn();
  const on = vi.fn();
  const subscribe = vi.fn();

  // Channel factory: each channel object stores itself in gameChannel / gameDbChannel
  // via subscribe() returning the channel object (matching supabase-js behavior)
  const channel = vi.fn().mockImplementation(() => {
    const self = {
      on: vi.fn((...args: unknown[]) => {
        on(...args);
        return self;
      }),
      subscribe: vi.fn(() => {
        subscribe();
        return self;
      }),
      unsubscribe: vi.fn(() => {
        unsubscribe();
      }),
    };
    return self;
  });

  const supabaseClient = {
    channel,
    functions: { invoke: vi.fn() },
    from,
    auth: { signOut: vi.fn() },
  };

  return {
    diContainer: container,
    mockChannelFn: channel,
    mockOn: on,
    mockSubscribe: subscribe,
    mockUnsubscribe: unsubscribe,
    mockSupabaseClient: supabaseClient,
    mockFrom: from,
  };
});

// ============================================================
// Mock modules
// ============================================================
vi.mock('@parchis/supabase', () => {
  return { supabase: { channel: vi.fn() } };
});

vi.mock('@angular/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    inject: vi.fn((token: unknown) => {
      if (diContainer.has(token)) return diContainer.get(token);
      throw new Error(`No provider for ${String(token)}`);
    }),
    signal: actual.signal,
    Injectable: actual.Injectable,
    computed: actual.computed,
  };
});

// ============================================================
// Imports
// ============================================================
import { GameService } from './game.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from '../auth/auth.service';
import type { EngineState } from '@parchis/engine';

function createService(): GameService {
  diContainer.set(SupabaseService, { client: mockSupabaseClient });
  diContainer.set(AuthService, {
    userId: 'test-user',
    session: vi.fn(),
    isAuthenticated: true,
  });
  // @ts-expect-error — bypass Angular DI
  return new GameService();
}

// Helper: register channel callbacks and simulate a findGameByRoomId call
// to establish initial game state before testing callbacks.
function setupDbMock(roomId = 'room-1') {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: 'game-1',
        room_id: roomId,
        state: makeState(5),
        version: 5,
      },
      error: null,
    }),
  };

  mockFrom.mockImplementation(() => mockQuery);
  return mockQuery;
}

// Helper: create minimal engine state with version
function makeState(version: number, overrides: Partial<EngineState> = {}): EngineState {
  return {
    id: 'game-1',
    roomId: 'room-1',
    phase: 'PLAYING',
    players: [
      { id: 'p1', color: 'RED', name: 'Alice', isHost: true, isConnected: true },
      { id: 'p2', color: 'BLUE', name: 'Bob', isHost: false, isConnected: true },
    ],
    tokens: [],
    currentPlayerIndex: 0,
    turnOrder: ['RED', 'BLUE'],
    turnPhase: 'ROLL',
    round: 1,
    currentRoll: null,
    consecutivePairs: 0,
    extraTurnsRemaining: 0,
    isLastTokenMode: false,
    missedCaptures: [],
    rollAttempts: 0,
    actions: [],
    winner: null,
    houseRules: { soplarCorrespondiente: false, patearSeguroSalida: false, exitRule: 'ALL' },
    ...overrides,
  };
}

type BroadcastPayload = { state: EngineState; version: number };
type PgChangesPayload = { new: { id: string; state: EngineState; version: number }; old: unknown; eventType: string };

function getBroadcastCallback(): (payload: BroadcastPayload) => void {
  return mockOn.mock.calls.find(([type]: [string]) => type === 'broadcast')![2] as (payload: BroadcastPayload) => void;
}

function getPgCallback(): (payload: PgChangesPayload) => void {
  return mockOn.mock.calls.find(([type]: [string]) => type === 'postgres_changes')![2] as (payload: PgChangesPayload) => void;
}

describe('GameService', () => {
  let service: GameService;

  beforeEach(() => {
    vi.clearAllMocks();
    diContainer.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('2.1 — subscribeToRoom creates both channels', () => {
    it('should create broadcast channel and postgres_changes channel', () => {
      service = createService();
      service.subscribeToRoom('room-1');

      // Called channel() twice: broadcast + postgres_changes
      expect(mockChannelFn).toHaveBeenCalledTimes(2);
      expect(mockChannelFn).toHaveBeenCalledWith('game:room-1');
      expect(mockChannelFn).toHaveBeenCalledWith('games-db:room-1');

      // Broadcast listener with correct config
      const broadcastCall = mockOn.mock.calls.find(
        ([type]: [string]) => type === 'broadcast'
      );
      expect(broadcastCall).toBeTruthy();
      expect(broadcastCall![1]).toEqual({ event: 'state_update' });

      // postgres_changes listener with correct config
      const pgCall = mockOn.mock.calls.find(
        ([type]: [string]) => type === 'postgres_changes'
      );
      expect(pgCall).toBeTruthy();
      expect(pgCall![1]).toEqual({
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: 'room_id=eq.room-1',
      });

      // Both subscribed
      expect(mockSubscribe).toHaveBeenCalledTimes(2);
    });
  });

  describe('2.2 — version dedup: same version from both channels', () => {
    it('should apply broadcast v5, discard same-version postgres_changes v5', async () => {
      service = createService();

      // Set up DB to return existing game at version 5
      setupDbMock();
      const gameInfo = await service.findGameByRoomId('room-1');
      expect(gameInfo).not.toBeNull();
      expect(gameInfo!.version).toBe(5);

      // Get channel callbacks (registered by subscribeToRoom called inside findGameByRoomId)
      const broadcastCb = getBroadcastCallback();
      const pgCb = getPgCallback();

      // Fire broadcast v5 — same version as current, should be discarded
      broadcastCb({ state: makeState(5), version: 5 });
      let game = (service as any).gameW();
      expect(game.version).toBe(5);

      // Fire postgres_changes v5 — same version, should be discarded
      pgCb({
        new: { id: 'game-1', state: makeState(5), version: 5 },
        old: {},
        eventType: 'UPDATE',
      });
      game = (service as any).gameW();
      expect(game.version).toBe(5);
    });
  });

  describe('2.3 — postgres_changes v6 applied as fallback', () => {
    it('should apply state when postgres_changes delivers v6 (simulating broadcast failure)', async () => {
      service = createService();
      setupDbMock();
      await service.findGameByRoomId('room-1');

      const broadcastCb = getBroadcastCallback();
      const pgCb = getPgCallback();

      // Current is v5. Fire broadcast v5 (no change)
      broadcastCb({ state: makeState(5), version: 5 });

      // Now v6 arrives via postgres_changes (broadcast failed)
      pgCb({
        new: { id: 'game-1', state: makeState(6), version: 6 },
        old: {},
        eventType: 'UPDATE',
      });

      // gameW should be v6 now
      const game = (service as any).gameW();
      expect(game.version).toBe(6);
    });
  });

  describe('2.4 — stale v6 discarded after v7 applied', () => {
    it('should discard late v6 when v7 already applied', async () => {
      service = createService();
      setupDbMock();
      await service.findGameByRoomId('room-1');

      const broadcastCb = getBroadcastCallback();
      const pgCb = getPgCallback();

      // Apply v7 via broadcast
      broadcastCb({ state: makeState(7), version: 7 });

      // Late v6 arrives via postgres_changes
      pgCb({
        new: { id: 'game-1', state: makeState(6), version: 6 },
        old: {},
        eventType: 'UPDATE',
      });

      // Should stay at v7
      const game = (service as any).gameW();
      expect(game.version).toBe(7);
    });
  });

  describe('2.5 — leaveGame cleanup', () => {
    it('should unsubscribe both channels and clear state', async () => {
      service = createService();
      setupDbMock();
      await service.findGameByRoomId('room-1');

      // Both channels subscribed
      expect(mockSubscribe).toHaveBeenCalledTimes(2);
      expect(mockUnsubscribe).not.toHaveBeenCalled();

      // State is set
      expect((service as any).gameW()).not.toBeNull();

      // Act: leave game
      service.leaveGame();

      // Both channels unsubscribed + cleared
      expect(mockUnsubscribe).toHaveBeenCalledTimes(2);
      expect((service as any).gameW()).toBeNull();
    });
  });
});
