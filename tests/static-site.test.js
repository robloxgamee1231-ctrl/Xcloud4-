// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { buildStaticSite } from '../scripts/build-site.mjs';
import { staticBackend, resetStaticCatalogCache } from '../public/js/static-backend.js';
import { appUrl, apiUrl, setStaticMode, isStaticMode, setRelayUrl, getRelayUrl, artworkUrl } from '../public/js/paths.js';
import { buildPlayXboxUrl, SIGL_GUIDS, fetchFullXboxCatalogSnapshot } from '../public/js/xbox-catalog.js';

if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
}

function makeFakeJwt(claims) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.sig`;
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

test('staticBackend performs real Microsoft Device Code OAuth2, Relay URL routing, settings, and offline fallback', async () => {
  setRelayUrl('');
  setStaticMode(true);
  resetStaticCatalogCache();
  const realFetch = globalThis.fetch;

  try {
    // 1) Offline sandbox behavior: catalog falls back cleanly & OAuth reports oauthUnavailable honestly
    globalThis.fetch = async () => {
      throw new Error('Offline sandbox');
    };
    const initial = await staticBackend.getState();
    assert.equal(initial.staticSiteMode, true);
    assert.equal(initial.auth.signedIn, false);
    assert.equal('demoSignIn' in staticBackend, false);

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

    await assert.rejects(() => staticBackend.startDeviceCode(), (err) => err.payload?.oauthUnavailable === true);
    await assert.rejects(() => staticBackend.playSession('BT5P2X999VH2'), (err) => err.payload?.usePlayXbox === true);

    // 2) Microsoft OAuth2 Device Code + JWT Identity Claim extraction when Microsoft endpoint responds
    const idJwt = makeFakeJwt({ name: 'HaloChief', preferred_username: 'chief@outlook.com', sub: 'ms-sub-99' });
    let pollCount = 0;
    globalThis.fetch = async (url) => {
      const s = String(url);
      if (s.includes('/oauth2/v2.0/devicecode')) {
        return new Response(
          JSON.stringify({
            device_code: 'dc-12345',
            user_code: 'ABCD1234',
            verification_uri: 'https://www.microsoft.com/link',
            expires_in: 900,
            interval: 5,
          }),
          { status: 200 }
        );
      }
      if (s.includes('/oauth2/v2.0/token')) {
        pollCount += 1;
        if (pollCount === 1) {
          return new Response(JSON.stringify({ error: 'authorization_pending' }), { status: 400 });
        }
        return new Response(
          JSON.stringify({
            access_token: 'ms-access-token',
            id_token: idJwt,
            expires_in: 3600,
          }),
          { status: 200 }
        );
      }
      throw new TypeError('CORS blocked on Xbox Live');
    };

    const dc = await staticBackend.startDeviceCode();
    assert.equal(dc.userCode, 'ABCD1234');
    assert.equal(dc.verificationUri, 'https://www.microsoft.com/link');

    const pending = await staticBackend.pollDeviceCode();
    assert.equal(pending.status, 'pending');

    const authorized = await staticBackend.pollDeviceCode();
    assert.equal(authorized.status, 'authorized');
    assert.equal(authorized.auth.signedIn, true);
    assert.equal(authorized.auth.gamertag, 'HaloChief');
    assert.equal(authorized.auth.email, 'chief@outlook.com');
    assert.equal(authorized.auth.offeringId, 'play.xbox.com');
    assert.equal(authorized.auth.liveStream, false);

    // 3) Relay URL configuration overrides static mode cleanly
    const savedRelay = setRelayUrl('http://localhost:3000/');
    assert.equal(savedRelay, 'http://localhost:3000');
    assert.equal(getRelayUrl(), 'http://localhost:3000');
    assert.equal(isStaticMode(), false);
    assert.equal(apiUrl('api/state'), 'http://localhost:3000/api/state');
    setRelayUrl('');
    setStaticMode(true);

    await staticBackend.logout(true);
    const loggedOut = await staticBackend.getState();
    assert.equal(loggedOut.auth.signedIn, false);
  } finally {
    setRelayUrl('');
    globalThis.fetch = realFetch;
    resetStaticCatalogCache();
    setStaticMode(false);
  }
});

test('xbox-catalog and staticBackend fetch real SIGL + DisplayCatalog v7.0 and fall back cleanly to deployed snapshot', async () => {
  assert.equal(SIGL_GUIDS.all, '29a81209-df6f-41fd-a528-2ae6b91f719c');
  assert.equal(buildPlayXboxUrl('BT5P2X999VH2', 'Fortnite'), 'https://www.xbox.com/play/games/fortnite/BT5P2X999VH2');
  assert.equal(buildPlayXboxUrl('9NNX1VVR3KNQ', 'Forza Horizon 5'), 'https://www.xbox.com/play/games/forza-horizon-5/9NNX1VVR3KNQ');

  const sampleDisplayCatalog = {
    Products: [
      {
        ProductId: 'BT5P2X999VH2',
        LocalizedProperties: [
          {
            ProductTitle: 'Fortnite',
            PublisherName: 'Epic Games',
            DeveloperName: 'Epic Games',
            ShortDescription: 'Battle Royale',
            Images: [
              { ImagePurpose: 'TitledHeroArt', Uri: '//store-images.s-microsoft.com/image/apps.fn1' },
              { ImagePurpose: 'SuperHeroArt', Uri: '//store-images.s-microsoft.com/image/apps.fn2' },
            ],
          },
        ],
        MarketProperties: [{ OriginalReleaseDate: '2017-07-21T00:00:00Z' }],
        Properties: { Category: 'Shooter' },
      },
      {
        ProductId: '9NNX1VVR3KNQ',
        LocalizedProperties: [
          {
            ProductTitle: 'Forza Horizon 5',
            PublisherName: 'Xbox Game Studios',
            DeveloperName: 'Playground Games',
            ShortDescription: 'Open world racing across Mexico',
            Images: [
              { ImagePurpose: 'BrandedKeyArt', Uri: 'https://store-images.s-microsoft.com/image/apps.fh5' },
            ],
          },
        ],
        MarketProperties: [{ OriginalReleaseDate: '2021-11-09T00:00:00Z' }],
        Properties: { Category: 'Racing & flying' },
      },
    ],
  };

  const realFetch = globalThis.fetch;
  setStaticMode(true);
  try {
    // Tier 1: Live Microsoft SIGL + DisplayCatalog v7.0
    resetStaticCatalogCache();
    globalThis.fetch = async (url) => {
      const s = String(url);
      if (s.includes('catalog.gamepass.com/sigls/v2')) {
        if (s.includes(SIGL_GUIDS.free)) {
          return new Response(JSON.stringify([{ siglId: 'x' }, { id: 'BT5P2X999VH2' }]), { status: 200 });
        }
        return new Response(JSON.stringify([{ siglId: 'x' }, { id: 'BT5P2X999VH2' }, { id: '9NNX1VVR3KNQ' }]), { status: 200 });
      }
      if (s.includes('displaycatalog.mp.microsoft.com/v7.0/products')) {
        return new Response(JSON.stringify(sampleDisplayCatalog), { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    };

    const liveSnap = await fetchFullXboxCatalogSnapshot({ includeAll: true });
    assert.equal(liveSnap.source, 'live');
    assert.equal(liveSnap.metadata['9NNX1VVR3KNQ'].title, 'Forza Horizon 5');
    assert.ok(liveSnap.metadata['9NNX1VVR3KNQ'].coverUrl.startsWith('https://store-images.s-microsoft.com/image/apps.fh5'));
    assert.equal(liveSnap.metadata['9NNX1VVR3KNQ'].playUrl, 'https://www.xbox.com/play/games/forza-horizon-5/9NNX1VVR3KNQ');

    const pub = await staticBackend.getPublicLists();
    assert.equal(pub.source, 'live');
    assert.equal(pub.metadata['9NNX1VVR3KNQ'].title, 'Forza Horizon 5');

    const cat = await staticBackend.getCatalog();
    assert.equal(cat.source, 'live');
    assert.ok(cat.items.some((i) => i.productId === '9NNX1VVR3KNQ'));

    // Tier 2: Prebuilt data/xbox-catalog.json when external CORS fails
    resetStaticCatalogCache();
    globalThis.fetch = async (url) => {
      const s = String(url);
      if (s.includes('data/xbox-catalog.json')) {
        return new Response(JSON.stringify({ ...liveSnap, source: 'live-snapshot' }), { status: 200 });
      }
      throw new TypeError('CORS blocked');
    };

    const snapPub = await staticBackend.getPublicLists();
    assert.equal(snapPub.source, 'live-snapshot');
    assert.equal(snapPub.metadata['9NNX1VVR3KNQ'].playUrl, 'https://www.xbox.com/play/games/forza-horizon-5/9NNX1VVR3KNQ');
  } finally {
    globalThis.fetch = realFetch;
    resetStaticCatalogCache();
    setStaticMode(false);
  }
});
