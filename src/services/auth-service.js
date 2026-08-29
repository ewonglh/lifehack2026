import { supabase } from '../lib/supabase.js';
import { useMockData } from '../config/env.js';
import { getMockState, updateMockState } from './mock-store.js';

const mockUser = (email) => ({
  id: 'mock-user',
  email,
  user_metadata: { display_name: email.split('@')[0] },
});
const callbackUrl = () => `${window.location.origin}/?auth_callback=1#/auth/callback`;
const ensureBackend = () => {
  if (!supabase && !useMockData) {
    throw { code: 'configuration_error', message: 'Supabase authentication is not configured.' };
  }
};

export const authService = {
  async getSession() {
    ensureBackend();
    if (supabase) {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    }
    return getMockState().user ? { user: getMockState().user } : null;
  },
  onChange(callback) {
    if (supabase) return supabase.auth.onAuthStateChange((_event, session) => callback(session));
    return { data: { subscription: { unsubscribe() {} } } };
  },
  async signIn({ email, password }) {
    ensureBackend();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    }
    const user = mockUser(email);
    updateMockState((state) => ({ ...state, user }));
    return { user, mock: true };
  },
  async signUp({ email, password }) {
    ensureBackend();
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return data;
    }
    return this.signIn({ email, password });
  },
  async sendMagicLink(email) {
    ensureBackend();
    if (supabase) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl() },
      });
      if (error) throw error;
    }
    return { mock: !supabase };
  },
  async signInWithOAuth(provider) {
    ensureBackend();
    if (supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl() },
      });
      if (error) throw error;
      return;
    }
    return this.signIn({ email: `${provider}.demo@ecocrew.local`, password: 'mock' });
  },
  async signOut() {
    ensureBackend();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } else updateMockState((state) => ({ ...state, user: null, profile: null }));
  },
};
