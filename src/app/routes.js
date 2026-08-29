import { ecoCrewRoutes } from '../features/ecocrew/routes.js';

export const routes = {
  '/': { redirectTo: '/dashboard' },
  ...Object.fromEntries(Object.entries(ecoCrewRoutes).map(([path, render]) => [path, { render }])),
};
