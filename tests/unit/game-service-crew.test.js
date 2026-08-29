import { beforeEach, describe, expect, it, vi } from 'vitest';

const functionInvoke = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());

vi.mock('../../src/config/env.js', () => ({ useMockData: false }));
vi.mock('../../src/lib/supabase.js', () => ({
  supabase: { functions: { invoke: functionInvoke }, from, auth: { getUser } },
}));
vi.mock('../../src/services/mock-store.js', () => ({
  getMockState: vi.fn(),
  updateMockState: vi.fn(),
}));

import { gameService } from '../../src/services/game-service.js';

function query(data, error = null) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => chain),
    maybeSingle: vi.fn(() => chain),
    then: (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject),
  };
  return chain;
}

const squad = {
  id: 'squad-1',
  name: 'Green Team',
  owner_id: 'user-1',
  timezone: 'Asia/Singapore',
  min_daily_members: 1,
};

const members = [
  {
    profile_id: 'user-1',
    role: 'owner',
    joined_at: '2026-08-30T00:00:00.000Z',
    profiles: { id: 'user-1', display_name: 'Eco Owner' },
  },
];

describe('crew mission overview adapter', () => {
  beforeEach(() => {
    functionInvoke.mockReset();
    from.mockReset();
    getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } } });
    from.mockImplementation((table) => {
      if (table === 'squads') return query(squad);
      if (table === 'squad_members') return query(members);
      if (table === 'activity_events') return query([]);
      throw new Error(`Unexpected table: ${table}`);
    });
    functionInvoke.mockImplementation(async (name) => {
      if (name === 'manage-league') {
        return {
          data: {
            squadId: 'squad-1',
            squadStreak: { current_streak: 2, repair_tokens: 1 },
            crewStreak: { required_members: 1, completed_members: 0 },
            progression: { weekly_points: 12 },
          },
          error: null,
        };
      }
      return {
        data: {
          mission: {
            id: 'mission-row-1',
            mission_id: 'glass-guardians',
            mission_day: '2026-08-30',
            progress: 4,
            title: 'Glass Guardians',
            theme: 'Glass',
            target: 50,
          },
        },
        error: null,
      };
    });
  });

  it('consumes the enriched manage-mission response as the canonical mission shape', async () => {
    const overview = await gameService.getCrewOverview();

    expect(overview.mission).toMatchObject({
      title: 'Glass Guardians',
      theme: 'Glass',
      target: 50,
      missionDay: '2026-08-30',
      progress: 4,
    });
    expect(functionInvoke).toHaveBeenCalledWith('manage-mission', {
      body: { action: 'getCrew', squadId: 'squad-1' },
    });
    const activityQuery = from.mock.results.find(
      (result, index) => from.mock.calls[index][0] === 'activity_events',
    ).value;
    expect(activityQuery.select).toHaveBeenCalledWith(
      'id, actor_id, event_type, payload, created_at, profiles!activity_events_actor_id_fkey(display_name), activity_reactions(emoji)',
    );
    expect(from).not.toHaveBeenCalledWith('squad_daily_missions');
  });

  it('keeps membership data when manage-mission reports temporary unavailability', async () => {
    functionInvoke.mockImplementation(async (name) => {
      if (name === 'manage-league') {
        return { data: { squadId: 'squad-1' }, error: null };
      }
      return {
        data: null,
        error: { code: 'MISSION_UNAVAILABLE', message: 'The crew mission is unavailable.' },
      };
    });

    const overview = await gameService.getCrewOverview();

    expect(overview.membership).toMatchObject({ crewId: 'squad-1', role: 'owner' });
    expect(overview.missionUnavailable).toBe(true);
    expect(overview.mission).toMatchObject({ unavailable: true, target: 1 });
  });
});
