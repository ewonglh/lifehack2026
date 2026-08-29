import { html } from '../lib/dom.js';

export function publicLayout(content) {
  return html`<div class="ecocrew-public-page">
    <header class="ecocrew-public-header">
      <a class="ecocrew-wordmark" href="#/auth"><span aria-hidden="true">✦</span> EcoCrew</a>
      <div class="ecocrew-public-header__actions">
        <details class="ecocrew-page-info">
          <summary aria-label="About EcoCrew"><i class="bi bi-info-lg" aria-hidden="true"></i></summary>
          <div class="ecocrew-page-info__panel">
            <strong>About EcoCrew</strong>
            <p>Small recycling actions become a shared game with your crew.</p>
          </div>
        </details>
        <a class="btn ecocrew-btn-primary" href="#/auth">Sign in</a>
      </div>
    </header>
    <main id="main-content" class="ecocrew-public-content" tabindex="-1">${content}</main>
    <footer class="ecocrew-public-footer">Small recycling actions, shared together.</footer>
  </div>`;
}
