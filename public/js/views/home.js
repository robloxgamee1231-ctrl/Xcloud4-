/* SPDX-License-Identifier: GPL-3.0-only */
/* UI 2.0 Home screen matching src/ui/ui2_home.c + home_rows.c. */

import { t, w } from '../i18n.js';
import { icon } from '../icons.js';
import { appUrl, artworkUrl } from '../paths.js';
import { buildPlayXboxUrl } from '../xbox-catalog.js';
import { escapeHtml, formatPlayTime, formatRelativeTime, renderShelfSection } from './cards.js';

export function renderHomeView(state) {
  const { auth, catalogItems, publicLists, favorites, myGames, localRecents, catalogSource } = state;
  const byId = new Map(catalogItems.map((i) => [i.productId, i]));

  const recentIds = Object.values(localRecents || {})
    .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
    .map((r) => r.productId)
    .filter((id) => byId.has(id));

  const continueId = recentIds[0] || null;
  const continueItem = continueId ? byId.get(continueId) : null;
  const fortniteItem = byId.get('BT5P2X999VH2') || catalogItems.find((i) => i.freeToPlay);
  const featuredItem =
    (publicLists?.popular || []).map((id) => byId.get(id)).find(Boolean) ||
    catalogItems.find((i) => i.productId !== 'BT5P2X999VH2') ||
    fortniteItem;

  const mapIds = (ids) => (ids || []).map((id) => byId.get(id)).filter(Boolean).slice(0, 14);
  const myGameItems = [...new Set([...favorites, ...myGames, ...recentIds])].map((id) => byId.get(id)).filter(Boolean);
  const isLiveCatalog = catalogSource === 'live' || catalogSource === 'live-snapshot';

  const countLabel =
    catalogItems.length === 1
      ? t('X4_TR_50_HOME_CLOUD_COUNT_ONE_FMT', catalogItems.length)
      : t('X4_TR_U49_HOME_CLOUD_COUNT_FMT', catalogItems.length);

  let heroHtml = '';
  if (!auth.signedIn) {
    const heroBgUrl = featuredItem?.heroUrl || featuredItem?.coverUrl || appUrl('assets/branding/pic1.png');
    const featuredPlayUrl = featuredItem ? (featuredItem.playUrl || buildPlayXboxUrl(featuredItem.productId, featuredItem.title)) : 'https://www.xbox.com/play';
    heroHtml = `
      <div class="x4-hero-card x4-hero-signin">
        <div class="x4-hero-bg" style="background-image:url('${escapeHtml(heroBgUrl)}')"></div>
        <div class="x4-hero-scrim"></div>
        <div class="x4-hero-content">
          <span class="x4-pill is-accent">${escapeHtml(countLabel)}${isLiveCatalog ? ` · ${escapeHtml(w('liveCatalogBadge'))}` : ''}</span>
          <h1>${featuredItem ? escapeHtml(featuredItem.title) : t('X4_TR_U49_HOME_SIGN_IN_TITLE')}</h1>
          <p>${featuredItem?.shortDescription ? escapeHtml(featuredItem.shortDescription) : t('X4_TR_U49_HOME_SIGN_IN_SUBTITLE')}</p>
          <div class="x4-hero-actions">
            <a class="x4-btn is-primary x4-focusable" href="${escapeHtml(featuredPlayUrl)}" target="_blank" rel="noopener noreferrer">
              ${icon('play')} <span>${w('playOnXbox')}</span>
            </a>
            <button class="x4-btn is-secondary x4-focusable" data-action="navigate" data-route="catalog" type="button">
              ${icon('device-desktop')} <span>${t('X4_TR_U49_HOME_EXPLORE_CATALOG')}</span>
            </button>
            <button class="x4-btn is-ghost x4-focusable" data-action="navigate" data-route="account" type="button">
              ${icon('user')} <span>${t('X4_TR_U49_ACCOUNT_SIGN_IN')}</span>
            </button>
          </div>
        </div>
      </div>`;
  } else if (continueItem) {
    const rec = localRecents[continueItem.productId];
    const contPlayUrl = continueItem.playUrl || buildPlayXboxUrl(continueItem.productId, continueItem.title);
    const liveStreamReady = !auth.demoMode;
    heroHtml = `
      <div class="x4-hero-card">
        <div class="x4-hero-bg" style="background-image:url('${escapeHtml(continueItem.heroUrl || continueItem.coverUrl || artworkUrl(continueItem.productId, 'hero.svg'))}')"></div>
        <div class="x4-hero-scrim"></div>
        <div class="x4-hero-content">
          <span class="x4-pill is-accent">${t('X4_TR_U49_HOME_LAST_PLAYED')} · ${formatRelativeTime(rec?.lastPlayedAt)} · ${formatPlayTime(rec?.playTimeSec)}</span>
          <h1>${escapeHtml(continueItem.title)}</h1>
          <p>${escapeHtml(continueItem.shortDescription || '')}</p>
          <div class="x4-hero-actions">
            ${
              liveStreamReady
                ? `<button class="x4-btn is-primary x4-focusable" data-action="play-game" data-product-id="${escapeHtml(continueItem.productId)}" type="button">
                     ${icon('play')} <span>${t('X4_TR_U49_HOME_CONTINUE')}</span>
                   </button>`
                : `<a class="x4-btn is-primary x4-focusable" href="${escapeHtml(contPlayUrl)}" target="_blank" rel="noopener noreferrer">
                     ${icon('play')} <span>${w('playOnXbox')}</span>
                   </a>
                   <button class="x4-btn is-secondary x4-focusable" data-action="play-game" data-product-id="${escapeHtml(continueItem.productId)}" type="button">
                     ${icon('device-gamepad')} <span>${w('streamPreviewBtn')}</span>
                   </button>`
            }
            <button class="x4-btn is-ghost x4-focusable" data-action="open-game" data-product-id="${escapeHtml(continueItem.productId)}" type="button">
              <span>${t('X4_TR_U49_VIEW_GAME_SHORT')}</span>
            </button>
          </div>
        </div>
      </div>`;
  } else {
    heroHtml = `
      <div class="x4-hero-card">
        <div class="x4-hero-bg" style="background-image:url('${appUrl('assets/branding/pic1.png')}')"></div>
        <div class="x4-hero-scrim"></div>
        <div class="x4-hero-content">
          <span class="x4-pill is-accent">${countLabel}</span>
          <h1>${t('X4_TR_U49_HOME_WELCOME_FMT', auth.gamertag)}</h1>
          <p>${t('X4_TR_U49_HOME_SUBTITLE')}</p>
          <div class="x4-hero-actions">
            <button class="x4-btn is-primary x4-focusable" data-action="navigate" data-route="catalog" type="button">
              ${icon('device-desktop')} <span>${t('X4_TR_U49_HOME_EXPLORE_CATALOG')}</span>
            </button>
            <button class="x4-btn is-secondary x4-focusable" data-action="navigate" data-route="search" type="button">
              ${icon('search')} <span>${t('X4_TR_U49_HOME_FIND_GAME')}</span>
            </button>
          </div>
        </div>
      </div>`;
  }

  const fortniteCard = fortniteItem
    ? `
      <button class="x4-fortnite-banner x4-focusable" data-action="navigate" data-route="fortnite" type="button">
        <div class="x4-fortnite-banner-art" style="background-image:url('${escapeHtml(fortniteItem.heroUrl || artworkUrl('BT5P2X999VH2', 'hero.svg'))}')"></div>
        <div class="x4-fortnite-banner-scrim"></div>
        <div class="x4-fortnite-banner-body">
          <span class="x4-badge-f2p">${t('X4_TR_U49_FORTNITE_NO_PASS')}</span>
          <div>
            <h3>${t('X4_TR_U49_FORTNITE_TITLE')}</h3>
            <p>${t('X4_TR_U49_FORTNITE_SUBTITLE')}</p>
          </div>
          <span class="x4-btn is-primary">${icon('play')} <span>${t('X4_TR_U49_FORTNITE_OPEN')}</span></span>
        </div>
      </button>`
    : '';

  return `
    <div class="x4-page x4-home-page">
      <div class="x4-page-header">
        <div>
          <h2 class="x4-greeting">${auth.signedIn ? t('X4_TR_U49_HOME_WELCOME_FMT', auth.gamertag) : t('X4_TR_U49_HOME_WELCOME')}</h2>
          <p class="x4-muted">${t('X4_TR_U49_HOME_SUBTITLE')}</p>
        </div>
        ${
          isLiveCatalog
            ? `<span class="x4-pill is-accent">${escapeHtml(w('liveCatalogBadge'))} · ${catalogItems.length}</span>`
            : auth.demoMode
              ? `<span class="x4-sandbox-chip">${w('demoBadge')}</span>`
              : ''
        }
      </div>

      <div class="x4-home-top-grid">
        ${heroHtml}
        ${fortniteCard}
      </div>

      ${renderShelfSection({
        id: 'my-games',
        title: t('X4_TR_U49_MY_GAMES'),
        items: myGameItems,
        favorites,
        localRecents,
        seeAllRoute: 'my-games',
      })}

      ${renderShelfSection({
        id: 'popular',
        title: t('X4_TR_U49_POPULAR_CLOUD'),
        items: mapIds(publicLists?.popular),
        favorites,
        localRecents,
        seeAllRoute: 'discover',
      })}

      ${renderShelfSection({
        id: 'free',
        title: t('X4_TR_CATALOG_FREE'),
        items: mapIds(publicLists?.free),
        favorites,
        localRecents,
        seeAllRoute: 'discover',
      })}

      ${renderShelfSection({
        id: 'new',
        title: t('X4_TR_U49_SORT_NEW'),
        items: mapIds(publicLists?.new),
        favorites,
        localRecents,
        seeAllRoute: 'discover',
      })}

      ${renderShelfSection({
        id: 'leaving',
        title: t('X4_TR_U49_COLLECTIONS') + ' · Leaving Soon',
        items: mapIds(publicLists?.leaving),
        favorites,
        localRecents,
        seeAllRoute: 'discover',
      })}
    </div>
  `;
}
