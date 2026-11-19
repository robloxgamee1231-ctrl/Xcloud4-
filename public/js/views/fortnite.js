/* SPDX-License-Identifier: GPL-3.0-only */
/* Dedicated Fortnite Free-to-Play launcher view matching src/ui/ui2_fortnite.c. */

import { t, w } from '../i18n.js';
import { icon } from '../icons.js';
import { artworkUrl } from '../paths.js';
import { escapeHtml } from './cards.js';

export function renderFortniteView(state) {
  const { auth, catalogItems } = state;
  const fn = catalogItems.find((i) => i.productId === 'BT5P2X999VH2') || {
    productId: 'BT5P2X999VH2',
    titleId: 'Fortnite',
    title: 'Fortnite',
    developer: 'Epic Games',
    publisher: 'Epic Games',
    heroUrl: artworkUrl('BT5P2X999VH2', 'hero.svg'),
    shortDescription: t('X4_TR_U49_FORTNITE_SUBTITLE'),
  };

  return `
    <div class="x4-page">
      <div class="x4-gamepage-hero is-fortnite">
        <div class="x4-gamepage-hero-bg" style="background-image:url('${escapeHtml(fn.heroUrl || artworkUrl('BT5P2X999VH2', 'hero.svg'))}')"></div>
        <div class="x4-gamepage-hero-scrim"></div>
        <div class="x4-gamepage-hero-content">
          <div class="x4-gamepage-badges">
            <span class="x4-badge-f2p">${t('X4_TR_U49_FORTNITE_NO_PASS')}</span>
            <span class="x4-meta-chip">BT5P2X999VH2</span>
          </div>
          <h1 class="x4-gamepage-title">${t('X4_TR_U49_FORTNITE_TITLE')}</h1>
          <p class="x4-gamepage-desc">${t('X4_TR_U49_FORTNITE_SUBTITLE')}</p>

          <div class="x4-info-banner">
            ${icon('info-circle')}
            <span>${t('X4_TR_U49_FORTNITE_WAIT')}</span>
          </div>

          <div class="x4-gamepage-actions">
            ${
              auth.signedIn
                ? `<button class="x4-btn is-primary is-lg x4-focusable" data-action="play-game" data-product-id="BT5P2X999VH2" type="button">
                     ${icon('play')} <span>${t('X4_TR_U49_FORTNITE_OPEN')}</span>
                   </button>`
                : `<button class="x4-btn is-primary is-lg x4-focusable" data-action="navigate" data-route="account" type="button">
                     ${icon('user')} <span>${t('X4_TR_U49_ACCOUNT_SIGN_IN')}</span>
                   </button>
                   <button class="x4-btn is-secondary x4-focusable" data-action="demo-play" data-product-id="BT5P2X999VH2" type="button">
                     ${icon('play')} <span>${w('demoModeBtn')}</span>
                   </button>`
            }
            <button class="x4-btn is-ghost x4-focusable" data-action="open-game" data-product-id="BT5P2X999VH2" type="button">
              <span>${t('X4_TR_U49_VIEW_GAME_SHORT')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
