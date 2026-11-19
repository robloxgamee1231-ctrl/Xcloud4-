/* SPDX-License-Identifier: GPL-3.0-only */
/* Voluntary Ko-fi support screen matching src/ui/ui2_info.c. */

import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { generateQrSvg } from '../qrcode-svg.js';

export function renderSupportView() {
  const url = 'https://ko-fi.com/asapedgr';
  const qrSvg = generateQrSvg(url);

  return `
    <div class="x4-page">
      <div class="x4-page-header">
        <div>
          <h1 class="x4-page-title">${t('X4_TR_U49_SUPPORT_TITLE')}</h1>
          <p class="x4-muted">${t('X4_TR_U49_SUPPORT_HEADLINE')}</p>
        </div>
      </div>

      <div class="x4-panel x4-support-card">
        <div class="x4-qr-card is-lg">${qrSvg}</div>
        <div class="x4-support-copy">
          <span class="x4-pill is-accent">${icon('heart-filled')} Ko-fi</span>
          <h2>${t('X4_TR_U49_SUPPORT_HEADLINE')}</h2>
          <p>${t('X4_TR_U49_SUPPORT_VOLUNTARY')}</p>
          <p class="x4-muted">${t('X4_TR_U49_SUPPORT_NOTICE')}</p>
          <div class="x4-hero-actions">
            <a class="x4-btn is-primary x4-focusable" href="${url}" target="_blank" rel="noopener noreferrer">
              ${icon('external-link')} <span>${t('X4_TR_U49_SUPPORT_SCAN')} · ko-fi.com/asapedgr</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}
