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
  if (error) {
    let payload;
    try {
      payload = error.context?.clone ? await error.context.clone().json() : null;
    } catch {
      payload = null;
    }
    throw {
      code: payload?.code || error.code || 'FUNCTION_ERROR',
      message:
        payload?.message || error.message || 'The EcoCrew service is temporarily unavailable.',
      correlationId: payload?.correlationId,
      cause: error,
    };
  }
  return data;
}

export const gameService = {
  async getDailyTask() {
    const response = await invoke('manage-mission', { action: 'getDaily' });
    if (response) return response.task;
    const state = getMockState();
    return state.dailyTask;
  },

  async submitTask({
    file,
    taskId,
    idempotencyKey,
    locale = 'en-SG',
    userSelectedBin,
    demoFixture,
  }) {
    if (!supabase) {
      const state = getMockState();
      const result = state.lastSubmission || {
        taskId,
        validated: false,
        points: { total: 0 },
        validationReason: 'Choose a demo fixture before submitting.',
        failureReason: 'low_confidence',
        streak: { current: 0, longest: 0 },
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
    if (demoFixture) form.append('demoFixture', demoFixture);
    lastSubmission = await invoke('create-submission', form);
    return lastSubmission;
  },

  async confirmAction({ submissionId, idempotencyKey, action = 'recycle_bottle' }) {
    if (!supabase) {
      const state = getMockState();
      if (state.lastSubmission?.behaviorCheckIn?.status === 'confirmed')
        return state.lastSubmission;
      throw { code: 'SUBMISSION_NOT_FOUND', message: 'We could not find that action.' };
    }
    lastSubmission = await invoke('confirm-action', {
      submissionId,
      idempotencyKey,
      action,
    });
    return lastSubmission;
  },

  async getSubmission(submissionId = 'latest') {
    if (!supabase) return lastSubmission ?? getMockState().lastSubmission;
    const actor = (await supabase.auth.getUser()).data.user?.id;
    if (!actor) return null;
    let query = supabase
      .from('submissions')
      .select(
        'id, task_id, task_day, user_bin, final_bin, confidence, verification_status, behavior_status, behavior_confirmed_at, points, model_result, validation_reason, failure_reason, result_payload, submitted_at',
      )
      .eq('profile_id', actor);
    if (submissionId && submissionId !== 'latest') query = query.eq('id', submissionId);
    else query = query.order('submitted_at', { ascending: false }).limit(1);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const payload = data.result_payload || {
      submissionId: data.id,
      taskId: data.task_id,
      taskDay: data.task_day,
      userSelectedBin: data.user_bin,
      recommendedBin: data.final_bin,
      validated: data.verification_status === 'verified',
      points: { total: data.points || 0 },
      validationReason: data.validation_reason,
      failureReason: data.failure_reason,
      classification: data.model_result,
    };
    const task = await this.getDailyTask().catch(() => null);
    return {
      ...payload,
      submissionId: payload.submissionId || data.id,
      task: task?.taskId === data.task_id ? task : payload.task,
      outcome:
        payload.outcome ??
        (data.behavior_status === 'pending'
          ? 'awaiting_check_in'
          : data.behavior_status === 'confirmed' || data.verification_status === 'verified'
            ? 'completed'
            : data.verification_status === 'low_confidence'
              ? 'unknown'
              : 'failed'),
      behaviorCheckIn: payload.behaviorCheckIn ?? {
        action: 'recycle_bottle',
        status: data.behavior_status || 'not_started',
        selfReported: data.behavior_status === 'confirmed',
        confirmedAt: data.behavior_confirmed_at || null,
      },
    };
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

  async getMeasurement() {
    const response = await invoke('manage-mission', { action: 'getMeasurement' });
    return response?.summary || null;
  },

  async getProfileStats() {
    if (!supabase) {
      const state = getMockState();
      return {
        lifetimePoints: state.lifetimePoints || 0,
        currentStreak: state.personalStreak?.current || 0,
        bestStreak: state.personalStreak?.longest || state.bestStreak || 0,
      };
    }
    const actor = (await supabase.auth.getUser()).data.user?.id;
    if (!actor) return { lifetimePoints: 0, currentStreak: 0, bestStreak: 0 };
    const [{ data: progress, error: progressError }, { data: streak, error: streakError }] =
      await Promise.all([
        supabase
          .from('profile_progress')
          .select('lifetime_xp')
          .eq('profile_id', actor)
          .maybeSingle(),
        supabase
          .from('user_streaks')
          .select('current_streak, longest_streak')
          .eq('profile_id', actor)
          .maybeSingle(),
      ]);
    if (progressError) throw progressError;
    if (streakError) throw streakError;
    return {
      lifetimePoints: Number(progress?.lifetime_xp || 0),
      currentStreak: Number(streak?.current_streak || 0),
      bestStreak: Number(streak?.longest_streak || 0),
    };
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

    let mission = null;
    let missionUnavailable;
    try {
      const response = await invoke('manage-mission', {
        action: 'getCrew',
        squadId: current.squadId,
      });
      mission = response?.mission ?? null;
      missionUnavailable = !mission;
    } catch (exception) {
      if (String(exception?.code || '').toUpperCase() !== 'MISSION_UNAVAILABLE') throw exception;
      missionUnavailable = true;
    }
    const { data: events, error: eventsError } = await supabase
      .from('activity_events')
      .select(
        'id, actor_id, event_type, payload, created_at, profiles!activity_events_actor_id_fkey(display_name), activity_reactions(emoji)',
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
      mission: missionUnavailable
        ? {
            title: 'Weekly mission unavailable',
            progress: 0,
            target: 1,
            endsLabel: 'Needs setup',
            unavailable: true,
          }
        : {
            title: mission.title ?? 'Weekly mission',
            theme: mission.theme ?? null,
            progress: Number(mission.progress ?? 0),
            target: Number(mission.target ?? 100),
            missionDay: mission.mission_day ?? null,
            endsLabel: 'This week',
          },
      missionUnavailable,
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
        'Daily task',
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
