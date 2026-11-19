/* SPDX-License-Identifier: GPL-3.0-only */
/* Account & Microsoft Device Code OAuth2 view matching src/ui/ui2_account.c + cloud_time.c. */

import { t, w } from '../i18n.js';
import { icon } from '../icons.js';
import { appUrl } from '../paths.js';
import { generateQrSvg } from '../qrcode-svg.js';
import { escapeHtml, formatPlayTime } from './cards.js';

export function renderAccountView(state) {
  const { auth, deviceLogin, favorites, localRecents, catalogItems } = state;

  if (!auth.signedIn) {
    const uri = deviceLogin?.verificationUri || 'https://www.microsoft.com/link';
    const qrSvg = generateQrSvg(uri);
    const remainingSec = deviceLogin?.expiresAt ? Math.max(0, Math.round((deviceLogin.expiresAt - Date.now()) / 1000)) : 0;

    return `
      <div class="x4-page">
        <div class="x4-page-header">
          <div>
            <h1 class="x4-page-title">${t('X4_TR_U49_ACCOUNT_TITLE')}</h1>
            <p class="x4-muted">${t('X4_TR_U49_ACCOUNT_PRIVACY')}</p>
          </div>
        </div>

        <div class="x4-account-grid">
          <div class="x4-panel">
            <div class="x4-panel-brand">
              <img src="${appUrl('assets/branding/profile.svg')}" alt="XCloud4 Profile" class="x4-profile-svg" />
              <div>
                <h2>${t('X4_TR_U49_ACCOUNT_SIGN_IN')}</h2>
                <p class="x4-muted">${t('X4_TR_U49_HOME_SIGN_IN_SUBTITLE')}</p>
              </div>
            </div>

            ${
              deviceLogin?.sandboxUnavailable
                ? `<div class="x4-warn-box">
                     <strong>${w('demoBadge')}</strong>
                     <p>${w('demoExplain')}</p>
                     <div class="x4-account-cta-row">
                       <a class="x4-btn is-primary x4-focusable" href="https://www.xbox.com/play" target="_blank" rel="noopener noreferrer">
                         ${icon('world')} <span>${w('playOnXbox')}</span>
                       </a>
                       <button class="x4-btn is-secondary x4-focusable" data-action="demo-signin" type="button">
                         ${icon('play')} <span>${w('demoModeBtn')}</span>
                       </button>
                     </div>
                   </div>`
                : deviceLogin?.userCode
                  ? `<div class="x4-device-box">
                       <div class="x4-qr-card">${qrSvg}</div>
                       <div class="x4-device-steps">
                         <div class="x4-step-line"><span class="x4-step-num">1</span><span>${t('X4_TR_U49_ACCOUNT_STEP_SCAN')} <a href="${escapeHtml(uri)}" target="_blank" rel="noopener noreferrer">${escapeHtml(uri)}</a></span></div>
                         <div class="x4-step-line"><span class="x4-step-num">2</span><span>${t('X4_TR_U49_ACCOUNT_STEP_CODE')}</span></div>
                         <div class="x4-code-row">
                           <code class="x4-device-code">${escapeHtml(deviceLogin.userCode)}</code>
                           <button class="x4-btn is-secondary x4-focusable" data-action="copy-device-code" data-code="${escapeHtml(deviceLogin.userCode)}" type="button">Copy</button>
                           <button class="x4-btn is-ghost x4-focusable" data-action="cancel-device-login" type="button">${t('X4_TR_UI2_SETTINGS_LAB_CANCEL')}</button>
                         </div>
                         <div class="x4-muted">${t('X4_TR_U49_ACCOUNT_WAIT')} (${Math.floor(remainingSec / 60)}m ${remainingSec % 60}s)</div>
                       </div>
                     </div>`
                  : `<div class="x4-account-cta-row">
                       <button class="x4-btn is-primary is-lg x4-focusable" data-action="start-device-login" type="button">
                         ${icon('user')} <span>${t('X4_TR_U49_ACCOUNT_SIGN_IN')}</span>
                       </button>
                       <a class="x4-btn is-secondary x4-focusable" href="https://www.xbox.com/play" target="_blank" rel="noopener noreferrer">
                         ${icon('world')} <span>${w('playOnXbox')}</span>
                       </a>
                       <button class="x4-btn is-ghost x4-focusable" data-action="demo-signin" type="button">
                         ${icon('play')} <span>${w('demoModeBtn')}</span>
                       </button>
                     </div>`
            }
          </div>

          <div class="x4-panel">
            <h3>${w('demoBadge')}</h3>
            <p class="x4-muted">${w('demoExplain')}</p>
            <div class="x4-account-demo-form">
              <label class="x4-input-label">
                <span>Gamertag</span>
                <input id="x4DemoTagInput" class="x4-input x4-focusable" type="text" value="XCloud4Preview" maxlength="24" />
              </label>
              <button class="x4-btn is-secondary x4-focusable" data-action="demo-signin" type="button">
                ${icon('play')} <span>${w('demoModeBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const recentValues = Object.values(localRecents || {});
  const totalSec = recentValues.reduce((acc, r) => acc + (r.playTimeSec || 0), 0);
  const ct = auth.cloudTime;

  let cloudTimeHtml = `<p class="x4-muted">Unlimited / Not restricted</p>`;
  if (ct?.available && !ct.unlimited && Number.isFinite(ct.remainingSeconds) && Number.isFinite(ct.maxSeconds)) {
    const remMin = Math.round(ct.remainingSeconds / 60);
    const maxMin = Math.max(1, Math.round(ct.maxSeconds / 60));
    const pct = Math.min(100, Math.round((ct.remainingSeconds / ct.maxSeconds) * 100));
    const levelCls = remMin <= 5 ? 'is-danger' : remMin <= 15 ? 'is-amber' : 'is-ok';
    cloudTimeHtml = `
      <div class="x4-quota-wrap">
        <div class="x4-quota-bar"><div class="x4-quota-fill ${levelCls}" style="width:${pct}%"></div></div>
        <div class="x4-quota-meta">
          <strong>${remMin} min / ${maxMin} min</strong>
          <span class="x4-muted">${pct}% remaining</span>
        </div>
      </div>`;
  }

  const localSummary =
    recentValues.length === 1
      ? t('X4_TR_50_ACCOUNT_LOCAL_ONE_FMT', 1)
      : t('X4_TR_U49_ACCOUNT_LOCAL_FMT', recentValues.length);

  return `
    <div class="x4-page">
      <div class="x4-page-header">
        <div>
          <h1 class="x4-page-title">${t('X4_TR_U49_ACCOUNT_TITLE')}</h1>
          <p class="x4-muted">${t('X4_TR_U49_ACCOUNT_ACTIVE')}</p>
        </div>
        ${auth.demoMode ? `<span class="x4-sandbox-chip">${w('demoBadge')}</span>` : ''}
      </div>

      <div class="x4-account-grid">
        <div class="x4-panel">
          <div class="x4-panel-brand">
            <img src="${appUrl('assets/branding/profile.svg')}" alt="Profile" class="x4-profile-svg" />
            <div>
              <h2>${escapeHtml(auth.gamertag)}</h2>
              <div class="x4-pill-row">
                <span class="x4-pill is-accent">${escapeHtml(auth.offeringId || 'xgpuweb')}</span>
                <span class="x4-pill">${escapeHtml(auth.activeRegion?.name || 'Auto')}</span>
              </div>
            </div>
          </div>

          <div class="x4-kv-list">
            <div class="x4-kv-row">
              <span class="x4-muted">${t('X4_TR_U49_ACCOUNT_SERVER')}</span>
              <strong>${escapeHtml(auth.activeRegion?.name || 'Auto')}</strong>
            </div>
            <div class="x4-kv-row">
              <span class="x4-muted">${t('X4_TR_U49_ACCOUNT_CATALOG')}</span>
              <strong>${catalogItems.length} ${t('X4_TR_U49_GAMES')}</strong>
            </div>
            <div class="x4-kv-row">
              <span class="x4-muted">${t('X4_TR_U49_ACCOUNT_LOCAL')}</span>
              <strong>${escapeHtml(localSummary)} · ${formatPlayTime(totalSec)} · ${favorites.length} ${t('X4_TR_U49_FAVORITES')}</strong>
            </div>
          </div>

          <div class="x4-account-actions">
            <button class="x4-btn is-secondary x4-focusable" data-action="refresh-account" type="button">
              ${icon('refresh')} <span>${t('X4_TR_U49_ACCOUNT_CHECK')}</span>
            </button>
            <button class="x4-btn is-secondary x4-focusable" data-action="logout-prompt" data-forget="false" type="button">
              <span>${t('X4_TR_U49_ACCOUNT_SIGN_OUT')}</span>
            </button>
            <button class="x4-btn is-danger x4-focusable" data-action="logout-prompt" data-forget="true" type="button">
              <span>${t('X4_TR_U49_ACCOUNT_FORGET')}</span>
            </button>
          </div>
        </div>

        <div class="x4-panel">
          <div class="x4-panel-head">
            <h3>${t('X4_TR_U49_ACCOUNT_CLOUD_TIME')}</h3>
            <button class="x4-icon-btn x4-focusable" data-action="refresh-cloud-time" type="button" title="Refresh">${icon('refresh')}</button>
          </div>
          ${cloudTimeHtml}
          <p class="x4-muted x4-mt-sm">${t('X4_TR_U49_ACCOUNT_PRIVACY')}</p>
        </div>
      </div>
    </div>
  `;
}
