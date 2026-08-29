import { crew, demoScan } from './mock-data.js';

const storageKey = 'ecocrew-demo-state';

function initialState() {
  return {
    todayPoints: 30,
    dailyScans: 0,
    dailyCap: 3,
    missionProgress: crew.mission.progress,
    lastResult: null,
    reactions: {},
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
    points: {
      correctBin: isCorrect ? 10 : 0,
      preparation: 5,
      dailyBonus: state.dailyScans === 0 ? 10 : 0,
      total: points,
    },
    crew: {
      ...crew,
      mission: { ...crew.mission, progress: Math.min(100, state.missionProgress + 10) },
    },
    unlock: isCorrect && state.dailyScans === 0 ? { name: 'Leaf Frame', icon: '🌿' } : null,
  };
  save({
    ...state,
    dailyScans: Math.min(state.dailyScans + 1, state.dailyCap),
    todayPoints: state.todayPoints + points,
    missionProgress: result.crew.mission.progress,
    lastResult: result,
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
