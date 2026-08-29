import { routes, fallbackRoute } from './routes.js';
import { publicLayout } from '../layouts/public-layout.js';
import { appLayout, initializeAppLayout } from '../layouts/app-layout.js';
import { toAppError } from './errors.js';

const normalizePath = (path) => path.replace(/^#/, '') || '/';

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
    const route = routes.find((candidate) => candidate.path === path) || fallbackRoute;
    const current = session.get();
    if (!current.ready) return;
    const redirect = guardPath(path, route.access, current);
    if (redirect) return navigate(redirect, true);
    try {
      const page = route.page({
        profile: current.profile,
        profileError: current.profileError,
        session: current.session,
      });
      document.title = `${page.title} · EcoCrew`;
      root.innerHTML =
        current.session?.user && route.access !== 'public'
          ? appLayout(page.content, path, current.profile)
          : publicLayout(page.content);
      initializeAppLayout();
      if (page.afterRender) await page.afterRender({ navigate, session });
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
