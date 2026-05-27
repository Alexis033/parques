import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import type { Session, User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  display_name: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService);
  private sessionW = signal<Session | null>(null);
  private profileW = signal<Profile | null>(null);
  private loadingW = signal(false);

  readonly session = this.sessionW.asReadonly();
  readonly profile = this.profileW.asReadonly();
  readonly loading = this.loadingW.asReadonly();

  constructor() {
    this.supabase.client.auth.getSession().then(({ data }) => {
      const s = data.session;
      this.sessionW.set(s);
      if (s) this.loadProfile(s.user.id);
    });

    this.supabase.client.auth.onAuthStateChange((event, session) => {
      this.sessionW.set(session);
      if (event === 'SIGNED_IN' && session) {
        this.loadProfile(session.user.id);
      }
      if (event === 'SIGNED_OUT') {
        this.profileW.set(null);
      }
    });
  }

  get user(): User | null {
    return this.sessionW()?.user ?? null;
  }

  get userId(): string | null {
    return this.user?.id ?? null;
  }

  get isAuthenticated(): boolean {
    return this.sessionW() !== null;
  }

  async signInAnonymously(): Promise<Session | null> {
    this.loadingW.set(true);
    try {
      const { data, error } = await this.supabase.client.auth.signInAnonymously();
      if (error) throw error;
      this.sessionW.set(data.session);
      if (data.session) {
        // Profile is auto-created by DB trigger (000004_profile_trigger.sql)
        // Load it here, don't insert manually
        await this.loadProfile(data.session.user.id);
      }
      return data.session;
    } catch (e) {
      console.error('[AuthService] signInAnonymously failed', e);
      throw e;
    } finally {
      this.loadingW.set(false);
    }
  }

  async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this.sessionW.set(null);
    this.profileW.set(null);
  }

  private async ensureProfile(userId: string): Promise<void> {
    const displayName = `Player_${userId.slice(0, 6)}`;
    // Check if profile already exists
    const { data: existing } = await this.supabase.client
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (existing) return;
    // Insert profile — upsert can be tricky with RLS, use simple insert
    const { error } = await this.supabase.client
      .from('profiles')
      .insert({ id: userId, display_name: displayName });
    if (error) {
      console.error('[AuthService] insert profile failed', error);
      // If it already existed (race), load and continue
      if (error.code === '23505') {
        await this.loadProfile(userId);
        return;
      }
      throw error;
    }
    await this.loadProfile(userId);
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('id, display_name')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('[AuthService] load profile failed', error);
      return;
    }
    if (data) {
      this.profileW.set(data);
      return;
    }
    // Profile doesn't exist (TTL cleanup or trigger missed).
    // Auto-create it so FK constraints (rooms.host_id) still work.
    const displayName = `Player_${userId.slice(0, 6)}`;
    const { error: insertError } = await this.supabase.client
      .from('profiles')
      .insert({ id: userId, display_name: displayName });
    if (insertError) {
      console.error('[AuthService] insert profile fallback failed', insertError);
      return;
    }
    this.profileW.set({ id: userId, display_name: displayName });
  }
}
