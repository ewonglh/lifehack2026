import { createClient } from '@supabase/supabase-js';
import { env, useMockData } from '../config/env.js';

export const supabase =
  !useMockData && env.supabaseUrl && env.supabaseAnonKey
    ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      })
    : null;
