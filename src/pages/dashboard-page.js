import { crew } from '../features/ecocrew/mock-data.js';
import { getDemoState } from '../features/ecocrew/scan-service.js';
import { appShell, navigate, progressBar } from '../features/ecocrew/page-utils.js';

export function renderDashboardPage() {
  const state = getDemoState();
  const remaining = Math.max(0, state.dailyCap - state.dailyScans);
  const page = appShell('Make today count.', 'Good morning, Irfan', `
    <section class="ecocrew-hero-card">
      <div><p class="ecocrew-kicker">TODAY'S SORT</p><h2>One small choice.<br>Big crew energy.</h2><p>${remaining ? `${remaining} verified sort${remaining === 1 ? '' : 's'} left today.` : 'Daily verified sorts complete — nice work!'}</p></div>
      <span class="ecocrew-hero-card__art" aria-hidden="true">♻</span>
      <button class="btn ecocrew-btn-primary" data-action="sort" ${remaining ? '' : 'disabled'}>${remaining ? 'Sort today’s item' : 'Come back tomorrow'}</button>
    </section>
    <section class="ecocrew-stat-grid" aria-label="Your progress">
      <article><span>Today</span><strong>${state.todayPoints}</strong><small>points earned</small></article>
      <article><span>Crew streak</span><strong>${crew.streak} <i>🔥</i></strong><small>days together</small></article>
      <article><span>Repair token</span><strong>${crew.repairTokens}</strong><small>ready this week</small></article>
    </section>
    <section class="ecocrew-card ecocrew-mission-card"><div class="ecocrew-card__top"><div><p class="ecocrew-kicker">WEEKLY MISSION</p><h2>${crew.mission.title}</h2></div><span>${crew.mission.endsLabel}</span></div>${progressBar(state.missionProgress, crew.mission.target, 'Weekly mission progress')}<div class="ecocrew-mission-card__footer"><strong>${state.missionProgress} / ${crew.mission.target}</strong><button class="btn btn-link" data-action="crew">View crew</button></div></section>
    <section class="ecocrew-next-unlock"><span aria-hidden="true">🍄</span><div><p class="ecocrew-kicker">NEXT UNLOCK</p><strong>Mushroom Frame</strong><small>2 more correct sorts</small></div></section>
  `);
  page.querySelector('[data-action="sort"]')?.addEventListener('click', () => navigate('/sort'));
  page.querySelector('[data-action="crew"]')?.addEventListener('click', () => navigate('/crew'));
  return page;
}
