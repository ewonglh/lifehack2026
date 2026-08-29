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
    'Make today count.',
    name === 'there' ? 'Your daily check-in' : 'Welcome back, ' + name,
    '<section class="ecocrew-hero-card">' +
      '<div><p class="ecocrew-kicker">TODAY’S TASK</p><h2 data-dashboard-task>Loading today’s task…</h2><p data-dashboard-task-meta>One verified choice helps your crew.</p></div>' +
      '<span class="ecocrew-hero-card__art" aria-hidden="true">♻</span>' +
      '<button class="btn ecocrew-btn-primary" type="button" data-action="sort">Complete today’s task</button>' +
      '</section>' +
      '<section class="ecocrew-stat-grid" aria-label="Your progress">' +
      '<article><span>Today</span><strong data-dashboard-today>—</strong><small>points earned</small></article>' +
      '<article><span>Crew streak</span><strong data-dashboard-streak>—</strong><small>days together</small></article>' +
      '<article><span>Weekly points</span><strong data-dashboard-weekly>—</strong><small data-dashboard-weekly-label>this league week</small></article>' +
      '</section>' +
      '<section class="ecocrew-card ecocrew-mission-card">' +
      '<div class="ecocrew-card__top"><div><p class="ecocrew-kicker">WEEKLY MISSION</p><h2 data-dashboard-mission>Loading mission…</h2></div><span data-dashboard-mission-end></span></div>' +
      '<div data-dashboard-progress></div>' +
      '<div class="ecocrew-mission-card__footer"><strong data-dashboard-mission-count>—</strong><button class="btn btn-link" type="button" data-action="crew">View crew</button></div>' +
      '</section>' +
      '<section class="ecocrew-next-unlock"><span aria-hidden="true">🍄</span><div><p class="ecocrew-kicker">NEXT UNLOCK</p><strong>Keep contributing</strong><small>Cosmetics appear as your crew progresses.</small></div></section>',
    'See your assigned daily task, personal points, crew progress, and the next action for your EcoCrew.',
  );

  page.querySelector('[data-action="sort"]')?.addEventListener('click', (event) => {
    navigate(event.currentTarget.dataset.destination || '/sort');
  });
  page.querySelector('[data-action="crew"]')?.addEventListener('click', () => navigate('/crew'));

  return {
    element: page,
    title: 'Dashboard',
    afterRender: async () => {
      try {
        const data = await ecoCrewService.getDashboardData();
        const task = data.task;
        const crew = data.crew || {};
        const mission = crew.mission;
        const dailyPoints = Number(data.dailyPoints ?? data.todayPoints ?? 0);
        const hasCrew = Boolean(crew.membership);
        const weeklyPoints = hasCrew
          ? Number(data.weeklyPoints ?? crew.weeklyPoints ?? data.league?.weeklyPoints ?? 0)
          : null;
        const button = page.querySelector('[data-action="sort"]');

        setText(page, '[data-dashboard-task]', task?.prompt || 'No task is available today.');
        setText(
          page,
          '[data-dashboard-task-meta]',
          task?.targetMaterial
            ? 'Target: ' + task.targetMaterial + ' ' + (task.targetObject || 'item')
            : 'Complete one valid task today.',
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
        setText(page, '[data-dashboard-mission]', mission?.title || 'Crew mission');
        setText(page, '[data-dashboard-mission-end]', mission?.endsLabel || '');
        setText(
          page,
          '[data-dashboard-mission-count]',
          mission
            ? String(mission.progress || 0) + ' / ' + String(mission.target || 0) + ' points'
            : 'Join a crew to contribute',
        );
        const progressTarget = page.querySelector('[data-dashboard-progress]');
        if (progressTarget) {
          progressTarget.innerHTML = mission
            ? progressBar(mission.progress, mission.target, 'Weekly mission progress')
            : '<p class="ecocrew-muted">Join a crew to unlock shared progress.</p>';
        }
        if (button) {
          if (data.todaySubmitted) {
            button.textContent = 'View today’s result';
            button.dataset.destination =
              '/result/' + encodeURIComponent(data.todaySubmissionId || 'latest');
            setText(page, '[data-dashboard-task-meta]', 'Today’s challenge is complete.');
          } else {
            button.textContent = crew.membership ? 'Complete today’s task' : 'Start today’s task';
            button.dataset.destination = '/sort';
          }
        }
      } catch (exception) {
        setText(page, '[data-dashboard-task]', 'Your task is temporarily unavailable.');
        setText(page, '[data-dashboard-task-meta]', exception.message || 'Try again in a moment.');
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
