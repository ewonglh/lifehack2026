import { activity, cosmetics, crew, demoScan, demoTask, profile } from './mock-data.js';

const storageKey = 'ecocrew-demo-state';
const dailyPointsCap = 75;

function singaporeDateKey(date = new Date()) {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(date)
    .reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  return dateParts.year + '-' + dateParts.month + '-' + dateParts.day;
}

function singaporeWeekKey(date = new Date()) {
  const dateParts = singaporeDateKey(date).split('-').map(Number);
  const localDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
  const mondayOffset = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - mondayOffset);
  return localDate.toISOString().slice(0, 10);
}

function initialState() {
  return {
    dailyPoints: 0,
    dailyScans: 0,
    dailyCap: 3,
    lifetimePoints: 1280,
    weeklyPoints: crew.weeklyPoints,
    dailyTaskDay: singaporeDateKey(),
    submittedTaskDay: null,
    weekKey: singaporeWeekKey(),
    missionProgress: crew.mission.progress,
    lastResult: null,
    submissionResults: {},
    reactions: {},
    profile: { ...profile },
    posts: [],
    crewMembership: null,
  };
}

function save(state) {
  localStorage.setItem(storageKey, JSON.stringify(state));
  return state;
}

export function getDemoState() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
    let state = { ...initialState(), ...stored };
    const today = singaporeDateKey();
    let changed = false;

    if (!Object.prototype.hasOwnProperty.call(stored, 'dailyTaskDay')) {
      const previousResultDate = stored.lastResult?.post?.createdAt || stored.lastResult?.createdAt;
      const legacySubmittedToday = previousResultDate
        ? singaporeDateKey(new Date(previousResultDate)) === today
        : Number(stored.dailyScans || 0) > 0;
      state = {
        ...state,
        dailyTaskDay: today,
        submittedTaskDay: legacySubmittedToday ? today : null,
        lastResult: legacySubmittedToday ? state.lastResult : null,
        dailyPoints: legacySubmittedToday ? state.dailyPoints : 0,
        dailyScans: legacySubmittedToday ? state.dailyScans : 0,
      };
      changed = true;
    } else if (state.dailyTaskDay !== today) {
      state = {
        ...state,
        dailyTaskDay: today,
        dailyPoints: 0,
        dailyScans: 0,
        submittedTaskDay: null,
        lastResult: null,
      };
      changed = true;
    }

    const currentWeek = singaporeWeekKey();
    if (state.weekKey !== currentWeek) {
      state = { ...state, weeklyPoints: 0, weekKey: currentWeek };
      changed = true;
    }
    return changed ? save(state) : state;
  } catch {
    return initialState();
  }
}

function normalizeBin(value) {
  return value === 'reuse' ? 'reuse_return' : value;
}

function currentProfile() {
  return { ...profile, ...getDemoState().profile };
}

export function getDailyTask() {
  return { ...demoTask, taskDay: singaporeDateKey() };
}

export async function analyseDemoPhoto() {
  await new Promise((resolve) => window.setTimeout(resolve, 350));
  return demoScan;
}

function buildDemoResult(state, userBin, analysis, idempotencyKey, task = getDailyTask()) {
  const selectedBin = normalizeBin(userBin);
  const confident = analysis.confidence >= 0.7 && analysis.recommendedBin !== 'unknown';
  const taskSatisfied = analysis.matchesTask !== false;
  const isCorrect = confident && taskSatisfied && selectedBin === analysis.recommendedBin;
  const awarded = [];
  let dailyPoints = state.dailyPoints;
  let totalPoints = 0;

  if (isCorrect && dailyPoints < dailyPointsCap) {
    const correctSort = Math.min(10, dailyPointsCap - dailyPoints);
    awarded.push({ actionType: 'correct_sort', points: correctSort });
    totalPoints += correctSort;
    dailyPoints += correctSort;
    if (analysis.preparationTip) {
      const preparation = Math.min(5, dailyPointsCap - dailyPoints);
      awarded.push({ actionType: 'prep_step', points: preparation });
      totalPoints += preparation;
      dailyPoints += preparation;
    }
    if (state.dailyScans === 0) {
      const dailyFirst = Math.min(10, dailyPointsCap - dailyPoints);
      awarded.push({ actionType: 'daily_first', points: dailyFirst });
      totalPoints += dailyFirst;
      dailyPoints += dailyFirst;
    }
  }

  const outcome = isCorrect
    ? 'confirmed'
    : !confident || !taskSatisfied
      ? 'unknown'
      : 'needs_confirmation';
  const missionProgress = isCorrect
    ? Math.min(crew.mission.target, state.missionProgress + 10)
    : state.missionProgress;
  const membership = state.crewMembership;
  const crewUpdate = membership
    ? {
        weeklyPoints: state.weeklyPoints + totalPoints,
        missionProgress,
        streakStatus: isCorrect ? 'advanced' : 'not_qualified',
      }
    : undefined;
  const points = {
    correctBin: awarded.find((item) => item.actionType === 'correct_sort')?.points || 0,
    preparation: awarded.find((item) => item.actionType === 'prep_step')?.points || 0,
    dailyBonus: awarded.find((item) => item.actionType === 'daily_first')?.points || 0,
    total: totalPoints,
  };
  const post = {
    id: 'demo-post-' + Date.now(),
    scanEventId: idempotencyKey,
    itemName: analysis.itemName,
    finalBin: analysis.recommendedBin,
    isCorrect: confident && taskSatisfied ? isCorrect : null,
    points: totalPoints,
    createdAt: new Date().toISOString(),
    visibility: 'private',
    imageVisible: false,
  };

  return {
    taskId: task.taskId,
    taskDay: task.taskDay,
    scanEventId: idempotencyKey,
    submissionId: idempotencyKey,
    validated: isCorrect,
    classification: analysis,
    outcome,
    userSelectedBin: selectedBin,
    isCorrect,
    awarded,
    points,
    dailyPointsRemaining: Math.max(0, dailyPointsCap - dailyPoints),
    streak: {
      current: isCorrect ? 1 : 0,
      longest: isCorrect ? 1 : 0,
    },
    crewUpdate,
    post,
    crew: {
      ...crew,
      mission: { ...crew.mission, progress: missionProgress },
    },
    unlock: isCorrect && state.dailyScans === 0 ? { name: 'Leaf Frame', icon: '🌿' } : null,
  };
}

function duplicateSubmissionError(state) {
  return {
    code: 'DAILY_TASK_ALREADY_SUBMITTED',
    message: 'You have already submitted today’s challenge.',
    submissionId: state.lastResult?.submissionId || state.lastResult?.scanEventId,
  };
}

function persistDemoSubmission(state, result, task, idempotencyKey) {
  const hasCrew = Boolean(state.crewMembership);
  return save({
    ...state,
    dailyScans: Math.min(state.dailyScans + 1, state.dailyCap),
    dailyPoints: state.dailyPoints + result.points.total,
    lifetimePoints: state.lifetimePoints + result.points.total,
    weeklyPoints: hasCrew ? state.weeklyPoints + result.points.total : state.weeklyPoints,
    missionProgress: hasCrew ? result.crew.mission.progress : state.missionProgress,
    submittedTaskDay: task.taskDay,
    lastResult: result,
    submissionResults: { ...(state.submissionResults || {}), [idempotencyKey]: result },
    posts: [result.post, ...state.posts],
  });
}

export async function submitDemoTask({ file, taskId, userSelectedBin, idempotencyKey }) {
  const FileConstructor = globalThis.File;
  if (!FileConstructor || !(file instanceof FileConstructor) || file.size === 0) {
    throw { code: 'INVALID_IMAGE', message: 'Choose an image before submitting.' };
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw { code: 'UNSUPPORTED_IMAGE_TYPE', message: 'Use a JPEG, PNG, or WebP image.' };
  }
  if (file.size > 10 * 1024 * 1024) {
    throw { code: 'IMAGE_TOO_LARGE', message: 'Task images must be 10 MB or smaller.' };
  }
  if (taskId && taskId !== demoTask.taskId) {
    throw { code: 'DAILY_TASK_MISMATCH', message: 'This is not your assigned task.' };
  }

  const state = getDemoState();
  const task = getDailyTask();
  if (state.submissionResults?.[idempotencyKey]) return state.submissionResults[idempotencyKey];
  if (state.submittedTaskDay === task.taskDay) throw duplicateSubmissionError(state);
  const result = buildDemoResult(state, userSelectedBin, demoScan, idempotencyKey, task);
  persistDemoSubmission(state, result, task, idempotencyKey);
  return result;
}

export function completeDemoSort(userBin, analysis = demoScan) {
  const state = getDemoState();
  const task = getDailyTask();
  if (state.submittedTaskDay === task.taskDay) throw duplicateSubmissionError(state);
  const idempotencyKey = 'demo-' + Date.now();
  const result = buildDemoResult(state, userBin, analysis, idempotencyKey, task);
  persistDemoSubmission(state, result, task, idempotencyKey);
  return result;
}

export function getLastResult() {
  return getDemoState().lastResult;
}

export function addReaction(activityId, emoji = '👏') {
  const state = getDemoState();
  const key = activityId + ':' + emoji;
  const reactions = { ...state.reactions, [key]: (state.reactions[key] || 0) + 1 };
  return save({ ...state, reactions });
}

export function getDemoProfile() {
  return currentProfile();
}

export function updateDemoProfile(updates) {
  const state = getDemoState();
  const nextProfile = { ...currentProfile(), ...updates };
  save({ ...state, profile: nextProfile });
  return nextProfile;
}

export function getDemoPosts() {
  return getDemoState().posts;
}

export function getCrewMembership() {
  return getDemoState().crewMembership;
}

export function joinDemoCrew(inviteCode) {
  const state = getDemoState();
  const membership = {
    crewId: crew.id,
    crewName: crew.name,
    inviteCode: String(inviteCode).trim().toUpperCase(),
    role: 'member',
    joinedAt: new Date().toISOString(),
  };
  save({ ...state, crewMembership: membership });
  return membership;
}

export function createDemoCrew(crewName) {
  const state = getDemoState();
  const cleanName = String(crewName).trim();
  const membership = {
    crewId: 'demo-' + cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    crewName: cleanName,
    inviteCode: cleanName
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 6)
      .padEnd(6, '0'),
    role: 'owner',
    joinedAt: new Date().toISOString(),
  };
  save({ ...state, crewMembership: membership });
  return membership;
}

export function createDemoInvite() {
  const membership = getCrewMembership();
  return {
    inviteCode: membership?.inviteCode || 'ECO123',
    inviteUrl:
      window.location.origin +
      window.location.pathname +
      '#/join/' +
      encodeURIComponent(membership?.inviteCode || 'ECO123'),
  };
}

export function getDemoCrewOverview() {
  const state = getDemoState();
  const membership = state.crewMembership;
  if (!membership) return { membership: null };
  const members =
    membership.role === 'owner'
      ? [{ ...crew.members[0], name: currentProfile().displayName }]
      : crew.members;
  return {
    membership,
    members,
    mission: { ...crew.mission, progress: state.missionProgress },
    streak: crew.streak,
    repairTokens: crew.repairTokens,
    weeklyPoints: state.weeklyPoints,
    requiredMembers: Math.ceil(members.length / 2),
    completedMembers: Math.max(0, Math.ceil(members.length / 2) - 1),
    activity: activity.map((entry) => ({
      ...entry,
      reactions: entry.reactions + (state.reactions[entry.id + ':👏'] || 0),
    })),
  };
}

export function getDemoLeagueOverview() {
  const state = getDemoState();
  const membership = state.crewMembership;
  if (!membership) {
    return {
      eligibility: 'no_crew',
      crewId: null,
      crewName: null,
      rows: [],
      weeklyPoints: null,
      resetLabel: getLeagueResetLabel(),
    };
  }

  const rows = [
    { rank: 1, name: 'Bottle Brigade', score: 910, trend: 'up' },
    { rank: 2, name: 'Compost Club', score: 835, trend: 'up' },
    { rank: 3, name: 'The Recyclables', score: 790, trend: 'down' },
    { rank: 4, name: membership.crewName || crew.name, score: state.weeklyPoints, trend: 'you' },
    { rank: 5, name: 'Bin There', score: 710, trend: 'up' },
  ]
    .sort((first, second) => second.score - first.score)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  return {
    eligibility: rows.some((row) => row.trend === 'you') ? 'ranked' : 'unranked',
    crewId: membership.crewId || null,
    crewName: membership.crewName || crew.name,
    rows,
    weeklyPoints: state.weeklyPoints,
    resetLabel: getLeagueResetLabel(),
  };
}

export function getDemoCosmetics() {
  return cosmetics.map((item) => ({ ...item }));
}

export function equipDemoCosmetic(cosmeticId) {
  return getDemoCosmetics().find((item) => item.id === cosmeticId) || null;
}

export function getLeagueResetLabel() {
  return 'Resets Monday at 00:00 SGT.';
}
