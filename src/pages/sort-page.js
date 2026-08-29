import { gameService } from '../services/game-service.js';

export const sortPage = () => ({
  title: 'Today’s task',
  content: `<section class="page-intro mb-4"><p class="text-success fw-semibold mb-1">Today’s action</p><h1 class="display-6 fw-bold" data-task-prompt>Loading…</h1><p class="text-secondary">Upload a photo to check preparation and recycling context. Then check in after you complete the action.</p></section><section class="surface-card card"><div class="card-body p-4"><form data-task-form><div class="mb-3"><label class="form-label" for="task-image">Bottle photo</label><input class="form-control" id="task-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" required><div class="form-text">JPEG, PNG, or WebP up to 10 MB.</div></div><p class="text-danger small d-none" data-form-error role="alert"></p><button class="btn btn-primary" type="submit">Check my action</button></form></div></section>`,
  afterRender: async ({ navigate }) => {
    const task = await gameService.getDailyTask();
    document.querySelector('[data-task-prompt]').textContent = task?.prompt ?? 'No task available';
    const form = document.querySelector('[data-task-form]');
    const error = document.querySelector('[data-form-error]');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const file = form.elements.image.files[0];
      if (!file) return;
      error.classList.add('d-none');
      const button = form.querySelector('button');
      button.disabled = true;
      button.textContent = 'Checking image…';
      try {
        const result = await gameService.submitTask({
          file,
          taskId: task.taskId,
          idempotencyKey: window.crypto.randomUUID(),
        });
        navigate(`/result/${encodeURIComponent(result.submissionId ?? 'latest')}`);
      } catch (exception) {
        error.textContent = exception.message || 'We could not validate this image.';
        error.classList.remove('d-none');
        button.disabled = false;
        button.textContent = 'Check my action';
      }
    });
  },
});
