import { escapeHtml } from '../lib/dom.js';
import { ecoCrewService } from '../services/ecocrew-service.js';
import { loadingState } from '../components/loading-state.js';
import { navigate as defaultNavigate, standaloneShell } from '../features/ecocrew/page-utils.js';

const pendingInviteKey = 'ecocrew-pending-invite';

export function rememberInviteCode(code) {
  const normalized = String(code || '')
    .trim()
    .toUpperCase();
  if (!normalized) return;
  window.sessionStorage.setItem(pendingInviteKey, normalized);
}

export function getPendingInviteCode() {
  return window.sessionStorage.getItem(pendingInviteKey) || '';
}

export function clearPendingInvite() {
  window.sessionStorage.removeItem(pendingInviteKey);
}

export function renderJoinCrewPage({ params = {}, session, navigate = defaultNavigate } = {}) {
  const code = String(params.inviteCode || '')
    .trim()
    .toUpperCase();
  const page = standaloneShell(
    'Join the crew',
    'You’re invited',
    '<section class="ecocrew-card ecocrew-join-card" data-join-card aria-labelledby="join-title"><div class="ecocrew-join-card__badge" aria-hidden="true">✦</div><p class="ecocrew-kicker">DEMO CREW INVITE</p><h2 id="join-title">Make one good choice together.</h2><p class="ecocrew-muted">You’ll join Glass Guardians and help turn today’s bottle check into shared progress.</p><div class="ecocrew-invite-code" aria-label="Invite code">' +
      escapeHtml(code || 'INVITE') +
      '</div><p class="ecocrew-form-error" data-join-error role="alert" hidden></p><button class="btn ecocrew-btn-primary w-100" type="button" data-join-action>Join Glass Guardians</button><div class="ecocrew-join-note" data-join-note>Sign in or create an account first. Your invite will stay with you.</div></section>',
    'A private invite link for joining a small EcoCrew. Your account keeps your own progress separate from other judges.',
  );
  const action = page.querySelector('[data-join-action]');
  const error = page.querySelector('[data-join-error]');
  const note = page.querySelector('[data-join-note]');

  async function join() {
    if (!code) {
      error.textContent = 'This invite link is missing its crew code.';
      error.hidden = false;
      return;
    }
    rememberInviteCode(code);
    const current = session?.get?.();
    if (!current?.session?.user) {
      navigate('/register');
      return;
    }
    if (!current.profile) {
      navigate('/onboarding');
      return;
    }
    action.disabled = true;
    action.textContent = 'Joining…';
    page.querySelector('[data-join-card]')?.setAttribute('aria-busy', 'true');
    note.innerHTML = loadingState('Joining your crew');
    try {
      await ecoCrewService.joinCrew(code);
      clearPendingInvite();
      navigate('/dashboard');
    } catch (exception) {
      error.textContent =
        exception.message || 'We could not join that crew. Check the invite code and try again.';
      error.hidden = false;
      note.textContent = 'Your invite is still ready when you are.';
      page.querySelector('[data-join-card]')?.setAttribute('aria-busy', 'false');
      action.disabled = false;
      action.textContent = 'Try again';
    }
  }

  action.addEventListener('click', join);

  return {
    element: page,
    title: 'Join the crew',
    afterRender: async () => {
      const current = session?.get?.();
      if (current?.session?.user && current.profile) {
        note.textContent = 'Joining your account to the invited crew…';
        await join();
      }
    },
  };
}
