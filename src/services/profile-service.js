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
      if (data?.avatar_path) {
        const { data: signed, error: signedError } = await supabase.storage
          .from('avatars')
          .createSignedUrl(data.avatar_path, 3600);
        if (!signedError) data.avatar_url = signed.signedUrl;
      }
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
      handle: values.handle?.trim() || null,
      about: values.about?.trim() || '',
      location: values.location?.trim() || 'Singapore',
      timezone: values.timezone?.trim() || 'Asia/Singapore',
      age_visibility: values.ageVisibility || 'private',
      leaderboard_visible: values.leaderboardVisible !== false,
    };
    if (supabase) {
      const form = new FormData();
      form.append('displayName', profile.display_name);
      form.append('handle', profile.handle || '');
      form.append('about', profile.about);
      form.append('location', profile.location);
      form.append('timezone', profile.timezone);
      form.append('ageVisibility', profile.age_visibility);
      form.append('leaderboardVisible', String(profile.leaderboard_visible));
      if (values.avatarFile) form.append('avatar', values.avatarFile);
      const { data, error } = await supabase.functions.invoke('manage-profile', { body: form });
      if (error) throw error;
      return { ...data.profile, avatar_url: data.avatarUrl ?? undefined };
    }
    updateMockState((state) => ({ ...state, profile }));
    return profile;
  },
};
