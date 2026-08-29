/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMeasurement = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/ecocrew-service.js', () => ({
  ecoCrewService: { getMeasurement },
}));

import { renderMeasurementPage } from '../../src/pages/measurement-page.js';

describe('measurement page loading state', () => {
  beforeEach(() => {
    getMeasurement.mockReset();
  });

  it('shows a loader until the measurement summary is fetched', async () => {
    let resolveMeasurement;
    getMeasurement.mockReturnValue(
      new Promise((resolve) => {
        resolveMeasurement = resolve;
      }),
    );
    const rendered = renderMeasurementPage();
    const pending = rendered.afterRender();

    expect(
      rendered.element.querySelector('[data-measurement-loading] [data-loading-state]'),
    ).not.toBeNull();
    expect(
      rendered.element.querySelector('[data-measurement-card]').getAttribute('aria-busy'),
    ).toBe('true');

    resolveMeasurement({
      baseline: { behavior_percent: 20, prepared_percent: 40, recycled_percent: 30 },
      followUp: { behavior_percent: 50, prepared_percent: 60, recycled_percent: 70 },
    });
    await pending;

    expect(rendered.element.querySelector('[data-measurement-loading]').hidden).toBe(true);
    expect(
      rendered.element.querySelector('[data-measurement-card]').getAttribute('aria-busy'),
    ).toBe('false');
    expect(rendered.element.querySelector('[data-measurement-change]').hidden).toBe(false);
  });

  it('replaces the measurement loader with an error', async () => {
    getMeasurement.mockRejectedValue(new Error('Measurement service is unavailable.'));
    const rendered = renderMeasurementPage();

    await rendered.afterRender();

    expect(rendered.element.querySelector('[data-measurement-loading]').hidden).toBe(true);
    expect(rendered.element.querySelector('[data-measurement-change]').textContent).toContain(
      'Measurement service is unavailable.',
    );
    expect(
      rendered.element.querySelector('[data-measurement-card]').getAttribute('aria-busy'),
    ).toBe('false');
  });
});
