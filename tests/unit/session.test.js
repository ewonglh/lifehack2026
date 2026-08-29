import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../../src/app/session.js';
import { authService } from '../../src/services/auth-service.js';
import { gameService } from '../../src/services/game-service.js';
import { profileService } from '../../src/services/profile-service.js';

describe('session restoration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(authService, 'getSession').mockResolvedValue(null);
    vi.spyOn(gameService, 'getDailyTask').mockResolvedValue({ taskId: 'recycle-plastic-bottle' });
    vi.spyOn(profileService, 'get').mockResolvedValue(null);
  });

  afterEach(() => vi.restoreAllMocks());

  it('restores an anonymous state when no local session exists', async () => {
    await session.restore();
    expect(session.get()).toMatchObject({ ready: true, session: null, profile: null });
    expect(gameService.getDailyTask).not.toHaveBeenCalled();
  });

  it('restores the persisted mock user and profile', async () => {
    authService.getSession.mockResolvedValue({
      user: { id: 'mock-user', email: 'maya@example.com' },
    });
    profileService.get.mockResolvedValue({ id: 'mock-user', display_name: 'Maya' });
    await session.restore();
    expect(session.get().session.user.email).toBe('maya@example.com');
    expect(session.get().profile.display_name).toBe('Maya');
    expect(gameService.getDailyTask).toHaveBeenCalledOnce();
  });

  it('keeps the authenticated session when task assignment fails', async () => {
    authService.getSession.mockResolvedValue({
      user: { id: 'user-1', email: 'member@example.com' },
    });
    gameService.getDailyTask.mockRejectedValue({
      code: 'DAILY_TASK_NOT_AVAILABLE',
      message: 'Today’s task is not available.',
    });

    await session.restore();

    expect(session.get().session.user.id).toBe('user-1');
  });

  it('keeps the authenticated session when profile loading fails', async () => {
    authService.getSession.mockResolvedValue({
      user: { id: 'user-1', email: 'member@example.com' },
    });
    profileService.get.mockRejectedValue({
      code: 'relation_missing',
      message: 'Profiles table is unavailable.',
    });
    await session.restore();
    expect(session.get().session.user.id).toBe('user-1');
    expect(session.get().profile).toBeNull();
    expect(session.get().profileError).toMatchObject({ code: 'relation_missing' });
  });
});
