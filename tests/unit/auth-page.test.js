import { describe, expect, it, vi } from 'vitest';
import { authPage, renderAuthPage } from '../../src/pages/auth-page.js';
import { authService } from '../../src/services/auth-service.js';

describe('auth page', () => {
  it('renders the authentication form and OAuth action', () => {
    const page = authPage();
    expect(page.content).toContain('data-auth-form');
    expect(page.content).toContain('data-social-login');
    expect(page.content).toContain('ecocrew-auth-page');
    expect(page.content).toContain('Sign in to EcoCrew');
    expect(page.content).not.toContain('Display name');
  });

  it('does not navigate locally after a live OAuth redirect starts', async () => {
    const signInWithOAuth = vi.spyOn(authService, 'signInWithOAuth').mockResolvedValue(undefined);
    const refresh = vi.fn();
    const navigate = vi.fn();
    const rendered = renderAuthPage({ session: { refresh }, navigate });

    rendered.element.querySelector('[data-social-login]').click();
    await vi.waitFor(() => expect(signInWithOAuth).toHaveBeenCalledWith('google'));

    expect(refresh).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    signInWithOAuth.mockRestore();
  });
});
