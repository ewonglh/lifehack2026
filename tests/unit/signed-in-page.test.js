import { describe, expect, it } from 'vitest';
import { signedInPage } from '../../src/pages/signed-in-page.js';

const session = { user: { id: 'user-1', email: 'member@example.com' } };

describe('signed-in page', () => {
  it('offers onboarding when no profile exists', () => {
    const page = signedInPage({ session, profile: null, profileError: null });
    expect(page.content).toContain('Complete your profile');
    expect(page.content).toContain('data-sign-out');
    expect(page.content).toContain('ecocrew-page--standalone');
  });

  it('offers the dashboard and profile recovery guidance', () => {
    const page = signedInPage({
      session,
      profile: { display_name: 'Maya' },
      profileError: { message: 'Profile lookup failed.' },
    });
    expect(page.content).toContain('Go to dashboard');
    expect(page.content).toContain('Profile lookup failed.');
  });
});
