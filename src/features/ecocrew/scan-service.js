import { crew, demoScan, profile } from './mock-data.js';

const storageKey = 'ecocrew-demo-state';

function initialState() {
  return {
    todayPoints: 30,
    dailyScans: 0,
    dailyCap: 3,
    missionProgress: crew.mission.progress,
    lastResult: null,
    reactions: {},
    profile: { ...profile },
    posts: [],
    crewMembership: null,
  };
}

export function getDemoState() {
  try {
    return { ...initialState(), ...JSON.parse(localStorage.getItem(storageKey) || '{}') };
  } catch {
    return initialState();
  }
}

function save(state) {
  localStorage.setItem(storageKey, JSON.stringify(state));
  return state;
}

export async function analyseDemoPhoto() {
  await new Promise((resolve) => window.setTimeout(resolve, 850));
  return demoScan;
}

export function completeDemoSort(userBin, analysis = demoScan) {
  const state = getDemoState();
  const isCorrect = userBin === analysis.recommendedBin;
  const points = isCorrect ? 25 : 5;
  const result = {
    ...analysis,
    userBin,
    isCorrect,
    points: { correctBin: isCorrect ? 10 : 0, preparation: 5, dailyBonus: state.dailyScans === 0 ? 10 : 0, total: points },
    crew: { ...crew, mission: { ...crew.mission, progress: Math.min(100, state.missionProgress + 10) } },
    unlock: isCorrect && state.dailyScans === 0 ? { name: 'Leaf Frame', icon: '🌿' } : null,
  };
  const post = { id: `post-${Date.now()}`, itemName: analysis.itemName, bin: analysis.recommendedBin, isCorrect, points, createdAt: new Date().toISOString() };
  save({ ...state, dailyScans: Math.min(state.dailyScans + 1, state.dailyCap), todayPoints: state.todayPoints + points, missionProgress: result.crew.mission.progress, lastResult: result, posts: [post, ...state.posts] });
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

export function joinDemoCrew(inviteCode) {
  const state = getDemoState();
  const membership = {
    crewName: crew.name,
    inviteCode: inviteCode.trim().toUpperCase(),
    role: 'member',
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
    joinedAt: new Date().toISOString(),
  };
  save({ ...state, crewMembership: membership });
  return membership;
}
