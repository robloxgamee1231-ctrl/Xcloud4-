/* SPDX-License-Identifier: GPL-3.0-only */
/* Frontend REST client for XCloud4 backend relay. */

async function request(method, url, body = undefined) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const text = await res.text();
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

export const api = {
  getState: () => request('GET', '/api/state'),
  saveSettings: (payload) => request('POST', '/api/settings', payload),
  resetSettings: (keepLabEnabled = false) => request('POST', '/api/settings/reset', { keepLabEnabled }),
  startDeviceCode: () => request('POST', '/api/auth/device-code', {}),
  pollDeviceCode: () => request('POST', '/api/auth/poll', {}),
  demoSignIn: (gamertag) => request('POST', '/api/auth/demo', { gamertag }),
  logout: (forget = false) => request('POST', '/api/auth/logout', { forget }),
  getPublicLists: (market, locale) => {
    const qs = market && locale ? `?market=${encodeURIComponent(market)}&locale=${encodeURIComponent(locale)}` : '';
    return request('GET', `/api/catalog/public-lists${qs}`);
  },
  getCatalog: () => request('GET', '/api/catalog'),
  getRecents: () => request('GET', '/api/catalog/recents'),
  getProductDetails: (id) => request('GET', `/api/catalog/product/${encodeURIComponent(id)}`),
  toggleFavorite: (productId) => request('POST', '/api/library/favorite', { productId }),
  toggleMyGames: (productId) => request('POST', '/api/library/mygames', { productId }),
  recordPlayTime: (productId, titleId, title, deltaSec) =>
    request('POST', '/api/library/playtime', { productId, titleId, title, deltaSec }),
  getCloudTime: () => request('GET', '/api/account/cloud-time'),
  pingServers: () => request('GET', '/api/servers/ping'),
  playSession: (titleId) => request('POST', '/api/session/play', { titleId }),
  getWaitTime: (titleId) => request('GET', `/api/session/waittime/${encodeURIComponent(titleId)}`),
  getSessionState: (id) => request('GET', `/api/session/${encodeURIComponent(id)}/state`),
  connectSession: (id) => request('POST', `/api/session/${encodeURIComponent(id)}/connect`, {}),
  sendSdpOffer: (id, sdp) => request('POST', `/api/session/${encodeURIComponent(id)}/sdp`, { sdp }),
  getSdpAnswer: (id) => request('GET', `/api/session/${encodeURIComponent(id)}/sdp`),
  sendIceCandidates: (id, candidates) => request('POST', `/api/session/${encodeURIComponent(id)}/ice`, { candidates }),
  getIceCandidates: (id) => request('GET', `/api/session/${encodeURIComponent(id)}/ice`),
  keepaliveSession: (id) => request('POST', `/api/session/${encodeURIComponent(id)}/keepalive`, {}),
  deleteSession: (id) => request('DELETE', `/api/session/${encodeURIComponent(id)}`),
  checkUpdates: () => request('GET', '/api/updates/check'),
  getLicenses: () => request('GET', '/api/licenses'),
};
