const navigation = [
  { path: '/dashboard', label: 'Home', icon: 'bi-house-door' },
  { path: '/sort', label: 'Post', icon: 'bi-plus-circle' },
  { path: '/crew', label: 'Crew', icon: 'bi-people' },
  { path: '/league', label: 'League', icon: 'bi-trophy' },
  { path: '/profile', label: 'Profile', icon: 'bi-person' },
];

export function renderAppLayout(page, activePath) {
  const layout = document.createElement('div');
  layout.className = 'app-layout';
  layout.append(page);

  const nav = document.createElement('nav');
  nav.className = 'app-bottom-nav';
  nav.setAttribute('aria-label', 'Primary navigation');
  nav.innerHTML = navigation.map((item) => `
    <a href="#${item.path}" class="${item.path === activePath ? 'is-active' : ''}" ${item.path === activePath ? 'aria-current="page"' : ''}>
      <i class="bi ${item.icon}" aria-hidden="true"></i><span>${item.label}</span>
    </a>
  `).join('');
  layout.append(nav);
  return layout;
}
