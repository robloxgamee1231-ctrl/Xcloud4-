/* SPDX-License-Identifier: GPL-3.0-only */
/* My Games view: Favorites & Recently Played tabs with sorting & play-time stats. */

import { t } from '../i18n.js';
import { escapeHtml, renderGameCard } from './cards.js';

export function renderMyGamesView(state) {
  const { catalogItems, favorites, myGames, localRecents, myGamesFilter } = state;
  const byId = new Map(catalogItems.map((i) => [i.productId, i]));
  const favSet = new Set(favorites);

  const favItems = [...new Set([...favorites, ...myGames])].map((id) => byId.get(id)).filter(Boolean);
  const recentEntries = Object.values(localRecents || {}).sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
  const recentItems = recentEntries.map((r) => byId.get(r.productId)).filter(Boolean);

  const tab = myGamesFilter.tab || 'favorites';
  let activeList = tab === 'recent' ? recentItems.slice() : favItems.slice();

  const sortMode = myGamesFilter.sort || 'recent';
  if (sortMode === 'az') {
    activeList.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortMode === 'most-played') {
    activeList.sort((a, b) => (localRecents[b.productId]?.playTimeSec || 0) - (localRecents[a.productId]?.playTimeSec || 0));
  } else if (sortMode === 'favorites-first') {
    activeList.sort((a, b) => Number(favSet.has(b.productId)) - Number(favSet.has(a.productId)));
  } else {
    activeList.sort((a, b) => (localRecents[b.productId]?.lastPlayedAt || 0) - (localRecents[a.productId]?.lastPlayedAt || 0));
  }

  return `
    <div class="x4-page">
      <div class="x4-page-header">
        <div>
          <h1 class="x4-page-title">${t('X4_TR_U49_MY_GAMES')}</h1>
          <p class="x4-muted">${t('X4_TR_U49_LIBRARY_SUBTITLE')}</p>
        </div>
      </div>

      <div class="x4-tabs-row">
        <div class="x4-tabs">
          <button class="x4-tab ${tab === 'favorites' ? 'is-active' : ''} x4-focusable" data-mygames-tab="favorites" type="button">
            ${t('X4_TR_U49_FAVORITES')} <span class="x4-count-pill">${favItems.length}</span>
          </button>
          <button class="x4-tab ${tab === 'recent' ? 'is-active' : ''} x4-focusable" data-mygames-tab="recent" type="button">
            ${t('X4_TR_U49_RECENTLY_PLAYED')} <span class="x4-count-pill">${recentItems.length}</span>
          </button>
        </div>

        <label class="x4-select-wrap">
          <span>${t('X4_TR_U49_SORT_BY')}</span>
          <select id="x4MyGamesSort" class="x4-select x4-focusable">
            <option value="recent" ${sortMode === 'recent' ? 'selected' : ''}>${t('X4_TR_U49_SORT_RECENT')}</option>
            <option value="most-played" ${sortMode === 'most-played' ? 'selected' : ''}>${t('X4_TR_U49_SORT_MOST_PLAYED')}</option>
            <option value="favorites-first" ${sortMode === 'favorites-first' ? 'selected' : ''}>${t('X4_TR_U49_SORT_FAVORITES_FIRST')}</option>
            <option value="az" ${sortMode === 'az' ? 'selected' : ''}>A – Z</option>
          </select>
        </label>
      </div>

      ${
        activeList.length === 0
          ? `<div class="x4-empty-box">
               <h3>${tab === 'favorites' ? t('X4_TR_U49_NO_FAVORITES') : t('X4_TR_U49_HOME_EMPTY_RECENTS')}</h3>
               <p class="x4-muted">${tab === 'favorites' ? t('X4_TR_U49_FAVORITE_FROM_GAME') : t('X4_TR_U49_RECENTS_WILL_APPEAR')}</p>
               <button class="x4-btn is-primary x4-focusable" data-action="navigate" data-route="catalog" type="button">
                 ${escapeHtml(t('X4_TR_U49_HOME_EXPLORE_CATALOG'))}
               </button>
             </div>`
          : `<div class="x4-game-grid">
               ${activeList.map((item) => renderGameCard(item, { isFav: favSet.has(item.productId), recentInfo: localRecents[item.productId] })).join('')}
             </div>`
      }
    </div>
  `;
}
