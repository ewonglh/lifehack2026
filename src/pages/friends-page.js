import { activity, crew } from '../features/ecocrew/mock-data.js';
import { addReaction, getDemoState } from '../features/ecocrew/scan-service.js';
import { appShell, navigate, progressBar } from '../features/ecocrew/page-utils.js';

export function renderFriendsPage() {
  const state = getDemoState();
  const page = appShell(crew.name, 'Your eco crew', `
    <section class="ecocrew-crew-hero"><div class="ecocrew-member-stack">${crew.members.map((member) => `<span class="ecocrew-avatar ecocrew-avatar--${member.tone}">${member.initials}</span>`).join('')}</div><div><strong>${crew.members.length} members · ${crew.streak}-day streak 🔥</strong><p>One more contribution protects today’s streak.</p></div><button class="btn ecocrew-btn-secondary" data-action="invite">Invite</button></section>
    <section class="ecocrew-card ecocrew-mission-card"><div class="ecocrew-card__top"><div><p class="ecocrew-kicker">${crew.mission.title.toUpperCase()}</p><h2>Keep the monster shrinking</h2></div><span>${crew.mission.endsLabel}</span></div>${progressBar(state.missionProgress, crew.mission.target, 'Mission progress')}<div class="ecocrew-mission-card__footer"><strong>${state.missionProgress} / ${crew.mission.target} points</strong><button class="btn btn-link" data-action="league">League board</button></div></section>
    <section class="ecocrew-feed"><div class="ecocrew-section-heading"><h2>Crew activity</h2><span>Celebrate milestones</span></div>${activity.map((entry) => `<article class="ecocrew-feed-item"><span class="ecocrew-feed-item__emoji" aria-hidden="true">${entry.emoji}</span><div><p><strong>${entry.actor}</strong> ${entry.action}</p><small>${entry.time}</small><button class="btn btn-sm" data-reaction="${entry.id}">👏 ${entry.reactions + (state.reactions[entry.id] || 0)}</button></div></article>`).join('')}</section>
  `);
  page.querySelectorAll('[data-reaction]').forEach((button) => button.addEventListener('click', () => {
    const stateAfterReaction = addReaction(button.dataset.reaction);
    button.textContent = `👏 ${Number(button.textContent.match(/\d+/)[0]) + 1}`;
    button.disabled = true;
    button.setAttribute('aria-label', `Reaction added. ${stateAfterReaction.reactions[button.dataset.reaction]} new reactions in this demo.`);
  }));
  page.querySelector('[data-action="league"]')?.addEventListener('click', () => navigate('/league'));
  page.querySelector('[data-action="invite"]')?.addEventListener('click', async (event) => {
    const link = `${window.location.origin}${window.location.pathname}#join/glass-guardians`;
    try { await navigator.clipboard.writeText(link); event.currentTarget.textContent = 'Copied!'; } catch { window.prompt('Copy this crew invite link:', link); }
  });
  return page;
}
