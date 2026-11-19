/* SPDX-License-Identifier: GPL-3.0-only */
/* Shared UI cards, horizontal shelves, and accessible modal helper. */

import { t, trCategory } from '../i18n.js';
import { icon } from '../icons.js';
import { artworkUrl } from '../paths.js';

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatPlayTime(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 60) return `${s}s`;
  const mins = Math.floor(s / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

export function formatRelativeTime(ts) {
  if (!ts) return '';
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (diffMin < 2) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  const hrs = Math.floor(diffMin / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function renderGameCard(item, { isFav = false, recentInfo = null, variant = 'wide' } = {}) {
  const pid = escapeHtml(item.productId);
  const title = escapeHtml(item.title || item.titleId || pid);
  const imgUrl = escapeHtml(
    (variant === 'poster' ? item.posterUrl : item.coverUrl) ||
    item.coverUrl ||
    artworkUrl(pid, 'cover.svg')
  );
  const fallbackImg = escapeHtml(artworkUrl(pid, 'cover.svg'));
  const cat = trCategory(item.category || '');
  const metaParts = [];
  if (cat) metaParts.push(cat);
  if (recentInfo?.playTimeSec) metaParts.push(formatPlayTime(recentInfo.playTimeSec));
  else if (item.year) metaParts.push(item.year);

  return `
    <button class="x4-game-card ${variant === 'poster' ? 'is-poster' : ''} x4-focusable" data-action="open-game" data-product-id="${pid}" type="button">
      <div class="x4-game-thumb">
        <img src="${imgUrl}" alt="${title}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImg}';" />
        ${item.freeToPlay ? `<span class="x4-badge-f2p">${t('X4_TR_CATALOG_FREE')}</span>` : ''}
        ${isFav ? `<span class="x4-badge-fav" title="${t('X4_TR_U49_FAVORITES')}">${icon('heart-filled')}</span>` : ''}
        <div class="x4-game-thumb-scrim"></div>
      </div>
      <div class="x4-game-meta">
        <div class="x4-game-title">${title}</div>
        <div class="x4-game-sub">${escapeHtml(metaParts.join(' · ') || 'Xbox Cloud Gaming')}</div>
      </div>
    </button>
  `;
}

export function renderShelfSection({ id, title, items, favorites = [], localRecents = {}, seeAllRoute = null }) {
  if (!items || items.length === 0) return '';
  const favSet = new Set(favorites);
  return `
    <section class="x4-shelf" data-shelf="${escapeHtml(id)}">
      <div class="x4-shelf-head">
        <h2 class="x4-shelf-title">${escapeHtml(title)} <span class="x4-count-pill">${items.length}</span></h2>
        ${
          seeAllRoute
            ? `<button class="x4-link-btn x4-focusable" data-action="navigate" data-route="${escapeHtml(seeAllRoute)}" type="button">
                 <span>${t('X4_TR_U49_SEE_ALL')}</span> ${icon('chevron-right')}
               </button>`
            : ''
        }
      </div>
      <div class="x4-shelf-track">
        ${items.map((item) => renderGameCard(item, { isFav: favSet.has(item.productId), recentInfo: localRecents[item.productId] })).join('')}
      </div>
    </section>
  `;
}

export function showModal({ title, bodyHtml, buttons = [] }) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.id = 'x4ModalOverlay';
  overlay.className = 'x4-modal-overlay';
  overlay.innerHTML = `
    <div class="x4-modal" role="dialog" aria-modal="true">
      <div class="x4-modal-head">
        <h3>${escapeHtml(title)}</h3>
        <button class="x4-icon-btn x4-focusable" data-modal-close type="button" aria-label="Close">${icon('x')}</button>
      </div>
      <div class="x4-modal-body">${bodyHtml}</div>
      ${
        buttons.length
          ? `<div class="x4-modal-actions">
               ${buttons
                 .map(
                   (b, idx) =>
                     `<button class="x4-btn ${b.primary ? 'is-primary' : b.danger ? 'is-danger' : 'is-secondary'} x4-focusable" data-modal-btn="${idx}" type="button">${escapeHtml(b.label)}</button>`
                 )
                 .join('')}
             </div>`
          : ''
      }
    </div>
  `;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-modal-close]')) {
      closeModal();
      return;
    }
    const btn = e.target.closest('[data-modal-btn]');
    if (btn) {
      const idx = Number(btn.getAttribute('data-modal-btn'));
      const cfg = buttons[idx];
      if (cfg?.onClick) cfg.onClick();
      if (cfg?.closeOnClick !== false) closeModal();
    }
  });

  document.body.appendChild(overlay);
  const firstBtn = overlay.querySelector('.x4-focusable');
  if (firstBtn) firstBtn.focus();
  return overlay;
}

export function closeModal() {
  const existing = document.getElementById('x4ModalOverlay');
  if (existing) existing.remove();
}
