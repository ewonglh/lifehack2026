import { escapeHtml, initials } from '../lib/dom.js';

export function avatar(profile, size = 'sm') {
  const name = profile?.display_name || profile?.displayName || 'EcoCrew member';
  return `<span class="avatar avatar-${size}" aria-label="${escapeHtml(name)}">${escapeHtml(initials(name))}</span>`;
}
