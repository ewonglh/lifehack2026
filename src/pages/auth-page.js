import { authService } from '../services/auth-service.js';
import { announce } from '../lib/dom.js';
import { email, minLength } from '../utils/validation.js';
import { useMockData } from '../config/env.js';

export const authPage = () => ({
  title: 'Sign in',
  content: `<div class="row justify-content-center"><section class="col-md-8 col-lg-5"><div class="surface-card card"><div class="card-body p-4 p-md-5"><h1 class="h2">Welcome to EcoCrew</h1><p class="text-secondary">Sign in or create your account to recycle with friends.</p>${useMockData ? '<div class="alert alert-info small" role="status">Development mock mode is active. No Supabase tables are required.</div>' : ''}<form data-auth-form novalidate><div class="mb-3"><label class="form-label" for="email">Email</label><input class="form-control" id="email" name="email" type="email" autocomplete="email" required></div><div class="mb-3"><label class="form-label" for="password">Password</label><input class="form-control" id="password" name="password" type="password" autocomplete="current-password" required minlength="8"></div><p class="text-danger small d-none" data-form-error role="alert"></p><div class="d-grid gap-2"><button class="btn btn-primary" type="submit" name="intent" value="sign-in">Sign in</button><button class="btn btn-outline-primary" type="submit" name="intent" value="sign-up">Create account</button><button class="btn btn-link" type="submit" name="intent" value="magic-link">Email me a magic link</button></div></form><div class="position-relative my-4 text-center text-secondary"><span class="bg-white px-2">or</span><hr class="position-absolute top-50 start-0 end-0 m-0 z-n1"></div><button class="btn btn-outline-secondary w-100" type="button" data-oauth="google"><i class="bi bi-google me-2" aria-hidden="true"></i>Continue with Google</button>${useMockData ? '<button class="btn btn-link btn-sm text-danger mt-3" type="button" data-reset-mock>Reset local demo data</button>' : ''}</div></div></section></div>`,
  afterRender: ({ navigate, session }) => {
    const form = document.querySelector('[data-auth-form]');
    const error = document.querySelector('[data-form-error]');
    const showError = (message) => {
      error.textContent = message;
      error.classList.remove('d-none');
    };
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.classList.add('d-none');
      const values = Object.fromEntries(new FormData(form));
      const intent = event.submitter?.value;
      const validation =
        email(values.email) ||
        (intent !== 'magic-link' && minLength(values.password, 8, 'Password'));
      if (validation) return showError(validation);
      try {
        if (intent === 'sign-up') await authService.signUp(values);
        else if (intent === 'magic-link') {
          await authService.sendMagicLink(values.email);
          announce('Check your inbox for the sign-in link.', 'success');
          return;
        } else await authService.signIn(values);
        await session.refresh();
        navigate('/onboarding');
      } catch (exception) {
        showError(exception.message || 'We could not sign you in.');
      }
    });
    document.querySelector('[data-oauth]').addEventListener('click', async () => {
      try {
        await authService.signInWithOAuth('google');
        await session.refresh();
        navigate('/onboarding');
      } catch (exception) {
        announce(exception.message, 'error');
      }
    });
  },
});
