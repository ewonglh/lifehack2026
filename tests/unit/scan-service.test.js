/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelDemoLeagueQueue,
  completeDemoSort,
  confirmDemoAction,
  createDemoCrew,
  getDailyTask,
  getDemoLeagueOverview,
  getDemoState,
  joinDemoCrew,
  leaveDemoCrew,
  queueDemoLeague,
  submitDemoTask,
} from '../../src/features/ecocrew/scan-service.js';

function imageFile() {
  return new globalThis.File(['demo image'], 'item.png', { type: 'image/png' });
}

describe('demo action check-in rules', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps personal points and crew progress unchanged until check-in', async () => {
    const before = getDemoState();

    const pending = await submitDemoTask({
      file: imageFile(),
      taskId: getDailyTask().taskId,
      idempotencyKey: 'no-crew-submission',
    });

    expect(pending).toMatchObject({
      outcome: 'awaiting_check_in',
      behaviorCheckIn: { status: 'pending', selfReported: false },
      points: { total: 0 },
    });
    expect(getDemoState()).toMatchObject({
      dailyScans: 0,
      dailyPoints: 0,
      weeklyPoints: before.weeklyPoints,
      missionProgress: before.missionProgress,
      posts: [],
    });

    const confirmed = confirmDemoAction(pending.submissionId);
    expect(confirmed).toMatchObject({
      outcome: 'completed',
      behaviorCheckIn: { status: 'confirmed', selfReported: true },
    });
    expect(confirmed.points.total).toBeGreaterThan(0);
    expect(getDemoState().posts).toHaveLength(1);
    expect(getDemoState().weeklyPoints).toBe(before.weeklyPoints);
    expect(getDemoState().missionProgress).toBe(before.missionProgress);
  });

  it('makes confirmation idempotent and blocks another action while pending', async () => {
    const task = getDailyTask();
    const first = await submitDemoTask({
      file: imageFile(),
      taskId: task.taskId,
      idempotencyKey: 'first-submission',
    });
    const stateAfterPhoto = getDemoState();

    await expect(
      submitDemoTask({
        file: imageFile(),
        taskId: task.taskId,
        idempotencyKey: 'second-submission',
      }),
    ).rejects.toMatchObject({ code: 'ACTION_CHECK_IN_PENDING' });
    expect(getDemoState()).toMatchObject({
      dailyScans: stateAfterPhoto.dailyScans,
      dailyPoints: stateAfterPhoto.dailyPoints,
      posts: [],
    });

    const confirmed = confirmDemoAction(first.submissionId);
    const pointsAfterConfirmation = getDemoState().dailyPoints;
    expect(confirmDemoAction(first.submissionId)).toEqual(confirmed);
    expect(getDemoState().dailyPoints).toBe(pointsAfterConfirmation);
    await expect(
      submitDemoTask({
        file: imageFile(),
        taskId: task.taskId,
        idempotencyKey: 'third-submission',
      }),
    ).rejects.toMatchObject({ code: 'DAILY_TASK_ALREADY_SUBMITTED' });
  });

  it('allows the next daily action after the Singapore calendar day changes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T12:00:00+08:00'));
    localStorage.clear();

    const firstTask = getDailyTask();
    const first = await submitDemoTask({
      file: imageFile(),
      taskId: firstTask.taskId,
      idempotencyKey: 'day-one-submission',
    });
    confirmDemoAction(first.submissionId);

    vi.setSystemTime(new Date('2026-08-30T12:00:00+08:00'));
    const nextTask = getDailyTask();
    expect(nextTask.taskDay).not.toBe(firstTask.taskDay);

    await expect(
      submitDemoTask({
        file: imageFile(),
        taskId: nextTask.taskId,
        idempotencyKey: 'day-two-submission',
      }),
    ).resolves.toMatchObject({ taskDay: nextTask.taskDay, outcome: 'awaiting_check_in' });
    expect(getDemoState().dailyScans).toBe(0);
  });

  it.each([
    ['liquid_bottle', 'liquid_present', 'failed'],
    ['unrelated_item', 'unrelated_item', 'failed'],
    ['empty_bottle', null, 'awaiting_check_in'],
  ])('keeps demo fixture outcome %s deterministic', async (fixture, failureReason, outcome) => {
    const result = await submitDemoTask({
      file: imageFile(),
      taskId: getDailyTask().taskId,
      idempotencyKey: 'fixture-' + fixture,
      demoFixture: fixture,
    });
    expect(result).toMatchObject({ outcome, failureReason });
  });

  it('keeps the legacy helper idempotent while using the new action contract', () => {
    const result = completeDemoSort('recycle');

    expect(result.outcome).toBe('completed');
    expect(result.behaviorCheckIn.status).toBe('confirmed');
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
