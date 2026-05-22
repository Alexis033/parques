import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ENV = (globalThis as Record<string, any>)['__ENV__'] ?? {};

const supabaseUrl: string =
  ENV['NG_APP_SUPABASE_URL'] ?? '';

const supabaseAnonKey: string =
  ENV['NG_APP_SUPABASE_ANON_KEY'] ?? '';

function createSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase: SupabaseClient = createSupabaseClient();
