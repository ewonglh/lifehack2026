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

  async submitTask({ file, taskId, idempotencyKey, locale = 'en-SG', userSelectedBin }) {
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
    if (userSelectedBin) form.append('userSelectedBin', userSelectedBin);
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

  async leaveSquad(squadId) {
    return invoke('manage-squad', { action: 'leave', squadId });
  },

  async createInvite(squadId) {
    return invoke('manage-squad', { action: 'createInvite', squadId });
  },

  async getCurrentLeague() {
    const response = await invoke('manage-league', { action: 'current' });
    return response ?? { squadId: null, queue: null, league: null, progression: null };
  },

  async getCrewOverview() {
    if (!supabase) return { membership: null };
    const current = await this.getCurrentLeague();
    if (!current.squadId) return { membership: null };

    const [{ data: squad, error: squadError }, { data: members, error: membersError }] =
      await Promise.all([
        supabase
          .from('squads')
          .select('id, name, owner_id, timezone, min_daily_members')
          .eq('id', current.squadId)
          .single(),
        supabase
          .from('squad_members')
          .select('profile_id, role, joined_at, profiles(id, display_name)')
          .eq('squad_id', current.squadId)
          .eq('status', 'active')
          .order('joined_at'),
      ]);
    if (squadError) throw squadError;
    if (membersError) throw membersError;

    const { data: mission } = await supabase
      .from('squad_daily_missions')
      .select('progress, mission_catalog(title, target)')
      .eq('squad_id', current.squadId)
      .order('mission_day', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: events, error: eventsError } = await supabase
      .from('activity_events')
      .select(
        'id, actor_id, event_type, payload, created_at, profiles(display_name), activity_reactions(emoji)',
      )
      .eq('squad_id', current.squadId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (eventsError) throw eventsError;

    const actorId = (await supabase.auth.getUser()).data.user?.id;
    const normalizedMembers = (members ?? []).map((member) => ({
      id: member.profile_id,
      name: member.profiles?.display_name ?? 'EcoCrew member',
      initials: (member.profiles?.display_name ?? 'E').slice(0, 1).toUpperCase(),
      role: member.role,
      joinedAt: member.joined_at,
      tone: 'moss',
    }));
    return {
      membership: {
        crewId: squad.id,
        crewName: squad.name,
        role: squad.owner_id === actorId ? 'owner' : 'member',
        joinedAt: normalizedMembers.find((member) => member.id === actorId)?.joinedAt,
      },
      members: normalizedMembers,
      mission: {
        title: mission?.mission_catalog?.title ?? 'Weekly mission',
        progress: Number(mission?.progress ?? 0),
        target: Number(mission?.mission_catalog?.target ?? 100),
        endsLabel: 'This week',
      },
      streak: Number(current.squadStreak?.current_streak ?? 0),
      repairTokens: Number(current.squadStreak?.repair_tokens ?? 1),
      weeklyPoints: Number(current.league?.score ?? current.progression?.weekly_points ?? 0),
      requiredMembers: Number(current.crewStreak?.required_members ?? squad.min_daily_members ?? 1),
      completedMembers: Number(current.crewStreak?.completed_members ?? 0),
      activity: (events ?? []).map((event) => ({
        id: event.id,
        actor: event.profiles?.display_name ?? 'A teammate',
        action: event.payload?.message ?? event.event_type.replaceAll('_', ' '),
        time: new Date(event.created_at).toLocaleString(),
        reactions: (event.activity_reactions ?? []).length,
        emoji: event.event_type === 'streak' ? '🔥' : event.event_type === 'unlock' ? '🌿' : '♻️',
      })),
    };
  },

  async reactActivity(activityId, emoji = '👏') {
    return invoke('manage-activity', { action: 'react', activityId, emoji });
  },

  async getProfilePosts(userId) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('profile_posts')
      .select(
        'id, submission_id, visibility, image_visible, created_at, submissions(model_result, final_bin, matches_task, points)',
      )
      .eq('profile_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((post) => ({
      id: post.id,
      scanEventId: post.submission_id,
      itemName:
        post.submissions?.model_result?.itemName ??
        post.submissions?.model_result?.item_name ??
        'Eco action',
      finalBin: post.submissions?.final_bin ?? 'unknown',
      isCorrect: post.submissions?.matches_task ?? null,
      points: Number(post.submissions?.points ?? 0),
      createdAt: post.created_at,
      visibility: post.visibility,
      imageVisible: post.image_visible,
    }));
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
