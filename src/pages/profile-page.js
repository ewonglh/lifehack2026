import { avatar } from '../components/avatar.js';
import { escapeHtml } from '../lib/dom.js';

export const profilePage = ({ profile }) => ({
  title: 'Your profile',
  content: `<section class="surface-card card"><div class="card-body p-4 p-md-5 d-flex gap-3 align-items-center">${avatar(profile, 'lg')}<div><h1 class="h2 mb-1">${escapeHtml(profile.display_name)}</h1><p class="text-secondary mb-0">${escapeHtml(profile.country)}</p></div></div></section><section class="mt-4"><h2 class="h4">About</h2><p>${escapeHtml(profile.bio || 'No profile bio yet.')}</p><a class="btn btn-outline-primary" href="#/settings">Edit profile and privacy</a></section>`,
});
