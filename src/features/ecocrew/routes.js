import { renderAuthPage } from '../../pages/auth-page.js';
import { renderDashboardPage } from '../../pages/dashboard-page.js';
import { renderFriendsPage } from '../../pages/friends-page.js';
import { renderLeaderboardPage } from '../../pages/leaderboard-page.js';
import { renderProfilePage } from '../../pages/profile-page.js';
import { renderSubmissionDetailPage } from '../../pages/submission-detail-page.js';
import { renderSubmitPage } from '../../pages/submit-page.js';
import { renderJoinCrewPage } from '../../pages/join-crew-page.js';

export const ecoCrewRoutes = {
  '/dashboard': renderDashboardPage,
  '/sort': renderSubmitPage,
  '/result': renderSubmissionDetailPage,
  '/crew': renderFriendsPage,
  '/league': renderLeaderboardPage,
  '/login': renderAuthPage,
  '/register': renderAuthPage,
  '/join/:inviteCode': renderJoinCrewPage,
  '/profile': renderProfilePage,
};
