/* SPDX-License-Identifier: GPL-3.0-only */
/* Base URL resolution supporting Node relay (/), custom Relay URL, and subpath static hosting (e.g. GitHub Pages /Xcloud4-/). */

import { renderFallbackArtworkDataUrl } from './fallback-catalog.js';

export const APP_BASE_URL = new URL('../', import.meta.url).href;
const RELAY_STORAGE_KEY = 'xcloud4_relay_url';

let _staticMode = false;

export function setStaticMode(enabled) {
  _staticMode = Boolean(enabled);
}

export function isStaticMode() {
  if (getRelayUrl()) return false;
  return _staticMode;
}

export function getRelayUrl() {
  try {
    if (typeof localStorage === 'undefined') return '';
    const raw = (localStorage.getItem(RELAY_STORAGE_KEY) || '').trim();
    if (!raw) return '';
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.href.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function setRelayUrl(url) {
  try {
    if (typeof localStorage === 'undefined') return '';
    const clean = String(url || '').trim();
    if (!clean) {
      localStorage.removeItem(RELAY_STORAGE_KEY);
      return '';
    }
    const normalized = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Relay URL must start with http:// or https://');
    }
    const finalUrl = parsed.href.replace(/\/+$/, '');
    localStorage.setItem(RELAY_STORAGE_KEY, finalUrl);
    _staticMode = false;
    return finalUrl;
  } catch (err) {
    throw new Error(err?.message || 'Invalid relay URL');
  }
}

export function appUrl(relativePath) {
  const clean = String(relativePath || '').replace(/^\/+/, '');
  return new URL(clean, APP_BASE_URL).href;
}

export function apiUrl(relativePath) {
  const clean = String(relativePath || '').replace(/^\/+/, '');
  const relay = getRelayUrl();
  if (relay) {
    return `${relay}/${clean}`;
  }
  return appUrl(clean);
}

export function artworkUrl(productId, kind = 'cover.svg') {
  const safeId = encodeURIComponent(String(productId || 'BT5P2X999VH2'));
  const safeKind = String(kind || 'cover.svg');
  if (isStaticMode()) {
    return renderFallbackArtworkDataUrl(safeId, safeKind);
  }
  return apiUrl(`api/artwork/${safeId}/${safeKind}`);
}
