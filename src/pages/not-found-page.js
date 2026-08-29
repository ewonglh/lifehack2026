import { navigate as defaultNavigate, standaloneShell } from '../features/ecocrew/page-utils.js';

export function notFoundPage({ navigate = defaultNavigate } = {}) {
  const page = standaloneShell(
    'That page has moved on.',
    'Not found',
    '<section class="ecocrew-card ecocrew-message-card" aria-labelledby="not-found-title"><div class="ecocrew-message-card__code" aria-hidden="true">404</div><h2 id="not-found-title">Nothing to sort here.</h2><p class="ecocrew-muted">The page you requested is not part of this EcoCrew.</p><button class="btn ecocrew-btn-primary" type="button" data-go-auth>Return to sign in</button></section>',
    'This route does not exist. Return to sign in to enter EcoCrew.',
  );
  page.querySelector('[data-go-auth]')?.addEventListener('click', () => navigate('/auth'));
  return { element: page, title: 'Page not found' };
}
