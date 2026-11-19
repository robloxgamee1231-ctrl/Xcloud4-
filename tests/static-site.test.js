// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { buildStaticSite } from '../scripts/build-site.mjs';
import { staticBackend } from '../public/js/static-backend.js';
import { appUrl, setStaticMode, artworkUrl } from '../public/js/paths.js';

if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
}

test('Static site builder outputs complete GitHub Pages bundle with subpath-safe assets', async () => {
  const tmpSite = await fs.mkdtemp(path.join(os.tmpdir(), 'x4-site-'));
  try {
    await buildStaticSite(tmpSite);
    const indexHtml = await fs.readFile(path.join(tmpSite, 'index.html'), 'utf8');
    const fallback404 = await fs.readFile(path.join(tmpSite, '404.html'), 'utf8');
    assert.equal(indexHtml, fallback404);
    assert.ok(indexHtml.includes('./css/app.css'));
    assert.ok(indexHtml.includes('./js/app.js'));

    await fs.access(path.join(tmpSite, '.nojekyll'));
    await fs.access(path.join(tmpSite, 'docs/licenses/Tabler-Icons-MIT.txt'));
    await fs.access(path.join(tmpSite, 'assets/fonts/Inter-Regular.ttf'));
    await fs.access(path.join(tmpSite, 'js/static-backend.js'));
  } finally {
    await fs.rm(tmpSite, { recursive: true, force: true });
  }
});

test('staticBackend supports full client-only Sandbox Demo, catalog, settings, and inline SVG artwork', async () => {
  setStaticMode(true);
  try {
    const initial = await staticBackend.getState();
    assert.equal(initial.staticSiteMode, true);
    assert.equal(initial.auth.signedIn, false);

    const signedIn = await staticBackend.demoSignIn('PagesPlayer');
    assert.equal(signedIn.auth.signedIn, true);
    assert.equal(signedIn.auth.gamertag, 'PagesPlayer');

    await staticBackend.saveSettings({
      public: { language: 'fr' },
      lab: { enabled: true, gyroSensitivity: 1.25 },
    });
    const afterSettings = await staticBackend.getState();
    assert.equal(afterSettings.settings.public.language, 'fr');
    assert.equal(afterSettings.settings.lab.gyroSensitivity, 1.25);

    const lists = await staticBackend.getPublicLists();
    assert.ok(lists.metadata.BT5P2X999VH2.coverUrl.startsWith('data:image/svg+xml'));
    assert.ok(artworkUrl('BT5P2X999VH2', 'hero.svg').startsWith('data:image/svg+xml'));
    assert.ok(appUrl('docs/licenses/Lua-MIT.txt').endsWith('/docs/licenses/Lua-MIT.txt'));

    const favs = await staticBackend.toggleFavorite('BT5P2X999VH2');
    assert.ok(favs.favorites.includes('BT5P2X999VH2'));

    const play = await staticBackend.playSession('BT5P2X999VH2');
    assert.equal(play.demoMode, true);
    assert.equal(play.state, 'Provisioned');

    await assert.rejects(() => staticBackend.startDeviceCode(), (err) => err.payload?.sandboxUnavailable === true);
    await staticBackend.logout(true);
  } finally {
    setStaticMode(false);
  }
});
