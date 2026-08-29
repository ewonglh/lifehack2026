import { landingPage } from '../pages/landing-page.js';
import { authPage } from '../pages/auth-page.js';
import { authCallbackPage } from '../pages/auth-callback-page.js';
import { signedInPage } from '../pages/signed-in-page.js';
import { onboardingPage } from '../pages/onboarding-page.js';
import { dashboardPage } from '../pages/dashboard-page.js';
import { sortPage } from '../pages/sort-page.js';
import { resultPage } from '../pages/result-page.js';
import { crewPage } from '../pages/crew-page.js';
import { leaguePage } from '../pages/league-page.js';
import { friendsPage } from '../pages/friends-page.js';
import { profilePage } from '../pages/profile-page.js';
import { settingsPage } from '../pages/settings-page.js';
import { notFoundPage } from '../pages/not-found-page.js';

export const routes = [
  { path: '/', page: landingPage, access: 'public' },
  { path: '/auth', page: authPage, access: 'public' },
  { path: '/auth/callback', page: authCallbackPage, access: 'callback' },
  { path: '/signed-in', page: signedInPage, access: 'signed-in' },
  { path: '/onboarding', page: onboardingPage, access: 'onboarding' },
  { path: '/dashboard', page: dashboardPage, access: 'private' },
  { path: '/sort', page: sortPage, access: 'private' },
  { path: '/result', page: resultPage, access: 'private' },
  { path: '/result/:submissionId', page: resultPage, access: 'private' },
  { path: '/crew', page: crewPage, access: 'private' },
  { path: '/league', page: leaguePage, access: 'private' },
  { path: '/friends', page: friendsPage, access: 'private' },
  { path: '/profile', page: profilePage, access: 'private' },
  { path: '/settings', page: settingsPage, access: 'private' },
];

export const fallbackRoute = { page: notFoundPage, access: 'public' };
