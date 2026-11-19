/* SPDX-License-Identifier: GPL-3.0-only */
/* Frontend REST client for XCloud4 backend relay (same-origin or custom Relay URL) with automatic static-site browser fallback. */

import { apiUrl, getRelayUrl, isStaticMode, setStaticMode } from './paths.js';
import { staticBackend } from './static-backend.js';

async function request(method, relativePath, body = undefined) {
  if (isStaticMode()) {
    throw new Error('Static mode active');
  }
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(apiUrl(relativePath), opts);
  const ctype = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!ctype.includes('application/json')) {
    throw Object.assign(new Error(`Non-JSON response (${res.status})`), {
      status: res.status,
      isStaticFallbackSignal: true,
    });
  }
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw Object.assign(new Error(json.error || `HTTP ${res.status}`), {
      status: res.status,
      payload: json,
    });
  }
  return json;
}

function withStaticFallback(methodName, serverFn) {
  return async (...args) => {
    if (isStaticMode()) {
      return staticBackend[methodName](...args);
    }
    try {
      return await serverFn(...args);
    } catch (err) {
      // Only switch to static mode when no custom external Relay URL is explicitly configured
      if (!getRelayUrl() && (err.isStaticFallbackSignal || err.name === 'TypeError')) {
        setStaticMode(true);
        return staticBackend[methodName](...args);
      }
      throw err;
    }
  };
}

export const api = {
  getState: withStaticFallback('getState', () => request('GET', 'api/state')),
  saveSettings: withStaticFallback('saveSettings', (payload) => request('POST', 'api/settings', payload)),
  resetSettings: withStaticFallback('resetSettings', (keepLabEnabled = false) =>
    request('POST', 'api/settings/reset', { keepLabEnabled })
  ),
  startDeviceCode: withStaticFallback('startDeviceCode', () => request('POST', 'api/auth/device-code', {})),
  pollDeviceCode: withStaticFallback('pollDeviceCode', () => request('POST', 'api/auth/poll', {})),
  upgradeSession: withStaticFallback('upgradeSession', async () => {
    const st = await request('GET', 'api/state');
    return { ok: Boolean(st?.auth?.signedIn), auth: st?.auth };
  }),
  logout: withStaticFallback('logout', (forget = false) => request('POST', 'api/auth/logout', { forget })),
  getPublicLists: withStaticFallback('getPublicLists', (market, locale) => {
    const qs = market && locale ? `?market=${encodeURIComponent(market)}&locale=${encodeURIComponent(locale)}` : '';
    return request('GET', `api/catalog/public-lists${qs}`);
  }),
  getCatalog: withStaticFallback('getCatalog', () => request('GET', 'api/catalog')),
  getRecents: withStaticFallback('getRecents', () => request('GET', 'api/catalog/recents')),
  getProductDetails: withStaticFallback('getProductDetails', (id) =>
    request('GET', `api/catalog/product/${encodeURIComponent(id)}`)
  ),
  toggleFavorite: withStaticFallback('toggleFavorite', (productId) =>
    request('POST', 'api/library/favorite', { productId })
  ),
  toggleMyGames: withStaticFallback('toggleMyGames', (productId) =>
    request('POST', 'api/library/mygames', { productId })
  ),
  recordPlayTime: withStaticFallback('recordPlayTime', (productId, titleId, title, deltaSec) =>
    request('POST', 'api/library/playtime', { productId, titleId, title, deltaSec })
  ),
  getCloudTime: withStaticFallback('getCloudTime', () => request('GET', 'api/account/cloud-time')),
  pingServers: withStaticFallback('pingServers', () => request('GET', 'api/servers/ping')),
  playSession: withStaticFallback('playSession', (titleId) => request('POST', 'api/session/play', { titleId })),
  getWaitTime: withStaticFallback('getWaitTime', (titleId) =>
    request('GET', `api/session/waittime/${encodeURIComponent(titleId)}`)
  ),
  getSessionState: withStaticFallback('getSessionState', (id) =>
    request('GET', `api/session/${encodeURIComponent(id)}/state`)
  ),
  connectSession: withStaticFallback('connectSession', (id) =>
    request('POST', `api/session/${encodeURIComponent(id)}/connect`, {})
  ),
  sendSdpOffer: withStaticFallback('sendSdpOffer', (id, sdp) =>
    request('POST', `api/session/${encodeURIComponent(id)}/sdp`, { sdp })
  ),
  getSdpAnswer: withStaticFallback('getSdpAnswer', (id) =>
    request('GET', `api/session/${encodeURIComponent(id)}/sdp`)
  ),
  sendIceCandidates: withStaticFallback('sendIceCandidates', (id, candidates) =>
    request('POST', `api/session/${encodeURIComponent(id)}/ice`, { candidates })
  ),
  getIceCandidates: withStaticFallback('getIceCandidates', (id) =>
    request('GET', `api/session/${encodeURIComponent(id)}/ice`)
  ),
  keepaliveSession: withStaticFallback('keepaliveSession', (id) =>
    request('POST', `api/session/${encodeURIComponent(id)}/keepalive`, {})
  ),
  deleteSession: withStaticFallback('deleteSession', (id) =>
    request('DELETE', `api/session/${encodeURIComponent(id)}`)
  ),
  checkUpdates: withStaticFallback('checkUpdates', () => request('GET', 'api/updates/check')),
  getLicenses: withStaticFallback('getLicenses', () => request('GET', 'api/licenses')),
};
