/* SPDX-License-Identifier: GPL-3.0-only */
/* Paginated Catalog Grid Browser with Collection Pills (All, Popular, Free, New, Leaving), Genre, Access & Sort. */

import { t, trCategory, w } from '../i18n.js';
import { escapeHtml, renderGameCard } from './cards.js';

const PAGE_SIZE = 24;

export function renderCatalogView(state) {
  const { catalogItems, catalogSource, publicLists, favorites, localRecents, catalogFilter } = state;
  const favSet = new Set(favorites);
  const isLiveCatalog = catalogSource === 'live' || catalogSource === 'live-snapshot';
  const activeCol = catalogFilter.collection || 'all';

  const genres = ['ALL', ...new Set(catalogItems.map((i) => i.category).filter(Boolean)).values()].sort((a, b) =>
    a === 'ALL' ? -1 : b === 'ALL' ? 1 : a.localeCompare(b)
  );

  let filtered = catalogItems.slice();
  if (activeCol !== 'all' && Array.isArray(publicLists?.[activeCol])) {
    const colOrder = new Map(publicLists[activeCol].map((id, idx) => [id, idx]));
    filtered = filtered.filter((i) => colOrder.has(i.productId));
    if (catalogFilter.sort === 'featured') {
      filtered.sort((a, b) => colOrder.get(a.productId) - colOrder.get(b.productId));
    }
  }
  if (catalogFilter.genre !== 'ALL') {
    filtered = filtered.filter((i) => i.category === catalogFilter.genre);
  }
  if (catalogFilter.access === 'free') {
    filtered = filtered.filter((i) => i.freeToPlay);
  } else if (catalogFilter.access === 'favorites') {
    filtered = filtered.filter((i) => favSet.has(i.productId));
  }

  if (catalogFilter.sort === 'az') {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  } else if (catalogFilter.sort === 'new') {
    filtered.sort((a, b) => String(b.releaseDate || b.year || '').localeCompare(String(a.releaseDate || a.year || '')));
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.max(1, Math.min(totalPages, catalogFilter.page || 1));
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const countLabel =
    filtered.length === 1
      ? t('X4_TR_50_HOME_CLOUD_COUNT_ONE_FMT', 1)
      : t('X4_TR_50_CATALOG_FILTER_COUNT_FMT', filtered.length);

  const collections = [
    { id: 'all', label: w('allGamesChip') },
    { id: 'popular', label: t('X4_TR_U49_POPULAR_CLOUD') },
    { id: 'free', label: t('X4_TR_CATALOG_FREE') },
    { id: 'new', label: t('X4_TR_U49_SORT_NEW') },
    { id: 'leaving', label: 'Leaving Soon' },
  ];

  return `
    <div class="x4-page">
      <div class="x4-page-header">
        <div>
          <h1 class="x4-page-title">${t('X4_TR_CATALOG_TITLE')}</h1>
          <p class="x4-muted">${t('X4_TR_U49_CATALOG_SUBTITLE')}</p>
        </div>
        <div class="x4-pill-row">
          ${isLiveCatalog ? `<span class="x4-pill is-ok">${escapeHtml(w('liveCatalogBadge'))}</span>` : ''}
          <span class="x4-pill is-accent">${escapeHtml(countLabel)}</span>
        </div>
      </div>

      <div class="x4-quick-chips">
        ${collections
          .map(
            (c) => `
              <button class="x4-chip ${activeCol === c.id ? 'is-accent' : ''} x4-focusable"
                data-cat-collection="${c.id}" type="button">${escapeHtml(c.label)}</button>`
          )
          .join('')}
      </div>

      <div class="x4-filter-bar">
        <label class="x4-select-wrap">
          <span>${t('X4_TR_U49_GENRE')}</span>
          <select id="x4CatGenre" class="x4-select x4-focusable">
            ${genres
              .map(
                (g) =>
                  `<option value="${escapeHtml(g)}" ${catalogFilter.genre === g ? 'selected' : ''}>${
                    g === 'ALL' ? t('X4_TR_AUTO') : escapeHtml(trCategory(g))
                  }</option>`
              )
              .join('')}
          </select>
        </label>

        <label class="x4-select-wrap">
          <span>${t('X4_TR_U49_ACCESS')}</span>
          <select id="x4CatAccess" class="x4-select x4-focusable">
            <option value="all" ${catalogFilter.access === 'all' ? 'selected' : ''}>${t('X4_TR_AUTO')}</option>
            <option value="free" ${catalogFilter.access === 'free' ? 'selected' : ''}>${t('X4_TR_CATALOG_FREE')}</option>
            <option value="favorites" ${catalogFilter.access === 'favorites' ? 'selected' : ''}>${t('X4_TR_U49_FAVORITES')}</option>
          </select>
        </label>

        <label class="x4-select-wrap">
          <span>${t('X4_TR_U49_SORT_BY')}</span>
          <select id="x4CatSort" class="x4-select x4-focusable">
            <option value="featured" ${catalogFilter.sort === 'featured' ? 'selected' : ''}>${t('X4_TR_U49_SORT_FEATURED')}</option>
            <option value="az" ${catalogFilter.sort === 'az' ? 'selected' : ''}>A – Z</option>
            <option value="new" ${catalogFilter.sort === 'new' ? 'selected' : ''}>${t('X4_TR_U49_SORT_NEW')}</option>
          </select>
        </label>
      </div>

      ${
        slice.length === 0
          ? `<div class="x4-empty-box"><p>${t('X4_TR_U49_NO_GAMES_IN_VIEW')}</p></div>`
          : `<div class="x4-game-grid">
               ${slice.map((item) => renderGameCard(item, { isFav: favSet.has(item.productId), recentInfo: localRecents[item.productId] })).join('')}
             </div>`
      }

      ${
        totalPages > 1
          ? `
        <div class="x4-pagination">
          <button class="x4-btn is-secondary x4-focusable" data-cat-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} type="button">‹</button>
          <span class="x4-muted">${t('X4_TR_U49_PAGE')} ${page} / ${totalPages}</span>
          <button class="x4-btn is-secondary x4-focusable" data-cat-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} type="button">›</button>
        </div>`
          : ''
      }
    </div>
  `;
}
