import { ecoCrewService } from '../services/ecocrew-service.js';
import { cosmeticVisual } from '../components/cosmetic-visual.js';
import {
  appShell,
  escapeHtml,
  navigate as defaultNavigate,
} from '../features/ecocrew/page-utils.js';

const failureCopy = {
  liquid_present: {
    kicker: 'ONE SMALL FIX',
    title: 'Empty the bottle first.',
    summary: 'The bottle matches today’s action, but it still contains liquid.',
  },
  unrelated_item: {
    kicker: 'NOT TODAY’S ITEM',
    title: 'That item does not match today’s action.',
    summary: 'Today’s check is for one empty single-use plastic bottle.',
  },
  recycling_context_missing: {
    kicker: 'SHOW THE NEXT STEP',
    title: 'We need to see the bottle ready for recycling.',
    summary: 'Include the whole empty bottle and enough recycling context, then try again.',
  },
  low_confidence: {
    kicker: 'NEEDS A CLOSER LOOK',
    title: 'We need a clearer photo.',
    summary: 'Show the whole empty bottle and recycling context, then try again.',
  },
  upload_failure: {
    kicker: 'PHOTO NOT CHECKED',
    title: 'We could not check that photo.',
    summary: 'Choose another image or take a new photo and try again.',
  },
  ai_failure: {
    kicker: 'TEMPORARY PAUSE',
    title: 'The checker is taking a breather.',
    summary: 'Your progress is safe. Try the photo again in a moment.',
  },
};

function pointRows(points = {}) {
  return [
    ['Action completed', points.actionCompletion],
    ['Preparation step', points.preparation],
    ['Daily first action', points.dailyBonus],
  ]
    .filter((row) => Number(row[1]) > 0)
    .map(
      (row) =>
        '<div class="ecocrew-result-points__row"><span>' +
        row[0] +
        '</span><strong>+' +
        Number(row[1]) +
        '</strong></div>',
    )
    .join('');
}

export function renderSubmissionDetailPage({ navigate = defaultNavigate, params = {} } = {}) {
  const page = appShell(
    'Your action',
    'Bottle check',
    '<section class="ecocrew-result" data-result-card><div class="ecocrew-result__burst" data-result-icon aria-hidden="true">✦</div><p class="ecocrew-kicker" data-result-kicker>RESULT</p><h2 data-result-title>Checking your action…</h2><p data-result-summary>We’re loading your bottle guidance.</p><p class="ecocrew-muted" data-result-task hidden></p></section>' +
      '<section class="ecocrew-card ecocrew-action-checkin" data-action-checkin hidden><p class="ecocrew-kicker">SELF-REPORTED CHECK-IN</p><h2>Your bottle is ready.</h2><p>Your bottle is ready. Place it in recycling, then check in.</p><div class="ecocrew-actions"><button class="btn ecocrew-btn-primary" type="button" data-action="confirm">I recycled it</button><button class="btn ecocrew-btn-secondary" type="button" data-action="defer">Not yet</button></div><p class="ecocrew-muted">This check-in is self-reported. The photo helps check preparation and context; it does not prove disposal occurred.</p><p data-checkin-error class="ecocrew-form-error" role="alert" hidden></p></section>' +
      '<section class="ecocrew-card ecocrew-result-breakdown" data-result-breakdown hidden><div class="ecocrew-card__top"><div><p class="ecocrew-kicker">DISPOSAL GUIDANCE</p><h2 data-result-bin>—</h2></div><span data-result-confidence>—</span></div><details><summary>Why this result?</summary><p data-result-reason></p></details><div class="ecocrew-tip" data-result-tip hidden><strong>Prep tip</strong><span></span></div><div class="ecocrew-points" data-result-points></div></section>' +
      '<section class="ecocrew-unlock" data-result-unlock hidden><span data-result-unlock-icon aria-hidden="true">🌿</span><div><p class="ecocrew-kicker">REWARD MOMENT</p><strong data-result-unlock-title>Progress unlocked</strong><p data-result-unlock-copy></p></div></section>' +
      '<section class="ecocrew-card ecocrew-crew-result" data-crew-result hidden><p class="ecocrew-kicker">CREW NEXT STEP</p><h2>Keep going together.</h2><p data-crew-result-copy></p></section>' +
      '<div class="ecocrew-actions"><button class="btn ecocrew-btn-primary" type="button" data-action="home">Back to home</button><button class="btn ecocrew-btn-secondary" type="button" data-action="retry" hidden>Try another photo</button><button class="btn ecocrew-btn-secondary" type="button" data-action="crew" hidden>Join or create a crew</button></div>',
    'See the bottle guidance, complete the honest self-reported check-in, and view any reward you earned.',
  );

  let currentResult = null;
  let confirming = false;

  page
    .querySelector('[data-action="home"]')
    ?.addEventListener('click', () => navigate('/dashboard'));
  page.querySelector('[data-action="retry"]')?.addEventListener('click', () => navigate('/sort'));
  page.querySelector('[data-action="crew"]')?.addEventListener('click', () => navigate('/crew'));
  page
    .querySelector('[data-action="defer"]')
    ?.addEventListener('click', () => navigate('/dashboard'));
  page.querySelector('[data-action="confirm"]')?.addEventListener('click', async () => {
    if (!currentResult || confirming) return;
    confirming = true;
    const confirmButton = page.querySelector('[data-action="confirm"]');
    const checkinError = page.querySelector('[data-checkin-error]');
    confirmButton.disabled = true;
    checkinError.hidden = true;
    try {
      currentResult = await ecoCrewService.confirmAction({
        submissionId: currentResult.submissionId || currentResult.scanEventId,
        idempotencyKey: 'web-confirm-' + Date.now() + '-' + Math.random().toString(16).slice(2),
        action: 'recycle_bottle',
      });
      applyResult(currentResult);
    } catch (exception) {
      checkinError.textContent = exception.message || 'We could not save your check-in. Try again.';
      checkinError.hidden = false;
      confirmButton.disabled = false;
    } finally {
      confirming = false;
    }
  });

  function applyResult(result) {
    currentResult = result;
    const classification = result.classification || result;
    const failureReason = result.failureReason || classification.failureReason || null;
    const isPending =
      result.outcome === 'awaiting_check_in' || result.behaviorCheckIn?.status === 'pending';
    const isCompleted =
      !isPending &&
      (result.outcome === 'completed' ||
        result.behaviorCheckIn?.status === 'confirmed' ||
        result.validated === true ||
        result.isCorrect === true);
    const copy = isCompleted
      ? {
          kicker: 'ACTION COMPLETE',
          title: 'Thanks for checking in!',
          summary: 'Your recycling action is recorded as a self-reported check-in.',
        }
      : isPending
        ? {
            kicker: 'READY FOR CHECK-IN',
            title: 'Your bottle is ready.',
            summary: 'Place it in recycling, then check in to record the action.',
          }
        : failureCopy[failureReason] || failureCopy.low_confidence;
    const card = page.querySelector('[data-result-card]');
    card.classList.toggle('is-correct', isCompleted || isPending);
    card.classList.toggle('is-correction', !isCompleted && !isPending);
    page.querySelector('[data-result-icon]').textContent = isCompleted
      ? '✓'
      : isPending
        ? '→'
        : failureReason === 'low_confidence'
          ? '?'
          : '!';
    page.querySelector('[data-result-kicker]').textContent = copy.kicker;
    page.querySelector('[data-result-title]').textContent = copy.title;
    page.querySelector('[data-result-summary]').textContent = copy.summary;

    const taskSummary = page.querySelector('[data-result-task]');
    if (taskSummary && result.task) {
      taskSummary.hidden = false;
      taskSummary.textContent = result.task.title + ': ' + result.task.instruction;
    }

    const breakdown = page.querySelector('[data-result-breakdown]');
    breakdown.hidden = false;
    page.querySelector('[data-result-bin]').textContent =
      classification.recommendedBin || 'Guidance unavailable';
    page.querySelector('[data-result-confidence]').textContent =
      Math.round(Number(classification.confidence || 0) * 100) + '% confidence';
    page.querySelector('[data-result-reason]').textContent =
      classification.explanation || result.reason || copy.summary;
    const tip = page.querySelector('[data-result-tip]');
    if (classification.preparationTip) {
      tip.hidden = false;
      tip.querySelector('span').textContent = classification.preparationTip;
    } else {
      tip.hidden = true;
    }
    page.querySelector('[data-result-points]').innerHTML =
      '<div class="ecocrew-result-points__top"><span>Points earned</span><strong>' +
      Number(result.points?.total || 0) +
      '</strong></div>' +
      (pointRows(result.points) ||
        '<p class="ecocrew-muted">Points appear after you check in.</p>');

    const checkin = page.querySelector('[data-action-checkin]');
    checkin.hidden = !isPending;
    const retry = page.querySelector('[data-action="retry"]');
    retry.hidden = isCompleted || isPending;
    const home = page.querySelector('[data-action="home"]');
    home.textContent = isPending ? 'Back to home' : 'Back to home';
    const crewButton = page.querySelector('[data-action="crew"]');
    crewButton.hidden = !isCompleted;
    crewButton.textContent = result.crewUpdate ? 'View crew' : 'Join or create a crew';

    const unlock = page.querySelector('[data-result-unlock]');
    unlock.hidden = !isCompleted;
    if (isCompleted) {
      page.querySelector('[data-result-unlock-icon]').innerHTML = result.unlock
        ? cosmeticVisual(result.unlock, 'ecocrew-unlock__image')
        : escapeHtml('🌿');
      page.querySelector('[data-result-unlock-title]').textContent =
        result.unlock?.name || 'Progress unlocked';
      page.querySelector('[data-result-unlock-copy]').textContent = result.unlock
        ? result.unlock.name +
          ' is now part of your EcoCrew look.' +
          (result.nextUnlock?.name
            ? ' Next up: ' +
              result.nextUnlock.name +
              ' at ' +
              Number(result.nextUnlock.unlockXp || 0) +
              ' XP.'
            : '')
        : result.nextUnlock?.name
          ? 'Next up: ' +
            result.nextUnlock.name +
            ' at ' +
            Number(result.nextUnlock.unlockXp || 0) +
            ' XP.'
          : 'Your completed action moved you closer to the next cosmetic reward.';
    }

    const crewResult = page.querySelector('[data-crew-result]');
    crewResult.hidden = !isCompleted;
    if (isCompleted) {
      page.querySelector('[data-crew-result-copy]').textContent = result.crewUpdate
        ? 'Your crew has ' +
          Number(result.crewUpdate.missionProgress || 0) +
          ' mission points and ' +
          Number(result.crewUpdate.weeklyPoints || 0) +
          ' weekly league points.'
        : 'Your personal progress counts. Join or create a crew whenever you are ready.';
    }
  }

  return {
    element: page,
    title: 'Your action',
    afterRender: async () => {
      let result;
      try {
        result = await ecoCrewService.getLastResult(params.submissionId || 'latest');
      } catch (exception) {
        page.querySelector('[data-result-title]').textContent = 'Result unavailable';
        page.querySelector('[data-result-summary]').textContent =
          exception.message || 'We could not load this result. Please return home and try again.';
        return;
      }
      if (!result) {
        page.querySelector('[data-result-title]').textContent = 'No result yet';
        page.querySelector('[data-result-summary]').textContent =
          'Start today’s action first, then come back to see its guidance.';
        return;
      }
      applyResult(result);
    },
  };
}
