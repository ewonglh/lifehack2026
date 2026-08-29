import { getCosmeticAsset } from './cosmetic-assets.js';
import { cosmeticVisual } from '../../components/cosmetic-visual.js';

export function appShell(
  title,
  eyebrow,
  content,
  info = 'A quick EcoCrew screen for making one small choice together.',
) {
  const avatarInitial =
    String(document.body.dataset.ecocrewDisplayName || 'I')
      .trim()
      .charAt(0)
      .toUpperCase() || 'I';
  const frameId = document.body.dataset.ecocrewFrameId;
  const avatarFrame = getCosmeticAsset(frameId)
    ? cosmeticVisual({ id: frameId }, 'ecocrew-avatar-frame')
    : '';
  const page = document.createElement('main');
  page.className = 'ecocrew-page';
  page.tabIndex = -1;
  page.dataset.pageTitle = title;
  page.innerHTML =
    '<header class="ecocrew-page__header">' +
    '<div class="ecocrew-wordmark"><span aria-hidden="true">✦</span> EcoCrew</div>' +
    '<div class="ecocrew-header-actions">' +
    '<details class="ecocrew-page-info"><summary aria-label="About this page"><i class="bi bi-info-lg" aria-hidden="true"></i></summary><div class="ecocrew-page-info__panel"><strong>' +
    escapeHtml(title) +
    '</strong><p>' +
    escapeHtml(info) +
    '</p></div></details>' +
    '<a class="ecocrew-avatar" href="#/profile" aria-label="Your profile">' +
    avatarInitial +
    avatarFrame +
    '</a>' +
    '</div></header>' +
    '<section class="ecocrew-page__intro"><p class="ecocrew-eyebrow">' +
    escapeHtml(eyebrow) +
    '</p><h1>' +
    escapeHtml(title) +
    '</h1></section>' +
    content;
  return page;
}

export function standaloneShell(
  title,
  eyebrow,
  content,
  info = 'A quick EcoCrew screen for making one small choice together.',
) {
  const page = document.createElement('main');
  page.className = 'ecocrew-page ecocrew-page--standalone';
  page.tabIndex = -1;
  page.dataset.pageTitle = title;
  page.innerHTML =
    '<header class="ecocrew-page__header">' +
    '<a class="ecocrew-wordmark" href="#/auth"><span aria-hidden="true">✦</span> EcoCrew</a>' +
    '<details class="ecocrew-page-info"><summary aria-label="About this page"><i class="bi bi-info-lg" aria-hidden="true"></i></summary><div class="ecocrew-page-info__panel"><strong>' +
    escapeHtml(title) +
    '</strong><p>' +
    escapeHtml(info) +
    '</p></div></details></header>' +
    '<section class="ecocrew-page__intro"><p class="ecocrew-eyebrow">' +
    escapeHtml(eyebrow) +
    '</p><h1>' +
    escapeHtml(title) +
    '</h1></section>' +
    content;
  return page;
}

export function navigate(path) {
  const target = '#' + path;
  if (window.location.hash === target) {
    window.dispatchEvent(new window.Event('hashchange'));
    return;
  }
  window.location.hash = target;
}

export function buildInviteUrl(inviteCode, location = window.location) {
  const code = String(inviteCode || '')
    .trim()
    .toUpperCase();
  if (!code) return '';

  const url = new window.URL(location.href);
  url.hash = '/join/' + encodeURIComponent(code);
  return url.toString();
}

export function progressBar(value, total, label) {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeValue = Math.max(0, Math.min(safeTotal, Number(value) || 0));
  const percent = Math.min(100, Math.round((safeValue / safeTotal) * 100));
  return (
    '<div class="ecocrew-progress" role="progressbar" aria-label="' +
    escapeHtml(label) +
    '" aria-valuemin="0" aria-valuemax="' +
    safeTotal +
    '" aria-valuenow="' +
    safeValue +
    '"><span style="width:' +
    percent +
    '%"></span></div>'
  );
}

export function escapeHtml(value = '') {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}
