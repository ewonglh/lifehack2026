import { describe, expect, it } from 'vitest';
import { guardPath, resolveRoute } from '../../src/app/router.js';
import { routes } from '../../src/app/routes.js';

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

describe('competition routes', () => {
  it.each(['/dashboard', '/sort', '/result', '/crew', '/league'])(
    'registers %s as private',
    (path) => {
      expect(routes.find((route) => route.path === path)?.access).toBe('private');
    },
  );

  it('extracts a submission id from a result route', () => {
    const match = resolveRoute('/result/submission-42');
    expect(match.params).toEqual({ submissionId: 'submission-42' });
  });

  it('falls back for unknown routes', () => {
    expect(resolveRoute('/competition/nope').route.path).toBeUndefined();
  });
});
