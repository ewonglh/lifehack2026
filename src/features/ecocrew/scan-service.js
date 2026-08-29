import { cosmetics, crew, dailyTasks, demoScan, profile } from './mock-data.js';

const storageKey = 'ecocrew-demo-state';

function singaporeDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
}

function singaporeDayKey(date = new Date()) {
  const { year, month, day } = singaporeDateParts(date);
  return `${year}-${month}-${day}`;
}

function singaporeWeekKey(date = new Date()) {
  const { year, month, day } = singaporeDateParts(date);
  const currentDay = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const daysSinceMonday = (currentDay.getUTCDay() + 6) % 7;
  currentDay.setUTCDate(currentDay.getUTCDate() - daysSinceMonday);
  return currentDay.toISOString().slice(0, 10);
}

function randomTaskId() {
  return dailyTasks[Math.floor(Math.random() * dailyTasks.length)].id;
}

function initialState() {
  return {
    todayPoints: 0,
    dailyScans: 0,
    dailyCap: 1,
    dailyKey: singaporeDayKey(),
    dailyTaskId: randomTaskId(),
    weeklyLeaguePoints: 0,
    leagueWeekKey: singaporeWeekKey(),
    lastResult: null,
    reactions: {},
    profile: { ...profile },
    posts: [],
    equippedCosmeticId: cosmetics.find((item) => item.equipped)?.id || null,
    crewMembership: null,
    leagueMembership: null,
  };
}

export function getDemoState() {
  let storedState;
  try {
    const parsedState = JSON.parse(localStorage.getItem(storageKey) || '{}');
    storedState = parsedState && typeof parsedState === 'object' && !Array.isArray(parsedState) ? parsedState : {};
  } catch {
    storedState = {};
  }
  const state = { ...initialState(), ...storedState };
  state.dailyCap = 1;
  if (!state.profile || typeof state.profile !== 'object' || Array.isArray(state.profile)) state.profile = { ...profile };
  if (!Array.isArray(state.posts)) state.posts = [];
  if (!state.reactions || typeof state.reactions !== 'object' || Array.isArray(state.reactions)) state.reactions = {};
  if (!cosmetics.some((item) => item.id === state.equippedCosmeticId && item.unlocked)) {
    state.equippedCosmeticId = cosmetics.find((item) => item.equipped)?.id || null;
  }
  if (state.dailyScans === 0) state.todayPoints = 0;
  let needsSave = !storedState.dailyTaskId;
  if ('missionProgress' in state) {
    delete state.missionProgress;
    needsSave = true;
  }
  const todayKey = singaporeDayKey();
  const weekKey = singaporeWeekKey();
  if (state.dailyKey !== todayKey) {
    state.dailyKey = todayKey;
    state.dailyScans = 0;
    state.todayPoints = 0;
    state.dailyTaskId = randomTaskId();
    needsSave = true;
  }
  if (state.leagueWeekKey !== weekKey) {
    state.leagueWeekKey = weekKey;
    state.weeklyLeaguePoints = 0;
    needsSave = true;
  }
  if (needsSave) save(state);
  return state;
}

function save(state) {
  localStorage.setItem(storageKey, JSON.stringify(state));
  return state;
}

export async function analyseDemoPhoto() {
  await new Promise((resolve) => window.setTimeout(resolve, 850));
  return demoScan;
}

export function getDailyTask() {
  const taskId = getDemoState().dailyTaskId;
  return dailyTasks.find((task) => task.id === taskId) || dailyTasks[0];
}

export function completeDemoTask(task = getDailyTask()) {
  const state = getDemoState();
  if (state.dailyScans >= state.dailyCap) return null;

  const correctBinPoints = 10;
  const preparationPoints = 5;
  const dailyBonusPoints = state.dailyScans === 0 ? 10 : 0;
  const points = correctBinPoints + preparationPoints + dailyBonusPoints;
  const result = {
    ...demoScan,
    itemName: task.title,
    task,
    isCorrect: true,
    points: { correctBin: correctBinPoints, preparation: preparationPoints, dailyBonus: dailyBonusPoints, total: points },
    unlock: state.dailyScans === 0 ? { name: 'Leaf Frame', icon: '🌿' } : null,
  };
  const post = { id: `post-${Date.now()}`, itemName: task.title, taskId: task.id, isCorrect: true, points, createdAt: new Date().toISOString() };
  save({
    ...state,
    dailyScans: state.dailyScans + 1,
    todayPoints: state.todayPoints + points,
    weeklyLeaguePoints: state.leagueMembership ? state.weeklyLeaguePoints + points : state.weeklyLeaguePoints,
    lastResult: result,
    posts: [post, ...state.posts],
    profile: { ...state.profile, totalPoints: state.profile.totalPoints + points },
  });
  return result;
}

export function getLastResult() {
  return getDemoState().lastResult;
}

export function addReaction(activityId) {
  const state = getDemoState();
  const reactions = { ...state.reactions, [activityId]: (state.reactions[activityId] || 0) + 1 };
  return save({ ...state, reactions });
}

export function getDemoProfile() { return getDemoState().profile; }

export function updateDemoProfile(updates) {
  const state = getDemoState();
  return save({ ...state, profile: { ...state.profile, ...updates } }).profile;
}

export function getDemoPosts() { return getDemoState().posts; }

export function getCrewMembership() { return getDemoState().crewMembership; }

export function getCrewMemberCount() {
  const membership = getCrewMembership();
  if (!membership) return 0;
  return Math.max(1, Number(membership.memberCount) || (membership.role === 'owner' ? 1 : crew.members.length));
}

export function getLeagueMembership() { return getDemoState().leagueMembership; }

export function getLeagueAveragePoints() {
  const state = getDemoState();
  if (!state.leagueMembership) return null;
  const memberCount = Math.max(1, Number(state.leagueMembership.memberCount) || 1);
  return Math.round(state.weeklyLeaguePoints / memberCount);
}

export function getDemoCosmetics() {
  const equippedId = getDemoState().equippedCosmeticId || cosmetics.find((item) => item.equipped)?.id;
  return cosmetics.map((item) => ({ ...item, equipped: item.id === equippedId }));
}

export function equipDemoCosmetic(cosmeticId) {
  const cosmetic = cosmetics.find((item) => item.id === cosmeticId);
  if (!cosmetic?.unlocked) return null;
  const state = getDemoState();
  save({ ...state, equippedCosmeticId: cosmeticId });
  return cosmeticId;
}

export function joinDemoCrew(inviteCode) {
  const state = getDemoState();
  const membership = {
    crewName: crew.name,
    inviteCode: inviteCode.trim().toUpperCase(),
    role: 'member',
    memberCount: crew.members.length,
    joinedAt: new Date().toISOString(),
  };
  save({ ...state, crewMembership: membership });
  return membership;
}

export function createDemoCrew(crewName) {
  const state = getDemoState();
  const membership = {
    crewName: crewName.trim(),
    inviteCode: crewName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'MY-CREW',
    role: 'owner',
    memberCount: 1,
    joinedAt: new Date().toISOString(),
  };
  save({ ...state, crewMembership: membership });
  return membership;
}

export function joinDemoLeague() {
  const state = getDemoState();
  const memberCount = getCrewMemberCount();
  if (state.crewMembership?.role !== 'owner' || memberCount < crew.league.minimumMembers) return null;

  const leagueMembership = {
    leagueName: crew.league.name,
    crewName: state.crewMembership.crewName,
    memberCount,
    joinedAt: new Date().toISOString(),
  };
  save({ ...state, leagueMembership, weeklyLeaguePoints: 0 });
  return leagueMembership;
}

export function leaveDemoLeague() {
  const state = getDemoState();
  if (!state.leagueMembership) return false;
  save({ ...state, leagueMembership: null, weeklyLeaguePoints: 0 });
  return true;
}

export function leaveDemoCrew() {
  const state = getDemoState();
  if (!state.crewMembership || state.crewMembership.role === 'owner') return false;
  save({ ...state, crewMembership: null, leagueMembership: null, weeklyLeaguePoints: 0, reactions: {} });
  return true;
}

export function deleteDemoCrew() {
  const state = getDemoState();
  if (state.crewMembership?.role !== 'owner') return false;

  save({
    ...state,
    crewMembership: null,
    leagueMembership: null,
    weeklyLeaguePoints: 0,
    reactions: {},
  });
  return true;
}

export function getLeagueResetLabel() {
  return `Resets Monday, 12:00 am Singapore time (week of ${getDemoState().leagueWeekKey}).`;
}
