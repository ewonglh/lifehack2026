import { loadingState } from '../components/loading-state.js';

export const authCallbackPage = () => ({
  title: 'Completing sign in',
  content: loadingState('Completing sign in'),
  afterRender: async ({ session, navigate }) => {
    try {
      await session.refresh();
      navigate('/signed-in', true);
    } catch (error) {
      const main = document.querySelector('#main-content');
      if (!main) throw error;
      main.innerHTML = `<section class="py-5 text-center"><div class="alert alert-danger text-start" role="alert"><h1 class="h4">We couldn’t complete sign in.</h1><p class="mb-3">${error.message || 'Please try again.'}</p><div class="d-flex gap-2 flex-wrap"><a class="btn btn-primary" href="#/auth">Return to sign in</a><button class="btn btn-outline-secondary" type="button" data-sign-out>Sign out</button></div></div></section>`;
    }
  },
});
