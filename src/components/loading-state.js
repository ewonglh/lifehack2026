export function loadingState(label = 'Loading') {
  return `<div class="d-flex align-items-center gap-2 py-4" role="status"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>${label}…</span></div>`;
}
