import { ecoCrewService } from '../services/ecocrew-service.js';
import {
  appShell,
  escapeHtml,
  navigate as defaultNavigate,
  progressBar,
} from '../features/ecocrew/page-utils.js';

function membershipActions() {
  return '<section class="ecocrew-crew-actions" aria-labelledby="find-crew-title"><div><p class="ecocrew-kicker">PLAY TOGETHER</p><h2 id="find-crew-title">Find your people</h2><p>Join with an invite code or start a new crew.</p></div><div><button class="btn ecocrew-btn-secondary" type="button" data-membership-action="join">Join</button><button class="btn ecocrew-btn-primary" type="button" data-membership-action="create">Create</button></div></section>';
}

function membershipForm(mode) {
  const joining = mode === 'join';
  return (
    '<form class="ecocrew-crew-form" data-crew-form="' +
    mode +
    '"><div class="ecocrew-card__top"><div><p class="ecocrew-kicker">' +
    (joining ? 'JOIN A CREW' : 'CREATE A CREW') +
    '</p><h2>' +
    (joining ? 'Enter your invite code' : 'Name your new crew') +
    '</h2></div><button class="btn btn-link" type="button" data-cancel-membership>Cancel</button></div><label>' +
    (joining ? 'Invite code' : 'Crew name') +
    '<input name="value" type="text" minlength="' +
    (joining ? '6' : '3') +
    '" maxlength="' +
    (joining ? '6' : '40') +
    '" autocomplete="' +
    (joining ? 'one-time-code' : 'off') +
    '" required></label><p class="ecocrew-form-error" data-crew-error role="alert" hidden></p><button class="btn ecocrew-btn-primary" type="submit">' +
    (joining ? 'Join crew' : 'Create crew') +
    '</button></form>'
  );
}

function inviteMenu() {
  return '<details class="ecocrew-invite-menu"><summary class="btn ecocrew-btn-secondary"><i class="bi bi-share" aria-hidden="true"></i><span>Invite</span><i class="bi bi-chevron-down" aria-hidden="true"></i></summary><div class="ecocrew-invite-menu__panel" aria-label="Share crew invite"><button type="button" data-share="native"><i class="bi bi-phone" aria-hidden="true"></i><span>Share link</span></button><button type="button" data-share="x"><i class="bi bi-twitter-x" aria-hidden="true"></i><span>X</span></button><button type="button" data-share="instagram"><i class="bi bi-instagram" aria-hidden="true"></i><span>Instagram</span></button><button type="button" data-share="telegram"><i class="bi bi-telegram" aria-hidden="true"></i><span>Telegram</span></button><button type="button" data-share="whatsapp"><i class="bi bi-whatsapp" aria-hidden="true"></i><span>WhatsApp</span></button><p data-share-status role="status"></p></div></details>';
}

function emptyCrew() {
  return '<section class="ecocrew-crew-section" aria-labelledby="your-crew-title"><div class="ecocrew-section-heading"><h2 id="your-crew-title">Your crew</h2></div><div class="ecocrew-crew-empty"><span aria-hidden="true"><i class="bi bi-people" aria-hidden="true"></i></span><strong>You have not joined a crew yet</strong><p>Crews make every good choice count toward a shared mission and streak.</p></div></section>';
}

function crewContent(overview) {
  const membership = overview.membership;
  const members = overview.members || [];
  const mission = overview.mission || {};
  const missionUnavailable = overview.missionUnavailable === true || mission.unavailable === true;
  const activity = overview.activity || [];
  return (
    '<section class="ecocrew-crew-section" aria-labelledby="your-crew-title"><div class="ecocrew-crew-title-row"><div><p class="ecocrew-kicker">YOUR CREW</p><h2 id="your-crew-title">' +
    escapeHtml(membership.crewName) +
    '</h2><small>' +
    escapeHtml(membership.role === 'owner' ? 'You created this crew' : 'Crew member') +
    '</small></div>' +
    '<div class="ecocrew-crew-title-actions">' +
    (membership.role === 'member'
      ? '<button class="btn ecocrew-delete-crew" type="button" data-leave-crew>Leave crew</button>'
      : '') +
    inviteMenu() +
    '</div>' +
    '</div><div class="ecocrew-crew-hero"><div class="ecocrew-member-stack">' +
    members
      .map(
        (member) =>
          '<span class="ecocrew-avatar" title="' +
          escapeHtml(member.name || member.displayName) +
          '">' +
          escapeHtml((member.name || member.displayName || '?').charAt(0).toUpperCase()) +
          '</span>',
      )
      .join('') +
    '</div><div><strong>' +
    members.length +
    ' member' +
    (members.length === 1 ? '' : 's') +
    ' · ' +
    Number(overview.streak || 0) +
    '-day streak 🔥</strong><p>' +
    Number(overview.completedMembers || 0) +
    ' of ' +
    Number(overview.requiredMembers || Math.ceil(members.length / 2)) +
    ' members completed today.</p></div></div></section>' +
    '<section class="ecocrew-card ecocrew-mission-card"><div class="ecocrew-card__top"><div><p class="ecocrew-kicker">WEEKLY MISSION</p><h2>' +
    escapeHtml(mission.title || 'Crew mission') +
    '</h2></div><span>' +
    escapeHtml(mission.endsLabel || '') +
    '</span></div>' +
    progressBar(mission.progress, mission.target, 'Mission progress') +
    (missionUnavailable
      ? '<p class="ecocrew-muted">Mission setup is temporarily unavailable. Your crew membership and leave controls are still available.</p>'
      : '') +
    '<div class="ecocrew-mission-card__footer"><strong>' +
    Number(mission.progress || 0) +
    ' / ' +
    Number(mission.target || 0) +
    ' points</strong><button class="btn btn-link" type="button" data-action="league">League board</button></div></section>' +
    '<section class="ecocrew-feed"><div class="ecocrew-section-heading"><h2>Crew activity</h2><span>Celebrate milestones</span></div>' +
    (activity.length
      ? activity
          .map(
            (entry) =>
              '<article class="ecocrew-feed-item"><span class="ecocrew-feed-item__emoji" aria-hidden="true">' +
              escapeHtml(entry.emoji || '✨') +
              '</span><div><p><strong>' +
              escapeHtml(entry.actor || entry.actorName || 'A crewmate') +
              '</strong> ' +
              escapeHtml(entry.action || 'made progress') +
              '</p><small>' +
              escapeHtml(entry.time || 'Recently') +
              '</small><button class="btn btn-sm" type="button" data-reaction="' +
              escapeHtml(entry.id || entry.activityId) +
              '">👏 ' +
              Number(entry.reactions || 0) +
              '</button></div></article>',
          )
          .join('')
      : '<p class="ecocrew-muted">Your crew activity will appear here after the first post.</p>') +
    '</section><p class="ecocrew-form-error" data-crew-action-error role="alert" hidden></p>'
  );
}

async function copyInvite(link, status) {
  try {
    if (window.navigator.clipboard?.writeText) await window.navigator.clipboard.writeText(link);
    else throw new Error('Clipboard unavailable');
    status.textContent = 'Invite link copied.';
  } catch {
    const fallback = document.createElement('textarea');
    fallback.value = link;
    fallback.setAttribute('readonly', '');
    fallback.style.position = 'fixed';
    fallback.style.opacity = '0';
    document.body.append(fallback);
    fallback.select();
    try {
      document.execCommand('copy');
      status.textContent = 'Invite link copied.';
    } catch {
      status.textContent = link;
    }
    fallback.remove();
  }
}

export function renderFriendsPage({ navigate = defaultNavigate } = {}) {
  const page = appShell(
    'Crew hub',
    'Crews',
    '<div data-crew-content><p class="ecocrew-muted">Loading your crew…</p></div>',
    'Join or create a crew, follow its shared streak and weekly mission, react to activity, and invite people you know.',
  );
  const content = page.querySelector('[data-crew-content]');

  function renderCrewOverview(overview) {
    content.innerHTML = overview.membership
      ? crewContent(overview)
      : membershipActions() + emptyCrew();
    bindCrewActions(overview);
  }

  function isNoCrewFailure(exception) {
    const code = String(exception?.code || '').toUpperCase();
    const message = String(exception?.message || '').toLowerCase();
    return (
      ['NO_CREW', 'CREW_NOT_FOUND'].includes(code) || message.includes('you have not joined a crew')
    );
  }

  async function loadCrew() {
    try {
      const overview = await ecoCrewService.getCrewOverview();
      renderCrewOverview(overview);
    } catch (exception) {
      if (isNoCrewFailure(exception)) {
        renderCrewOverview({ membership: null });
        return;
      }
      content.innerHTML =
        '<p class="ecocrew-form-error" role="alert">' +
        'We could not load your crew yet. Please try again in a moment.' +
        '</p>' +
        membershipActions();
      bindCrewActions({ membership: null });
    }
  }

  function bindCrewActions(overview) {
    page.querySelectorAll('[data-membership-action]').forEach((button) =>
      button.addEventListener('click', () => {
        content.innerHTML = membershipForm(button.dataset.membershipAction);
        const form = content.querySelector('[data-crew-form]');
        const input = form.querySelector('input');
        form.querySelector('[data-cancel-membership]').addEventListener('click', loadCrew);
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!form.reportValidity()) return;
          const submit = form.querySelector('[type="submit"]');
          const error = form.querySelector('[data-crew-error]');
          submit.disabled = true;
          try {
            const value = new FormData(form).get('value');
            if (form.dataset.crewForm === 'join') await ecoCrewService.joinCrew(value);
            else await ecoCrewService.createCrew(value);
            await loadCrew();
          } catch (exception) {
            error.textContent = exception.message || 'We could not update your crew.';
            error.hidden = false;
            submit.disabled = false;
          }
        });
        input.focus();
      }),
    );

    page
      .querySelector('[data-action="league"]')
      ?.addEventListener('click', () => navigate('/league'));
    page.querySelector('[data-leave-crew]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      if (
        !overview.membership?.crewId ||
        !window.confirm('Leave ' + overview.membership.crewName + '?')
      )
        return;
      button.disabled = true;
      try {
        await ecoCrewService.leaveCrew(overview.membership);
        await loadCrew();
      } catch (exception) {
        const actionError = page.querySelector('[data-crew-action-error]');
        if (actionError) {
          actionError.textContent = exception.message || 'We could not leave your crew.';
          actionError.hidden = false;
        }
        button.disabled = false;
      }
    });
    page.querySelectorAll('[data-reaction]').forEach((button) =>
      button.addEventListener('click', async () => {
        button.disabled = true;
        await ecoCrewService.reactActivity(button.dataset.reaction);
        button.textContent = '👏 ' + (Number(button.textContent.match(/\d+/)?.[0] || 0) + 1);
      }),
    );
    const menu = page.querySelector('.ecocrew-invite-menu');
    if (!menu || !overview.membership) return;
    const status = menu.querySelector('[data-share-status]');
    menu.querySelectorAll('[data-share]').forEach((button) =>
      button.addEventListener('click', async () => {
        const invite = await ecoCrewService.createInvite(overview.membership);
        const inviteCode = invite.inviteCode || '';
        const link =
          invite.inviteUrl ||
          window.location.origin + window.location.pathname + '#/join/' + inviteCode;
        const message =
          'Join my EcoCrew, ' +
          overview.membership.crewName +
          '! Use invite code ' +
          inviteCode +
          '.';
        if (button.dataset.share === 'native' && window.navigator.share) {
          await window.navigator.share({ title: 'Join my EcoCrew', text: message, url: link });
          status.textContent = 'Invite ready to share.';
          menu.open = false;
        } else if (button.dataset.share === 'native' || button.dataset.share === 'instagram') {
          await copyInvite(link, status);
          if (button.dataset.share === 'instagram')
            status.textContent = 'Link copied — paste it into Instagram.';
        } else {
          const urls = {
            x:
              'https://x.com/intent/post?text=' +
              encodeURIComponent(message) +
              '&url=' +
              encodeURIComponent(link),
            telegram:
              'https://t.me/share/url?url=' +
              encodeURIComponent(link) +
              '&text=' +
              encodeURIComponent(message),
            whatsapp: 'https://wa.me/?text=' + encodeURIComponent(message + ' ' + link),
          };
          window.open(urls[button.dataset.share], '_blank', 'noopener,noreferrer');
          status.textContent = 'Opening ' + button.textContent.trim() + '…';
          menu.open = false;
        }
      }),
    );
  }

  return { element: page, title: 'Crew hub', afterRender: loadCrew };
}
