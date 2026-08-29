import { activity, cosmetics, crew, demoScans, demoScan, demoTask, profile } from './mock-data.js';

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
    pendingSubmissionId: null,
    weekKey: singaporeWeekKey(),
    missionProgress: crew.mission.progress,
    lastResult: null,
    submissionResults: {},
    reactions: {},
    profile: { ...profile },
    posts: [],
    crewMembership: null,
    leagueQueueStatus: 'none',
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
        pendingSubmissionId: null,
      };
      changed = true;
    } else if (state.dailyTaskDay !== today) {
      state = {
        ...state,
        dailyTaskDay: today,
        dailyPoints: 0,
        dailyScans: 0,
        submittedTaskDay: null,
        pendingSubmissionId: null,
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

function duplicateSubmissionError(state) {
  return {
    code: 'DAILY_TASK_ALREADY_SUBMITTED',
    message: 'You have already completed today’s action.',
    submissionId: state.lastResult?.submissionId || state.lastResult?.scanEventId,
  };
}

function pendingSubmissionError(state) {
  return {
    code: 'ACTION_CHECK_IN_PENDING',
    message: 'Your bottle is ready. Finish today’s check-in first.',
    submissionId: state.pendingSubmissionId,
  };
}

function buildDemoResult(state, analysis, idempotencyKey, task = getDailyTask()) {
  const confident = analysis.confidence >= 0.7 && analysis.recommendedBin !== 'unknown';
  const taskSatisfied = analysis.taskSatisfied ?? analysis.matchesTask !== false;
  const failureReason =
    analysis.failureReason ??
    (!taskSatisfied ? 'recycling_context_missing' : !confident ? 'low_confidence' : null);
  const photoValidated = confident && taskSatisfied;
  const outcome = photoValidated
    ? 'awaiting_check_in'
    : failureReason === 'low_confidence'
      ? 'unknown'
      : 'failed';
  const points = { actionCompletion: 0, preparation: 0, dailyBonus: 0, total: 0 };

  return {
    taskId: task.taskId,
    taskDay: task.taskDay,
    task,
    scanEventId: idempotencyKey,
    submissionId: idempotencyKey,
    validated: false,
    photoValidated,
    classification: analysis,
    failureReason,
    outcome,
    behaviorCheckIn: photoValidated
      ? {
          action: 'recycle_bottle',
          status: 'pending',
          selfReported: false,
          confirmedAt: null,
        }
      : null,
    isCorrect: false,
    awarded: [],
    points,
    dailyPointsRemaining: Math.max(0, dailyPointsCap - state.dailyPoints),
    streak: { current: 0, longest: 0 },
    crewUpdate: undefined,
    post: null,
    crew: {
      ...crew,
      mission: { ...crew.mission, progress: state.missionProgress },
    },
    unlock: null,
  };
}

function persistDemoSubmission(state, result, task, idempotencyKey) {
  return save({
    ...state,
    pendingSubmissionId: result.photoValidated ? result.submissionId : state.pendingSubmissionId,
    lastResult: result,
    submissionResults: { ...(state.submissionResults || {}), [idempotencyKey]: result },
  });
}

function awardDemoResult(state, pending) {
  const membership = state.crewMembership;
  const awarded = [];
  let dailyPoints = state.dailyPoints;
  const award = (actionType, requested) => {
    const points = Math.min(requested, Math.max(0, dailyPointsCap - dailyPoints));
    if (points > 0) {
      awarded.push({ actionType, points });
      dailyPoints += points;
    }
    return points;
  };
  const actionCompletion = award('action_completed', 10);
  const preparation = pending.classification.preparationTip ? award('prep_step', 5) : 0;
  const dailyBonus = state.dailyScans === 0 ? award('daily_first', 10) : 0;
  const total = actionCompletion + preparation + dailyBonus;
  const missionProgress = membership
    ? Math.min(crew.mission.target, state.missionProgress + actionCompletion)
    : state.missionProgress;
  const confirmedAt = new Date().toISOString();
  const post = {
    id: 'demo-post-' + Date.now(),
    scanEventId: pending.scanEventId,
    itemName: pending.classification.itemName,
    finalBin: pending.classification.recommendedBin,
    isCorrect: true,
    points: total,
    createdAt: confirmedAt,
    visibility: 'private',
    imageVisible: false,
  };
  const result = {
    ...pending,
    validated: true,
    outcome: 'completed',
    failureReason: null,
    behaviorCheckIn: {
      action: 'recycle_bottle',
      status: 'confirmed',
      selfReported: true,
      confirmedAt,
    },
    isCorrect: true,
    awarded,
    points: { actionCompletion, preparation, dailyBonus, total },
    dailyPointsRemaining: Math.max(0, dailyPointsCap - dailyPoints),
    streak: { current: 1, longest: 1 },
    crewUpdate: membership
      ? {
          weeklyPoints: state.weeklyPoints + total,
          missionProgress,
          streakStatus: 'advanced',
        }
      : undefined,
    post,
    crew: {
      ...crew,
      mission: { ...crew.mission, progress: missionProgress },
    },
    unlock: state.dailyScans === 0 ? { name: 'Leaf Frame', icon: '🌿' } : null,
  };
  return {
    state: {
      ...state,
      dailyScans: Math.min(state.dailyScans + 1, state.dailyCap),
      dailyPoints,
      lifetimePoints: state.lifetimePoints + total,
      weeklyPoints: membership ? state.weeklyPoints + total : state.weeklyPoints,
      missionProgress,
      submittedTaskDay: pending.taskDay,
      pendingSubmissionId: null,
      lastResult: result,
      submissionResults: { ...(state.submissionResults || {}), [pending.submissionId]: result },
      posts: [post, ...state.posts],
    },
    result,
  };
}

export async function submitDemoTask({ file, taskId, idempotencyKey, demoFixture }) {
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
  if (state.pendingSubmissionId) throw pendingSubmissionError(state);
  const analysis = demoScans[demoFixture] || demoScan;
  const result = buildDemoResult(state, analysis, idempotencyKey, task);
  persistDemoSubmission(state, result, task, idempotencyKey);
  return result;
}

export function confirmDemoAction(submissionId = 'latest') {
  const state = getDemoState();
  const pendingId = submissionId === 'latest' ? state.pendingSubmissionId : submissionId;
  const pending = state.submissionResults?.[pendingId] || state.lastResult;
  if (!pending) throw { code: 'SUBMISSION_NOT_FOUND', message: 'We could not find that action.' };
  if (pending.behaviorCheckIn?.status === 'confirmed' || pending.outcome === 'completed')
    return pending;
  if (!pending.behaviorCheckIn || pending.behaviorCheckIn.status !== 'pending') {
    throw { code: 'SUBMISSION_NOT_PENDING', message: 'This action is not ready for check-in.' };
  }
  const confirmed = awardDemoResult(state, pending);
  save(confirmed.state);
  return confirmed.result;
}

export function completeDemoSort(_userBin, analysis = demoScan) {
  const state = getDemoState();
  const task = getDailyTask();
  if (state.submittedTaskDay === task.taskDay) throw duplicateSubmissionError(state);
  if (state.pendingSubmissionId) throw pendingSubmissionError(state);
  const idempotencyKey = 'demo-' + Date.now();
  const result = buildDemoResult(state, analysis, idempotencyKey, task);
  persistDemoSubmission(state, result, task, idempotencyKey);
  return confirmDemoAction(idempotencyKey);
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
      (membership?.inviteCode || 'ECO123'),
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
      queueStatus: 'none',
      canQueue: false,
    };
  }

  if (state.leagueQueueStatus === 'queued') {
    return {
      eligibility: 'queued',
      crewId: membership.crewId || null,
      crewName: membership.crewName || crew.name,
      rows: [],
      weeklyPoints: null,
      resetLabel: getLeagueResetLabel(),
      queueStatus: 'queued',
      canQueue: false,
      membershipRole: membership.role,
    };
  }

  if (membership.role !== 'owner') {
    return {
      eligibility: 'waiting',
      crewId: membership.crewId || null,
      crewName: membership.crewName || crew.name,
      rows: [],
      weeklyPoints: null,
      resetLabel: getLeagueResetLabel(),
      queueStatus: 'none',
      canQueue: false,
      membershipRole: membership.role,
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
    queueStatus: 'none',
    canQueue: membership.role === 'owner',
    membershipRole: membership.role,
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

export function leaveDemoCrew() {
  const state = getDemoState();
  if (!state.crewMembership || state.crewMembership.role === 'owner') return false;
  save({ ...state, crewMembership: null, leagueQueueStatus: 'none', weeklyPoints: 0 });
  return true;
}

export function queueDemoLeague() {
  const state = getDemoState();
  if (state.crewMembership?.role !== 'owner') return null;
  save({ ...state, leagueQueueStatus: 'queued' });
  return { status: 'queued' };
}

export function cancelDemoLeagueQueue() {
  const state = getDemoState();
  if (state.crewMembership?.role !== 'owner' || state.leagueQueueStatus !== 'queued') return null;
  save({ ...state, leagueQueueStatus: 'none' });
  return { status: 'cancelled' };
}
