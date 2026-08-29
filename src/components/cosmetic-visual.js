import { escapeHtml } from '../lib/dom.js';
import { getCosmeticAsset } from '../features/ecocrew/cosmetic-assets.js';

export function cosmeticVisual(item, className = '') {
  const asset = getCosmeticAsset(item?.id || item?.cosmeticId);
  if (!asset) return escapeHtml(item?.icon || '✦');
  return (
    '<img class="' +
    escapeHtml(className) +
    '" src="' +
    escapeHtml(asset) +
    '" alt="" aria-hidden="true">'
  );
}
