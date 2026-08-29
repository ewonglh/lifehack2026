import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/main.scss';
import { createRouter } from './app/router.js';
import { session } from './app/session.js';
import { announce } from './lib/dom.js';
import { validateEnvironment } from './config/env.js';
import { authService } from './services/auth-service.js';
import { publicLayout } from './layouts/public-layout.js';
import { resetMockState } from './services/mock-store.js';

function renderStartupError(error) {
  root.innerHTML = publicLayout(
    `<section class="py-5 text-center"><div class="alert alert-danger text-start" role="alert"><h1 class="h4">EcoCrew could not start.</h1><p>${error.message || 'The session could not be restored.'}</p><div class="d-flex gap-2"><button class="btn btn-primary" type="button" data-retry-session>Try again</button><a class="btn btn-outline-secondary" href="#/auth">Continue to sign in</a></div></div></section>`,
  );
}

const root = document.querySelector('#app');
const router = createRouter({ root, session });

document.addEventListener('click', async (event) => {
  const retry = event.target.closest('[data-retry-session]');
  if (retry) {
    try {
      await session.restore();
      router.start();
    } catch (error) {
      renderStartupError(error);
    }
    return;
  }
  const reset = event.target.closest('[data-reset-mock]');
  if (reset) {
    resetMockState();
    await session.signOut();
    announce('Local demo data was reset.', 'success');
    router.navigate('/auth');
    return;
  }
  const signOut = event.target.closest('[data-sign-out]');
  if (!signOut) return;
  try {
    await session.signOut();
    announce('You have signed out.', 'success');
    router.navigate('/auth');
  } catch {
    announce('We could not sign you out. Please try again.', 'error');
  }
});

const environment = validateEnvironment();
if (environment.mode === 'mock') {
  console.info(
    'EcoCrew is running with local mock data. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Supabase.',
  );
}
if (!environment.valid) {
  renderStartupError(
    new Error('Add Supabase credentials, or enable VITE_USE_MOCK_DATA during development.'),
  );
  // Keep the invalid production configuration on its visible recovery screen.
} else {
  try {
    await session.restore();
    authService.onChange(() =>
      session
        .refresh()
        .then(() => router.start())
        .catch(renderStartupError),
    );
    router.start();
  } catch (error) {
    renderStartupError(error);
  }
}
