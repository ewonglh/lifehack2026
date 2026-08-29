import { authService } from '../services/auth-service.js';
import { useMockData } from '../config/env.js';
import { navigate as defaultNavigate } from '../features/ecocrew/page-utils.js';
import { getPendingInviteCode } from './join-crew-page.js';

function authMarkup(isRegister) {
  const actionLabel = isRegister ? 'Create your EcoCrew account' : 'Sign in to EcoCrew';
  const supportingText = isRegister
    ? 'Start one small recycling action, then build the habit with friends.'
    : 'Pick up today’s bottle action and keep your progress moving.';
  return (
    '<main class="ecocrew-auth-page" tabindex="-1">' +
    '<div class="ecocrew-auth-header"><a class="ecocrew-wordmark ecocrew-auth-page__brand" href="#/auth"><span aria-hidden="true">✦</span> EcoCrew</a><details class="ecocrew-page-info"><summary aria-label="About EcoCrew sign in"><i class="bi bi-info-lg" aria-hidden="true"></i></summary><div class="ecocrew-page-info__panel"><strong>Sign in to EcoCrew</strong><p>Your account keeps your display name, points, crew progress, and private post summaries together.</p></div></details></div>' +
    '<section class="ecocrew-auth-card" aria-labelledby="auth-title">' +
    '<p class="ecocrew-eyebrow">' +
    (isRegister ? 'JOIN THE GOOD KIND OF COMPETITIVE' : 'YOUR CREW IS WAITING') +
    '</p><h1 id="auth-title">' +
    actionLabel +
    '</h1><p class="ecocrew-auth-card__lead">' +
    supportingText +
    '</p><form class="ecocrew-auth-form" data-auth-form novalidate>' +
    '<label>Email address<input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label>' +
    '<label>Password<input name="password" type="password" autocomplete="' +
    (isRegister ? 'new-password' : 'current-password') +
    '" placeholder="At least 8 characters" minlength="8" required></label>' +
    (isRegister
      ? '<label class="ecocrew-check"><input name="terms" type="checkbox" required><span>I agree to keep EcoCrew kind and respectful.</span></label>'
      : '') +
    '<p class="ecocrew-form-error" data-form-error role="alert" hidden></p>' +
    '<button class="btn ecocrew-btn-primary w-100" type="submit">' +
    (isRegister ? 'Create account' : 'Log in') +
    '</button></form>' +
    '<div class="ecocrew-auth-divider"><span>or continue with</span></div>' +
    '<button class="btn ecocrew-social-button w-100" type="button" data-social-login><i class="bi bi-google" aria-hidden="true"></i> Google</button>' +
    (useMockData
      ? '<button class="btn btn-link btn-sm text-danger mt-3" type="button" data-reset-mock>Reset local demo data</button>'
      : '') +
    '<p class="ecocrew-auth-switch">' +
    (isRegister ? 'Already part of EcoCrew?' : 'New to EcoCrew?') +
    ' <a href="#/' +
    (isRegister ? 'login' : 'register') +
    '">' +
    (isRegister ? 'Log in' : 'Create an account') +
    '</a></p></section></main>'
  );
}

export function renderAuthPage({ session, navigate = defaultNavigate } = {}) {
  const isRegister = window.location.hash.slice(1) === '/register';
  const container = document.createElement('div');
  container.innerHTML = authMarkup(isRegister);
  const page = container.firstElementChild;
  const form = page.querySelector('[data-auth-form]');
  const error = page.querySelector('[data-form-error]');

  const showError = (message) => {
    error.textContent = message;
    error.hidden = false;
  };
  const continueAfterAuth = async () => {
    const state = session?.get?.();
    const invite = getPendingInviteCode();
    if (invite && state?.profile) navigate('/join/' + encodeURIComponent(invite));
    else navigate(state?.profile ? '/dashboard' : '/onboarding');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    if (!form.checkValidity()) {
      showError('Please complete the highlighted fields to continue.');
      form.reportValidity();
      return;
    }
    const values = Object.fromEntries(new FormData(form));
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      if (isRegister) {
        await authService.signUp({ email: values.email, password: values.password });
        await session?.refresh?.();
        if (!session?.get?.().session?.user) {
          showError(
            'Account created. Check your email to confirm it, then return to EcoCrew to continue.',
          );
          submitButton.disabled = false;
          return;
        }
      } else {
        await authService.signIn({ email: values.email, password: values.password });
        await session?.refresh?.();
      }
      await continueAfterAuth();
    } catch (exception) {
      showError(exception.message || 'We could not sign you in.');
      submitButton.disabled = false;
    }
  });

  page.querySelector('[data-social-login]').addEventListener('click', async () => {
    try {
      const result = await authService.signInWithOAuth('google');
      // In Supabase mode this call has already started a full-page redirect to
      // Google. The callback page will restore the session after the redirect.
      if (!result?.mock) return;
      await session?.refresh?.();
      await continueAfterAuth();
    } catch (exception) {
      showError(exception.message || 'Google sign-in is unavailable right now.');
    }
  });
  return { element: page, title: isRegister ? 'Create an account' : 'Sign in' };
}

export const authPage = () => ({ title: 'Sign in', content: authMarkup(false) });
