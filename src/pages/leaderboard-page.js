import { crew, leagues } from '../features/ecocrew/mock-data.js';
import { equipDemoCosmetic, getCrewMemberCount, getCrewMembership, getDemoCosmetics, getLeagueAveragePoints, getLeagueMembership, getLeagueResetLabel, joinDemoLeague, leaveDemoLeague } from '../features/ecocrew/scan-service.js';
import { appShell, escapeHtml, navigate } from '../features/ecocrew/page-utils.js';

function rankedRows(league, averagePoints, crewName) {
  return league.rows
    .map((row) => row.trend === 'you' ? { ...row, name: crewName, score: averagePoints } : { ...row })
    .sort((first, second) => second.score - first.score)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function leagueAccessContent(membership, leagueMembership) {
  if (!membership) {
    return `<section class="ecocrew-league-access"><p class="ecocrew-kicker">CREW REQUIRED</p><h2>Join a crew first</h2><p>League entries belong to crews. Create a crew or join one before entering a league.</p><button class="btn ecocrew-btn-primary" type="button" data-action="crew">Join or create a crew</button></section>`;
  }
  if (!leagueMembership) {
    if (membership.role === 'owner') {
      const memberCount = getCrewMemberCount();
      const minimumMembers = Math.min(...leagues.map((league) => league.minimumMembers));
      const needsMembers = memberCount < minimumMembers;
      return `<section class="ecocrew-league-access"><p class="ecocrew-kicker">${needsMembers ? `${memberCount} OF ${minimumMembers} MEMBERS` : 'CREW LEADER'}</p><h2>${needsMembers ? 'Invite more crew members' : 'Available leagues'}</h2><p>${needsMembers ? `A crew needs at least ${minimumMembers} members before its leader can join a league.` : `Choose where ${escapeHtml(membership.crewName)} will compete. Your crew will then be able to view its standing.`}</p><div class="ecocrew-league-picker">${leagues.map((league) => `<article class="ecocrew-league-option"><strong>${escapeHtml(league.name)}</strong><small>Minimum ${league.minimumMembers} members</small><button class="btn ecocrew-btn-primary" type="button" data-join-league="${league.id}" ${memberCount < league.minimumMembers ? 'disabled' : ''}>Join ${escapeHtml(league.name)}</button></article>`).join('')}</div>${needsMembers ? '<button class="btn ecocrew-btn-secondary" type="button" data-action="crew">Back to crew</button>' : ''}</section>`;
    }
    return `<section class="ecocrew-league-access"><p class="ecocrew-kicker">WAITING FOR YOUR LEADER</p><h2>Your crew has not entered yet</h2><p>Only the crew creator can join a league. Ask your crew leader to enter the team.</p><button class="btn ecocrew-btn-secondary" type="button" data-action="crew">Back to crew</button></section>`;
  }
  return null;
}

export function renderLeaderboardPage() {
  const cosmetics = getDemoCosmetics();
  const membership = getCrewMembership();
  const leagueMembership = getLeagueMembership();
  const accessContent = leagueAccessContent(membership, leagueMembership);
  if (accessContent) {
    const page = appShell('League', 'This week', accessContent, 'Choose a league as a crew leader. Once your crew has entered, its members can view the weekly standings.');
    page.querySelector('[data-action="crew"]')?.addEventListener('click', () => navigate('/crew'));
    page.querySelectorAll('[data-join-league]').forEach((button) => button.addEventListener('click', () => {
      if (joinDemoLeague(button.dataset.joinLeague)) navigate('/league');
    }));
    return page;
  }
  const activeLeague = leagues.find((league) => league.id === leagueMembership.leagueId || league.name === leagueMembership.leagueName) || leagues[0];
  const crewName = membership?.crewName || crew.name;
  const averagePoints = getLeagueAveragePoints();
  const rows = rankedRows(activeLeague, averagePoints, crewName);
  const yourIndex = rows.findIndex((row) => row.trend === 'you');
  const yourRow = rows[yourIndex];
  const nextCrew = yourIndex > 0 ? rows[yourIndex - 1] : null;
  const gap = nextCrew ? nextCrew.score - yourRow.score + 1 : 0;
  const positionText = nextCrew ? `${escapeHtml(crewName)} need ${gap} point${gap === 1 ? '' : 's'} to pass ${escapeHtml(nextCrew.name)}.` : `${escapeHtml(crewName)} are leading this week!`;
  const page = appShell(activeLeague.name, 'This week', `
    ${membership?.role === 'owner' ? '<div class="ecocrew-league-actions"><button class="btn ecocrew-btn-secondary" type="button" data-leave-league>Leave league</button></div>' : ''}
    <section class="ecocrew-league-summary"><span aria-hidden="true">🌱</span><div><strong>#${yourRow.rank} of ${activeLeague.total}</strong><p>${positionText}</p></div></section>
    <section class="ecocrew-league-points"><div><span>Average weekly points per member</span><strong>${averagePoints.toLocaleString()}</strong></div><small>${getLeagueResetLabel()}</small><p>Rankings use each crew’s average points per person, so crew size does not create an advantage.</p></section>
    <section class="ecocrew-card ecocrew-rankings">${rows.map((row) => `<div class="ecocrew-ranking ${row.trend === 'you' ? 'is-you' : ''}"><strong>${row.rank}</strong><span class="ecocrew-ranking__badge">${row.rank === 1 ? '🏆' : '✦'}</span><b>${escapeHtml(row.name)}</b><small>${row.score.toLocaleString()} avg</small>${row.trend === 'you' ? '<em>You</em>' : ''}</div>`).join('')}</section>
    <section class="ecocrew-section-heading"><h2>Your collection</h2><button class="btn btn-link" data-action="crew">Crew</button></section>
    <section class="ecocrew-cosmetics">${cosmetics.map((item) => `<article class="ecocrew-cosmetic ${item.unlocked ? '' : 'is-locked'}"><span aria-hidden="true">${item.icon}</span><strong>${item.name}</strong><small>${item.equipped ? 'Equipped' : item.unlocked ? 'Ready to equip' : item.progress}</small>${item.unlocked && !item.equipped ? `<button class="btn btn-sm ecocrew-btn-secondary" data-equip="${item.id}">Equip</button>` : ''}</article>`).join('')}</section>
  `, 'Compare your crew’s points for the current weekly league. League points reset every Monday, while your profile’s lifetime points never reset.');
  page.querySelector('[data-action="crew"]')?.addEventListener('click', () => navigate('/crew'));
  page.querySelector('[data-leave-league]')?.addEventListener('click', () => {
    const confirmed = window.confirm(`Leave ${activeLeague.name}? Your crew’s score for this week will be removed.`);
    if (confirmed && leaveDemoLeague()) navigate('/league');
  });
  page.querySelectorAll('[data-equip]').forEach((button) => button.addEventListener('click', () => {
    if (equipDemoCosmetic(button.dataset.equip)) navigate('/league');
  }));
  return page;
}
