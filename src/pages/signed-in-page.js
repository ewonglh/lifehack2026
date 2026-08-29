import { avatar } from '../components/avatar.js';
import { escapeHtml } from '../lib/dom.js';

export const signedInPage = ({ session, profile, profileError }) => {
  const user = session?.user;
  const email = user?.email || 'Authenticated user';
  const nextPath = profile ? '/dashboard' : '/onboarding';
  const nextLabel = profile ? 'Go to dashboard' : 'Complete your profile';
  const recovery = profileError
    ? `<div class="alert alert-warning mt-4" role="alert"><strong>Your sign-in worked, but your profile is unavailable.</strong><p class="mb-0 mt-1">${escapeHtml(profileError.message)} You can continue to onboarding or ask an administrator to check the profiles table.</p></div>`
    : '';

  return {
    title: 'Signed in',
    content: `<section class="row justify-content-center"><div class="col-lg-7"><div class="surface-card card"><div class="card-body p-4 p-md-5 text-center">${avatar(profile || { display_name: email }, 'lg')}<p class="text-success fw-semibold mt-4 mb-1">Authentication complete</p><h1 class="h2">You’re signed in.</h1><p class="text-secondary mb-1">${escapeHtml(email)}</p><p class="text-secondary small">User ID: ${escapeHtml(user?.id || ' unavailable')}</p>${recovery}<div class="d-flex justify-content-center gap-2 flex-wrap mt-4"><a class="btn btn-primary" href="#${nextPath}">${nextLabel}</a><button class="btn btn-outline-secondary" type="button" data-sign-out>Log out</button></div></div></div></div></section>`,
  };
};
