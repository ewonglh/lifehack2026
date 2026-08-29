import { escapeHtml } from '../lib/dom.js';
import { gameService } from '../services/game-service.js';

export const dashboardPage = ({ profile }) => ({
  title: 'Your EcoCrew',
  content: `<div class="page-intro mb-4"><p class="text-success fw-semibold mb-1">Welcome back</p><h1 class="display-6 fw-bold">Hi, ${escapeHtml(profile.display_name)}.</h1><p class="text-secondary">Complete your daily task and help your crew climb the league.</p></div><section class="surface-card card mb-4"><div class="card-body p-4"><div class="d-flex justify-content-between align-items-start gap-3"><div><p class="text-success fw-semibold mb-1">Today’s task</p><h2 class="h4" data-task-prompt>Loading task…</h2><p class="text-secondary mb-0" data-task-meta></p></div><a class="btn btn-primary" href="#/sort">Start task</a></div></div></section><section class="row g-3"><div class="col-md-6"><article class="surface-card card h-100"><div class="card-body"><h2 class="h5">Crew and streak</h2><p class="mb-0" data-crew-status>Loading crew status…</p></div></article></div><div class="col-md-6"><article class="surface-card card h-100"><div class="card-body"><h2 class="h5">League</h2><p class="mb-0" data-league-status>Loading league status…</p></div></article></div></section>`,
  afterRender: async () => {
    const [task, current] = await Promise.all([
      gameService.getDailyTask(),
      gameService.getCurrentLeague(),
    ]);
    document.querySelector('[data-task-prompt]').textContent =
      task?.prompt ?? 'No task is available today.';
    document.querySelector('[data-task-meta]').textContent = task?.targetMaterial
      ? `Target: ${task.targetMaterial} ${task.targetObject}`
      : 'Complete one valid task today.';
    document.querySelector('[data-crew-status]').textContent = current.squadId
      ? current.crewStreak
        ? `Today: ${current.crewStreak.completed_members}/${current.crewStreak.total_members} completed; ${current.crewStreak.required_members} needed for the crew streak.`
        : 'You are participating with your crew.'
      : 'You are working independently. Join a crew to earn league XP.';
    const league = current.league?.leagues;
    document.querySelector('[data-league-status]').textContent = current.queue
      ? 'Your crew is queued for the next league.'
      : league?.status === 'active'
        ? `${league.name} is active.`
        : 'Your crew is not currently in a league.';
  },
});
