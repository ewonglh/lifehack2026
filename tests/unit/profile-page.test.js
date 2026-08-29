/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProfileData = vi.hoisted(() => vi.fn());
const equipCosmetic = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/ecocrew-service.js', () => ({
  ecoCrewService: {
    getProfileData,
    equipCosmetic,
    saveProfile: vi.fn(),
  },
}));

import { renderProfilePage } from '../../src/pages/profile-page.js';

const profileData = {
  profile: {
    displayName: '<Ari>',
    handle: '@ari',
    location: 'Singapore',
    about: '<script>alert(1)</script>',
    leaderboardVisible: true,
    frameId: 'leaf-frame',
  },
  lifetimePoints: 120,
  bestStreak: 4,
  cosmetics: [
    { id: 'leaf-frame', name: 'Leaf Frame', kind: 'frame', unlocked: true, equipped: true },
    { id: 'moss', name: 'Moss badge', icon: '🌿', unlocked: true, equipped: false },
  ],
  posts: [
    {
      itemName: '<Bottle>',
      finalBin: 'recycle',
      isCorrect: true,
      points: 20,
      createdAt: '2026-08-29T00:00:00.000Z',
    },
  ],
};

describe('profile cosmetics and post history', () => {
  beforeEach(() => {
    getProfileData.mockReset().mockResolvedValue(profileData);
    equipCosmetic.mockReset().mockResolvedValue({ id: 'moss' });
  });

  it('renders escaped profile/post text and directly equips unlocked cosmetics', async () => {
    const rendered = renderProfilePage({ sessionState: { session: { user: { id: 'user-1' } } } });
    await rendered.afterRender();

    const content = rendered.element.querySelector('[data-profile-content]');
    expect(content.innerHTML).toContain('&lt;Ari&gt;');
    expect(content.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(content.innerHTML).toContain('&lt;Bottle&gt;');
    expect(rendered.element.textContent).toContain('Task history');
    expect(rendered.element.textContent).toContain('tasks completed');
    expect(rendered.element.textContent).toContain('Daily task completed');
    expect(rendered.element.textContent).not.toMatch(/posts?/i);
    expect(rendered.element.textContent).not.toContain('action');
    expect(content.querySelector('.ecocrew-profile-frame')).not.toBeNull();
    expect(content.querySelector('[data-equip-cosmetic="leaf-frame"] img')).not.toBeNull();

    const equipButton = content.querySelector('[data-equip-cosmetic="moss"]');
    expect(equipButton).not.toBeNull();
    expect(equipButton.getAttribute('aria-pressed')).toBe('false');
    equipButton.click();

    await vi.waitFor(() => expect(equipCosmetic).toHaveBeenCalledWith('moss'));
  });

  it('shows a loader until profile data is available', async () => {
    let resolveProfile;
    getProfileData.mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );
    const rendered = renderProfilePage({ sessionState: { session: { user: { id: 'user-1' } } } });
    const pending = rendered.afterRender();

    expect(
      rendered.element.querySelector('[data-profile-content] [data-loading-state]'),
    ).not.toBeNull();
    expect(rendered.element.querySelector('[data-profile-content]').getAttribute('aria-busy')).toBe(
      'true',
    );
    expect(rendered.element.querySelector('[data-edit]')).toBeNull();

    resolveProfile(profileData);
    await pending;

    expect(
      rendered.element.querySelector('[data-profile-content] [data-loading-state]'),
    ).toBeNull();
    expect(rendered.element.querySelector('[data-profile-content]').getAttribute('aria-busy')).toBe(
      'false',
    );
    expect(rendered.element.querySelector('[data-edit]')).not.toBeNull();
  });

  it('replaces the profile loader with an accessible error', async () => {
    getProfileData.mockRejectedValue(new Error('Profile service is unavailable.'));
    const rendered = renderProfilePage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-loading-state]')).toBeNull();
    expect(rendered.element.querySelector('[data-profile-content]').getAttribute('aria-busy')).toBe(
      'false',
    );
    expect(
      rendered.element.querySelector('[data-profile-content] [role="alert"]').textContent,
    ).toContain('Profile service is unavailable.');
  });
});
