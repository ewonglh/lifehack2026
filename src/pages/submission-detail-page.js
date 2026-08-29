import { ecoCrewService } from '../services/ecocrew-service.js';
import { appShell, navigate as defaultNavigate } from '../features/ecocrew/page-utils.js';

function pointRows(points = {}) {
  const rows = [
    ['Correct bin', points.correctBin],
    ['Preparation step', points.preparation],
    ['Daily first post', points.dailyBonus],
  ].filter((row) => Number(row[1]) > 0);
  if (!rows.length) return '<p class="ecocrew-muted">No points were awarded for this post.</p>';
  return rows
    .map((row) => '<div class="ecocrew-result-points__row"><span>' + row[0] + '</span><strong>+' + Number(row[1]) + '</strong></div>')
    .join('');
}

export function renderSubmissionDetailPage({ navigate = defaultNavigate } = {}) {
  const page = appShell(
    'Your result',
    'Post checked',
    '<section class="ecocrew-result" data-result-card><div class="ecocrew-result__burst" data-result-icon aria-hidden="true">✦</div><p class="ecocrew-kicker" data-result-kicker>RESULT</p><h2 data-result-title>Checking your post…</h2><p data-result-summary>We’re loading the disposal guidance.</p></section>' +
      '<section class="ecocrew-card ecocrew-result-breakdown" data-result-breakdown hidden><div class="ecocrew-card__top"><div><p class="ecocrew-kicker">DISPOSAL GUIDE</p><h2 data-result-bin>—</h2></div><span data-result-confidence>—</span></div><p data-result-reason></p><div class="ecocrew-tip" data-result-tip hidden><strong>Prep tip</strong><span></span></div><div class="ecocrew-points" data-result-points></div></section>' +
      '<section class="ecocrew-card ecocrew-crew-result" data-crew-result hidden><p class="ecocrew-kicker">CREW PROGRESS</p><h2 data-crew-result-title>Keep going together.</h2><p data-crew-result-copy></p></section>' +
      '<div class="ecocrew-actions"><button class="btn ecocrew-btn-primary" type="button" data-action="home">Back to home</button><button class="btn ecocrew-btn-secondary" type="button" data-action="crew">View crew</button></div>',
    'See how your selected bin compares with the disposal recommendation, what to do next, and how many points your post earned.',
  );

  page.querySelector('[data-action="home"]')?.addEventListener('click', () => navigate('/dashboard'));
  page.querySelector('[data-action="crew"]')?.addEventListener('click', () => navigate('/crew'));

  return {
    element: page,
    title: 'Task result',
    afterRender: async () => {
      const result = ecoCrewService.getLastResult();
      const card = page.querySelector('[data-result-card]');
      const breakdown = page.querySelector('[data-result-breakdown]');
      const crewResult = page.querySelector('[data-crew-result]');
      if (!result) {
        page.querySelector('[data-result-title]').textContent = 'No result yet';
        page.querySelector('[data-result-summary]').textContent = 'Create a post first, then come back to see its guidance.';
        return;
      }

      const classification = result.classification || result;
      const needsConfirmation =
        classification.matchesTask === false ||
        Number(classification.confidence || 0) < 0.7 ||
        classification.recommendedBin === 'unknown';
      const isCorrect = result.isCorrect === true;
      card.classList.add(isCorrect ? 'is-correct' : 'is-correction');
      page.querySelector('[data-result-icon]').textContent = isCorrect ? '✓' : needsConfirmation ? '?' : '!';
      page.querySelector('[data-result-kicker]').textContent = isCorrect ? 'CORRECT SORT' : needsConfirmation ? 'NEEDS A CLOSER LOOK' : 'TRY AGAIN NEXT TIME';
      page.querySelector('[data-result-title]').textContent = isCorrect ? 'Nice choice.' : needsConfirmation ? 'We need more certainty.' : 'That bin was not the best match.';
      page.querySelector('[data-result-summary]').textContent = needsConfirmation
        ? 'The image or task match was not confident enough to validate this post.'
        : 'You chose ' + (result.userSelectedBin || 'a bin') + '. The recommended destination is shown below.';

      breakdown.hidden = false;
      page.querySelector('[data-result-bin]').textContent = classification.recommendedBin || 'Unknown';
      page.querySelector('[data-result-confidence]').textContent = Math.round(Number(classification.confidence || 0) * 100) + '% confidence';
      page.querySelector('[data-result-reason]').textContent = classification.explanation || result.reason || 'The server did not provide an additional explanation.';
      const tip = page.querySelector('[data-result-tip]');
      if (classification.preparationTip) {
        tip.hidden = false;
        tip.querySelector('span').textContent = classification.preparationTip;
      }
      page.querySelector('[data-result-points]').innerHTML =
        '<div class="ecocrew-result-points__top"><span>Points earned</span><strong>' + Number(result.points?.total || 0) + '</strong></div>' +
        pointRows(result.points);

      if (result.crewUpdate) {
        crewResult.hidden = false;
        page.querySelector('[data-crew-result-copy]').textContent =
          'Your crew has ' + Number(result.crewUpdate.missionProgress || 0) + ' mission points and ' +
          Number(result.crewUpdate.weeklyPoints || 0) + ' weekly league points.';
      }
    },
  };
}
