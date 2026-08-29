import { useMockData } from '../config/env.js';
import { supabase } from '../lib/supabase.js';
import { getMockState } from './mock-store.js';
import { gameService } from './game-service.js';
import { profileService } from './profile-service.js';
import {
  createDemoCrew,
  createDemoInvite,
  cancelDemoLeagueQueue,
  equipDemoCosmetic,
  getCrewMembership,
  getDemoCosmetics,
  getDemoCrewOverview,
  getDemoLeagueOverview,
  getDemoPosts,
  getDemoProfile,
  getDailyTask,
  getLastResult,
  joinDemoCrew,
  leaveDemoCrew,
  queueDemoLeague,
  addReaction,
  submitDemoTask,
  confirmDemoAction,
  updateDemoProfile,
  getDemoState,
} from '../features/ecocrew/scan-service.js';

function normalizeProfile(value = {}) {
  value = value || {};
  return {
    id: value.id || 'mock-user',
    displayName: value.displayName ?? value.display_name ?? '',
    handle: value.handle ?? '',
    age: value.age ?? null,
    about: value.about ?? '',
    location: value.location ?? 'Singapore',
    timezone: value.timezone ?? 'Asia/Singapore',
    avatarId: value.avatarId ?? value.avatar_id ?? null,
    frameId: value.frameId ?? value.frame_id ?? null,
    ageVisibility: value.ageVisibility ?? value.age_visibility ?? 'private',
    leaderboardVisible: value.leaderboardVisible ?? value.leaderboard_visible ?? true,
    joinedLabel: value.joinedLabel ?? 'EcoCrew member',
  };
}

function normalizeClassification(value = {}) {
  value = value || {};
  return {
    itemName: value.itemName ?? value.item_name ?? 'Unknown item',
    material: value.material ?? null,
    recommendedBin: value.recommendedBin ?? value.final_bin ?? 'unknown',
    preparationTip: value.preparationTip ?? value.preparation_tip ?? null,
    confidence: Number(value.confidence ?? 0),
    localeRuleVersion: value.localeRuleVersion ?? value.locale_rule_version ?? 'sg-demo-v1',
    explanation: value.explanation ?? value.reason ?? null,
    taskPrompt: value.taskPrompt ?? value.task_prompt ?? '',
    promptSimilarity:
      value.promptSimilarity === undefined && value.prompt_similarity === undefined
        ? 0
        : Number(value.promptSimilarity ?? value.prompt_similarity),
    taskSatisfied: Boolean(
      value.taskSatisfied ?? value.task_satisfied ?? value.matchesTask ?? false,
    ),
    failureReason:
      (value.failureReason ?? value.failure_reason ?? null) === 'wrong_bin'
        ? 'recycling_context_missing'
        : (value.failureReason ?? value.failure_reason ?? null),
    matchesTask: Boolean(value.matchesTask ?? false),
    taskConfidence: Number(value.taskConfidence ?? 0),
    taskReason: value.taskReason ?? null,
  };
}

function normalizeBehaviorCheckIn(value = {}) {
  value = value || {};
  return {
    action: value.action ?? 'recycle_bottle',
    status: value.status ?? value.behavior_status ?? 'not_started',
    selfReported: Boolean(value.selfReported ?? value.self_reported ?? false),
    confirmedAt: value.confirmedAt ?? value.confirmed_at ?? null,
  };
}

function normalizeSubmission(value = {}) {
  const classification = normalizeClassification(value.classification ?? value);
  const awarded = Array.isArray(value.awarded) ? value.awarded : [];
  const totalPoints =
    value.points && typeof value.points === 'object'
      ? Number(value.points.total ?? 0)
      : Number(value.points ?? awarded.reduce((sum, item) => sum + Number(item.points || 0), 0));
  const behaviorCheckIn = normalizeBehaviorCheckIn(value.behaviorCheckIn ?? value);
  const isCorrect = value.post?.isCorrect ?? value.validated === true;
  const failureReason =
    value.failureReason ?? value.failure_reason ?? classification.failureReason ?? null;
  return {
    ...value,
    scanEventId: value.scanEventId ?? value.submissionId ?? value.id,
    submissionId: value.submissionId ?? value.scanEventId ?? value.id,
    classification,
    itemName: classification.itemName,
    material: classification.material,
    recommendedBin: classification.recommendedBin,
    preparationTip: classification.preparationTip,
    confidence: classification.confidence,
    reason: classification.explanation,
    failureReason: failureReason === 'wrong_bin' ? 'recycling_context_missing' : failureReason,
    isCorrect,
    outcome:
      value.outcome ??
      (behaviorCheckIn.status === 'pending'
        ? 'awaiting_check_in'
        : behaviorCheckIn.status === 'confirmed' || value.validated
          ? 'completed'
          : 'failed'),
    behaviorCheckIn,
    awarded,
    points:
      value.points && typeof value.points === 'object'
        ? value.points
        : {
            total: totalPoints,
            actionCompletion: isCorrect ? totalPoints : 0,
            preparation: 0,
            dailyBonus: 0,
          },
    crewUpdate: value.crewUpdate,
    post: value.post,
    task: value.task,
  };
}

function normalizeMembership(value) {
  if (!value) return null;
  return {
    crewId: value.crewId ?? value.squadId ?? value.squad_id,
    crewName: value.crewName ?? value.name ?? value.squadName ?? 'EcoCrew',
    role: value.role === 'owner' ? 'owner' : 'member',
    joinedAt: value.joinedAt ?? value.joined_at ?? new Date().toISOString(),
    inviteCode: value.inviteCode,
  };
}

function mockProfile() {
  const stored = getMockState().profile;
  return normalizeProfile(stored || getDemoProfile());
}

export const ecoCrewService = {
  async getProfile(userId) {
    if (useMockData) return mockProfile();
    return normalizeProfile(await profileService.get(userId));
  },

  async saveProfile(userId, values) {
    if (useMockData) {
      const profileValue = await profileService.save(userId, values);
      updateDemoProfile({
        displayName: values.displayName,
        handle: values.handle,
        about: values.about,
        location: values.location,
      });
      return normalizeProfile(profileValue);
    }
    return normalizeProfile(await profileService.save(userId, values));
  },

  async getDailyTask() {
    if (useMockData) return getDailyTask();
    return gameService.getDailyTask();
  },

  async submitTask(values) {
    const result = useMockData
      ? await submitDemoTask(values)
      : await gameService.submitTask(values);
    return normalizeSubmission(result);
  },

  async confirmAction(values) {
    const result = useMockData
      ? confirmDemoAction(values?.submissionId || 'latest')
      : await gameService.confirmAction(values);
    return normalizeSubmission(result);
  },

  async getLastResult(submissionId = 'latest') {
    const result = useMockData ? getLastResult() : await gameService.getSubmission(submissionId);
    return result ? normalizeSubmission(result) : null;
  },

  async getDashboardData() {
    if (useMockData) {
      const state = getDemoState();
      const task = getDailyTask();
      return {
        task,
        crew: getDemoCrewOverview(),
        league: getDemoLeagueOverview(),
        dailyPoints: state.dailyPoints,
        lifetimePoints: state.lifetimePoints,
        weeklyPoints: state.crewMembership ? state.weeklyPoints : null,
        todayActionStatus: state.pendingSubmissionId
          ? 'pending'
          : state.submittedTaskDay === task.taskDay
            ? 'completed'
            : 'available',
        todaySubmitted: state.submittedTaskDay === task.taskDay,
        todaySubmissionId:
          state.pendingSubmissionId ||
          (state.submittedTaskDay === task.taskDay
            ? state.lastResult?.submissionId || state.lastResult?.scanEventId || null
            : null),
      };
    }
    const [task, crew, league, actor] = await Promise.all([
      gameService.getDailyTask(),
      gameService.getCrewOverview(),
      gameService.getCurrentLeague(),
      supabase.auth.getUser(),
    ]);
    const userId = actor.data.user?.id;
    const [
      { data: submissionRows, error: submissionError },
      { data: profileProgress, error: progressError },
    ] = await Promise.all([
      supabase
        .from('submissions')
        .select(
          'id, task_day, verification_status, behavior_status, behavior_confirmed_at, points, submitted_at',
        )
        .eq('profile_id', userId)
        .eq('task_day', task.taskDay)
        .order('submitted_at', { ascending: false }),
      supabase
        .from('profile_progress')
        .select('lifetime_xp')
        .eq('profile_id', userId)
        .maybeSingle(),
    ]);
    if (submissionError) throw submissionError;
    if (progressError) throw progressError;
    const submissions = submissionRows || [];
    const verified = submissions.find(
      (submission) => submission.verification_status === 'verified',
    );
    const pending = submissions.find((submission) => submission.behavior_status === 'pending');
    const dailyPoints = submissions
      .filter((submission) => submission.verification_status === 'verified')
      .reduce((sum, submission) => sum + Number(submission.points || 0), 0);
    return {
      task,
      crew,
      league,
      dailyPoints,
      lifetimePoints: Number(profileProgress?.lifetime_xp || 0),
      weeklyPoints: crew.membership ? Number(crew.weeklyPoints || league.league?.score || 0) : null,
      todaySubmitted: Boolean(verified),
      todayActionStatus: verified ? 'completed' : pending ? 'pending' : 'available',
      todaySubmissionId: verified?.id || pending?.id || null,
    };
  },

  async getMeasurement() {
    if (useMockData) {
      return {
        baseline: {
          scenarios: 4,
          prepared_percent: 50,
          recycled_percent: 50,
          behavior_percent: 50,
        },
        followUp: {
          scenarios: 4,
          prepared_percent: 75,
          recycled_percent: 75,
          behavior_percent: 75,
        },
        targetPercentagePoints: 20,
        isDemo: true,
      };
    }
    return gameService.getMeasurement();
  },

  async getCrewOverview() {
    if (useMockData) return getDemoCrewOverview();
    return gameService.getCrewOverview();
  },

  async joinCrew(inviteCode) {
    if (useMockData) return normalizeMembership(joinDemoCrew(inviteCode));
    const response = await gameService.joinSquad(inviteCode);
    return normalizeMembership({ squadId: response.squadId, role: 'member' });
  },

  async createCrew(name) {
    if (useMockData) return normalizeMembership(createDemoCrew(name));
    const response = await gameService.createSquad(name, 'Asia/Singapore');
    return normalizeMembership({ squadId: response.squadId, role: 'owner' });
  },

  async leaveCrew(membership) {
    const crewId = membership?.crewId || (await this.getCrewOverview()).membership?.crewId;
    if (!crewId) return null;
    if (useMockData) return leaveDemoCrew();
    return gameService.leaveSquad(crewId);
  },

  async createInvite(membership) {
    if (useMockData) return createDemoInvite();
    return gameService.createInvite(membership.crewId);
  },

  async reactActivity(activityId, emoji = '👏') {
    if (useMockData) {
      addReaction(activityId, emoji);
      return { activityId, emoji };
    }
    return gameService.reactActivity(activityId, emoji);
  },

  async getLeagueOverview() {
    if (useMockData) return getDemoLeagueOverview();
    const current = await gameService.getCurrentLeague();
    if (!current.squadId) {
      return {
        eligibility: 'no_crew',
        crewId: null,
        crewName: null,
        rows: [],
        weeklyPoints: null,
        resetLabel: 'Resets Monday at 00:00 SGT.',
        queueStatus: 'none',
        canQueue: false,
      };
    }
    const crewOverview = await gameService.getCrewOverview();
    const membershipRole = crewOverview.membership?.role;
    if (current.queue?.status === 'queued') {
      return {
        eligibility: 'queued',
        crewId: current.squadId,
        crewName: crewOverview.membership?.crewName || 'Your crew',
        rows: [],
        weeklyPoints: null,
        resetLabel: 'Resets Monday at 00:00 SGT.',
        queueStatus: 'queued',
        canQueue: false,
        membershipRole,
      };
    }
    if (!current.league && membershipRole !== 'owner') {
      return {
        eligibility: 'waiting',
        crewId: current.squadId,
        crewName: crewOverview.membership?.crewName || 'Your crew',
        rows: [],
        weeklyPoints: null,
        resetLabel: 'Resets Monday at 00:00 SGT.',
        queueStatus: 'none',
        canQueue: false,
        membershipRole,
      };
    }
    const leagues = await gameService.getLeagues();
    const activeLeague =
      leagues.find((league) => league.id === current.league?.league_id) ??
      current.league?.leagues ??
      leagues[0];
    const entries = activeLeague?.league_entries ?? [];
    const rows = entries
      .map((entry) => ({
        name: entry.squads?.name ?? entry.squad_name ?? 'EcoCrew',
        score: Number(entry.score ?? 0),
        trend: entry.squad_id === current.squadId ? 'you' : 'up',
      }))
      .sort((first, second) => second.score - first.score || first.name.localeCompare(second.name))
      .map((row, index) => ({ ...row, rank: index + 1 }));
    const own = rows.find((row) => row.trend === 'you');
    return {
      eligibility: own ? 'ranked' : 'unranked',
      crewId: current.squadId,
      crewName: own?.name || current.league?.squads?.name || 'Your crew',
      rows,
      weeklyPoints: Number(
        own?.score ?? current.league?.score ?? current.progression?.weekly_points ?? 0,
      ),
      resetLabel: 'Resets Monday at 00:00 SGT.',
      queueStatus: 'none',
      canQueue: !current.league && membershipRole === 'owner',
      membershipRole,
    };
  },

  async queueForLeague(crewId) {
    if (useMockData) return queueDemoLeague();
    const id = crewId || (await this.getCrewOverview()).membership?.crewId;
    return id ? gameService.queueForLeague(id) : null;
  },

  async cancelLeagueQueue(crewId) {
    if (useMockData) return cancelDemoLeagueQueue();
    const id = crewId || (await this.getCrewOverview()).membership?.crewId;
    return id ? gameService.cancelLeagueQueue(id) : null;
  },

  async getCosmetics() {
    if (useMockData) return getDemoCosmetics();
    const items = await gameService.getCosmetics();
    return (items || []).map((item) => {
      const catalog = item.cosmetic_catalog || {};
      const kind = item.kind || catalog.kind || 'badge';
      return {
        id: item.id || item.cosmetic_id,
        name: item.name || catalog.name || 'Eco cosmetic',
        kind,
        icon: kind === 'frame' ? '🌿' : kind === 'avatar' ? '🦊' : '🌱',
        unlocked: item.unlocked !== false,
        equipped: Boolean(item.equipped),
        progress: item.progress,
      };
    });
  },

  async equipCosmetic(cosmeticId) {
    if (useMockData) return equipDemoCosmetic(cosmeticId);
    return gameService.equipCosmetic(cosmeticId);
  },

  async getPosts(userId) {
    if (useMockData) return getDemoPosts();
    return gameService.getProfilePosts(userId);
  },

  async getProfileData(userId) {
    const [profile, posts, cosmetics, stats] = await Promise.all([
      this.getProfile(userId),
      this.getPosts(userId),
      this.getCosmetics(),
      useMockData ? Promise.resolve(null) : gameService.getProfileStats(),
    ]);
    const state = useMockData ? getDemoState() : null;
    return {
      profile,
      posts,
      cosmetics,
      lifetimePoints: Number(state?.lifetimePoints ?? stats?.lifetimePoints ?? 0),
      bestStreak: Number(state?.bestStreak ?? stats?.bestStreak ?? 0),
    };
  },

  getMembership() {
    return useMockData ? normalizeMembership(getCrewMembership()) : null;
  },

  getSupabaseClient() {
    return supabase;
  },
};
