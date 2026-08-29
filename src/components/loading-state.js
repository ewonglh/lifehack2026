import { escapeHtml } from '../lib/dom.js';

export function loadingState(label = 'Loading') {
  return `<div class="ecocrew-loading-state" data-loading-state role="status" aria-live="polite"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>${escapeHtml(label)}…</span></div>`;
}
