/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/env.js', () => ({ useMockData: true }));
vi.mock('../../src/lib/supabase.js', () => ({ supabase: null }));
vi.mock('../../src/services/game-service.js', () => ({ gameService: {} }));
vi.mock('../../src/services/profile-service.js', () => ({ profileService: {} }));

import { joinDemoCrew } from '../../src/features/ecocrew/scan-service.js';
import { ecoCrewService } from '../../src/services/ecocrew-service.js';

describe('mock dashboard data', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not expose weekly points before joining a crew', async () => {
    await expect(ecoCrewService.getDashboardData()).resolves.toMatchObject({
      weeklyPoints: null,
      todaySubmitted: false,
      personalStreak: { current: 0, longest: 0 },
    });
  });

  it('retains the seeded crew weekly points after joining', async () => {
    joinDemoCrew('ECO123');

    await expect(ecoCrewService.getDashboardData()).resolves.toMatchObject({
      weeklyPoints: 745,
      todaySubmitted: false,
      personalStreak: { current: 0, longest: 0 },
    });
  });
});
