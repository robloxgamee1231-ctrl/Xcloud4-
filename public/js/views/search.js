/* SPDX-License-Identifier: GPL-3.0-only */
/* Live Search view with controller-friendly On-Screen Keyboard row. */

import { t, tCount, trCategory } from '../i18n.js';
import { icon } from '../icons.js';
import { escapeHtml, renderGameCard } from './cards.js';

const OSK_ROWS = [
  '1234567890'.split(''),
  'QWERTYUIOP'.split(''),
  'ASDFGHJKL'.split(''),
  'ZXCVBNM'.split(''),
];

export function renderSearchView(state) {
  const { catalogItems, favorites, localRecents, searchQuery, showOsk } = state;
  const favSet = new Set(favorites);
  const q = (searchQuery || '').trim().toLowerCase();

  const matches = q
    ? catalogItems.filter((item) => {
        const hay = `${item.title} ${item.publisher} ${item.developer} ${item.category} ${trCategory(item.category)}`.toLowerCase();
        return hay.includes(q);
      })
    : catalogItems;

  const countText = `${matches.length} ${tCount(matches.length, 'X4_TR_U49_RESULT', 'X4_TR_U49_RESULTS')}`;

  return `
    <div class="x4-page">
      <div class="x4-page-header">
        <div>
          <h1 class="x4-page-title">${t('X4_TR_U49_SEARCH_LABEL')}</h1>
          <p class="x4-muted">${t('X4_TR_U49_SEARCH_SUBTITLE')}</p>
        </div>
        <span class="x4-pill is-accent">${escapeHtml(countText)}</span>
      </div>

      <div class="x4-search-bar-row">
        <div class="x4-search-input-wrap">
          ${icon('search')}
          <input id="x4SearchInput" class="x4-search-input x4-focusable" type="search"
            value="${escapeHtml(searchQuery)}"
            placeholder="${escapeHtml(t('X4_TR_U49_SEARCH_PLACEHOLDER'))}" autocomplete="off" />
          ${
            searchQuery
              ? `<button class="x4-icon-btn x4-focusable" data-search-clear type="button" aria-label="Clear">${icon('x')}</button>`
              : ''
          }
        </div>
        <button class="x4-btn is-secondary x4-focusable" data-search-toggle-osk type="button">
          ${icon('device-gamepad')} <span>OSK</span>
        </button>
      </div>

      ${
        showOsk
          ? `<div class="x4-osk">
               ${OSK_ROWS.map(
                 (row) => `
                   <div class="x4-osk-row">
                     ${row.map((ch) => `<button class="x4-osk-key x4-focusable" data-osk-key="${ch}" type="button">${ch}</button>`).join('')}
                   </div>`
               ).join('')}
               <div class="x4-osk-row">
                 <button class="x4-osk-key is-wide x4-focusable" data-osk-key=" " type="button">SPACE</button>
                 <button class="x4-osk-key is-wide x4-focusable" data-osk-back type="button">⌫</button>
                 <button class="x4-osk-key is-wide x4-focusable" data-search-clear type="button">CLEAR</button>
               </div>
             </div>`
          : `<p class="x4-muted x4-search-hint">${t('X4_TR_U49_SEARCH_HINT')}</p>`
      }

      ${
        matches.length === 0
          ? `<div class="x4-empty-box"><p>${t('X4_TR_U49_NO_GAMES_IN_VIEW')}</p></div>`
          : `<div class="x4-game-grid">
               ${matches.map((item) => renderGameCard(item, { isFav: favSet.has(item.productId), recentInfo: localRecents[item.productId] })).join('')}
             </div>`
      }
    </div>
  `;
}
