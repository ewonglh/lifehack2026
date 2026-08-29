const key = 'ecocrew-mock-state';

const initialState = {
  user: null,
  profile: null,
  dailyTask: {
    taskId: 'recycle-metal-can',
    taskDay: 'demo-day',
    prompt: 'Recycle a metal can',
    targetObject: 'can',
    targetMaterial: 'metal',
    targetAction: 'recycle',
  },
  lastSubmission: null,
  friends: [
    { id: 'friend-1', displayName: 'Maya Chen', country: 'Singapore', status: 'accepted' },
    { id: 'friend-2', displayName: 'Jordan Lee', country: 'Singapore', status: 'pending_incoming' },
  ],
};

export function getMockState() {
  try {
    return { ...initialState, ...JSON.parse(localStorage.getItem(key) || '{}') };
  } catch {
    return structuredClone(initialState);
  }
}

export function setMockState(next) {
  localStorage.setItem(key, JSON.stringify(next));
  return next;
}

export function updateMockState(callback) {
  return setMockState(callback(getMockState()));
}

export function resetMockState() {
  localStorage.removeItem(key);
  return structuredClone(initialState);
}
