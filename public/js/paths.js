/* SPDX-License-Identifier: GPL-3.0-only */
/* Base URL resolution supporting Node relay (/ or custom Node URL), Cloudflare CORS Relay, and GitHub Pages static hosting. */

import { renderFallbackArtworkDataUrl } from './fallback-catalog.js';

export const APP_BASE_URL = new URL('../', import.meta.url).href;
const RELAY_STORAGE_KEY = 'xcloud4_relay_url';
const RELAY_TYPE_KEY = 'xcloud4_relay_type';

let _staticMode = false;

export function setStaticMode(enabled) {
  _staticMode = Boolean(enabled);
}

export function isStaticMode() {
  if (getRelayUrl()) {
    return getRelayType() === 'cors-proxy';
  }
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

export function getRelayType() {
  try {
    if (typeof localStorage === 'undefined') return 'node';
    return localStorage.getItem(RELAY_TYPE_KEY) === 'cors-proxy' ? 'cors-proxy' : 'node';
  } catch {
    return 'node';
  }
}

export function getCorsProxyUrl() {
  const url = getRelayUrl();
  if (!url || getRelayType() !== 'cors-proxy') return '';
  return `${url}/proxy`;
}

function normalizeRelayInput(raw) {
  const clean = String(raw || '').trim();
  if (!clean) return '';
  const normalized = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
  const parsed = new URL(normalized);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Relay URL must start with http:// or https://');
  }
  return parsed.href.replace(/\/+$/, '');
}

export function setRelayUrl(url, type = 'node') {
  try {
    if (typeof localStorage === 'undefined') return '';
    const clean = String(url || '').trim();
    if (!clean) {
      localStorage.removeItem(RELAY_STORAGE_KEY);
      localStorage.removeItem(RELAY_TYPE_KEY);
      return '';
    }
    const finalUrl = normalizeRelayInput(clean);
    const finalType = type === 'cors-proxy' ? 'cors-proxy' : 'node';
    localStorage.setItem(RELAY_STORAGE_KEY, finalUrl);
    localStorage.setItem(RELAY_TYPE_KEY, finalType);
    _staticMode = finalType === 'cors-proxy';
    return finalUrl;
  } catch (err) {
    throw new Error(err?.message || 'Invalid relay URL');
  }
}

export async function probeAndSetRelayUrl(rawUrl) {
  const clean = String(rawUrl || '').trim();
  if (!clean) {
    setRelayUrl('');
    return { url: '', type: 'none' };
  }
  const finalUrl = normalizeRelayInput(clean);

  // 1) Check full XCloud4 Node Relay (/api/health)
  try {
    const res = await fetch(`${finalUrl}/api/health`, { method: 'GET', cache: 'no-store' });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        setRelayUrl(finalUrl, 'node');
        return { url: finalUrl, type: 'node' };
      }
    }
  } catch {
    // Try Cloudflare CORS Worker health below
  }

  // 2) Check Cloudflare Worker Xbox CORS Relay (/health)
  try {
    const res = await fetch(`${finalUrl}/health`, { method: 'GET', cache: 'no-store' });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.ok && data?.mode === 'xbox-cors-relay') {
        setRelayUrl(finalUrl, 'cors-proxy');
        return { url: finalUrl, type: 'cors-proxy' };
      }
    }
  } catch {
    // Unreachable
  }

  throw new Error(`Could not connect to an XCloud4 Relay at ${finalUrl}. Make sure the server or Cloudflare Worker is running.`);
}

export function appUrl(relativePath) {
  const clean = String(relativePath || '').replace(/^\/+/, '');
  return new URL(clean, APP_BASE_URL).href;
}

export function apiUrl(relativePath) {
  const clean = String(relativePath || '').replace(/^\/+/, '');
  const relay = getRelayUrl();
  if (relay && getRelayType() === 'node') {
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
