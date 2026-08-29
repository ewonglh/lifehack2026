const read = (key) => import.meta.env[key]?.trim() || '';

const hasSupabaseCredentials = (values) => Boolean(values.supabaseUrl && values.supabaseAnonKey);

export function resolveEnvironmentMode({ isDevelopment, useMockFlag, hasCredentials }) {
  if (isDevelopment && (useMockFlag || !hasCredentials)) return 'mock';
  if (hasCredentials) return 'supabase';
  return 'invalid';
}

export const env = Object.freeze({
  supabaseUrl: read('VITE_SUPABASE_URL'),
  supabaseAnonKey: read('VITE_SUPABASE_ANON_KEY'),
  useMockFlag: read('VITE_USE_MOCK_DATA').toLowerCase() === 'true',
});

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const environmentMode = resolveEnvironmentMode({
  isDevelopment: import.meta.env.DEV,
  useMockFlag: env.useMockFlag,
  hasCredentials: hasSupabaseCredentials(env),
});
export const useMockData = environmentMode === 'mock';

export function validateEnvironment() {
  if (environmentMode === 'supabase') return { valid: true, mode: 'supabase', missing: [] };
  if (environmentMode === 'mock') return { valid: true, mode: 'mock', missing: [] };

  return {
    valid: false,
    mode: 'invalid',
    missing: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
  };
}
