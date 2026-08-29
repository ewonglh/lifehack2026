import { routes, fallbackRoute } from './routes.js';
import { publicLayout } from '../layouts/public-layout.js';
import { appLayout, initializeAppLayout } from '../layouts/app-layout.js';
import { toAppError } from './errors.js';

const normalizePath = (path) => path.replace(/^#/, '') || '/';

function matchRoute(path, route) {
  const routeParts = route.path.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (routeParts.length !== pathParts.length) return null;
  const params = {};
  for (let index = 0; index < routeParts.length; index += 1) {
    const routePart = routeParts[index];
    const pathPart = pathParts[index];
    if (routePart.startsWith(':')) params[routePart.slice(1)] = decodeURIComponent(pathPart);
    else if (routePart !== pathPart) return null;
  }
  return params;
}

export function resolveRoute(path) {
  const normalizedPath = normalizePath(path);
  const route = routes.find((candidate) => matchRoute(normalizedPath, candidate));
  return route
    ? { route, params: matchRoute(normalizedPath, route) }
    : { route: fallbackRoute, params: {} };
}

export function guardPath(path, access, current) {
  if (
    (access === 'private' ||
      access === 'onboarding' ||
      access === 'callback' ||
      access === 'signed-in') &&
    !current.session?.user
  )
    return '/auth';
  if (access === 'private' && !current.profile) return '/onboarding';
  if (access === 'onboarding' && current.profile) return '/dashboard';
  if (access === 'public' && current.session?.user && (path === '/' || path === '/auth'))
    return current.profile ? '/dashboard' : '/onboarding';
  return null;
}

export function createRouter({ root, session }) {
  async function render() {
    const path = normalizePath(window.location.hash);
    const { route, params } = resolveRoute(path);
    const current = session.get();
    if (!current.ready) return;
    const redirect = guardPath(path, route.access, current);
    if (redirect) return navigate(redirect, true);
    try {
      const page = route.page({
        profile: current.profile,
        profileError: current.profileError,
        session: current.session,
        navigate,
        params,
      });
      document.title = `${page.title} · EcoCrew`;
      root.innerHTML =
        current.session?.user && route.access !== 'public'
          ? appLayout(page.content, path, current.profile)
          : publicLayout(page.content);
      initializeAppLayout();
      if (page.afterRender) await page.afterRender({ navigate, session, params });
      document.querySelector('#main-content')?.focus({ preventScroll: true });
    } catch (exception) {
      const error = toAppError(exception);
      root.innerHTML = publicLayout(
        `<div class="alert alert-danger" role="alert"><h1 class="h4">We could not load this page.</h1><p class="mb-0">${error.message}</p></div>`,
      );
    }
  }
  function navigate(path, replace = false) {
    const target = `#${path}`;
    if (replace) window.location.replace(target);
    else window.location.hash = target;
  }
  window.addEventListener('hashchange', render);
  return {
    start: render,
    navigate,
    destroy: () => window.removeEventListener('hashchange', render),
  };
}
