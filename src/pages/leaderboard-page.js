import { cosmetics, crew, leagueRows } from '../features/ecocrew/mock-data.js';
import { getCrewMembership, getDemoState, getLeagueResetLabel } from '../features/ecocrew/scan-service.js';
import { appShell, escapeHtml, navigate } from '../features/ecocrew/page-utils.js';

function rankedRows(weeklyPoints, crewName) {
  return leagueRows
    .map((row) => row.trend === 'you' ? { ...row, name: crewName, score: weeklyPoints } : { ...row })
    .sort((first, second) => second.score - first.score)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function renderLeaderboardPage() {
  const state = getDemoState();
  const membership = getCrewMembership();
  const crewName = membership?.crewName || crew.name;
  const rows = rankedRows(state.weeklyLeaguePoints, crewName);
  const yourIndex = rows.findIndex((row) => row.trend === 'you');
  const yourRow = rows[yourIndex];
  const nextCrew = yourIndex > 0 ? rows[yourIndex - 1] : null;
  const gap = nextCrew ? nextCrew.score - yourRow.score + 1 : 0;
  const positionText = nextCrew ? `${escapeHtml(crewName)} need ${gap} point${gap === 1 ? '' : 's'} to pass ${escapeHtml(nextCrew.name)}.` : `${escapeHtml(crewName)} are leading this week!`;
  const page = appShell('Sprout League', 'This week', `
    <section class="ecocrew-league-summary"><span aria-hidden="true">🌱</span><div><strong>#${yourRow.rank} of ${crew.league.total}</strong><p>${positionText}</p></div></section>
    <section class="ecocrew-league-points"><div><span>Weekly league points</span><strong>${state.weeklyLeaguePoints.toLocaleString()}</strong></div><small>${getLeagueResetLabel()}</small><p>Your lifetime profile points are kept permanently.</p></section>
    <section class="ecocrew-card ecocrew-rankings">${rows.map((row) => `<div class="ecocrew-ranking ${row.trend === 'you' ? 'is-you' : ''}"><strong>${row.rank}</strong><span class="ecocrew-ranking__badge">${row.rank === 1 ? '🏆' : '✦'}</span><b>${escapeHtml(row.name)}</b><small>${row.score.toLocaleString()} pts</small>${row.trend === 'you' ? '<em>You</em>' : ''}</div>`).join('')}</section>
    <section class="ecocrew-section-heading"><h2>Your collection</h2><button class="btn btn-link" data-action="crew">Crew</button></section>
    <section class="ecocrew-cosmetics">${cosmetics.map((item) => `<article class="ecocrew-cosmetic ${item.unlocked ? '' : 'is-locked'}"><span aria-hidden="true">${item.icon}</span><strong>${item.name}</strong><small>${item.equipped ? 'Equipped' : item.unlocked ? 'Ready to equip' : item.progress}</small>${item.unlocked && !item.equipped ? `<button class="btn btn-sm ecocrew-btn-secondary" data-equip="${item.id}">Equip</button>` : ''}</article>`).join('')}</section>
  `, 'Compare your crew’s points for the current weekly league. League points reset every Monday, while your profile’s lifetime points never reset.');
  page.querySelector('[data-action="crew"]')?.addEventListener('click', () => navigate('/crew'));
  page.querySelectorAll('[data-equip]').forEach((button) => button.addEventListener('click', () => { button.textContent = 'Equipped'; button.disabled = true; }));
  return page;
}
