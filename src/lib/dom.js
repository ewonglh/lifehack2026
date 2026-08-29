export const html = String.raw;

export function escapeHtml(value = '') {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#039;',
        '"': '&quot;',
      })[character],
  );
}

export function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

export function announce(message, tone = 'info') {
  const region = document.querySelector('#toast-region');
  if (!region) return;
  region.className = 'toast-stack';
  region.innerHTML = `<div class="alert alert-${tone === 'error' ? 'danger' : tone} shadow-sm mb-0" role="status">${escapeHtml(message)}</div>`;
  window.setTimeout(() => {
    region.innerHTML = '';
    region.className = 'visually-hidden';
  }, 4500);
}
