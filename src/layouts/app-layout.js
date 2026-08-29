import { avatar } from '../components/avatar.js';
import Collapse from 'bootstrap/js/dist/collapse';

const links = [
  ['/dashboard', 'Dashboard'],
  ['/sort', 'Sort'],
  ['/result', 'Result'],
  ['/crew', 'Crew'],
  ['/league', 'League'],
  ['/profile', 'Profile'],
  ['/settings', 'Settings'],
];

const navigation = [
  { path: '/dashboard', label: 'Home', icon: 'bi-house-door' },
  { path: '/sort', label: 'Post', icon: 'bi-plus-circle' },
  { path: '/crew', label: 'Crew', icon: 'bi-people' },
  { path: '/league', label: 'League', icon: 'bi-trophy' },
  { path: '/profile', label: 'Profile', icon: 'bi-person' },
];

export function appLayout(content, currentPath, profile) {
  const nav = links
    .map(
      ([path, label]) =>
        '<li class=\"nav-item\"><a class=\"nav-link ' +
        (currentPath === path || (path === '/result' && currentPath.startsWith('/result/'))
          ? 'active'
          : '') +
        '\" href=\"#' +
        path +
        '\">' +
        label +
        '</a></li>',
    )
    .join('');
  return (
    '<div class=\"app-shell d-flex flex-column\">' +
    '<header class=\"border-bottom bg-white\"><nav class=\"navbar navbar-expand-md container\" aria-label=\"Main navigation\">' +
    '<a class=\"brand-mark navbar-brand\" href=\"#/dashboard\">EcoCrew</a>' +
    '<button class=\"navbar-toggler\" type=\"button\" data-bs-toggle=\"collapse\" data-bs-target=\"#app-nav\" aria-controls=\"app-nav\" aria-expanded=\"false\" aria-label=\"Toggle navigation\"><span class=\"navbar-toggler-icon\"></span></button>' +
    '<div class=\"collapse navbar-collapse\" id=\"app-nav\"><ul class=\"navbar-nav me-auto\">' +
    nav +
    '</ul><div class=\"d-flex align-items-center gap-2 py-2 py-md-0\">' +
    avatar(profile) +
    '<button class=\"btn btn-sm btn-outline-secondary\" data-sign-out>Sign out</button></div></div></nav></header>' +
    '<main id=\"main-content\" class=\"app-main flex-grow-1 container\" tabindex=\"-1\">' +
    content +
    '</main></div>'
  );
}

export function renderAppLayout(page, activePath) {
  const layout = document.createElement('div');
  layout.className = 'app-layout';
  layout.append(page);

  const nav = document.createElement('nav');
  nav.className = 'app-bottom-nav';
  nav.setAttribute('aria-label', 'Primary navigation');
  nav.innerHTML = navigation
    .map(
      (item) =>
        '<a href=\"#' +
        item.path +
        '\" class=\"' +
        (item.path === activePath || (item.path === '/result' && activePath.startsWith('/result/')) ? 'is-active' : '') +
        '\" ' +
        (item.path === activePath || (item.path === '/result' && activePath.startsWith('/result/')) ? 'aria-current=\"page\"' : '') +
        '><i class=\"bi ' +
        item.icon +
        '\" aria-hidden=\"true\"></i><span>' +
        item.label +
        '</span></a>',
    )
    .join('');
  layout.append(nav);
  return layout;
}

export function initializeAppLayout() {
  document
    .querySelectorAll('[data-bs-toggle=\"collapse\"]')
    .forEach((toggle) =>
      Collapse.getOrCreateInstance(document.querySelector(toggle.dataset.bsTarget)),
    );
}
