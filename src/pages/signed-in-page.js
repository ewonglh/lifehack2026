import { escapeHtml } from '../lib/dom.js';
import { navigate as defaultNavigate, standaloneShell } from '../features/ecocrew/page-utils.js';

function displayName(profile, email) {
  return profile?.displayName || profile?.display_name || email || 'EcoCrew member';
}

export function renderSignedInPage({
  session,
  rawSession,
  profile,
  profileError,
  navigate = defaultNavigate,
} = {}) {
  const currentSession = rawSession || (session?.user ? session : session?.get?.()?.session);
  const user = currentSession?.user;
  const email = user?.email || 'Authenticated user';
  const name = displayName(profile, email);
  const nextPath = profile ? '/dashboard' : '/onboarding';
  const nextLabel = profile ? 'Go to dashboard' : 'Complete your profile';
  const recovery = profileError
    ? '<div class="ecocrew-form-error" role="alert"><strong>Your sign-in worked, but your profile is unavailable.</strong><p>' +
      escapeHtml(profileError.message) +
      ' You can continue to onboarding or ask an administrator to check your profile.</p></div>'
    : '';
  const page = standaloneShell(
    'You’re signed in',
    'Authentication complete',
    '<section class="ecocrew-card ecocrew-signed-in-card" aria-labelledby="signed-in-title"><div class="ecocrew-onboarding-avatar" aria-hidden="true">' +
      escapeHtml(name.charAt(0).toUpperCase()) +
      '</div><p class="ecocrew-kicker">WELCOME TO THE CREW</p><h2 id="signed-in-title">Your account is ready.</h2><p class="ecocrew-muted">' +
      escapeHtml(email) +
      '</p><p class="ecocrew-signed-in-id">User ID: ' +
      escapeHtml(user?.id || 'unavailable') +
      '</p>' +
      recovery +
      '<div class="ecocrew-actions"><a class="btn ecocrew-btn-primary" href="#' +
      nextPath +
      '">' +
      nextLabel +
      '</a><button class="btn ecocrew-btn-secondary" type="button" data-sign-out>Log out</button></div></section>',
    'Confirm that your EcoCrew session is ready, then continue to your profile or dashboard.',
  );

  page.querySelector('[data-sign-out]')?.addEventListener('click', async () => {
    await session?.signOut?.();
    navigate('/auth');
  });
  return { element: page, title: 'Signed in' };
}

export const signedInPage = ({ session, profile, profileError } = {}) => {
  const rendered = renderSignedInPage({ rawSession: session, profile, profileError });
  return { title: rendered.title, content: rendered.element.outerHTML };
};
