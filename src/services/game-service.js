import { supabase } from '../lib/supabase.js';
import { useMockData } from '../config/env.js';
import { getMockState, updateMockState } from './mock-store.js';

let lastSubmission = null;

function ensureBackend() {
  if (!supabase && !useMockData)
    throw { code: 'configuration_error', message: 'Supabase is not configured.' };
}

async function invoke(name, body) {
  ensureBackend();
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data;
}

export const gameService = {
  async getDailyTask() {
    const response = await invoke('manage-mission', { action: 'getDaily' });
    if (response) return response.task;
    const state = getMockState();
    return state.dailyTask;
  },

  async submitTask({ file, taskId, idempotencyKey, locale = 'en-SG' }) {
    if (!supabase) {
      const state = getMockState();
      const result = {
        taskId,
        validated: true,
        points: 0,
        validationReason: 'Demo validation passed.',
        streak: { current: 1, longest: 1 },
      };
      updateMockState({ ...state, lastSubmission: result, dailyTask: state.dailyTask });
      lastSubmission = result;
      return result;
    }
    const form = new FormData();
    form.append('image', file);
    form.append('taskId', taskId);
    form.append('idempotencyKey', idempotencyKey);
    form.append('locale', locale);
    lastSubmission = await invoke('create-submission', form);
    return lastSubmission;
  },

  getLastSubmission() {
    return lastSubmission ?? getMockState().lastSubmission;
  },

  async createSquad(name, timezone) {
    const response = await invoke('manage-squad', { action: 'create', name, timezone });
    return response;
  },

  async joinSquad(inviteCode) {
    return invoke('manage-squad', { action: 'join', inviteCode });
  },

  async createInvite(squadId) {
    return invoke('manage-squad', { action: 'createInvite', squadId });
  },

  async getCurrentLeague() {
    const response = await invoke('manage-league', { action: 'current' });
    return response ?? { squadId: null, queue: null, league: null, progression: null };
  },

  async getLeagues() {
    const response = await invoke('manage-league', { action: 'list' });
    return response?.leagues ?? [];
  },

  async queueForLeague(squadId) {
    const response = await invoke('manage-league', { action: 'queue', squadId });
    return response ?? { status: 'queued' };
  },

  async cancelLeagueQueue(squadId) {
    return invoke('manage-league', { action: 'cancel', squadId });
  },

  async getCrewLeaderboard(squadId) {
    const response = await invoke('manage-league', { action: 'leaderboard', squadId });
    return response?.rows ?? [];
  },

  async getContactLeaderboard() {
    const response = await invoke('manage-league', { action: 'contacts' });
    return response?.rows ?? [];
  },

  async getCosmetics() {
    const response = await invoke('manage-cosmetics', { action: 'list' });
    return response?.cosmetics ?? [];
  },

  async equipCosmetic(cosmeticId) {
    return invoke('manage-cosmetics', { action: 'equip', cosmeticId });
  },

  async syncContacts(provider, accessToken) {
    return invoke('manage-contacts', { action: 'sync', provider, accessToken });
  },

  async startContactSync(provider) {
    const response = await invoke('manage-contacts', { action: 'authorize', provider });
    if (response?.authorizeUrl) window.location.assign(response.authorizeUrl);
    return response;
  },

  async disableContactSync(provider) {
    return invoke('manage-contacts', { action: 'disable', provider });
  },
};
