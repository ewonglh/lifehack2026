/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import { renderAuthCallbackPage } from '../../src/pages/auth-callback-page.js';

describe('authentication callback page', () => {
  it('routes an authenticated user with a profile to the dashboard', async () => {
    const navigate = vi.fn();
    const session = {
      refresh: vi.fn().mockResolvedValue({
        session: { user: { id: 'user-1' } },
        profile: { display_name: 'Maya' },
      }),
    };

    const rendered = renderAuthCallbackPage({ session, navigate });
    await rendered.afterRender();

    expect(navigate).toHaveBeenCalledWith('/dashboard', true);
  });

  it('routes a new authenticated user to onboarding', async () => {
    const navigate = vi.fn();
    const session = {
      refresh: vi.fn().mockResolvedValue({
        session: { user: { id: 'user-1' } },
        profile: null,
      }),
    };

    const rendered = renderAuthCallbackPage({ session, navigate });
    await rendered.afterRender();

    expect(navigate).toHaveBeenCalledWith('/onboarding', true);
  });
});
