export const environment = {
  production: true,
  supabaseUrl: (globalThis as any).__ENV__?.NG_APP_SUPABASE_URL || '',
  supabaseAnonKey: (globalThis as any).__ENV__?.NG_APP_SUPABASE_PUBLISHABLE_KEY || (globalThis as any).__ENV__?.NG_APP_SUPABASE_ANON_KEY || '',
  apiUrl: '/api',
};
