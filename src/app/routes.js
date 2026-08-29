import { renderAuthCallbackPage } from '../pages/auth-callback-page.js';
import { renderSignedInPage } from '../pages/signed-in-page.js';
import { renderOnboardingPage } from '../pages/onboarding-page.js';
import { renderSettingsPage } from '../pages/settings-page.js';
import { notFoundPage } from '../pages/not-found-page.js';
import { ecoCrewRoutes } from '../features/ecocrew/routes.js';

const modernPrivate = (path, title, render) => ({
  path,
  title,
  render,
  access: 'private',
  layout: 'app',
});
const modernPublic = (path, title, render) => ({
  path,
  title,
  render,
  access: 'public',
  layout: 'standalone',
});

export const routes = [
  { path: '/', redirectTo: '/auth', access: 'public', layout: 'standalone' },
  modernPublic('/auth', 'Sign in', ecoCrewRoutes['/login']),
  modernPublic('/login', 'Sign in', ecoCrewRoutes['/login']),
  modernPublic('/register', 'Create an account', ecoCrewRoutes['/register']),
  {
    path: '/auth/callback',
    render: renderAuthCallbackPage,
    access: 'callback',
    layout: 'standalone',
  },
  { path: '/signed-in', render: renderSignedInPage, access: 'signed-in', layout: 'standalone' },
  { path: '/onboarding', render: renderOnboardingPage, access: 'onboarding', layout: 'standalone' },
  modernPrivate('/dashboard', 'Your EcoCrew', ecoCrewRoutes['/dashboard']),
  modernPrivate('/sort', 'Create a post', ecoCrewRoutes['/sort']),
  modernPrivate('/result', 'Task result', ecoCrewRoutes['/result']),
  {
    path: '/result/:submissionId',
    title: 'Task result',
    render: ecoCrewRoutes['/result'],
    access: 'private',
    layout: 'app',
  },
  modernPrivate('/crew', 'Crew hub', ecoCrewRoutes['/crew']),
  { path: '/friends', redirectTo: '/crew', access: 'private', layout: 'app' },
  modernPrivate('/league', 'Sprout League', ecoCrewRoutes['/league']),
  modernPrivate('/profile', 'Your profile', ecoCrewRoutes['/profile']),
  modernPrivate('/settings', 'Settings', renderSettingsPage),
];

export const fallbackRoute = {
  render: notFoundPage,
  access: 'public',
  title: 'Not found',
  layout: 'standalone',
};
