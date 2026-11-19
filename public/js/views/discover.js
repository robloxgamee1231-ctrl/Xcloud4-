/* SPDX-License-Identifier: GPL-3.0-only */
/* Discover view backed by Xbox Game Pass SIGLs (Free, New, Popular, Leaving). */

import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { artworkUrl } from '../paths.js';
import { escapeHtml, renderShelfSection } from './cards.js';

export function renderDiscoverView(state) {
  const { catalogItems, publicLists, favorites, localRecents } = state;
  const byId = new Map(catalogItems.map((i) => [i.productId, i]));
  const mapIds = (ids) => (ids || []).map((id) => byId.get(id)).filter(Boolean);

  const featuredList = mapIds(publicLists?.popular);
  const featured = featuredList[0] || catalogItems[0];

  const shelves = [
    { id: 'free', title: t('X4_TR_CATALOG_FREE'), items: mapIds(publicLists?.free) },
    { id: 'new', title: t('X4_TR_U49_SORT_NEW'), items: mapIds(publicLists?.new) },
    { id: 'popular', title: t('X4_TR_U49_POPULAR_CLOUD'), items: mapIds(publicLists?.popular) },
    { id: 'leaving', title: t('X4_TR_U49_COLLECTIONS') + ' · Leaving Soon', items: mapIds(publicLists?.leaving) },
  ];

  return `
    <div class="x4-page">
      <div class="x4-page-header">
        <div>
          <h1 class="x4-page-title">${t('X4_TR_DISCOVER')}</h1>
          <p class="x4-muted">${t('X4_TR_U49_CATALOG_SUBTITLE')}</p>
        </div>
      </div>

      ${
        featured
          ? `
        <div class="x4-discover-banner">
          <div class="x4-hero-bg" style="background-image:url('${escapeHtml(featured.heroUrl || featured.coverUrl || artworkUrl(featured.productId, 'hero.svg'))}')"></div>
          <div class="x4-hero-scrim"></div>
          <div class="x4-hero-content">
            <span class="x4-pill is-accent">${t('X4_TR_APPLE_FEATURED_BADGE')}</span>
            <h2>${escapeHtml(featured.title)}</h2>
            <p>${escapeHtml(featured.shortDescription || '')}</p>
            <div class="x4-hero-actions">
              <button class="x4-btn is-primary x4-focusable" data-action="play-game" data-product-id="${escapeHtml(featured.productId)}" type="button">
                ${icon('play')} <span>${t('X4_TR_APPLE_PLAY_NOW_BTN')}</span>
              </button>
              <button class="x4-btn is-secondary x4-focusable" data-action="open-game" data-product-id="${escapeHtml(featured.productId)}" type="button">
                <span>${t('X4_TR_U49_VIEW_GAME_SHORT')}</span>
              </button>
            </div>
          </div>
        </div>`
          : ''
      }

      ${shelves
        .map((s) =>
          renderShelfSection({
            id: s.id,
            title: s.title,
            items: s.items,
            favorites,
            localRecents,
            seeAllRoute: 'catalog',
          })
        )
        .join('')}
    </div>
  `;
}
