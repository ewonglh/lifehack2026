import { escapeHtml } from '../lib/dom.js';
import { gameService } from '../services/game-service.js';

export const resultPage = () => ({
  title: 'Task result',
  content: `<section class="page-intro mb-4"><p class="text-success fw-semibold mb-1">Task result</p><h1 class="display-6 fw-bold">Your image was checked</h1></section><section class="surface-card card"><div class="card-body p-4" data-result>Loading result…</div></section>`,
  afterRender: async () => {
    const result = gameService.getLastSubmission();
    const target = document.querySelector('[data-result]');
    if (!result) {
      target.innerHTML = '<p class="mb-0">No recent task submission was found.</p>';
      return;
    }
    const valid = result.validated === true;
    target.innerHTML = `<div class="alert ${valid ? 'alert-success' : 'alert-warning'}"><h2 class="h4">${valid ? 'Task accepted' : 'Task not accepted'}</h2><p class="mb-0">${escapeHtml(result.validationReason || (valid ? 'Your task was verified.' : 'Try again with a clearer image.'))}</p></div><p class="mb-1"><strong>Points</strong></p><p>${result.points ?? 0}</p>${result.streak ? `<p class="mb-0"><strong>Daily streak:</strong> ${result.streak.current} day${result.streak.current === 1 ? '' : 's'}</p>` : ''}<a class="btn btn-primary mt-3" href="#/dashboard">Back to dashboard</a>`;
  },
});
