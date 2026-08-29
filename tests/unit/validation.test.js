import { describe, expect, it } from 'vitest';
import { email, minLength, required } from '../../src/utils/validation.js';

describe('form validation', () => {
  it('requires a value', () => expect(required('', 'Name')).toBe('Name is required.'));
  it('accepts valid emails and rejects invalid ones', () => {
    expect(email('member@example.com')).toBeNull();
    expect(email('not-an-email')).toBeTruthy();
  });
  it('enforces minimum length', () => {
    expect(minLength('12345678', 8, 'Password')).toBeNull();
    expect(minLength('short', 8, 'Password')).toBeTruthy();
  });
});
