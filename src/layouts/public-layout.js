import { html } from '../lib/dom.js';

export function publicLayout(content) {
  return html`<div class="app-shell d-flex flex-column">
    <header class="border-bottom bg-white">
      <nav
        class="container py-3 d-flex align-items-center justify-content-between"
        aria-label="Main navigation"
      >
        <a class="brand-mark fs-4 text-decoration-none" href="#/">EcoCrew</a
        ><a class="btn btn-primary" href="#/auth">Sign in</a>
      </nav>
    </header>
    <main id="main-content" class="app-main flex-grow-1 container" tabindex="-1">${content}</main>
    <footer class="border-top py-4 text-center text-secondary small">
      Small recycling actions, shared together.
    </footer>
  </div>`;
}
