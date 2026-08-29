/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const joinCrew = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/ecocrew-service.js', () => ({
  ecoCrewService: { joinCrew },
}));

import { renderJoinCrewPage } from '../../src/pages/join-crew-page.js';

describe('join crew loading state', () => {
  beforeEach(() => {
    joinCrew.mockReset();
    window.sessionStorage.clear();
  });

  it('shows a loader while an authenticated user is joining', async () => {
    let resolveJoin;
    joinCrew.mockReturnValue(
      new Promise((resolve) => {
        resolveJoin = resolve;
      }),
    );
    const navigate = vi.fn();
    const session = {
      get: () => ({ session: { user: { id: 'user-1' } }, profile: { displayName: 'Maya' } }),
    };
    const rendered = renderJoinCrewPage({
      params: { inviteCode: 'eco123' },
      session,
      navigate,
    });
    const pending = rendered.afterRender();

    expect(rendered.element.querySelector('[data-join-card] [data-loading-state]')).not.toBeNull();
    expect(rendered.element.querySelector('[data-join-card]').getAttribute('aria-busy')).toBe(
      'true',
    );
    expect(rendered.element.querySelector('[data-join-action]').disabled).toBe(true);

    resolveJoin({ crewId: 'crew-1' });
    await pending;

    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });
});
