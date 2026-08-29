import { routes, fallbackRoute } from './routes.js';
import { publicLayout } from '../layouts/public-layout.js';
import { initializeAppLayout, renderAppLayout } from '../layouts/app-layout.js';
import { toAppError } from './errors.js';
import { escapeHtml } from '../lib/dom.js';

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
  if (
    access === 'public' &&
    current.session?.user &&
    (path === '/' || path === '/auth' || path === '/login' || path === '/register')
  )
    return current.profile ? '/dashboard' : '/onboarding';
  return null;
}

async function renderModernRoute({ root, route, path, current, navigate, session, params }) {
  const rendered = await route.render({
    profile: current.profile,
    profileError: current.profileError,
    session,
    rawSession: current.session,
    sessionState: current,
    navigate,
    params,
  });
  const element = rendered?.element ?? rendered;
  if (!(element instanceof window.HTMLElement))
    throw new Error('The page did not return an HTML element.');

  document.title = (rendered?.title ?? route.title ?? 'EcoCrew') + ' · EcoCrew';
  root.replaceChildren(
    route.layout === 'app' ? renderAppLayout(element, path, current.profile) : element,
  );
  initializeAppLayout();
  const afterRender = rendered?.afterRender ?? element.afterRender;
  if (afterRender)
    await afterRender({
      navigate,
      session,
      rawSession: current.session,
      params,
      sessionState: current,
    });
  document
    .querySelector('#main-content, .ecocrew-page, .ecocrew-auth-page')
    ?.focus({ preventScroll: true });
}

export function createRouter({ root, session }) {
  async function render() {
    const path = normalizePath(window.location.hash);
    const { route, params } = resolveRoute(path);
    const current = session.get();
    if (!current.ready) return;
    const redirect = guardPath(path, route.access, current);
    if (redirect) return navigate(redirect, true);
    if (route.redirectTo) return navigate(route.redirectTo, true);

    try {
      document.body.dataset.ecocrewDisplayName =
        current.profile?.displayName || current.profile?.display_name || 'I';
      document.body.dataset.ecocrewFrameId =
        current.profile?.frameId || current.profile?.frame_id || '';
      await renderModernRoute({ root, route, path, current, navigate, session, params });
    } catch (exception) {
      const error = toAppError(exception);
      root.innerHTML = publicLayout(
        '<section class="ecocrew-public-message" role="alert"><p class="ecocrew-kicker">TEMPORARY ERROR</p><h1>We could not load this page.</h1><p>' +
          escapeHtml(error.message) +
          '</p><a class="btn ecocrew-btn-primary" href="#/auth">Return to sign in</a></section>',
      );
    }
  }

  function navigate(path, replace = false) {
    const target = '#' + path;
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
