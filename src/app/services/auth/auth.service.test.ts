import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Hoisted: set up mock factories before any imports
// ============================================================
const { diContainer, mockGetSession, mockOnAuthStateChange, mockSignInAnonymously, mockFrom, mockSupabaseClient } = vi.hoisted(() => {
  const container = new Map<unknown, unknown>();

  const getSession = vi.fn();
  const onAuthStateChange = vi.fn();
  const signInAnonymously = vi.fn();
  const from = vi.fn();

  const supabaseClient = {
    auth: {
      getSession,
      onAuthStateChange,
      signInAnonymously,
      signOut: vi.fn(),
    },
    from,
    channel: vi.fn(),
    functions: { invoke: vi.fn() },
  };

  return {
    diContainer: container,
    mockGetSession: getSession,
    mockOnAuthStateChange: onAuthStateChange,
    mockSignInAnonymously: signInAnonymously,
    mockFrom: from,
    mockSupabaseClient: supabaseClient,
  };
});

// ============================================================
// Mock @parchis/supabase (hoisted)
// ============================================================
vi.mock('@parchis/supabase', () => {
  return { supabase: { channel: vi.fn() } };
});

// ============================================================
// Mock @angular/core — provide custom inject()
// ============================================================
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
import { AuthService } from './auth.service';
import { SupabaseService } from '../supabase/supabase.service';

function createService(): AuthService {
  diContainer.set(SupabaseService, { client: mockSupabaseClient });
  // @ts-expect-error — bypass Angular DI by calling constructor directly
  return new AuthService();
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    diContainer.clear();

    // Default mock behaviors
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockImplementation((_event: string, _callback: unknown) => {
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1.1 — initPromise blocks signInAnonymously', () => {
    it('should block signInAnonymously until getSession resolves', async () => {
      // Arrange: delay getSession to prove blocking behavior
      let resolveGetSession!: (value: unknown) => void;
      mockGetSession.mockReturnValue(new Promise((resolve) => {
        resolveGetSession = resolve;
      }));

      service = createService();

      // Act: start sign-in — should be blocked by initPromise
      const signInPromise = service.signInAnonymously();

      // Assert: blocked — no supabase sign-in call happened yet
      expect(mockSignInAnonymously).not.toHaveBeenCalled();

      // Set up sign-in mock so it resolves when called
      mockSignInAnonymously.mockResolvedValue({
        data: { session: { user: { id: 'test-user' } } },
        error: null,
      });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      // Resolve getSession (no session found)
      resolveGetSession({ data: { session: null }, error: null });

      await signInPromise;

      // After initPromise resolves, sign-in proceeds
      expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
    });
  });

  describe('1.2 — skip-if-authed guard', () => {
    it('should skip supabase signInAnonymously when session already exists', async () => {
      // Arrange: constructor finds existing session
      const existingSession = { user: { id: 'existing-user' }, access_token: 'abc' };
      mockGetSession.mockResolvedValue({ data: { session: existingSession }, error: null });

      service = createService();

      // Wait for initPromise to complete (microtask queue)
      await vi.waitFor(() => {
        expect(service.isAuthenticated).toBe(true);
      });

      mockSignInAnonymously.mockClear();

      // Act
      const result = await service.signInAnonymously();

      // Assert
      expect(mockSignInAnonymously).not.toHaveBeenCalled();
      expect(result).toBeTruthy();
      expect(result!.user.id).toBe('existing-user');
    });

    it('should proceed with signInAnonymously when no session exists', async () => {
      mockSignInAnonymously.mockResolvedValue({
        data: { session: { user: { id: 'new-user' } } },
        error: null,
      });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      service = createService();

      const result = await service.signInAnonymously();

      expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
      expect(result).toBeTruthy();
      expect(result!.user.id).toBe('new-user');
    });
  });

  describe('1.3 — concurrent guard', () => {
    it('should produce single signInAnonymously call for concurrent calls', async () => {
      mockSignInAnonymously.mockResolvedValue({
        data: { session: { user: { id: 'concurrent-user' } } },
        error: null,
      });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      service = createService();

      // Fire 3 concurrent calls
      const [r1, r2, r3] = await Promise.all([
        service.signInAnonymously(),
        service.signInAnonymously(),
        service.signInAnonymously(),
      ]);

      expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
      expect(r1).toBeTruthy();
      expect(r2).toBeTruthy();
      expect(r3).toBeTruthy();
    });
  });
});
