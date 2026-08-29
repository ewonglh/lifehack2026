import { renderAuthCallbackPage } from '../pages/auth-callback-page.js';
import { renderSignedInPage } from '../pages/signed-in-page.js';
import { renderOnboardingPage } from '../pages/onboarding-page.js';
import { renderSettingsPage } from '../pages/settings-page.js';
import { notFoundPage } from '../pages/not-found-page.js';
import { ecoCrewRoutes } from '../features/ecocrew/routes.js';
import { renderJoinCrewPage } from '../pages/join-crew-page.js';
import { renderMeasurementPage } from '../pages/measurement-page.js';
import { renderLandingPage } from '../pages/landing-page.js';

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
  {
    path: '/',
    title: 'Build the bottle-recycling habit',
    render: renderLandingPage,
    access: 'public',
    layout: 'standalone',
  },
  modernPublic('/auth', 'Sign in', ecoCrewRoutes['/login']),
  modernPublic('/login', 'Sign in', ecoCrewRoutes['/login']),
  modernPublic('/register', 'Create an account', ecoCrewRoutes['/register']),
  {
    path: '/join/:inviteCode',
    title: 'Join the crew',
    render: renderJoinCrewPage,
    access: 'public',
    layout: 'standalone',
  },
  {
    path: '/auth/callback',
    render: renderAuthCallbackPage,
    access: 'callback',
    layout: 'standalone',
  },
  { path: '/signed-in', render: renderSignedInPage, access: 'signed-in', layout: 'standalone' },
  { path: '/onboarding', render: renderOnboardingPage, access: 'onboarding', layout: 'standalone' },
  modernPrivate('/dashboard', 'Your EcoCrew', ecoCrewRoutes['/dashboard']),
  modernPrivate('/sort', 'Today’s action', ecoCrewRoutes['/sort']),
  modernPrivate('/result', 'Your action', ecoCrewRoutes['/result']),
  {
    path: '/result/:submissionId',
    title: 'Your action',
    render: ecoCrewRoutes['/result'],
    access: 'private',
    layout: 'app',
  },
  modernPrivate('/crew', 'Crew hub', ecoCrewRoutes['/crew']),
  { path: '/friends', redirectTo: '/crew', access: 'private', layout: 'app' },
  modernPrivate('/league', 'Sprout League', ecoCrewRoutes['/league']),
  modernPrivate('/profile', 'Your profile', ecoCrewRoutes['/profile']),
  modernPrivate('/settings', 'Settings', renderSettingsPage),
  modernPrivate('/measurement', 'Measurement', renderMeasurementPage),
];

export const fallbackRoute = {
  render: notFoundPage,
  access: 'public',
  title: 'Not found',
  layout: 'standalone',
};
