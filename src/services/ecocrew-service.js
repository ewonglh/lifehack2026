import { useMockData } from '../config/env.js';
import { supabase } from '../lib/supabase.js';
import { getMockState } from './mock-store.js';
import { gameService } from './game-service.js';
import { profileService } from './profile-service.js';
import {
  createDemoCrew,
  createDemoInvite,
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
  addReaction,
  submitDemoTask,
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
    matchesTask: value.matchesTask,
    taskConfidence: value.taskConfidence,
    taskReason: value.taskReason ?? null,
  };
}

function normalizeSubmission(value = {}) {
  const classification = normalizeClassification(value.classification ?? value);
  const awarded = Array.isArray(value.awarded) ? value.awarded : [];
  const totalPoints =
    value.points && typeof value.points === 'object'
      ? Number(value.points.total ?? 0)
      : Number(value.points ?? awarded.reduce((sum, item) => sum + Number(item.points || 0), 0));
  const isCorrect =
    value.post?.isCorrect ??
    (value.userSelectedBin
      ? value.userSelectedBin === classification.recommendedBin && value.validated === true
      : value.validated === true);
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
    isCorrect,
    outcome: value.outcome ?? (value.validated ? 'confirmed' : 'needs_confirmation'),
    awarded,
    points:
      value.points && typeof value.points === 'object'
        ? value.points
        : {
            total: totalPoints,
            correctBin: isCorrect ? totalPoints : 0,
            preparation: 0,
            dailyBonus: 0,
          },
    crewUpdate: value.crewUpdate,
    post: value.post,
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

  getLastResult() {
    const result = useMockData ? getLastResult() : gameService.getLastSubmission();
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
        todaySubmitted: state.submittedTaskDay === task.taskDay,
        todaySubmissionId:
          state.submittedTaskDay === task.taskDay
            ? state.lastResult?.submissionId || state.lastResult?.scanEventId || null
            : null,
      };
    }
    const [task, crew, league] = await Promise.all([
      gameService.getDailyTask(),
      gameService.getCrewOverview(),
      gameService.getCurrentLeague(),
    ]);
    return { task, crew, league };
  },

  async getCrewOverview() {
    if (useMockData) return getDemoCrewOverview();
    return gameService.getCrewOverview();
  },

  async joinCrew(inviteCode) {
    if (useMockData) return normalizeMembership(joinDemoCrew(inviteCode));
    const response = await gameService.joinSquad(inviteCode);
    const overview = await gameService.getCrewOverview();
    return normalizeMembership(overview.membership ?? { squadId: response.squadId });
  },

  async createCrew(name) {
    if (useMockData) return normalizeMembership(createDemoCrew(name));
    const response = await gameService.createSquad(name, 'Asia/Singapore');
    const overview = await gameService.getCrewOverview();
    return normalizeMembership(overview.membership ?? { squadId: response.squadId, role: 'owner' });
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
      };
    }
    const leagues = await gameService.getLeagues();
    const activeLeague =
      leagues.find((league) => league.id === current.league?.league_id) ??
      current.league?.leagues ??
      leagues[0];
    const entries = activeLeague?.league_entries ?? [];
    const rows = entries.map((entry, index) => ({
      rank: entry.final_rank ?? index + 1,
      name: entry.squads?.name ?? entry.squad_name ?? 'EcoCrew',
      score: Number(entry.score ?? 0),
      trend: entry.squad_id === current.squadId ? 'you' : 'up',
    }));
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
    };
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
    const [profile, posts, cosmetics] = await Promise.all([
      this.getProfile(userId),
      this.getPosts(userId),
      this.getCosmetics(),
    ]);
    const state = useMockData ? getDemoState() : null;
    return {
      profile,
      posts,
      cosmetics,
      lifetimePoints: Number(
        state?.lifetimePoints ?? posts.reduce((sum, post) => sum + Number(post.points || 0), 0),
      ),
      bestStreak: Number(state?.bestStreak ?? 0),
    };
  },

  getMembership() {
    return useMockData ? normalizeMembership(getCrewMembership()) : null;
  },

  getSupabaseClient() {
    return supabase;
  },
};
