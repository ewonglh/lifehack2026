import { escapeHtml } from '../lib/dom.js';

export const dashboardPage = ({ profile }) => ({
  title: 'Your EcoCrew',
  content: `<div class="page-intro mb-4"><p class="text-success fw-semibold mb-1">Welcome back</p><h1 class="display-6 fw-bold">Hi, ${escapeHtml(profile.display_name)}.</h1><p class="text-secondary">Your competition dashboard will appear here as the game features are connected.</p></div><div class="surface-card card"><div class="card-body p-4"><h2 class="h4">Ready for today’s sort?</h2><p class="text-secondary">Upload, leaderboards, and challenges are owned by the competition experience team.</p><a class="btn btn-primary" href="#/friends">Invite a friend</a></div></div>`,
});
