/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completeDemoSort,
  createDemoCrew,
  getDailyTask,
  getDemoLeagueOverview,
  getDemoState,
  joinDemoCrew,
  leaveDemoCrew,
  queueDemoLeague,
  cancelDemoLeagueQueue,
  submitDemoTask,
} from '../../src/features/ecocrew/scan-service.js';

function imageFile() {
  return new globalThis.File(['demo image'], 'item.png', { type: 'image/png' });
}

describe('demo submission rules', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps personal submissions out of crew weekly and mission progress without membership', async () => {
    const before = getDemoState();

    await submitDemoTask({
      file: imageFile(),
      taskId: getDailyTask().taskId,
      userSelectedBin: 'recycle',
      idempotencyKey: 'no-crew-submission',
    });

    expect(getDemoState()).toMatchObject({
      weeklyPoints: before.weeklyPoints,
      missionProgress: before.missionProgress,
    });
  });

  it('allows one submission per Singapore calendar day', async () => {
    const task = getDailyTask();
    const first = await submitDemoTask({
      file: imageFile(),
      taskId: task.taskId,
      userSelectedBin: 'recycle',
      idempotencyKey: 'first-submission',
    });
    const stateAfterFirst = getDemoState();

    await expect(
      submitDemoTask({
        file: imageFile(),
        taskId: task.taskId,
        userSelectedBin: 'recycle',
        idempotencyKey: 'second-submission',
      }),
    ).rejects.toMatchObject({ code: 'DAILY_TASK_ALREADY_SUBMITTED' });

    expect(getDemoState()).toMatchObject({
      dailyScans: stateAfterFirst.dailyScans,
      dailyPoints: stateAfterFirst.dailyPoints,
      lifetimePoints: stateAfterFirst.lifetimePoints,
    });
    expect(getDemoState().posts).toHaveLength(1);

    await expect(
      submitDemoTask({
        file: imageFile(),
        taskId: task.taskId,
        userSelectedBin: 'recycle',
        idempotencyKey: 'first-submission',
      }),
    ).resolves.toEqual(first);
    expect(getDemoState().posts).toHaveLength(1);
  });

  it('allows the next daily task after the Singapore calendar day changes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T12:00:00+08:00'));
    localStorage.clear();

    const firstTask = getDailyTask();
    await submitDemoTask({
      file: imageFile(),
      taskId: firstTask.taskId,
      userSelectedBin: 'recycle',
      idempotencyKey: 'day-one-submission',
    });

    vi.setSystemTime(new Date('2026-08-30T12:00:00+08:00'));
    const nextTask = getDailyTask();
    expect(nextTask.taskDay).not.toBe(firstTask.taskDay);

    await expect(
      submitDemoTask({
        file: imageFile(),
        taskId: nextTask.taskId,
        userSelectedBin: 'recycle',
        idempotencyKey: 'day-two-submission',
      }),
    ).resolves.toMatchObject({ taskDay: nextTask.taskDay });
    expect(getDemoState().dailyScans).toBe(1);
  });

  it('applies the duplicate guard to the legacy demo sort helper', () => {
    completeDemoSort('recycle');

    expect(() => completeDemoSort('recycle')).toThrowError(
      expect.objectContaining({ code: 'DAILY_TASK_ALREADY_SUBMITTED' }),
    );
  });

  it('keeps crew leave and league queue behavior role-aware in the mock adapter', () => {
    createDemoCrew('Green Team');
    expect(queueDemoLeague()).toEqual({ status: 'queued' });
    expect(getDemoLeagueOverview()).toMatchObject({ eligibility: 'queued', queueStatus: 'queued' });
    expect(cancelDemoLeagueQueue()).toEqual({ status: 'cancelled' });
    expect(getDemoLeagueOverview()).toMatchObject({ queueStatus: 'none', canQueue: true });
    expect(leaveDemoCrew()).toBe(false);

    joinDemoCrew('ABC123');
    expect(getDemoLeagueOverview()).toMatchObject({ eligibility: 'waiting', queueStatus: 'none' });
    expect(leaveDemoCrew()).toBe(true);
    expect(getDemoLeagueOverview()).toMatchObject({ eligibility: 'no_crew', crewId: null });
  });
});
