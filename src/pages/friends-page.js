import { activity, crew } from '../features/ecocrew/mock-data.js';
import {
  addReaction,
  addDemoCrewMember,
  createDemoCrew,
  deleteDemoCrew,
  getCrewMembership,
  getDemoProfile,
  getDemoState,
  leaveDemoCrew,
  joinDemoCrew,
} from '../features/ecocrew/scan-service.js';
import { appShell, escapeHtml, navigate } from '../features/ecocrew/page-utils.js';

function membershipActions() {
  return `
    <section class="ecocrew-crew-actions" aria-labelledby="find-crew-title">
      <div><p class="ecocrew-kicker">PLAY TOGETHER</p><h2 id="find-crew-title">Find your people</h2><p>Join with an invite code or start a new crew.</p></div>
      <div><button class="btn ecocrew-btn-secondary" type="button" data-membership-action="join"><i class="bi bi-box-arrow-in-right" aria-hidden="true"></i> Join</button><button class="btn ecocrew-btn-primary" type="button" data-membership-action="create"><i class="bi bi-plus-lg" aria-hidden="true"></i> Create</button></div>
    </section>`;
}

function membershipForm(mode, initialValue = '') {
  const isJoining = mode === 'join';
  return `
    <form class="ecocrew-crew-form" data-crew-form="${mode}">
      <div class="ecocrew-card__top"><div><p class="ecocrew-kicker">${isJoining ? 'JOIN A CREW' : 'CREATE A CREW'}</p><h2>${isJoining ? 'Enter your invite code' : 'Name your new crew'}</h2></div><button class="btn btn-link" type="button" data-cancel-membership>Cancel</button></div>
      <label>${isJoining ? 'Invite code' : 'Crew name'}<input name="value" type="text" value="${escapeHtml(initialValue)}" ${isJoining ? 'placeholder="e.g. GLASS-GUARDIANS"' : 'placeholder="e.g. Green Dream Team"'} minlength="3" maxlength="40" required></label>
      <p class="ecocrew-form-error" role="alert" hidden>Please enter at least three characters.</p>
      <button class="btn ecocrew-btn-primary" type="submit">${isJoining ? 'Join crew' : 'Create crew'}</button>
    </form>`;
}

function inviteDropdown() {
  return `
    <details class="ecocrew-invite-menu">
      <summary class="btn ecocrew-btn-secondary"><i class="bi bi-send" aria-hidden="true"></i> Invite <i class="bi bi-chevron-down" aria-hidden="true"></i></summary>
      <div class="ecocrew-invite-menu__panel" aria-label="Share crew invite">
        <button type="button" data-share="x"><i class="bi bi-twitter-x" aria-hidden="true"></i><span>X</span></button>
        <button type="button" data-share="instagram"><i class="bi bi-instagram" aria-hidden="true"></i><span>Instagram</span></button>
        <button type="button" data-share="telegram"><i class="bi bi-telegram" aria-hidden="true"></i><span>Telegram</span></button>
        <button type="button" data-share="whatsapp"><i class="bi bi-whatsapp" aria-hidden="true"></i><span>WhatsApp</span></button>
        <p data-share-status role="status"></p>
      </div>
    </details>`;
}

function emptyCrew() {
  return `
    <section class="ecocrew-crew-section" aria-labelledby="your-crew-title">
      <div class="ecocrew-section-heading"><h2 id="your-crew-title">Your crew</h2></div>
      <div class="ecocrew-crew-empty"><span aria-hidden="true"><i class="bi bi-people"></i></span><strong>You have not joined a crew yet</strong><p>Crews make every good choice count toward a shared streak.</p></div>
    </section>`;
}

function crewContent(state, membership) {
  const profile = getDemoProfile();
  const isCreatedCrew = membership.role === 'owner';
  const memberCount = Math.max(1, Number(membership.memberCount) || 1);
  const members = isCreatedCrew
    ? [
      { name: profile.name, initials: profile.name.charAt(0).toUpperCase(), tone: 'moss' },
      ...Array.from({ length: memberCount - 1 }, (_, index) => crew.members[index + 1] || { name: `Member ${index + 2}`, initials: String(index + 2), tone: 'sky' }),
    ]
    : crew.members.map((member) => member.name === 'Irfan' ? { ...member, name: profile.name, initials: profile.name.charAt(0).toUpperCase() } : member);
  return `
    <section class="ecocrew-crew-section" aria-labelledby="your-crew-title">
      <div class="ecocrew-crew-title-row"><div><p class="ecocrew-kicker">YOUR CREW</p><h2 id="your-crew-title">${escapeHtml(membership.crewName)}</h2><small>${escapeHtml(membership.role === 'owner' ? 'You created this crew' : 'Joined with invite code')}</small></div>${isCreatedCrew ? '<button class="btn ecocrew-delete-crew" type="button" data-delete-crew><i class="bi bi-trash3" aria-hidden="true"></i> Delete crew</button>' : '<button class="btn ecocrew-delete-crew" type="button" data-leave-crew>Leave crew</button>'}</div>
      <div class="ecocrew-crew-hero"><div class="ecocrew-member-stack">${members.map((member) => `<span class="ecocrew-avatar ecocrew-avatar--${member.tone}" title="${escapeHtml(member.name)}">${escapeHtml(member.initials)}</span>`).join('')}</div><div><strong>${members.length} member${members.length === 1 ? '' : 's'} · ${crew.streak}-day streak 🔥</strong><p>One more contribution protects today’s streak.</p></div><div class="ecocrew-crew-member-actions">${inviteDropdown()}${isCreatedCrew && memberCount < 8 ? '<button class="btn ecocrew-btn-secondary" type="button" data-add-demo-member>Add demo member</button>' : ''}</div></div>
    </section>
    <section class="ecocrew-feed"><div class="ecocrew-section-heading"><h2>Crew activity</h2><span>Celebrate milestones</span></div>${activity.map((entry) => `<article class="ecocrew-feed-item"><span class="ecocrew-feed-item__emoji" aria-hidden="true">${entry.emoji}</span><div><p><strong>${escapeHtml(entry.id === 'irfan' ? profile.name : entry.actor)}</strong> ${entry.action}</p><small>${entry.time}</small><button class="btn btn-sm" data-reaction="${entry.id}">👏 ${entry.reactions + (state.reactions[entry.id] || 0)}</button></div></article>`).join('')}</section>`;
}

async function copyInviteLink(link, status) {
  try {
    await navigator.clipboard.writeText(link);
    status.textContent = 'Invite link copied!';
  } catch {
    window.prompt('Copy this crew invite link:', link);
  }
}

function bindShareMenu(page, membership) {
  const menu = page.querySelector('.ecocrew-invite-menu');
  if (!menu) return;
  const status = menu.querySelector('[data-share-status]');
  const link = `${window.location.origin}${window.location.pathname}#/crew?invite=${encodeURIComponent(membership.inviteCode)}`;
  const message = `Join my EcoCrew, ${membership.crewName}!`;
  menu.querySelectorAll('[data-share]').forEach((button) => button.addEventListener('click', async () => {
    const platform = button.dataset.share;
    if (platform === 'instagram') {
      await copyInviteLink(link, status);
      status.textContent = 'Link copied — paste it into Instagram.';
      return;
    }
    const shareUrls = {
      x: `https://x.com/intent/post?text=${encodeURIComponent(message)}&url=${encodeURIComponent(link)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`,
    };
    window.open(shareUrls[platform], '_blank', 'noopener,noreferrer');
    status.textContent = `Opening ${button.textContent.trim()}…`;
    menu.open = false;
  }));
}

export function renderFriendsPage() {
  const state = getDemoState();
  const membership = getCrewMembership();
  const inviteCode = new URLSearchParams(window.location.hash.split('?')[1] || '').get('invite') || '';
  const page = appShell(membership ? escapeHtml(membership.crewName) : 'Crew hub', 'Crews', `
    <div data-crew-content>${membership ? '' : inviteCode ? membershipForm('join', inviteCode) : membershipActions()}${membership ? crewContent(state, membership) : emptyCrew()}</div>
  `, 'Join or create a crew, follow its shared streak, react to activity, and invite people you know.');

  function bindMembershipForm(form) {
    form.querySelector('[data-cancel-membership]').addEventListener('click', () => navigate('/crew'));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.querySelector('.ecocrew-form-error').hidden = false;
        form.reportValidity();
        return;
      }
      const value = String(new FormData(form).get('value') || '').trim();
      const membershipResult = form.dataset.crewForm === 'join' ? joinDemoCrew(value) : createDemoCrew(value);
      if (!membershipResult) {
        form.querySelector('.ecocrew-form-error').hidden = false;
        return;
      }
      navigate('/crew');
    });
  }

  page.querySelectorAll('[data-membership-action]').forEach((button) => button.addEventListener('click', () => {
    const container = page.querySelector('[data-crew-content]');
    container.querySelector('.ecocrew-crew-actions').outerHTML = membershipForm(button.dataset.membershipAction);
    const form = container.querySelector('[data-crew-form]');
    bindMembershipForm(form);
    form.querySelector('input').focus();
  }));

  const inviteForm = page.querySelector('[data-crew-form]');
  if (inviteForm) bindMembershipForm(inviteForm);

  page.querySelectorAll('[data-reaction]').forEach((button) => button.addEventListener('click', () => {
    const stateAfterReaction = addReaction(button.dataset.reaction);
    button.textContent = `👏 ${Number(button.textContent.match(/\d+/)[0]) + 1}`;
    button.disabled = true;
    button.setAttribute('aria-label', `Reaction added. ${stateAfterReaction.reactions[button.dataset.reaction]} new reactions in this demo.`);
  }));
  page.querySelector('[data-action="league"]')?.addEventListener('click', () => navigate('/league'));
  page.querySelector('[data-delete-crew]')?.addEventListener('click', () => {
    const confirmed = window.confirm(`Delete ${membership.crewName}? This removes every member and cannot be undone.`);
    if (confirmed && deleteDemoCrew()) navigate('/crew');
  });
  page.querySelector('[data-leave-crew]')?.addEventListener('click', () => {
    const confirmed = window.confirm(`Leave ${membership.crewName}?`);
    if (confirmed && leaveDemoCrew()) navigate('/crew');
  });
  page.querySelector('[data-add-demo-member]')?.addEventListener('click', () => {
    if (addDemoCrewMember()) navigate('/crew');
  });
  if (membership) bindShareMenu(page, membership);
  return page;
}
