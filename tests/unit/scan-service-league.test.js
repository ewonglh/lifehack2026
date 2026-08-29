/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest';
import { getDemoLeagueOverview, joinDemoCrew } from '../../src/features/ecocrew/scan-service.js';

describe('demo league eligibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not create a league row for a user without a crew', () => {
    expect(getDemoLeagueOverview()).toMatchObject({
      eligibility: 'no_crew',
      crewId: null,
      rows: [],
      weeklyPoints: null,
    });
  });

  it('uses the joined crew identity for the seeded demo row', () => {
    joinDemoCrew('ECO123');
    const overview = getDemoLeagueOverview();

    expect(overview.eligibility).toBe('ranked');
    expect(overview.crewName).toBe('Glass Guardians');
    expect(overview.rows.find((row) => row.trend === 'you')?.name).toBe('Glass Guardians');
  });
});
