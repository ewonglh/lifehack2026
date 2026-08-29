export function appShell(title, eyebrow, content, infoText = 'Learn more about this part of EcoCrew.') {
  const page = document.createElement('main');
  page.className = 'ecocrew-page';
  page.innerHTML = `
    <header class="ecocrew-page__header">
      <div class="ecocrew-wordmark"><span aria-hidden="true">✦</span> EcoCrew</div>
      <div class="ecocrew-header-actions">
        <details class="ecocrew-page-info">
          <summary aria-label="About this page"><i class="bi bi-info-lg" aria-hidden="true"></i></summary>
          <div class="ecocrew-page-info__panel"><strong>About this page</strong><p>${escapeHtml(infoText)}</p></div>
        </details>
        <a class="ecocrew-avatar" href="#/profile" aria-label="Go to your profile">I</a>
      </div>
    </header>
    <section class="ecocrew-page__intro">
      <p class="ecocrew-eyebrow">${eyebrow}</p>
      <h1>${title}</h1>
    </section>
    ${content}
  `;
  return page;
}

export function navigate(path) {
  if (window.location.hash === `#${path}`) {
    window.dispatchEvent(new Event('hashchange'));
    return;
  }
  window.location.hash = path;
}

export function progressBar(value, total, label) {
  const percent = Math.min(100, Math.round((value / total) * 100));
  return `<div class="ecocrew-progress" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${value}"><span style="width:${percent}%"></span></div>`;
}

export function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}
