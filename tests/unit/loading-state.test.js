import { describe, expect, it } from 'vitest';
import { loadingState } from '../../src/components/loading-state.js';

describe('loading state', () => {
  it('renders an accessible animated status with escaped copy', () => {
    const markup = loadingState('<Loading dashboard>');

    expect(markup).toContain('class="ecocrew-loading-state"');
    expect(markup).toContain('data-loading-state');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('spinner-border');
    expect(markup).toContain('&lt;Loading dashboard&gt;…');
    expect(markup).not.toContain('<Loading dashboard>');
  });
});
