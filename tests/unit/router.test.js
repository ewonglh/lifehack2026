import { describe, expect, it } from 'vitest';
import { guardPath } from '../../src/app/router.js';

const anonymous = { session: null, profile: null };
const incomplete = { session: { user: { id: 'user-1' } }, profile: null };
const complete = { session: { user: { id: 'user-1' } }, profile: { display_name: 'Maya' } };

describe('route guard', () => {
  it('sends anonymous users to sign in', () =>
    expect(guardPath('/friends', 'private', anonymous)).toBe('/auth'));
  it('sends incomplete profiles to onboarding', () =>
    expect(guardPath('/friends', 'private', incomplete)).toBe('/onboarding'));
  it('keeps complete users out of onboarding', () =>
    expect(guardPath('/onboarding', 'onboarding', complete)).toBe('/dashboard'));
  it('keeps a public landing page available to anonymous users', () =>
    expect(guardPath('/', 'public', anonymous)).toBeNull());
});
