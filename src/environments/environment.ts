export const environment = {
  production: false,
  supabaseUrl: (globalThis as any).__ENV__?.NG_APP_SUPABASE_URL || '',
  supabaseAnonKey: (globalThis as any).__ENV__?.NG_APP_SUPABASE_ANON_KEY || '',
  apiUrl: 'http://localhost:4200/api',
};
