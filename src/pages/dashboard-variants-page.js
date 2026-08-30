import { loadingState } from '../components/loading-state.js';
import { ecoCrewService } from '../services/ecocrew-service.js';
import {
  appShell,
  escapeHtml,
  navigate as defaultNavigate,
  progressBar,
} from '../features/ecocrew/page-utils.js';

const statusDetails = {
  completed: { icon: '✓', label: 'completed', className: 'is-completed' },
  pending: { icon: '…', label: 'check-in pending', className: 'is-pending' },
  available: { icon: '○', label: 'ready to start', className: 'is-available' },
  missed: { icon: '×', label: 'not completed', className: 'is-missed' },
  upcoming: { icon: '·', label: 'upcoming', className: 'is-upcoming' },
};

const variantDetails = {
  banner: {
    id: 'banner',
    title: 'Streak Banner',
    subtitle: 'Clear and compact',
    kicker: 'OPTION A',
  },
  journey: {
    id: 'journey',
    title: 'Habit Journey',
    subtitle: 'Playful and motivational',
    kicker: 'OPTION B',
  },
  tiles: {
    id: 'tiles',
    title: 'Weekly Tiles',
    subtitle: 'Friendly and game-like',
    kicker: 'OPTION C',
  },
};

function text(value, fallback = '') {
  return escapeHtml(value ?? fallback);
}

function getStreak(data) {
  return {
    current: Number(data.personalStreak?.current ?? 0),
    longest: Number(data.personalStreak?.longest ?? 0),
  };
}

function getWeekDays(data) {
  return Array.isArray(data.weekProgress?.days) ? data.weekProgress.days : [];
}

function dayAriaLabel(day) {
  const detail = statusDetails[day.status] || statusDetails.upcoming;
  return (
    text(day.longLabel || day.shortLabel, 'Day') +
    (day.isToday ? ', today' : '') +
    ', ' +
    detail.label
  );
}

function statusIcon(day) {
  const detail = statusDetails[day.status] || statusDetails.upcoming;
  return (
    '<span class="ecocrew-dashboard-review__day-icon" aria-hidden="true">' +
    detail.icon +
    '</span><span class="visually-hidden">' +
    text(detail.label) +
    '</span>'
  );
}

function renderBannerStreak(data) {
  const streak = getStreak(data);
  const days = getWeekDays(data);
  const count = Number(data.weekProgress?.completedCount ?? 0);
  return (
    '<section class="ecocrew-dashboard-review__streak ecocrew-dashboard-review__streak--banner" aria-labelledby="review-banner-streak-title">' +
    '<div class="ecocrew-dashboard-review__streak-heading"><div><p class="ecocrew-kicker">YOUR STREAK</p><h3 id="review-banner-streak-title">' +
    text(streak.current) +
    ' day' +
    (streak.current === 1 ? '' : 's') +
    ' in a row</h3></div><div class="ecocrew-dashboard-review__best"><span>Best</span><strong>' +
    text(streak.longest) +
    ' days</strong></div></div>' +
    '<div class="ecocrew-dashboard-review__week-heading"><span>This week</span><strong>' +
    text(count) +
    ' / 7 complete</strong></div>' +
    '<div class="ecocrew-dashboard-review__day-row" role="list" aria-label="This week’s habit progress">' +
    days
      .map(
        (day) =>
          '<div class="ecocrew-dashboard-review__day ' +
          text((statusDetails[day.status] || statusDetails.upcoming).className) +
          (day.isToday ? ' is-today' : '') +
          '" role="listitem" aria-label="' +
          dayAriaLabel(day) +
          '"><span>' +
          text(day.shortLabel) +
          '</span>' +
          statusIcon(day) +
          '</div>',
      )
      .join('') +
    '</div></section>'
  );
}

function renderJourneyStreak(data) {
  const streak = getStreak(data);
  const days = getWeekDays(data);
  const count = Number(data.weekProgress?.completedCount ?? 0);
  return (
    '<section class="ecocrew-dashboard-review__streak ecocrew-dashboard-review__streak--journey" aria-labelledby="review-journey-streak-title"><div class="ecocrew-dashboard-review__journey-score"><span class="ecocrew-dashboard-review__flame" aria-hidden="true">🔥</span><div><p class="ecocrew-kicker">PERSONAL STREAK</p><h3 id="review-journey-streak-title">' +
    text(streak.current) +
    ' days strong</h3><p>Keep the chain moving today.</p></div><span class="ecocrew-dashboard-review__journey-best">Best ' +
    text(streak.longest) +
    '</span></div>' +
    '<ol class="ecocrew-dashboard-review__journey" aria-label="This week’s habit journey">' +
    days
      .map(
        (day) =>
          '<li class="ecocrew-dashboard-review__journey-day ' +
          text((statusDetails[day.status] || statusDetails.upcoming).className) +
          (day.isToday ? ' is-today' : '') +
          '" aria-label="' +
          dayAriaLabel(day) +
          '"><span class="ecocrew-dashboard-review__journey-node">' +
          statusIcon(day) +
          '</span><span>' +
          text(day.shortLabel) +
          '</span></li>',
      )
      .join('') +
    '</ol><p class="ecocrew-dashboard-review__journey-count">' +
    text(count) +
    ' of 7 days complete this week</p></section>'
  );
}

function renderTileStreak(data) {
  const streak = getStreak(data);
  const days = getWeekDays(data);
  const count = Number(data.weekProgress?.completedCount ?? 0);
  return (
    '<section class="ecocrew-dashboard-review__streak ecocrew-dashboard-review__streak--tiles" aria-labelledby="review-tiles-streak-title"><div class="ecocrew-dashboard-review__tiles-heading"><div><p class="ecocrew-kicker">WEEKLY COLLECTION</p><h3 id="review-tiles-streak-title">Keep your run alive</h3></div><div class="ecocrew-dashboard-review__tiles-counter"><strong>' +
    text(streak.current) +
    '</strong><span>day streak</span></div></div><div class="ecocrew-dashboard-review__tile-grid" role="list" aria-label="This week’s habit progress">' +
    days
      .map(
        (day) =>
          '<div class="ecocrew-dashboard-review__tile ' +
          text((statusDetails[day.status] || statusDetails.upcoming).className) +
          (day.isToday ? ' is-today' : '') +
          '" role="listitem" aria-label="' +
          dayAriaLabel(day) +
          '" title="' +
          dayAriaLabel(day) +
          '"><span>' +
          text(day.shortLabel) +
          '</span>' +
          statusIcon(day) +
          '</div>',
      )
      .join('') +
    '</div><div class="ecocrew-dashboard-review__tiles-footer"><span>' +
    text(count) +
    ' / 7 days complete</span><span>Best streak: ' +
    text(streak.longest) +
    '</span></div></section>'
  );
}

function renderTaskCard(data, variantId) {
  const task = data.task || {};
  const status = data.todayActionStatus || (data.todaySubmitted ? 'completed' : 'available');
  const actionDestination =
    status === 'completed' || status === 'pending'
      ? '/result/' + encodeURIComponent(data.todaySubmissionId || 'latest')
      : '/sort';
  const actionLabel =
    status === 'completed'
      ? 'View today’s result'
      : status === 'pending'
        ? 'Finish today’s check-in'
        : 'Start today’s action';
  const actionCopy =
    status === 'completed'
      ? 'Today’s action is complete. Keep the habit going.'
      : status === 'pending'
        ? 'Your photo is ready. Finish your check-in to count today.'
        : 'Empty it first, place it in recycling, then check in honestly.';
  return (
    '<section class="ecocrew-dashboard-review__task ecocrew-dashboard-review__task--' +
    text(variantId) +
    '"><p class="ecocrew-kicker">TODAY’S ACTION</p><p class="ecocrew-dashboard-review__task-title">' +
    text(task.title || 'Clean Bottle Check') +
    '</p><h3>' +
    text(task.instruction || 'Empty and recycle one plastic bottle.') +
    '</h3><p>' +
    text(actionCopy) +
    '</p><button class="btn ecocrew-btn-primary" type="button" data-variant-action data-destination="' +
    text(actionDestination) +
    '">' +
    text(actionLabel) +
    '</button></section>'
  );
}

function renderStats(data) {
  const crew = data.crew || {};
  const hasCrew = Boolean(crew.membership);
  const dailyPoints = Number(data.dailyPoints ?? data.todayPoints ?? 0);
  const weeklyPoints = hasCrew
    ? Number(data.weeklyPoints ?? crew.weeklyPoints ?? data.league?.weeklyPoints ?? 0)
    : null;
  return (
    '<section class="ecocrew-dashboard-review__stats" aria-label="Your progress"><article><span>Today</span><strong>' +
    text(dailyPoints) +
    '</strong><small>points earned</small></article><article><span>Crew streak</span><strong>' +
    text(crew.streak ? crew.streak + ' 🔥' : '—') +
    '</strong><small>days together</small></article><article><span>Weekly points</span><strong>' +
    text(weeklyPoints === null ? '—' : weeklyPoints) +
    '</strong><small>' +
    text(hasCrew ? 'this league week' : 'join a crew to track this') +
    '</small></article></section>'
  );
}

function renderMission(data) {
  const crew = data.crew || {};
  const mission = crew.mission;
  if (!crew.membership) {
    return '<section class="ecocrew-dashboard-review__mission ecocrew-dashboard-review__mission--empty"><p class="ecocrew-kicker">YOUR PROGRESS COUNTS</p><h3>You can start on your own.</h3><p>Complete today’s action now. After check-in, you can join or create a crew.</p></section>';
  }
  return (
    '<section class="ecocrew-dashboard-review__mission"><div><p class="ecocrew-kicker">WEEKLY MISSION</p><h3>' +
    text(mission?.title || 'Crew mission') +
    '</h3></div><span>' +
    text(mission?.endsLabel || '') +
    '</span>' +
    progressBar(mission?.progress || 0, mission?.target || 1, 'Weekly mission progress') +
    '<strong>' +
    text(mission ? mission.progress || 0 : 0) +
    ' / ' +
    text(mission ? mission.target || 0 : 0) +
    ' points</strong></section>'
  );
}

function renderVariant(data, variantId) {
  const variant = variantDetails[variantId];
  const streak =
    variantId === 'banner'
      ? renderBannerStreak(data)
      : variantId === 'journey'
        ? renderJourneyStreak(data)
        : renderTileStreak(data);
  return (
    '<article class="ecocrew-dashboard-review__variant ecocrew-dashboard-review__variant--' +
    text(variant.id) +
    '" data-dashboard-variant="' +
    text(variant.id) +
    '"><header class="ecocrew-dashboard-review__variant-heading"><div><p class="ecocrew-kicker">' +
    text(variant.kicker) +
    '</p><h2>' +
    text(variant.title) +
    '</h2></div><span>' +
    text(variant.subtitle) +
    '</span></header>' +
    renderTaskCard(data, variant.id) +
    streak +
    renderStats(data) +
    renderMission(data) +
    '</article>'
  );
}

export function renderDashboardVariantsPage({ navigate = defaultNavigate } = {}) {
  const page = appShell(
    'Dashboard design review',
    'TEMPORARY REVIEW',
    '<section class="ecocrew-dashboard-review" data-dashboard-variants aria-busy="true"><div data-dashboard-variants-loading>' +
      loadingState('Loading dashboard design options') +
      '</div><div data-dashboard-variants-content hidden><p class="ecocrew-dashboard-review__note">Temporary comparison only. Each option uses the same live progress and action flow.</p><div data-dashboard-variant-list></div></div></section>',
    'Compare three temporary personal-streak dashboard treatments before choosing the final design.',
  );

  return {
    element: page,
    title: 'Dashboard design review',
    afterRender: async () => {
      const region = page.querySelector('[data-dashboard-variants]');
      const loading = page.querySelector('[data-dashboard-variants-loading]');
      const content = page.querySelector('[data-dashboard-variants-content]');
      const list = page.querySelector('[data-dashboard-variant-list]');

      try {
        const data = await ecoCrewService.getDashboardData();
        if (list) {
          list.innerHTML = ['banner', 'journey', 'tiles']
            .map((variantId) => renderVariant(data, variantId))
            .join('');
        }
        if (loading) loading.hidden = true;
        if (content) content.hidden = false;
        if (region) region.setAttribute('aria-busy', 'false');
        page.querySelectorAll('[data-variant-action]').forEach((button) => {
          button.addEventListener('click', () => navigate(button.dataset.destination || '/sort'));
        });
      } catch {
        if (loading) loading.hidden = true;
        if (content) {
          content.hidden = false;
          content.innerHTML =
            '<div class="ecocrew-dashboard-review__error" role="alert">Dashboard design options are temporarily unavailable. Try again in a moment.</div>';
        }
        if (region) region.setAttribute('aria-busy', 'false');
      }
    },
  };
}

export const dashboardVariantsPage = ({ profile } = {}) => {
  const rendered = renderDashboardVariantsPage({ profile });
  return {
    title: rendered.title,
    content: rendered.element.outerHTML,
    afterRender: rendered.afterRender,
  };
};
