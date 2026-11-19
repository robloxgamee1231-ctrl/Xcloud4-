/* SPDX-License-Identifier: GPL-3.0-only */
/* Dedicated Game Page matching src/ui/game_page.c with play.xbox.com launch & optional live WebRTC. */

import { t, trCategory, w } from '../i18n.js';
import { icon } from '../icons.js';
import { artworkUrl } from '../paths.js';
import { buildPlayXboxUrl } from '../xbox-catalog.js';
import { escapeHtml, formatPlayTime, formatRelativeTime, renderShelfSection } from './cards.js';

export function renderGamePageView(state, item) {
  if (!item) {
    return `<div class="x4-page"><div class="x4-empty-box"><p>Game not found.</p></div></div>`;
  }
  const { auth, catalogItems, favorites, myGames, localRecents } = state;
  const isFav = favorites.includes(item.productId);
  const inMyGames = myGames.includes(item.productId);
  const rec = localRecents[item.productId];
  const heroBg = item.heroUrl || item.coverUrl || artworkUrl(item.productId, 'hero.svg');
  const playUrl = item.playUrl || buildPlayXboxUrl(item.productId, item.title);
  const liveStreamReady = Boolean(auth?.signedIn && auth?.liveStream);

  const similar = catalogItems
    .filter((g) => g.productId !== item.productId && (g.category === item.category || g.publisher === item.publisher))
    .slice(0, 10);

  const shots = Array.isArray(item.screenshots) ? item.screenshots : [];

  return `
    <div class="x4-page x4-gamepage">
      <div class="x4-gamepage-hero">
        <div class="x4-gamepage-hero-bg" style="background-image:url('${escapeHtml(heroBg)}')"></div>
        <div class="x4-gamepage-hero-scrim"></div>
        <div class="x4-gamepage-hero-content">
          <button class="x4-btn is-ghost x4-back-pill x4-focusable" data-action="back" type="button">
            ${icon('chevron-left')} <span>Back</span>
          </button>

          <div class="x4-gamepage-badges">
            ${item.freeToPlay ? `<span class="x4-badge-f2p">${t('X4_TR_CATALOG_FREE')}</span>` : ''}
            ${item.ageRating ? `<span class="x4-meta-chip">${escapeHtml(item.ageRating)}</span>` : ''}
            ${item.category ? `<span class="x4-meta-chip">${escapeHtml(trCategory(item.category))}</span>` : ''}
            ${item.year ? `<span class="x4-meta-chip">${escapeHtml(item.year)}</span>` : ''}
          </div>

          <h1 class="x4-gamepage-title">${escapeHtml(item.title)}</h1>
          <p class="x4-gamepage-studio">${escapeHtml([item.developer, item.publisher].filter(Boolean).join(' · '))}</p>
          <p class="x4-gamepage-desc">${escapeHtml(item.description || item.shortDescription || '')}</p>

          ${
            rec?.playTimeSec || rec?.lastPlayedAt
              ? `<div class="x4-gamepage-recents">
                   ${rec?.playTimeSec ? `<span>${t('X4_TR_U49_PLAY_TIME')}: <strong>${formatPlayTime(rec.playTimeSec)}</strong></span>` : ''}
                   ${rec?.lastPlayedAt ? `<span>${t('X4_TR_U49_LAST_SESSION')}: <strong>${formatRelativeTime(rec.lastPlayedAt)}</strong></span>` : ''}
                 </div>`
              : ''
          }

          <div class="x4-gamepage-actions">
            ${
              liveStreamReady
                ? `<button class="x4-btn is-primary is-lg x4-focusable" data-action="play-game" data-product-id="${escapeHtml(item.productId)}" type="button">
                     ${icon('play')} <span>${t('X4_TR_APPLE_PLAY_NOW_BTN')}</span>
                   </button>
                   <a class="x4-btn is-secondary x4-focusable" href="${escapeHtml(playUrl)}" target="_blank" rel="noopener noreferrer" data-play-xbox="${escapeHtml(item.productId)}">
                     ${icon('world')} <span>${w('playOnXbox')}</span>
                   </a>`
                : `<a class="x4-btn is-primary is-lg x4-focusable" href="${escapeHtml(playUrl)}" target="_blank" rel="noopener noreferrer" data-play-xbox="${escapeHtml(item.productId)}">
                     ${icon('play')} <span>${w('playOnXbox')}</span>
                   </a>
                   ${
                     !auth?.signedIn
                       ? `<button class="x4-btn is-secondary x4-focusable" data-action="navigate" data-route="account" type="button">
                            ${icon('user')} <span>${t('X4_TR_U49_ACCOUNT_SIGN_IN')}</span>
                          </button>`
                       : ''
                   }`
            }

            <button class="x4-btn is-secondary x4-focusable" data-action="toggle-favorite" data-product-id="${escapeHtml(item.productId)}" type="button">
              ${icon(isFav ? 'heart-filled' : 'heart')}
              <span>${isFav ? t('X4_TR_U49_REMOVE_FAVORITE') : t('X4_TR_U49_ADD_TO_FAVORITES')}</span>
            </button>

            <button class="x4-btn is-secondary x4-focusable" data-action="toggle-mygames" data-product-id="${escapeHtml(item.productId)}" type="button">
              ${icon(inMyGames ? 'check' : 'plus')}
              <span>${inMyGames ? t('X4_TR_U49_REMOVE_FROM_MY_GAMES') : t('X4_TR_U49_ADD_TO_MY_GAMES')}</span>
            </button>

            <button class="x4-btn is-ghost x4-focusable" data-action="store-qr" data-product-id="${escapeHtml(item.productId)}" type="button">
              ${icon('qrcode')} <span>${w('openStoreQr')}</span>
            </button>
          </div>
        </div>
      </div>

      ${
        item.attributes?.length
          ? `<section class="x4-details-strip">
               ${item.attributes.map((a) => `<span class="x4-attr-chip">${escapeHtml(a)}</span>`).join('')}
             </section>`
          : ''
      }

      ${
        shots.length
          ? `<section class="x4-shelf">
               <div class="x4-shelf-head"><h2 class="x4-shelf-title">Screenshots <span class="x4-count-pill">${shots.length}</span></h2></div>
               <div class="x4-shots-grid">
                 ${shots
                   .map(
                     (s, idx) => `
                       <button class="x4-shot-card x4-focusable" data-action="zoom-shot" data-shot-url="${escapeHtml(s.full || s.thumb)}" data-shot-title="${escapeHtml(item.title)} (${idx + 1})" type="button">
                         <img src="${escapeHtml(s.thumb || s.full)}" alt="Screenshot ${idx + 1}" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(artworkUrl(item.productId, `shot${idx + 1}.svg`))}';" />
                       </button>`
                   )
                   .join('')}
               </div>
             </section>`
          : ''
      }

      ${renderShelfSection({
        id: 'similar',
        title: 'Similar Games',
        items: similar,
        favorites,
        localRecents,
      })}
    </div>
  `;
}
