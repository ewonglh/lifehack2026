import { escapeHtml } from '../lib/dom.js';

export function alert(message, tone = 'danger') {
  return `<div class="alert alert-${tone}" role="alert">${escapeHtml(message)}</div>`;
}
