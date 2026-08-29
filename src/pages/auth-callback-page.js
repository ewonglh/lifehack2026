import { escapeHtml } from '../lib/dom.js';
import { navigate as defaultNavigate, standaloneShell } from '../features/ecocrew/page-utils.js';
import { getPendingInviteCode } from './join-crew-page.js';

export function renderAuthCallbackPage({ session, navigate = defaultNavigate } = {}) {
  const page = standaloneShell(
    'Completing sign in',
    'One moment',
    '<section class="ecocrew-card ecocrew-message-card" data-callback-content aria-live="polite"><div class="ecocrew-message-card__icon" aria-hidden="true">⌁</div><h2>Restoring your EcoCrew session…</h2><p class="ecocrew-muted">We are checking your account before sending you to the right next step.</p><div class="ecocrew-loading-bar" aria-hidden="true"></div></section>',
    'EcoCrew is securely restoring your authenticated session.',
  );

  return {
    element: page,
    title: 'Completing sign in',
    afterRender: async () => {
      try {
        const restored = await session.refresh();
        const current = restored || session.get?.();
        const invite = getPendingInviteCode();
        const nextPath =
          invite && current?.profile
            ? '/join/' + encodeURIComponent(invite)
            : current?.profile
              ? '/dashboard'
              : '/onboarding';
        navigate(nextPath, true);
      } catch (error) {
        const content = page.querySelector('[data-callback-content]');
        if (!content) throw error;
        content.innerHTML =
          '<div class="ecocrew-message-card__icon" aria-hidden="true">!</div><p class="ecocrew-kicker">SIGN-IN ERROR</p><h2>We could not complete sign in.</h2><p class="ecocrew-muted">' +
          escapeHtml(error.message || 'Please try again.') +
          '</p><div class="ecocrew-actions"><a class="btn ecocrew-btn-primary" href="#/auth">Return to sign in</a><button class="btn ecocrew-btn-secondary" type="button" data-sign-out>Sign out</button></div>';
      }
    },
  };
}

export const authCallbackPage = () => {
  const rendered = renderAuthCallbackPage();
  return { title: rendered.title, content: rendered.element.outerHTML };
};
