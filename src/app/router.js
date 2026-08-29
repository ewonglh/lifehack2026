import { renderAppLayout } from '../layouts/app-layout.js';
import { routes } from './routes.js';

function currentPath() {
  const hash = window.location.hash.slice(1);
  return hash.startsWith('/') ? hash : '/';
}

function renderNotFound() {
  const page = document.createElement('main');
  page.className = 'ecocrew-page';
  page.innerHTML = `
    <section class="ecocrew-page__intro"><p class="ecocrew-eyebrow">NOT FOUND</p><h1>That path has wandered off.</h1></section>
    <a class="btn ecocrew-btn-primary" href="#/dashboard">Back to EcoCrew</a>
  `;
  return page;
}

function renderRoute(outlet) {
  const path = currentPath();
  const route = routes[path];

  if (route?.redirectTo) {
    window.location.replace(`#${route.redirectTo}`);
    return;
  }

  const page = route?.render ? route.render() : renderNotFound();
  outlet.replaceChildren(renderAppLayout(page, path));
  outlet.focus();
}

export function startRouter(outlet) {
  if (!outlet) throw new Error('EcoCrew needs an #app outlet.');
  window.addEventListener('hashchange', () => renderRoute(outlet));
  renderRoute(outlet);
}
