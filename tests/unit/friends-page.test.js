/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCrewOverview = vi.hoisted(() => vi.fn());
const createCrew = vi.hoisted(() => vi.fn());
const joinCrew = vi.hoisted(() => vi.fn());
const leaveCrew = vi.hoisted(() => vi.fn());
const createInvite = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/ecocrew-service.js', () => ({
  ecoCrewService: {
    getCrewOverview,
    createCrew,
    joinCrew,
    leaveCrew,
    createInvite,
    reactActivity: vi.fn(),
  },
}));

import { renderFriendsPage } from '../../src/pages/friends-page.js';

const member = {
  id: 'profile-1',
  name: '<Member>',
  role: 'member',
};

const membership = {
  crewId: 'crew-1',
  crewName: '<Crew>',
  role: 'member',
};

function crewOverview(role = 'member') {
  return {
    membership: { ...membership, role },
    members: [member],
    mission: { title: 'Keep it circular', progress: 2, target: 10, endsLabel: 'This week' },
    streak: 3,
    completedMembers: 1,
    requiredMembers: 1,
    activity: [
      { id: 'event-1', actor: '<Actor>', action: '<message>', time: '<time>', reactions: 0 },
    ],
  };
}

describe('crew page membership actions', () => {
  beforeEach(() => {
    getCrewOverview.mockReset();
    createCrew.mockReset().mockResolvedValue({ crewId: 'crew-1' });
    joinCrew.mockReset().mockResolvedValue({ crewId: 'crew-1' });
    leaveCrew.mockReset().mockResolvedValue(true);
    createInvite.mockReset().mockResolvedValue({ inviteCode: 'ABC123' });
    window.confirm = vi.fn().mockReturnValue(true);
    window.open = vi.fn();
  });

  it('delegates creating a crew from the empty state', async () => {
    getCrewOverview.mockResolvedValue({ membership: null });
    const rendered = renderFriendsPage();
    await rendered.afterRender();

    rendered.element.querySelector('[data-membership-action="create"]').click();
    const form = rendered.element.querySelector('[data-crew-form="create"]');
    form.querySelector('input').value = 'Green Team';
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(createCrew).toHaveBeenCalledWith('Green Team'));
  });

  it('delegates joining a crew from the empty state', async () => {
    getCrewOverview.mockResolvedValue({ membership: null });
    const rendered = renderFriendsPage();
    await rendered.afterRender();

    rendered.element.querySelector('[data-membership-action="join"]').click();
    const form = rendered.element.querySelector('[data-crew-form="join"]');
    form.querySelector('input').value = 'ABC123';
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(joinCrew).toHaveBeenCalledWith('ABC123'));
  });

  it('shows leave only to members and delegates the existing leave action', async () => {
    getCrewOverview.mockResolvedValue(crewOverview());
    const rendered = renderFriendsPage();
    await rendered.afterRender();

    const leaveButton = rendered.element.querySelector('[data-leave-crew]');
    expect(leaveButton).not.toBeNull();
    expect(rendered.element.querySelector('[data-crew-content]').innerHTML).toContain(
      '&lt;Crew&gt;',
    );
    expect(rendered.element.querySelector('[data-crew-content]').innerHTML).toContain(
      '&lt;Actor&gt;',
    );
    leaveButton.click();

    await vi.waitFor(() =>
      expect(leaveCrew).toHaveBeenCalledWith(expect.objectContaining({ crewId: 'crew-1' })),
    );
  });

  it('does not render owner deletion or leave controls', async () => {
    getCrewOverview.mockResolvedValue(crewOverview('owner'));
    const rendered = renderFriendsPage();
    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-leave-crew]')).toBeNull();
    expect(rendered.element.querySelector('[data-delete-crew]')).toBeNull();
  });

  it('shares the current crew route and includes the invite code', async () => {
    getCrewOverview.mockResolvedValue(crewOverview());
    const rendered = renderFriendsPage();
    await rendered.afterRender();

    rendered.element.querySelector('[data-share="x"]').click();
    await vi.waitFor(() => expect(window.open).toHaveBeenCalled());
    const sharedUrl = window.open.mock.calls[0][0];
    expect(sharedUrl).toContain('ABC123');
    expect(sharedUrl).toContain('%23%2Fcrew');
  });
});
