/* SPDX-License-Identifier: GPL-3.0-only */
/* About, version info, license viewer, and live GitHub Release checker matching src/ui/ui2_info.c. */

import { t, w } from '../i18n.js';
import { icon, brandWordmark } from '../icons.js';
import { escapeHtml } from './cards.js';

export function renderAboutView(state) {
  const isLab = Boolean(state.settings?.lab?.enabled);
  const version = isLab ? '0.7.111-lab' : '1.3.0-beta';
  const upd = state.updateCheck;

  let updateStatusHtml = `<span class="x4-muted">${t('X4_TR_U49_ABOUT_HELP')}</span>`;
  if (upd?.checking) {
    updateStatusHtml = `<span class="x4-pill">${t('X4_TR_U49_ABOUT_CHECKING')}</span>`;
  } else if (upd?.error) {
    updateStatusHtml = `<span class="x4-pill is-amber">${t('X4_TR_U49_ABOUT_FAILED')} (${escapeHtml(upd.error)})</span>`;
  } else if (upd?.ok) {
    updateStatusHtml = upd.isLatest
      ? `<span class="x4-pill is-accent">${icon('check')} ${t('X4_TR_U49_ABOUT_LATEST')} (${escapeHtml(upd.latestTag)})</span>`
      : `<span class="x4-pill is-amber">${t('X4_TR_U49_ABOUT_UPDATE_FMT', upd.latestTag)}</span>`;
  }

  return `
    <div class="x4-page">
      <div class="x4-page-header">
        <div>
          <h1 class="x4-page-title">${t('X4_TR_U49_ABOUT_TITLE')}</h1>
          <p class="x4-muted">${t('X4_TR_U49_ABOUT_DESCRIPTION')}</p>
        </div>
      </div>

      <div class="x4-panel">
        <div class="x4-about-brand-row">
          ${brandWordmark(true)}
          ${isLab ? `<span class="x4-lab-pill">${w('labBadge')}</span>` : ''}
        </div>

        <div class="x4-kv-list">
          <div class="x4-kv-row"><span class="x4-muted">${t('X4_TR_U49_ABOUT_VERSION')}</span><strong>${escapeHtml(version)} (Web Edition)</strong></div>
          <div class="x4-kv-row"><span class="x4-muted">${t('X4_TR_U49_ABOUT_DEVELOPER')}</span><strong>ASAP_EDGR (upstream) · Web Port</strong></div>
          <div class="x4-kv-row"><span class="x4-muted">${t('X4_TR_U49_ABOUT_LICENSE')}</span><strong>GPL-3.0-only</strong></div>
          <div class="x4-kv-row"><span class="x4-muted">${t('X4_TR_U49_ABOUT_SOURCE')}</span><a href="https://github.com/asp11edgr/XCloud4" target="_blank" rel="noopener noreferrer">github.com/asp11edgr/XCloud4</a></div>
          <div class="x4-kv-row"><span class="x4-muted">${t('X4_TR_U49_ABOUT_REQUIREMENTS')}</span><span>WebRTC · WebGL · Gamepad API · Xbox Cloud Gaming</span></div>
          <div class="x4-kv-row"><span class="x4-muted">${t('X4_TR_U49_ABOUT_CREDITS')}</span><span>Inter v4.0 (OFL) · Noto Sans (OFL) · Tabler Icons v3.24.0 (MIT) · AMD FidelityFX CAS (MIT) · JoyShockMapper (MIT) · Better xCloud (MIT)</span></div>
        </div>

        <div class="x4-about-update-bar">
          <div>${updateStatusHtml}</div>
          <div class="x4-hero-actions">
            <button class="x4-btn is-primary x4-focusable" data-action="check-updates" type="button">
              ${icon('refresh')} <span>${t('X4_TR_U49_ABOUT_UPDATE')}</span>
            </button>
            ${
              upd?.htmlUrl
                ? `<a class="x4-btn is-secondary x4-focusable" href="${escapeHtml(upd.htmlUrl)}" target="_blank" rel="noopener noreferrer">${icon('external-link')} Release</a>`
                : ''
            }
            <button class="x4-btn is-secondary x4-focusable" data-action="view-licenses" type="button">
              ${icon('info-circle')} <span>Licenses</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
