const read = (key) => import.meta.env[key]?.trim() || '';

export const env = Object.freeze({
  supabaseUrl: read('VITE_SUPABASE_URL'),
  supabaseAnonKey: read('VITE_SUPABASE_ANON_KEY'),
});

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

export function validateEnvironment() {
  if (isSupabaseConfigured) return { valid: true, mode: 'supabase', missing: [] };

  return {
    valid: true,
    mode: 'mock',
    missing: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
  };
}
