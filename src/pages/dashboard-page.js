import { crew } from '../features/ecocrew/mock-data.js';
import { getDailyTask, getDemoState } from '../features/ecocrew/scan-service.js';
import { appShell, navigate } from '../features/ecocrew/page-utils.js';

export function renderDashboardPage() {
  const state = getDemoState();
  const dailyTask = getDailyTask();
  const remaining = Math.max(0, state.dailyCap - state.dailyScans);
  const page = appShell('Make today count.', 'Good morning, Irfan', `
    <section class="ecocrew-hero-card">
      <div><p class="ecocrew-kicker">TODAY'S TASK</p><h2>${dailyTask.title}</h2><p>${remaining ? `${dailyTask.guidance} ${remaining} post${remaining === 1 ? '' : 's'} left today.` : 'Daily verified posts complete — nice work!'}</p></div>
      <span class="ecocrew-hero-card__art" aria-hidden="true">♻</span>
      <button class="btn ecocrew-btn-primary" data-action="sort" ${remaining ? '' : 'disabled'}>${remaining ? 'Complete today’s task' : 'Come back tomorrow'}</button>
    </section>
    <section class="ecocrew-stat-grid" aria-label="Your progress">
      <article><span>Today</span><strong>${state.todayPoints}</strong><small>points earned</small></article>
      <article><span>Crew streak</span><strong>${crew.streak} <i>🔥</i></strong><small>days together</small></article>
      <article><span>Repair token</span><strong>${crew.repairTokens}</strong><small>ready this week</small></article>
    </section>
    <section class="ecocrew-next-unlock"><span aria-hidden="true">🍄</span><div><p class="ecocrew-kicker">NEXT UNLOCK</p><strong>Mushroom Frame</strong><small>2 more completed tasks</small></div></section>
  `);
  page.querySelector('[data-action="sort"]')?.addEventListener('click', () => navigate('/sort'));
  page.querySelector('[data-action="crew"]')?.addEventListener('click', () => navigate('/crew'));
  return page;
}
