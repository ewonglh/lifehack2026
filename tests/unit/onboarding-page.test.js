/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import { renderOnboardingPage } from '../../src/pages/onboarding-page.js';

describe('onboarding page', () => {
  it('uses the standalone EcoCrew theme and only asks for a display name', () => {
    const rendered = renderOnboardingPage({
      session: { saveProfile: vi.fn() },
      navigate: vi.fn(),
    });

    expect(rendered.element.classList.contains('ecocrew-page--standalone')).toBe(true);
    expect(rendered.element.querySelectorAll('input').length).toBe(1);
    expect(rendered.element.querySelector('[name="displayName"]')).not.toBeNull();
    expect(rendered.element.querySelector('[data-onboarding-avatar]').textContent).toBe('?');
  });

  it('saves the display name and navigates to the dashboard', async () => {
    const saveProfile = vi.fn().mockResolvedValue({ displayName: 'Maya Chen' });
    const navigate = vi.fn();
    const rendered = renderOnboardingPage({ session: { saveProfile }, navigate });
    const input = rendered.element.querySelector('[name="displayName"]');
    const form = rendered.element.querySelector('[data-profile-form]');

    input.value = 'Maya Chen';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(saveProfile).toHaveBeenCalledWith({ displayName: 'Maya Chen' }));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
    expect(rendered.element.querySelector('[data-onboarding-avatar]').textContent).toBe('MC');
  });
});
