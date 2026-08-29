import { navigate } from '../features/ecocrew/page-utils.js';

function authMarkup(isRegister) {
  const actionLabel = isRegister ? 'Create your account' : 'Welcome back';
  const supportingText = isRegister
    ? 'Join your crew and turn everyday choices into a shared win.'
    : 'Pick up where your crew left off.';

  return `
    <main class="ecocrew-auth-page">
      <a class="ecocrew-wordmark ecocrew-auth-page__brand" href="#/dashboard"><span aria-hidden="true">✦</span> EcoCrew</a>
      <section class="ecocrew-auth-card" aria-labelledby="auth-title">
        <p class="ecocrew-eyebrow">${isRegister ? 'JOIN THE GOOD KIND OF COMPETITIVE' : 'YOUR CREW IS WAITING'}</p>
        <h1 id="auth-title">${actionLabel}</h1>
        <p class="ecocrew-auth-card__lead">${supportingText}</p>
        <form class="ecocrew-auth-form" novalidate>
          ${isRegister ? `<label>Display name<input name="name" type="text" autocomplete="name" placeholder="What should your crew call you?" required></label>` : ''}
          <label>Email address<input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label>
          <label>Password<input name="password" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" placeholder="At least 8 characters" minlength="8" required></label>
          ${isRegister ? `<label class="ecocrew-check"><input name="terms" type="checkbox" required><span>I agree to keep EcoCrew kind and respectful.</span></label>` : ''}
          <p class="ecocrew-form-error" role="alert" hidden></p>
          <button class="btn ecocrew-btn-primary w-100" type="submit">${isRegister ? 'Create account' : 'Log in'}</button>
        </form>
        <div class="ecocrew-auth-divider"><span>or continue with</span></div>
        <button class="btn ecocrew-social-button w-100" type="button" data-social-login><i class="bi bi-google" aria-hidden="true"></i> Google</button>
        <p class="ecocrew-auth-switch">${isRegister ? 'Already part of EcoCrew?' : 'New to EcoCrew?'} <a href="#/${isRegister ? 'login' : 'register'}">${isRegister ? 'Log in' : 'Create an account'}</a></p>
      </section>
    </main>
  `;
}

export function renderAuthPage() {
  const isRegister = window.location.hash.slice(1) === '/register';
  const container = document.createElement('div');
  container.innerHTML = authMarkup(isRegister);
  const page = container.firstElementChild;
  const form = page.querySelector('form');
  const error = page.querySelector('.ecocrew-form-error');

  function continueToDashboard() {
    sessionStorage.setItem('ecocrew-demo-signed-in', 'true');
    navigate('/dashboard');
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      error.textContent = 'Please complete the highlighted fields to continue.';
      error.hidden = false;
      form.reportValidity();
      return;
    }
    continueToDashboard();
  });
  page.querySelector('[data-social-login]').addEventListener('click', continueToDashboard);
  return page;
}
