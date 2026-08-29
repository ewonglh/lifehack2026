import { cosmetics, crew, dailyTasks, demoScan, leagues, profile } from './mock-data.js';

const storageKey = 'ecocrew-demo-state';
const maximumCrewMembers = 8;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function crewMemberCount(value, fallback = 1) {
  return Math.min(maximumCrewMembers, Math.max(1, nonNegativeInteger(value, fallback)));
}

function cosmeticIsUnlocked(item, completedTaskCount) {
  return item.unlocked || (item.id === 'mushroom-frame' && completedTaskCount >= 2);
}

function normalizeCrewMembership(value) {
  if (!isObject(value) || !['owner', 'member'].includes(value.role)) return null;
  const crewName = typeof value.crewName === 'string' ? value.crewName.trim() : '';
  if (crewName.length < 3 || crewName.length > 40) return null;
  return {
    ...value,
    crewName,
    inviteCode: typeof value.inviteCode === 'string' ? value.inviteCode.trim().toUpperCase() : '',
    memberCount: crewMemberCount(value.memberCount, value.role === 'owner' ? 1 : crew.members.length),
  };
}

function normalizeLeagueMembership(value, membership) {
  if (!isObject(value) || !membership) return null;
  const league = leagues.find((item) => item.id === value.leagueId || item.name === value.leagueName);
  if (!league) return null;
  return {
    ...value,
    leagueId: league.id,
    leagueName: league.name,
    crewName: membership.crewName,
    memberCount: membership.memberCount,
  };
}

function normalizeResult(value) {
  if (!isObject(value) || !isObject(value.points) || !Number.isFinite(Number(value.points.total))) return null;
  return value;
}

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
    completedTaskCount: 0,
    equippedCosmeticId: cosmetics.find((item) => item.equipped)?.id || null,
    crewMembership: null,
    leagueMembership: null,
  };
}

export function getDemoState() {
  let storedState;
  try {
    const parsedState = JSON.parse(localStorage.getItem(storageKey) || '{}');
    storedState = isObject(parsedState) ? parsedState : {};
  } catch {
    storedState = {};
  }
  const state = { ...initialState(), ...storedState };
  const stateBeforeNormalization = JSON.stringify(state);
  state.dailyCap = 1;
  state.dailyScans = Math.min(state.dailyCap, nonNegativeInteger(state.dailyScans));
  state.todayPoints = nonNegativeInteger(state.todayPoints);
  state.weeklyLeaguePoints = nonNegativeInteger(state.weeklyLeaguePoints);
  state.posts = Array.isArray(state.posts)
    ? state.posts.filter(isObject).map((post, index) => ({
      ...post,
      id: typeof post.id === 'string' ? post.id : `post-${Date.now()}-${index}`,
      itemName: typeof post.itemName === 'string' ? post.itemName.slice(0, 120) : 'Completed sustainability task',
      points: nonNegativeInteger(post.points),
      createdAt: typeof post.createdAt === 'string' ? post.createdAt : '',
    }))
    : [];
  const completedPostCount = state.posts.filter((post) => post.taskId).length;
  state.completedTaskCount = Math.max(nonNegativeInteger(state.completedTaskCount), completedPostCount);
  const storedProfile = isObject(state.profile) ? state.profile : {};
  state.profile = {
    ...profile,
    ...storedProfile,
    name: typeof storedProfile.name === 'string' && storedProfile.name.trim() ? storedProfile.name.trim().slice(0, 40) : profile.name,
    handle: typeof storedProfile.handle === 'string' && storedProfile.handle.length <= 30 && /^@[a-zA-Z0-9._]+$/.test(storedProfile.handle) ? storedProfile.handle : profile.handle,
    age: Math.min(120, Math.max(13, nonNegativeInteger(storedProfile.age, profile.age))),
    about: typeof storedProfile.about === 'string' && storedProfile.about.trim() ? storedProfile.about.trim().slice(0, 280) : profile.about,
    totalPoints: nonNegativeInteger(storedProfile.totalPoints, profile.totalPoints),
  };
  delete state.profile.correctSorts;
  state.reactions = isObject(state.reactions)
    ? Object.fromEntries(Object.entries(state.reactions).map(([key, value]) => [key, nonNegativeInteger(value)]))
    : {};
  state.lastResult = normalizeResult(state.lastResult);
  state.crewMembership = normalizeCrewMembership(state.crewMembership);
  state.leagueMembership = normalizeLeagueMembership(state.leagueMembership, state.crewMembership);
  if (!state.leagueMembership) state.weeklyLeaguePoints = 0;
  if (!cosmetics.some((item) => item.id === state.equippedCosmeticId && cosmeticIsUnlocked(item, state.completedTaskCount))) {
    state.equippedCosmeticId = cosmetics.find((item) => item.equipped)?.id || null;
  }
  if (state.dailyScans === 0) state.todayPoints = 0;
  let needsSave = !storedState.dailyTaskId || JSON.stringify(state) !== stateBeforeNormalization;
  if (!dailyTasks.some((task) => task.id === state.dailyTaskId)) {
    state.dailyTaskId = randomTaskId();
    needsSave = true;
  }
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
    state.lastResult = null;
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
  const assignedTask = dailyTasks.find((item) => item.id === state.dailyTaskId);
  if (state.dailyScans >= state.dailyCap || !assignedTask || task?.id !== assignedTask.id) return null;
  task = assignedTask;

  const taskCompletionPoints = 10;
  const evidencePoints = 5;
  const dailyBonusPoints = state.dailyScans === 0 ? 10 : 0;
  const points = taskCompletionPoints + evidencePoints + dailyBonusPoints;
  const completedTaskCount = state.completedTaskCount + 1;
  const result = {
    ...demoScan,
    itemName: task.title,
    task,
    isCorrect: true,
    points: { taskCompletion: taskCompletionPoints, evidence: evidencePoints, dailyBonus: dailyBonusPoints, total: points },
    unlock: completedTaskCount === 2 ? { name: 'Mushroom Frame', icon: '🍄' } : null,
  };
  const post = { id: `post-${Date.now()}`, itemName: task.title, taskId: task.id, isCorrect: true, points, createdAt: new Date().toISOString() };
  save({
    ...state,
    dailyScans: state.dailyScans + 1,
    todayPoints: state.todayPoints + points,
    weeklyLeaguePoints: state.leagueMembership ? state.weeklyLeaguePoints + points : state.weeklyLeaguePoints,
    lastResult: result,
    posts: [post, ...state.posts],
    completedTaskCount,
    profile: { ...state.profile, totalPoints: state.profile.totalPoints + points },
  });
  return result;
}

export function getLastResult() {
  return getDemoState().lastResult;
}

export function addReaction(activityId) {
  const state = getDemoState();
  if (typeof activityId !== 'string' || !activityId) return null;
  const reactions = { ...state.reactions, [activityId]: (state.reactions[activityId] || 0) + 1 };
  return save({ ...state, reactions });
}

export function getDemoProfile() { return getDemoState().profile; }

export function updateDemoProfile(updates) {
  const state = getDemoState();
  if (!isObject(updates)) return null;
  const name = String(updates.name ?? state.profile.name).trim();
  const handle = String(updates.handle ?? state.profile.handle).trim();
  const about = String(updates.about ?? state.profile.about).trim();
  const age = Number(updates.age ?? state.profile.age);
  if (!name || name.length > 40 || !/^@[a-zA-Z0-9._]+$/.test(handle) || handle.length > 30 || !about || about.length > 280 || !Number.isInteger(age) || age < 13 || age > 120) return null;
  const nextProfile = { ...state.profile, name, handle, about, age };
  return save({ ...state, profile: nextProfile }).profile;
}

export function getDemoPosts() { return getDemoState().posts; }

export function getCrewMembership() { return getDemoState().crewMembership; }

export function getCrewMemberCount() {
  const membership = getCrewMembership();
  if (!membership) return 0;
  return crewMemberCount(membership.memberCount, membership.role === 'owner' ? 1 : crew.members.length);
}

export function getLeagueMembership() { return getDemoState().leagueMembership; }

export function getLeagueAveragePoints() {
  const state = getDemoState();
  if (!state.leagueMembership) return null;
  const memberCount = crewMemberCount(state.leagueMembership.memberCount);
  return Math.round(state.weeklyLeaguePoints / memberCount);
}

export function getDemoCosmetics() {
  const state = getDemoState();
  const equippedId = state.equippedCosmeticId || cosmetics.find((item) => item.equipped)?.id;
  const completedTaskCount = state.completedTaskCount;
  return cosmetics.map((item) => {
    const unlocked = cosmeticIsUnlocked(item, completedTaskCount);
    const remaining = Math.max(0, 2 - completedTaskCount);
    return { ...item, unlocked, equipped: unlocked && item.id === equippedId, progress: item.id === 'mushroom-frame' && !unlocked ? `${remaining} more completed task${remaining === 1 ? '' : 's'}` : item.progress };
  });
}

export function equipDemoCosmetic(cosmeticId) {
  const cosmetic = getDemoCosmetics().find((item) => item.id === cosmeticId);
  if (!cosmetic?.unlocked) return null;
  const state = getDemoState();
  save({ ...state, equippedCosmeticId: cosmeticId });
  return cosmeticId;
}

export function joinDemoCrew(inviteCode) {
  const state = getDemoState();
  const normalizedInviteCode = typeof inviteCode === 'string' ? inviteCode.trim().toUpperCase() : '';
  if (state.crewMembership || normalizedInviteCode.length < 3 || normalizedInviteCode.length > 40) return null;
  const membership = {
    crewName: crew.name,
    inviteCode: normalizedInviteCode,
    role: 'member',
    memberCount: crew.members.length,
    joinedAt: new Date().toISOString(),
  };
  save({ ...state, crewMembership: membership });
  return membership;
}

export function createDemoCrew(crewName) {
  const state = getDemoState();
  const normalizedCrewName = typeof crewName === 'string' ? crewName.trim() : '';
  if (state.crewMembership || normalizedCrewName.length < 3 || normalizedCrewName.length > 40) return null;
  const membership = {
    crewName: normalizedCrewName,
    inviteCode: normalizedCrewName.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'MY-CREW',
    role: 'owner',
    memberCount: 1,
    joinedAt: new Date().toISOString(),
  };
  save({ ...state, crewMembership: membership });
  return membership;
}

export function addDemoCrewMember() {
  const state = getDemoState();
  if (state.crewMembership?.role !== 'owner' || getCrewMemberCount() >= maximumCrewMembers) return null;
  const memberCount = getCrewMemberCount() + 1;
  const crewMembership = { ...state.crewMembership, memberCount };
  const leagueMembership = state.leagueMembership ? { ...state.leagueMembership, memberCount } : null;
  save({ ...state, crewMembership, leagueMembership });
  return crewMembership;
}

export function joinDemoLeague(leagueId) {
  const state = getDemoState();
  const memberCount = getCrewMemberCount();
  const league = leagues.find((item) => item.id === leagueId);
  if (!league || state.leagueMembership || state.crewMembership?.role !== 'owner' || memberCount < league.minimumMembers) return null;

  const leagueMembership = {
    leagueId: league.id,
    leagueName: league.name,
    crewName: state.crewMembership.crewName,
    memberCount,
    joinedAt: new Date().toISOString(),
  };
  save({ ...state, leagueMembership, weeklyLeaguePoints: 0 });
  return leagueMembership;
}

export function leaveDemoLeague() {
  const state = getDemoState();
  if (!state.leagueMembership || state.crewMembership?.role !== 'owner') return false;
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
