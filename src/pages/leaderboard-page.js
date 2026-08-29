import { crew, leagueRows } from '../features/ecocrew/mock-data.js';
import { equipDemoCosmetic, getCrewMemberCount, getCrewMembership, getDemoCosmetics, getDemoState, getLeagueAveragePoints, getLeagueMembership, getLeagueResetLabel, joinDemoLeague, leaveDemoLeague } from '../features/ecocrew/scan-service.js';
import { appShell, escapeHtml, navigate } from '../features/ecocrew/page-utils.js';

function rankedRows(averagePoints, crewName) {
  return leagueRows
    .map((row) => row.trend === 'you' ? { ...row, name: crewName, score: averagePoints } : { ...row })
    .sort((first, second) => second.score - first.score)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function leagueAccessContent(membership, leagueMembership) {
  if (!membership) {
    return `<section class="ecocrew-league-access"><p class="ecocrew-kicker">CREW REQUIRED</p><h2>Join a crew first</h2><p>League entries belong to crews. Create a crew or join one before entering the NUS League.</p><button class="btn ecocrew-btn-primary" type="button" data-action="crew">Join or create a crew</button></section>`;
  }
  if (!leagueMembership) {
    if (membership.role === 'owner') {
      const memberCount = getCrewMemberCount();
      if (memberCount < crew.league.minimumMembers) {
        return `<section class="ecocrew-league-access"><p class="ecocrew-kicker">${memberCount} OF ${crew.league.minimumMembers} MEMBERS</p><h2>Invite more crew members</h2><p>A crew needs at least ${crew.league.minimumMembers} members before its leader can join the NUS League.</p><button class="btn ecocrew-btn-secondary" type="button" data-action="crew">Back to crew</button></section>`;
      }
      return `<section class="ecocrew-league-access"><p class="ecocrew-kicker">CREW LEADER</p><h2>Ready to compete?</h2><p>Enter ${escapeHtml(membership.crewName)} in the NUS League. Your crew will then be able to view its standing.</p><button class="btn ecocrew-btn-primary" type="button" data-join-league>Join NUS League</button></section>`;
    }
    return `<section class="ecocrew-league-access"><p class="ecocrew-kicker">WAITING FOR YOUR LEADER</p><h2>Your crew has not entered yet</h2><p>Only the crew creator can join the NUS League. Ask your crew leader to enter the team.</p><button class="btn ecocrew-btn-secondary" type="button" data-action="crew">Back to crew</button></section>`;
  }
  return null;
}

export function renderLeaderboardPage() {
  const state = getDemoState();
  const cosmetics = getDemoCosmetics();
  const membership = getCrewMembership();
  const leagueMembership = getLeagueMembership();
  const accessContent = leagueAccessContent(membership, leagueMembership);
  if (accessContent) {
    const page = appShell(crew.league.name, 'This week', accessContent, 'Join the NUS League as a crew leader. Once your crew has entered, its members can view the weekly standings.');
    page.querySelector('[data-action="crew"]')?.addEventListener('click', () => navigate('/crew'));
    page.querySelector('[data-join-league]')?.addEventListener('click', () => {
      if (joinDemoLeague()) navigate('/league');
    });
    return page;
  }
  const crewName = membership?.crewName || crew.name;
  const averagePoints = getLeagueAveragePoints();
  const rows = rankedRows(averagePoints, crewName);
  const yourIndex = rows.findIndex((row) => row.trend === 'you');
  const yourRow = rows[yourIndex];
  const nextCrew = yourIndex > 0 ? rows[yourIndex - 1] : null;
  const gap = nextCrew ? nextCrew.score - yourRow.score + 1 : 0;
  const positionText = nextCrew ? `${escapeHtml(crewName)} need ${gap} point${gap === 1 ? '' : 's'} to pass ${escapeHtml(nextCrew.name)}.` : `${escapeHtml(crewName)} are leading this week!`;
  const page = appShell(crew.league.name, 'This week', `
    <div class="ecocrew-league-actions"><button class="btn ecocrew-btn-secondary" type="button" data-leave-league>Leave league</button></div>
    <section class="ecocrew-league-summary"><span aria-hidden="true">🌱</span><div><strong>#${yourRow.rank} of ${crew.league.total}</strong><p>${positionText}</p></div></section>
    <section class="ecocrew-league-points"><div><span>Average weekly points per member</span><strong>${averagePoints.toLocaleString()}</strong></div><small>${getLeagueResetLabel()}</small><p>Rankings use each crew’s average points per person, so crew size does not create an advantage.</p></section>
    <section class="ecocrew-card ecocrew-rankings">${rows.map((row) => `<div class="ecocrew-ranking ${row.trend === 'you' ? 'is-you' : ''}"><strong>${row.rank}</strong><span class="ecocrew-ranking__badge">${row.rank === 1 ? '🏆' : '✦'}</span><b>${escapeHtml(row.name)}</b><small>${row.score.toLocaleString()} avg</small>${row.trend === 'you' ? '<em>You</em>' : ''}</div>`).join('')}</section>
    <section class="ecocrew-section-heading"><h2>Your collection</h2><button class="btn btn-link" data-action="crew">Crew</button></section>
    <section class="ecocrew-cosmetics">${cosmetics.map((item) => `<article class="ecocrew-cosmetic ${item.unlocked ? '' : 'is-locked'}"><span aria-hidden="true">${item.icon}</span><strong>${item.name}</strong><small>${item.equipped ? 'Equipped' : item.unlocked ? 'Ready to equip' : item.progress}</small>${item.unlocked && !item.equipped ? `<button class="btn btn-sm ecocrew-btn-secondary" data-equip="${item.id}">Equip</button>` : ''}</article>`).join('')}</section>
  `, 'Compare your crew’s points for the current weekly league. League points reset every Monday, while your profile’s lifetime points never reset.');
  page.querySelector('[data-action="crew"]')?.addEventListener('click', () => navigate('/crew'));
  page.querySelector('[data-leave-league]')?.addEventListener('click', () => {
    const confirmed = window.confirm(`Leave ${crew.league.name}? Your crew’s score for this week will be removed.`);
    if (confirmed && leaveDemoLeague()) navigate('/league');
  });
  page.querySelectorAll('[data-equip]').forEach((button) => button.addEventListener('click', () => {
    if (equipDemoCosmetic(button.dataset.equip)) navigate('/league');
  }));
  return page;
}
