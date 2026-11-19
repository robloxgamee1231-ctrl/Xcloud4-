/* SPDX-License-Identifier: GPL-3.0-only */
/* Xbox Cloud Gaming Home Spotlight Carousel, quick genre bar, and in-site cloud shelves. */

import { t, w, trCategory } from '../i18n.js';
import { icon } from '../icons.js';
import { appUrl } from '../paths.js';
import { escapeHtml, formatPlayTime, formatRelativeTime, renderShelfSection } from './cards.js';

export function renderHomeView(state) {
  const { auth, catalogItems, publicLists, favorites, myGames, localRecents, catalogSource, heroIndex = 0 } = state;
  const byId = new Map(catalogItems.map((i) => [i.productId, i]));

  const recentIds = Object.values(localRecents || {})
    .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
    .map((r) => r.productId)
    .filter((id) => byId.has(id));

  const recentItems = recentIds.map((id) => byId.get(id)).filter(Boolean);
  const continueItem = recentItems[0] || null;
  const fortniteItem = byId.get('BT5P2X999VH2') || catalogItems.find((i) => i.freeToPlay);

  const mapIds = (ids, limit = 16) => (ids || []).map((id) => byId.get(id)).filter(Boolean).slice(0, limit);
  const popularItems = mapIds(publicLists?.popular, 16);
  const myGameItems = [...new Set([...favorites, ...myGames, ...recentIds])].map((id) => byId.get(id)).filter(Boolean);
  const isLiveCatalog = catalogSource === 'live' || catalogSource === 'live-snapshot';
  const liveStreamReady = Boolean(auth?.signedIn && auth?.liveStream);

  // Build spotlight slides (Continue + top popular + Fortnite)
  const slideSeen = new Set();
  const slides = [];
  const pushSlide = (item, badge) => {
    if (!item || slideSeen.has(item.productId) || slides.length >= 5) return;
    slideSeen.add(item.productId);
    slides.push({ item, badge });
  };

  if (continueItem) {
    const rec = localRecents[continueItem.productId];
    const extra = rec?.playTimeSec ? ` · ${formatPlayTime(rec.playTimeSec)}` : '';
    pushSlide(continueItem, `${w('jumpBackIn')} · ${formatRelativeTime(rec?.lastPlayedAt)}${extra}`);
  }
  for (const p of popularItems.slice(0, 4)) {
    pushSlide(p, p.freeToPlay ? t('X4_TR_CATALOG_FREE') : t('X4_TR_APPLE_FEATURED_BADGE'));
  }
  if (fortniteItem) pushSlide(fortniteItem, t('X4_TR_U49_FORTNITE_NO_PASS'));
  if (slides.length === 0 && catalogItems[0]) pushSlide(catalogItems[0], t('X4_TR_APPLE_FEATURED_BADGE'));

  const safeIdx = slides.length ? ((heroIndex % slides.length) + slides.length) % slides.length : 0;
  const activeSlide = slides[safeIdx];
  const heroItem = activeSlide?.item || null;
  const heroBgUrl = heroItem?.heroUrl || heroItem?.coverUrl || appUrl('assets/branding/pic1.png');

  const countLabel =
    catalogItems.length === 1
      ? t('X4_TR_50_HOME_CLOUD_COUNT_ONE_FMT', catalogItems.length)
      : t('X4_TR_U49_HOME_CLOUD_COUNT_FMT', catalogItems.length);

  // Quick-jump genres discovered from catalog
  const genreCounts = new Map();
  for (const item of catalogItems) {
    if (item.category) genreCounts.set(item.category, (genreCounts.get(item.category) || 0) + 1);
  }
  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([g]) => g);

  const isFavHero = heroItem ? favorites.includes(heroItem.productId) : false;

  return `
    <div class="x4-page x4-home-page">
      <section class="x4-xbox-hero" aria-label="Featured Cloud Spotlight">
        <div class="x4-hero-bg" style="background-image:url('${escapeHtml(heroBgUrl)}')"></div>
        <div class="x4-hero-scrim"></div>
        <div class="x4-hero-top-meta">
          <div class="x4-pill-row">
            <span class="x4-pill is-accent">${escapeHtml(activeSlide?.badge || t('X4_TR_APPLE_FEATURED_BADGE'))}</span>
            ${isLiveCatalog ? `<span class="x4-pill is-ok">${escapeHtml(w('liveCatalogBadge'))} · ${escapeHtml(countLabel)}</span>` : `<span class="x4-pill">${escapeHtml(countLabel)}</span>`}
          </div>
          ${
            slides.length > 1
              ? `<div class="x4-hero-nav">
                   <button class="x4-hero-arrow x4-focusable" data-hero-step="-1" type="button" aria-label="Previous featured game">${icon('chevron-left')}</button>
                   <button class="x4-hero-arrow x4-focusable" data-hero-step="1" type="button" aria-label="Next featured game">${icon('chevron-right')}</button>
                 </div>`
              : ''
          }
        </div>

        <div class="x4-xbox-hero-body">
          <div class="x4-hero-content">
            ${
              heroItem?.category || heroItem?.publisher
                ? `<div class="x4-hero-kicker">${escapeHtml([trCategory(heroItem.category), heroItem.publisher, heroItem.year].filter(Boolean).join(' · '))}</div>`
                : ''
            }
            <h1 class="x4-hero-title">${heroItem ? escapeHtml(heroItem.title) : escapeHtml(t('X4_TR_U49_HOME_WELCOME'))}</h1>
            <p class="x4-hero-desc">${escapeHtml(heroItem?.shortDescription || t('X4_TR_U49_HOME_SUBTITLE'))}</p>

            <div class="x4-hero-actions">
              ${
                heroItem
                  ? `<button class="x4-btn is-primary is-lg x4-focusable" data-action="play-game" data-product-id="${escapeHtml(heroItem.productId)}" type="button">
                       ${icon('play')} <span>${liveStreamReady ? t('X4_TR_APPLE_PLAY_NOW_BTN') : w('playNowBtn')}</span>
                     </button>
                     <button class="x4-btn is-secondary x4-focusable" data-action="open-game" data-product-id="${escapeHtml(heroItem.productId)}" type="button">
                       ${icon('info-circle')} <span>${t('X4_TR_U49_VIEW_GAME_SHORT')}</span>
                     </button>`
                  : `<button class="x4-btn is-primary is-lg x4-focusable" data-action="navigate" data-route="catalog" type="button">
                       ${icon('device-desktop')} <span>${t('X4_TR_U49_HOME_EXPLORE_CATALOG')}</span>
                     </button>`
              }
              ${
                heroItem
                  ? `<button class="x4-btn is-ghost x4-focusable" data-action="toggle-favorite" data-product-id="${escapeHtml(heroItem.productId)}" type="button" title="${t('X4_TR_U49_FAVORITES')}">
                       ${icon(isFavHero ? 'heart-filled' : 'heart')}
                       <span>${isFavHero ? t('X4_TR_U49_FAVORITES') : t('X4_TR_U49_ADD_TO_FAVORITES')}</span>
                     </button>`
                  : ''
              }
              ${
                !auth.signedIn
                  ? `<button class="x4-btn is-ghost x4-focusable" data-action="open-signin-modal" type="button">
                       ${icon('user')} <span>${w('msSignInBtn')}</span>
                     </button>`
                  : ''
              }
            </div>
          </div>

          ${
            slides.length > 1
              ? `<div class="x4-hero-dots" role="tablist" aria-label="Featured titles">
                   ${slides
                     .map(
                       (s, idx) => `
                         <button class="x4-hero-dot ${idx === safeIdx ? 'is-active' : ''} x4-focusable"
                           data-hero-idx="${idx}" type="button" aria-label="${escapeHtml(s.item.title)}"></button>`
                     )
                     .join('')}
                 </div>`
              : ''
          }
        </div>
      </section>

      <!-- Quick Xbox Cloud Gaming Category & Collection Strip -->
      <div class="x4-quick-chips" aria-label="Quick collections and genres">
        <button class="x4-chip is-accent x4-focusable" data-action="browse-collection" data-collection="all" type="button">${w('allGamesChip')}</button>
        <button class="x4-chip x4-focusable" data-action="browse-collection" data-collection="popular" type="button">${t('X4_TR_U49_POPULAR_CLOUD')}</button>
        <button class="x4-chip x4-focusable" data-action="browse-collection" data-collection="free" type="button">${t('X4_TR_CATALOG_FREE')}</button>
        <button class="x4-chip x4-focusable" data-action="browse-collection" data-collection="new" type="button">${t('X4_TR_U49_SORT_NEW')}</button>
        <button class="x4-chip x4-focusable" data-action="browse-collection" data-collection="leaving" type="button">Leaving Soon</button>
        ${topGenres
          .map(
            (g) => `
              <button class="x4-chip x4-focusable" data-action="browse-genre" data-genre="${escapeHtml(g)}" type="button">
                ${escapeHtml(trCategory(g))}
              </button>`
          )
          .join('')}
      </div>

      ${
        recentItems.length > 0
          ? renderShelfSection({
              id: 'jump-back-in',
              title: w('jumpBackIn'),
              items: recentItems.slice(0, 12),
              favorites,
              localRecents,
              seeAllRoute: 'my-games',
            })
          : ''
      }

      ${renderShelfSection({
        id: 'my-games',
        title: w('myLibrary'),
        items: myGameItems,
        favorites,
        localRecents,
        seeAllRoute: 'my-games',
      })}

      ${renderShelfSection({
        id: 'popular',
        title: t('X4_TR_U49_POPULAR_CLOUD'),
        items: popularItems,
        favorites,
        localRecents,
        seeAllCollection: 'popular',
      })}

      ${renderShelfSection({
        id: 'free',
        title: t('X4_TR_CATALOG_FREE'),
        items: mapIds(publicLists?.free),
        favorites,
        localRecents,
        seeAllCollection: 'free',
      })}

      ${renderShelfSection({
        id: 'new',
        title: t('X4_TR_U49_SORT_NEW'),
        items: mapIds(publicLists?.new),
        favorites,
        localRecents,
        seeAllCollection: 'new',
      })}

      ${renderShelfSection({
        id: 'leaving',
        title: 'Leaving Soon',
        items: mapIds(publicLists?.leaving),
        favorites,
        localRecents,
        seeAllCollection: 'leaving',
      })}
    </div>
  `;
}
