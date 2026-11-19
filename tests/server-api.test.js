// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { createAppServer } from '../src/server.js';

async function startTestServer() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'x4-srv-'));
  const { server } = await createAppServer({ dataDir: tmpDir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return {
    baseUrl,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

test('HTTP server serves SPA assets, catalog APIs, settings, library, CORS relay headers, and rejects unauthenticated play', async () => {
  const srv = await startTestServer();
  try {
    // Static SPA entry, CSS, i18n dictionary, and bundled fonts/icons
    const htmlRes = await fetch(`${srv.baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.ok(html.includes('XCloud4'));

    const cssRes = await fetch(`${srv.baseUrl}/css/app.css`);
    assert.equal(cssRes.status, 200);
    const i18nRes = await fetch(`${srv.baseUrl}/js/i18n-data.json`);
    assert.equal(i18nRes.status, 200);
    const i18nData = await i18nRes.json();
    assert.ok(i18nData.tables.en);
    assert.ok(i18nData.tables.es);
    assert.equal(i18nData.stages.length, 229);

    // Relay CORS preflight, /api/health & /workers/xcloud4-relay.js
    const preflightRes = await fetch(`${srv.baseUrl}/api/state`, { method: 'OPTIONS' });
    assert.equal(preflightRes.status, 204);
    assert.equal(preflightRes.headers.get('access-control-allow-origin'), '*');

    const healthRes = await fetch(`${srv.baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.ok, true);
    assert.equal(healthJson.mode, 'node');

    const workerRes = await fetch(`${srv.baseUrl}/workers/xcloud4-relay.js`);
    assert.equal(workerRes.status, 200);
    assert.ok((await workerRes.text()).includes('xbox-cors-relay'));

    // State & Settings update
    const stateRes = await fetch(`${srv.baseUrl}/api/state`);
    assert.equal(stateRes.status, 200);
    assert.equal(stateRes.headers.get('access-control-allow-origin'), '*');
    const stateJson = await stateRes.json();
    assert.equal(stateJson.identity.publicVersion, '1.3.0-beta');
    assert.equal(stateJson.identity.labVersion, '0.7.111-lab');
    assert.equal(stateJson.auth.signedIn, false);

    const postSettingsRes = await fetch(`${srv.baseUrl}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public: { language: 'es', accessCountry: 'US' },
        lab: { enabled: true, rembFixedMbps: 30, gyroSensitivity: 1.6, stickDeadzone: 0.12, turboRateHz: 20, touchOverlay: 'on' },
      }),
    });
    assert.equal(postSettingsRes.status, 200);
    const settingsJson = await postSettingsRes.json();
    assert.equal(settingsJson.settings.public.language, 'es');
    assert.equal(settingsJson.settings.public.accessCountry, 'US');
    assert.equal(settingsJson.settings.lab.enabled, true);
    assert.equal(settingsJson.settings.lab.rembFixedMbps, 30);
    assert.equal(settingsJson.settings.lab.gyroSensitivity, 1.6);
    assert.equal(settingsJson.settings.lab.stickDeadzone, 0.12);
    assert.equal(settingsJson.settings.lab.turboRateHz, 20);
    assert.equal(settingsJson.settings.lab.touchOverlay, 'on');

    const resetRes = await fetch(`${srv.baseUrl}/api/settings/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepLabEnabled: true }),
    });
    assert.equal(resetRes.status, 200);
    const resetJson = await resetRes.json();
    assert.equal(resetJson.settings.public.language, 'auto');
    assert.equal(resetJson.settings.lab.enabled, true);
    assert.equal(resetJson.settings.lab.gyroSensitivity, 0.85);

    // Demo endpoint must not exist & unauthenticated play/quota must reject with 401
    const demoAuthRes = await fetch(`${srv.baseUrl}/api/auth/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gamertag: 'ArenaPlayer' }),
    });
    assert.equal(demoAuthRes.status, 404);

    const quotaRes = await fetch(`${srv.baseUrl}/api/account/cloud-time`);
    assert.equal(quotaRes.status, 401);

    const unauthPlayRes = await fetch(`${srv.baseUrl}/api/session/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titleId: 'BT5P2X999VH2' }),
    });
    assert.equal(unauthPlayRes.status, 401);

    // Public Lists, Catalog Browse/Search, Product, Favorites, My Games, Playtime
    const listsRes = await fetch(`${srv.baseUrl}/api/catalog/public-lists`);
    assert.equal(listsRes.status, 200);
    const listsJson = await listsRes.json();
    assert.ok(Array.isArray(listsJson.lists.popular) && listsJson.lists.popular.length > 0);
    assert.ok(listsJson.metadata.BT5P2X999VH2);
    assert.equal(listsJson.metadata.BT5P2X999VH2.playUrl, 'https://www.xbox.com/play/games/fortnite/BT5P2X999VH2');

    const searchRes = await fetch(`${srv.baseUrl}/api/catalog?q=fortnite`);
    assert.equal(searchRes.status, 200);
    const searchJson = await searchRes.json();
    assert.ok(searchJson.items.some((g) => g.productId === 'BT5P2X999VH2'));

    const prodRes = await fetch(`${srv.baseUrl}/api/catalog/product/BT5P2X999VH2`);
    assert.equal(prodRes.status, 200);
    const prodJson = await prodRes.json();
    assert.equal(prodJson.item.title, 'Fortnite');

    const favRes = await fetch(`${srv.baseUrl}/api/library/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'BT5P2X999VH2' }),
    });
    assert.equal(favRes.status, 200);
    const favJson = await favRes.json();
    assert.ok(favJson.favorites.includes('BT5P2X999VH2'));

    const playTimeRes = await fetch(`${srv.baseUrl}/api/library/playtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'BT5P2X999VH2', title: 'Fortnite', deltaSec: 120 }),
    });
    assert.equal(playTimeRes.status, 200);
    const ptJson = await playTimeRes.json();
    assert.equal(ptJson.localRecents.BT5P2X999VH2.playTimeSec, 120);

    // Server Ping
    const pingRes = await fetch(`${srv.baseUrl}/api/servers/ping`);
    assert.equal(pingRes.status, 200);
    const pingJson = await pingRes.json();
    assert.ok(Array.isArray(pingJson.regions) && pingJson.regions.length > 0);

    // QR + Licenses + Fallback SVG art
    const qrRes = await fetch(`${srv.baseUrl}/api/qr.svg?text=https://ko-fi.com/asapedgr`);
    assert.equal(qrRes.status, 200);
    assert.ok((await qrRes.text()).includes('<svg'));

    const licRes = await fetch(`${srv.baseUrl}/api/licenses`);
    assert.equal(licRes.status, 200);
    const licJson = await licRes.json();
    assert.ok(licJson.licenses.length >= 6);

    const artRes = await fetch(`${srv.baseUrl}/api/artwork/BT5P2X999VH2/hero.svg`);
    assert.equal(artRes.status, 200);
    assert.ok((await artRes.text()).includes('<svg'));
  } finally {
    await srv.close();
  }
});
