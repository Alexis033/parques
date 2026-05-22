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
    const { data, error } = await this.supabase.client.auth.signInAnonymously();
    if (error) {
      this.loadingW.set(false);
      throw error;
    }
    this.sessionW.set(data.session);
    if (data.session) {
      await this.ensureProfile(data.session.user.id);
    }
    this.loadingW.set(false);
    return data.session;
  }

  async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this.sessionW.set(null);
    this.profileW.set(null);
  }

  private async ensureProfile(userId: string): Promise<void> {
    const displayName = `Player_${userId.slice(0, 6)}`;
    const { error } = await this.supabase.client.from('profiles').upsert(
      { id: userId, display_name: displayName },
      { onConflict: 'id', ignoreDuplicates: false },
    );
    if (error) console.error('[AuthService] upsert profile failed', error);
    await this.loadProfile(userId);
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('id, display_name')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('[AuthService] load profile failed', error);
      return;
    }
    this.profileW.set(data);
  }
}
