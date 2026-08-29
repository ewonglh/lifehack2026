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
  },
  lifetimePoints: 120,
  bestStreak: 4,
  cosmetics: [
    { id: 'moss', name: 'Moss badge', icon: '🌿', unlocked: true, equipped: false },
    { id: 'leaf', name: 'Leaf badge', icon: '🍃', unlocked: true, equipped: true },
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

    const equipButton = content.querySelector('[data-equip-cosmetic="moss"]');
    expect(equipButton).not.toBeNull();
    expect(equipButton.getAttribute('aria-pressed')).toBe('false');
    equipButton.click();

    await vi.waitFor(() => expect(equipCosmetic).toHaveBeenCalledWith('moss'));
  });
});
