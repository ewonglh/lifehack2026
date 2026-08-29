/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import { renderLandingPage } from '../../src/pages/landing-page.js';

describe('habit landing page', () => {
  it('frames the bottle action as a repeated behaviour loop', () => {
    const rendered = renderLandingPage();
    const text = rendered.element.textContent;

    expect(text).toContain('ONE SMALL ACTION, REPEATED');
    expect(text).toContain('Build the bottle-recycling habit together.');
    expect(text).toContain('Empty a single-use plastic bottle, recycle it, and check in.');
    expect(text).toContain('Empty it');
    expect(text).toContain('Recycle it');
    expect(text).toContain('Check in');
    expect(text).toContain('Start today’s bottle check');
    expect(text).not.toContain('choose the right bin');
    expect(rendered.element.querySelector('[href="#/register"]')).not.toBeNull();
  });
});
