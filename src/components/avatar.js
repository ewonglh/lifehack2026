import { escapeHtml, initials } from '../lib/dom.js';
import { getProfileFrameId } from '../features/ecocrew/cosmetic-assets.js';
import { cosmeticVisual } from './cosmetic-visual.js';

export function avatar(profile, size = 'sm') {
  const name = profile?.display_name || profile?.displayName || 'EcoCrew member';
  const base = profile?.avatar_url
    ? `<img class="avatar avatar-${size} object-fit-cover" src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(name)}">`
    : `<span class="avatar avatar-${size}" aria-label="${escapeHtml(name)}">${escapeHtml(initials(name))}</span>`;
  const frameId = getProfileFrameId(profile);
  if (!frameId) return base;
  return `<span class="avatar-frame-wrap avatar-frame-wrap-${size}">${base}${cosmeticVisual(
    { id: frameId },
    'avatar-frame avatar-frame-' + size,
  )}</span>`;
}
