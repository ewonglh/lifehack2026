export function renderLandingPage() {
  const page = document.createElement('main');
  page.className = 'ecocrew-landing-page';
  page.tabIndex = -1;
  page.innerHTML =
    '<header class="ecocrew-landing-header"><a class="ecocrew-wordmark" href="#/"><span aria-hidden="true">✦</span> EcoCrew</a><a class="btn ecocrew-btn-secondary" href="#/auth">Sign in</a></header>' +
    '<section class="ecocrew-landing-hero" aria-labelledby="landing-title"><p class="ecocrew-eyebrow">ONE SMALL ACTION, REPEATED</p><h1 id="landing-title">Build the bottle-recycling habit together.</h1><p class="ecocrew-landing-hero__lead">Empty a single-use plastic bottle, recycle it, and check in. EcoCrew helps you practise the action, get feedback, and keep going with friends.</p><a class="btn ecocrew-btn-primary btn-lg" href="#/register">Start today’s bottle check <i class="bi bi-arrow-right" aria-hidden="true"></i></a></section>' +
    '<section class="ecocrew-landing-steps" aria-label="How EcoCrew works"><article><span aria-hidden="true">1</span><div><h2>Empty it</h2><p>Prepare the bottle before it goes anywhere.</p></div></article><article><span aria-hidden="true">2</span><div><h2>Recycle it</h2><p>Put the prepared bottle in recycling.</p></div></article><article><span aria-hidden="true">3</span><div><h2>Check in</h2><p>Get feedback, track your progress, and keep your crew moving.</p></div></article></section>' +
    '<p class="ecocrew-landing-note">You can start on your own. Joining a crew is optional after your first action.</p>';
  return { element: page, title: 'Build the bottle-recycling habit' };
}

export const landingPage = () => {
  const rendered = renderLandingPage();
  return { title: rendered.title, content: rendered.element.outerHTML };
};
