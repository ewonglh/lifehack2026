import { ecoCrewService } from '../services/ecocrew-service.js';
import { appShell, navigate as defaultNavigate } from '../features/ecocrew/page-utils.js';

function percent(value) {
  return Math.round(Number(value || 0)) + '%';
}

export function renderMeasurementPage({ navigate = defaultNavigate } = {}) {
  const page = appShell(
    'Measure the habit',
    'Behaviour change',
    '<section class="ecocrew-card ecocrew-measurement-card"><p class="ecocrew-kicker" data-measurement-label>DEMO MEASUREMENT</p><h2>Baseline vs follow-up</h2><p class="ecocrew-muted">We compare a short unaided check before guidance with an equivalent check after seven days.</p><div class="ecocrew-measurement-grid"><article><p class="ecocrew-kicker">BASELINE</p><strong data-measurement-baseline>—</strong><span>Prepared correctly</span><span data-measurement-baseline-prep>—</span><span>Recycled action reported</span><span data-measurement-baseline-recycled>—</span></article><article><p class="ecocrew-kicker">FOLLOW-UP</p><strong data-measurement-follow-up>—</strong><span>Prepared correctly</span><span data-measurement-follow-up-prep>—</span><span>Recycled action reported</span><span data-measurement-follow-up-recycled>—</span></article></div><div class="ecocrew-measurement-target"><strong>Provisional target: +20 percentage points</strong><span data-measurement-change>Loading the demo comparison…</span></div></section>' +
      '<section class="ecocrew-card"><p class="ecocrew-kicker">HOW WE READ IT</p><h2>Two behaviour signals</h2><p class="ecocrew-muted">We measure whether the bottle was prepared correctly and whether the user reported completing the recycling action. Points, streaks, scan volume, and AI similarity are engagement or validation signals—not proof of real-world behaviour change.</p><p class="ecocrew-muted">Task images are never saved. Optional self-report context after seven days can help explain the change.</p></section>' +
      '<div class="ecocrew-actions"><button class="btn ecocrew-btn-primary" type="button" data-action="home">Back to home</button><button class="btn ecocrew-btn-secondary" type="button" data-action="crew">View crew</button></div>',
    'A transparent baseline-plus-follow-up view for the bottle behaviour target. Hackathon values are seeded demonstration data.',
  );

  page
    .querySelector('[data-action="home"]')
    ?.addEventListener('click', () => navigate('/dashboard'));
  page.querySelector('[data-action="crew"]')?.addEventListener('click', () => navigate('/crew'));

  return {
    element: page,
    title: 'Measurement',
    afterRender: async () => {
      try {
        const summary = await ecoCrewService.getMeasurement();
        const baseline = summary?.baseline || {};
        const followUp = summary?.followUp || {};
        const baselineBehavior = Number(
          baseline.behavior_percent ?? baseline.recycled_percent ?? 0,
        );
        const followUpBehavior = Number(
          followUp.behavior_percent ?? followUp.recycled_percent ?? 0,
        );
        page.querySelector('[data-measurement-label]').textContent = summary?.isDemo
          ? 'DEMO DATA — NOT OBSERVED IMPACT'
          : 'YOUR MEASUREMENT';
        page.querySelector('[data-measurement-baseline]').textContent = percent(baselineBehavior);
        page.querySelector('[data-measurement-follow-up]').textContent = percent(followUpBehavior);
        page.querySelector('[data-measurement-baseline-prep]').textContent = percent(
          baseline.prepared_percent,
        );
        page.querySelector('[data-measurement-follow-up-prep]').textContent = percent(
          followUp.prepared_percent,
        );
        page.querySelector('[data-measurement-baseline-recycled]').textContent = percent(
          baseline.recycled_percent,
        );
        page.querySelector('[data-measurement-follow-up-recycled]').textContent = percent(
          followUp.recycled_percent,
        );
        const change = followUpBehavior - baselineBehavior;
        page.querySelector('[data-measurement-change]').textContent =
          (change >= 0 ? '+' : '') + change + ' percentage points in the seeded comparison.';
      } catch (exception) {
        page.querySelector('[data-measurement-change]').textContent =
          exception.message || 'Measurement data is temporarily unavailable.';
      }
    },
  };
}
