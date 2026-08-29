import { cosmetics, crew, leagueRows } from '../features/ecocrew/mock-data.js';
import { appShell, navigate } from '../features/ecocrew/page-utils.js';

export function renderLeaderboardPage() {
  const page = appShell('Sprout League', 'This week', `
    <section class="ecocrew-league-summary"><span aria-hidden="true">🌱</span><div><strong>#${crew.league.rank} of ${crew.league.total}</strong><p>Glass Guardians are 45 points from third place.</p></div></section>
    <section class="ecocrew-card ecocrew-rankings">${leagueRows.map((row) => `<div class="ecocrew-ranking ${row.trend === 'you' ? 'is-you' : ''}"><strong>${row.rank}</strong><span class="ecocrew-ranking__badge">${row.rank === 1 ? '🏆' : '✦'}</span><b>${row.name}</b><small>${row.score} pts</small>${row.trend === 'you' ? '<em>You</em>' : ''}</div>`).join('')}</section>
    <section class="ecocrew-section-heading"><h2>Your collection</h2><button class="btn btn-link" data-action="crew">Crew</button></section>
    <section class="ecocrew-cosmetics">${cosmetics.map((item) => `<article class="ecocrew-cosmetic ${item.unlocked ? '' : 'is-locked'}"><span aria-hidden="true">${item.icon}</span><strong>${item.name}</strong><small>${item.equipped ? 'Equipped' : item.unlocked ? 'Ready to equip' : item.progress}</small>${item.unlocked && !item.equipped ? `<button class="btn btn-sm ecocrew-btn-secondary" data-equip="${item.id}">Equip</button>` : ''}</article>`).join('')}</section>
  `);
  page.querySelector('[data-action="crew"]')?.addEventListener('click', () => navigate('/crew'));
  page.querySelectorAll('[data-equip]').forEach((button) => button.addEventListener('click', () => { button.textContent = 'Equipped'; button.disabled = true; }));
  return page;
}
