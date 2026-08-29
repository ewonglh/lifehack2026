import { bins, demoScan } from '../features/ecocrew/mock-data.js';
import { getLastResult } from '../features/ecocrew/scan-service.js';
import { appShell, navigate } from '../features/ecocrew/page-utils.js';

export function renderSubmissionDetailPage() {
  const result = getLastResult() || { ...demoScan, userBin: 'recycle', isCorrect: true, points: { correctBin: 10, preparation: 5, dailyBonus: 10, total: 25 }, unlock: { name: 'Leaf Frame', icon: '🌿' } };
  const bin = bins.find((item) => item.id === result.recommendedBin);
  const isTaskCompletion = Boolean(result.task);
  const heading = isTaskCompletion ? 'Task complete!' : result.isCorrect ? 'Nailed it!' : 'Close one — now you know.';
  const page = appShell(heading, isTaskCompletion ? 'Daily task' : result.isCorrect ? 'Correct sort' : 'Sorting guidance', `
    <section class="ecocrew-result ${result.isCorrect ? 'is-correct' : 'is-correction'}">
      <div class="ecocrew-result__burst" aria-hidden="true">${result.isCorrect ? '✦' : '?'}</div>
      <p>${result.itemName}${isTaskCompletion ? '' : ` · ${Math.round(result.confidence * 100)}% confident`}</p>
      <h2>${isTaskCompletion ? 'Great work!' : `${bin.icon} ${bin.label}`}</h2>
      <div class="ecocrew-tip"><span aria-hidden="true">💡</span><div><strong>${isTaskCompletion ? 'Keep the habit going' : 'Prep it first'}</strong><p>${isTaskCompletion ? result.task.guidance : result.preparationTip}</p></div></div>
      <details><summary>${isTaskCompletion ? 'About this task' : 'Why this bin?'}</summary><p>${isTaskCompletion ? 'Daily tasks turn practical sustainable choices into progress for you and your crew.' : result.reason}</p></details>
    </section>
    <section class="ecocrew-card ecocrew-points"><p class="ecocrew-kicker">YOUR REWARD</p><h2>+${result.points.total} points</h2><div><span>Correct bin <b>+${result.points.correctBin}</b></span><span>Preparation tip <b>+${result.points.preparation}</b></span><span>First verified sort <b>+${result.points.dailyBonus}</b></span></div></section>
    ${result.unlock ? `<section class="ecocrew-unlock"><span aria-hidden="true">${result.unlock.icon}</span><div><p class="ecocrew-kicker">UNLOCKED</p><h2>${result.unlock.name}</h2><p>Your crew sees every good choice.</p></div></section>` : ''}
    <div class="ecocrew-actions"><button class="btn ecocrew-btn-primary" data-action="crew">Celebrate with crew</button><button class="btn ecocrew-btn-secondary" data-action="home">Back home</button></div>
  `);
  page.querySelector('[data-action="crew"]')?.addEventListener('click', () => navigate('/crew'));
  page.querySelector('[data-action="home"]')?.addEventListener('click', () => navigate('/dashboard'));
  return page;
}
