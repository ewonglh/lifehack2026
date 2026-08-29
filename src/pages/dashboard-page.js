import { ecoCrewService } from '../services/ecocrew-service.js';
import {
  appShell,
  navigate as defaultNavigate,
  progressBar,
} from '../features/ecocrew/page-utils.js';

function profileName(profile) {
  return profile?.displayName || profile?.display_name || 'there';
}

function setText(page, selector, value) {
  const target = page.querySelector(selector);
  if (target) target.textContent = value;
}

export function renderDashboardPage({ profile, navigate = defaultNavigate } = {}) {
  const name = profileName(profile);
  const page = appShell(
    'Today’s action',
    name === 'there' ? 'Your bottle habit' : 'Welcome back, ' + name,
    '<section class="ecocrew-hero-card">' +
      '<div><p class="ecocrew-kicker" data-dashboard-task-title>CLEAN BOTTLE CHECK</p><h2 data-dashboard-task-instruction>Loading today’s action…</h2><p data-dashboard-task-meta>Loading today’s task…</p></div>' +
      '<span class="ecocrew-hero-card__art" aria-hidden="true">♻</span>' +
      '<button class="btn ecocrew-btn-primary" type="button" data-action="sort">Start today’s action</button>' +
      '</section>' +
      '<section class="ecocrew-stat-grid" aria-label="Your progress">' +
      '<article><span>Today</span><strong data-dashboard-today>0</strong><small>points earned</small></article>' +
      '<article><span>Crew streak</span><strong data-dashboard-streak>—</strong><small>days together</small></article>' +
      '<article><span>Weekly points</span><strong data-dashboard-weekly>—</strong><small data-dashboard-weekly-label>this league week</small></article>' +
      '</section>' +
      '<section class="ecocrew-card ecocrew-mission-card" data-dashboard-crew-card>' +
      '<div class="ecocrew-card__top"><div><p class="ecocrew-kicker">WEEKLY MISSION</p><h2 data-dashboard-mission>Loading mission…</h2></div><span data-dashboard-mission-end></span></div>' +
      '<div data-dashboard-progress></div>' +
      '<div class="ecocrew-mission-card__footer"><strong data-dashboard-mission-count>—</strong></div>' +
      '</section>' +
      '<section class="ecocrew-card ecocrew-dashboard-no-crew" data-dashboard-no-crew hidden><p class="ecocrew-kicker">YOUR PROGRESS COUNTS</p><h2>You can start on your own.</h2><p class="ecocrew-muted">Complete today’s action now. After check-in, you can join or create a crew.</p></section>',
    'Complete one small bottle-recycling action, check in honestly, and build your progress over time.',
  );

  page.querySelector('[data-action="sort"]')?.addEventListener('click', (event) => {
    navigate(event.currentTarget.dataset.destination || '/sort');
  });
  page.querySelector('[data-action="crew"]')?.addEventListener('click', () => navigate('/crew'));

  return {
    element: page,
    title: 'Today’s action',
    afterRender: async () => {
      try {
        const data = await ecoCrewService.getDashboardData();
        const crew = data.crew || {};
        const mission = crew.mission;
        const dailyPoints = Number(data.dailyPoints ?? data.todayPoints ?? 0);
        const hasCrew = Boolean(crew.membership);
        const weeklyPoints = hasCrew
          ? Number(data.weeklyPoints ?? crew.weeklyPoints ?? data.league?.weeklyPoints ?? 0)
          : null;
        const button = page.querySelector('[data-action="sort"]');
        const noCrew = page.querySelector('[data-dashboard-no-crew]');
        const crewCard = page.querySelector('[data-dashboard-crew-card]');
        const status = data.todayActionStatus || (data.todaySubmitted ? 'completed' : 'available');
        const task = data.task || {};
        setText(page, '[data-dashboard-task-title]', task.title || 'Today’s action');
        setText(
          page,
          '[data-dashboard-task-instruction]',
          task.instruction || 'Empty and recycle one plastic bottle.',
        );

        setText(
          page,
          '[data-dashboard-task-meta]',
          status === 'pending'
            ? 'Your bottle is ready. Finish the check-in when you have recycled it.'
            : status === 'completed'
              ? 'Today’s action is complete. Keep the habit going.'
              : 'Empty it first, place it in recycling, then check in.',
        );
        setText(page, '[data-dashboard-today]', String(dailyPoints));
        setText(
          page,
          '[data-dashboard-weekly]',
          weeklyPoints === null ? '—' : String(weeklyPoints),
        );
        setText(
          page,
          '[data-dashboard-weekly-label]',
          hasCrew ? 'this league week' : 'join a crew to track this',
        );
        setText(page, '[data-dashboard-streak]', crew.streak ? String(crew.streak) + ' 🔥' : '—');
        if (crewCard) crewCard.hidden = false;
        if (noCrew) noCrew.hidden = hasCrew;
        if (hasCrew) {
          setText(page, '[data-dashboard-mission]', mission?.title || 'Crew mission');
          setText(page, '[data-dashboard-mission-end]', mission?.endsLabel || '');
          setText(
            page,
            '[data-dashboard-mission-count]',
            mission
              ? String(mission.progress || 0) + ' / ' + String(mission.target || 0) + ' points'
              : 'No mission yet',
          );
          const progressTarget = page.querySelector('[data-dashboard-progress]');
          if (progressTarget) {
            progressTarget.innerHTML = mission
              ? progressBar(mission.progress, mission.target, 'Weekly mission progress')
              : '<p class="ecocrew-muted">Your weekly mission will appear here soon.</p>';
          }
        } else {
          setText(page, '[data-dashboard-mission]', 'Join a crew to unlock the weekly mission.');
          setText(page, '[data-dashboard-mission-end]', '');
          setText(page, '[data-dashboard-mission-count]', 'No crew yet');
          const progressTarget = page.querySelector('[data-dashboard-progress]');
          if (progressTarget) {
            progressTarget.innerHTML =
              '<p class="ecocrew-muted">Weekly mission progress will appear after you join a crew.</p>';
          }
        }
        if (button) {
          if (status === 'completed') {
            button.textContent = 'View today’s result';
            button.dataset.destination =
              '/result/' + encodeURIComponent(data.todaySubmissionId || 'latest');
          } else if (status === 'pending') {
            button.textContent = 'Finish today’s action';
            button.dataset.destination =
              '/result/' + encodeURIComponent(data.todaySubmissionId || 'latest');
          } else {
            button.textContent = 'Start today’s action';
            button.dataset.destination = '/sort';
          }
        }
      } catch {
        setText(
          page,
          '[data-dashboard-task-meta]',
          'Today’s daily task is temporarily unavailable. Try again in a moment.',
        );
      }
    },
  };
}

export const dashboardPage = ({ profile } = {}) => {
  const rendered = renderDashboardPage({ profile });
  return {
    title: rendered.title,
    content: rendered.element.outerHTML,
    afterRender: rendered.afterRender,
  };
};
