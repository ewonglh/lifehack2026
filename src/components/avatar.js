import { escapeHtml, initials } from '../lib/dom.js';

export function avatar(profile, size = 'sm') {
  const name = profile?.display_name || profile?.displayName || 'EcoCrew member';
  if (profile?.avatar_url) {
    return `<img class="avatar avatar-${size} object-fit-cover" src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(name)}">`;
  }
  return `<span class="avatar avatar-${size}" aria-label="${escapeHtml(name)}">${escapeHtml(initials(name))}</span>`;
}
