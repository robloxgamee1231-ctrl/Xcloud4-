/* SPDX-License-Identifier: GPL-3.0-only */
/* Base URL resolution supporting both Node relay (/) and subpath static hosting (e.g. GitHub Pages /Xcloud4-/). */

import { renderFallbackArtworkDataUrl } from './fallback-catalog.js';

export const APP_BASE_URL = new URL('../', import.meta.url).href;

let _staticMode = false;

export function setStaticMode(enabled) {
  _staticMode = Boolean(enabled);
}

export function isStaticMode() {
  return _staticMode;
}

export function appUrl(relativePath) {
  const clean = String(relativePath || '').replace(/^\/+/, '');
  return new URL(clean, APP_BASE_URL).href;
}

export function artworkUrl(productId, kind = 'cover.svg') {
  const safeId = encodeURIComponent(String(productId || 'BT5P2X999VH2'));
  const safeKind = String(kind || 'cover.svg');
  if (_staticMode) {
    return renderFallbackArtworkDataUrl(safeId, safeKind);
  }
  return appUrl(`api/artwork/${safeId}/${safeKind}`);
}
