import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDemoCrewMember,
  completeDemoTask,
  createDemoCrew,
  equipDemoCosmetic,
  getDailyTask,
  getDemoCosmetics,
  getDemoProfile,
  getDemoState,
  getLeagueMembership,
  joinDemoCrew,
  joinDemoLeague,
  leaveDemoLeague,
  updateDemoProfile,
} from '../src/features/ecocrew/scan-service.js';

const storedValues = new Map();

globalThis.localStorage = {
  getItem(key) { return storedValues.get(key) ?? null; },
  setItem(key, value) { storedValues.set(key, value); },
  removeItem(key) { storedValues.delete(key); },
};

beforeEach(() => storedValues.clear());

test('awards the assigned daily task only once', () => {
  const assignedTask = getDailyTask();
  assert.equal(completeDemoTask({ id: 'not-the-assigned-task' }), null);
  assert.equal(completeDemoTask(assignedTask)?.points.total, 25);
  assert.equal(completeDemoTask(assignedTask), null);
  assert.equal(getDemoState().posts.length, 1);
});

test('persists dynamically unlocked cosmetics', () => {
  localStorage.setItem('ecocrew-demo-state', JSON.stringify({ completedTaskCount: 2 }));
  assert.equal(equipDemoCosmetic('mushroom-frame'), 'mushroom-frame');
  assert.equal(getDemoCosmetics().find((item) => item.id === 'mushroom-frame')?.equipped, true);
});

test('rejects invalid and conflicting crew memberships', () => {
  assert.equal(createDemoCrew('   '), null);
  assert.equal(joinDemoCrew('  '), null);
  assert.equal(createDemoCrew('  Green Team  ')?.crewName, 'Green Team');
  assert.equal(joinDemoCrew('ANOTHER-CREW'), null);
  for (let index = 1; index < 8; index += 1) assert.ok(addDemoCrewMember());
  assert.equal(addDemoCrewMember(), null);
});

test('allows only one active league per crew', () => {
  createDemoCrew('League Crew');
  addDemoCrewMember();
  addDemoCrewMember();
  assert.equal(joinDemoLeague('nus')?.leagueId, 'nus');
  assert.equal(joinDemoLeague('sutd'), null);
  assert.equal(getLeagueMembership()?.leagueId, 'nus');
  assert.equal(leaveDemoLeague(), true);
  assert.equal(joinDemoLeague('sutd')?.leagueId, 'sutd');
});

test('normalizes malformed browser state before calculations', () => {
  localStorage.setItem('ecocrew-demo-state', JSON.stringify({
    dailyScans: '9',
    todayPoints: 'invalid',
    weeklyLeaguePoints: 100,
    reactions: { maya: '2' },
    posts: [{ id: 42, itemName: '<img src=x>', points: '<script>', createdAt: null }],
    profile: { name: '', totalPoints: 'invalid', correctSorts: 42 },
    leagueMembership: { leagueId: 'nus', memberCount: 0 },
  }));
  const state = getDemoState();
  assert.equal(state.dailyScans, 1);
  assert.equal(state.todayPoints, 0);
  assert.equal(state.weeklyLeaguePoints, 0);
  assert.equal(state.reactions.maya, 2);
  assert.equal(state.profile.name, 'Irfan');
  assert.equal(state.profile.totalPoints, 1280);
  assert.equal('correctSorts' in state.profile, false);
  assert.equal(state.leagueMembership, null);
  assert.equal(state.posts[0].points, 0);
});

test('profile updates cannot overwrite protected statistics', () => {
  const updated = updateDemoProfile({
    name: 'Ari',
    handle: '@ari.eco',
    age: '22',
    about: 'Making one sustainable choice at a time.',
    totalPoints: 999999,
  });
  assert.equal(updated.age, 22);
  assert.equal(getDemoProfile().totalPoints, 1280);
});

test('a new Singapore day clears stale completion results', () => {
  localStorage.setItem('ecocrew-demo-state', JSON.stringify({
    dailyKey: '2000-01-01',
    dailyScans: 1,
    todayPoints: 25,
    lastResult: { points: { total: 25 } },
  }));
  const state = getDemoState();
  assert.equal(state.dailyScans, 0);
  assert.equal(state.todayPoints, 0);
  assert.equal(state.lastResult, null);
});
