import { supabase } from '../lib/supabase.js';
import { useMockData } from '../config/env.js';
import { getMockState, updateMockState } from './mock-store.js';

export const profileService = {
  async get(userId) {
    if (!supabase && !useMockData) {
      throw { code: 'configuration_error', message: 'Supabase is not configured.' };
    }
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
    return getMockState().profile;
  },
  async save(userId, values) {
    if (!supabase && !useMockData) {
      throw { code: 'configuration_error', message: 'Supabase is not configured.' };
    }
    const profile = {
      id: userId,
      display_name: values.displayName.trim(),
      country: values.country.trim(),
      bio: values.bio?.trim() || '',
      is_public: Boolean(values.isPublic),
    };
    if (supabase) {
      const { data, error } = await supabase.from('profiles').upsert(profile).select().single();
      if (error) throw error;
      return data;
    }
    updateMockState((state) => ({ ...state, profile }));
    return profile;
  },
};
