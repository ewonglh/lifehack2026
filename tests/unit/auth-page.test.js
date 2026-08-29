import { describe, expect, it } from 'vitest';
import { authPage } from '../../src/pages/auth-page.js';

describe('auth page', () => {
  it('renders the authentication form and OAuth action', () => {
    const page = authPage();
    expect(page.content).toContain('data-auth-form');
    expect(page.content).toContain('data-oauth="google"');
  });
});
