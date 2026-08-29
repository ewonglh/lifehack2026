import { renderDashboardPage } from '../../pages/dashboard-page.js';
import { renderFriendsPage } from '../../pages/friends-page.js';
import { renderLeaderboardPage } from '../../pages/leaderboard-page.js';
import { renderSubmissionDetailPage } from '../../pages/submission-detail-page.js';
import { renderSubmitPage } from '../../pages/submit-page.js';

// Person 2 can spread this object into the shared route registry.
export const ecoCrewRoutes = {
  '/dashboard': renderDashboardPage,
  '/sort': renderSubmitPage,
  '/result': renderSubmissionDetailPage,
  '/crew': renderFriendsPage,
  '/league': renderLeaderboardPage,
};
