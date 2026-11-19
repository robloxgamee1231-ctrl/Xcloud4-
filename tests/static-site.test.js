// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { buildStaticSite } from '../scripts/build-site.mjs';
import { staticBackend, resetStaticCatalogCache } from '../public/js/static-backend.js';
import {
  appUrl,
  apiUrl,
  setStaticMode,
  isStaticMode,
  setRelayUrl,
  getRelayUrl,
  getRelayType,
  getCorsProxyUrl,
  probeAndSetRelayUrl,
  artworkUrl,
} from '../public/js/paths.js';
import { buildPlayXboxUrl, SIGL_GUIDS, fetchFullXboxCatalogSnapshot } from '../public/js/xbox-catalog.js';
import relayWorker, { isAllowedTargetUrl } from '../workers/xcloud4-relay.js';

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

test('Static site builder outputs complete GitHub Pages bundle including Cloudflare worker relay', async () => {
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
    await fs.access(path.join(tmpSite, 'workers/xcloud4-relay.js'));
  } finally {
    await fs.rm(tmpSite, { recursive: true, force: true });
  }
});

test('Cloudflare Worker Xbox CORS Relay enforces strict HTTPS allowlist and CORS headers', async () => {
  assert.ok(isAllowedTargetUrl('https://user.auth.xboxlive.com/user/authenticate'));
  assert.ok(isAllowedTargetUrl('https://xgpuweb.gssv-play-prod.xboxlive.com/v5/sessions/cloud/play'));
  assert.ok(isAllowedTargetUrl('https://login.microsoftonline.com/consumers/oauth2/v2.0/token'));
  assert.equal(isAllowedTargetUrl('https://evil.example.com/steal'), null);
  assert.equal(isAllowedTargetUrl('http://user.auth.xboxlive.com/user/authenticate'), null);
  assert.equal(isAllowedTargetUrl('https://www.xbox.com/play'), null);

  const optsRes = await relayWorker.fetch(new Request('https://relay.example.dev/proxy', { method: 'OPTIONS' }));
  assert.equal(optsRes.status, 204);
  assert.equal(optsRes.headers.get('access-control-allow-origin'), '*');

  const healthRes = await relayWorker.fetch(new Request('https://relay.example.dev/health', { method: 'GET' }));
  assert.equal(healthRes.status, 200);
  const health = await healthRes.json();
  assert.equal(health.ok, true);
  assert.equal(health.mode, 'xbox-cors-relay');

  const blockedRes = await relayWorker.fetch(
    new Request('https://relay.example.dev/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://evil.example.com/steal', method: 'GET' }),
    })
  );
  assert.equal(blockedRes.status, 403);

  // Verify 204 No Content responses from Xbox GSSV pass through without Response(body, { status: 204 }) TypeError
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 204 });
    const pass204 = await relayWorker.fetch(
      new Request('https://relay.example.dev/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://eus.gssv-play-prod.xboxlive.com/v5/sessions/cloud/s1/sdp', method: 'GET' }),
      })
    );
    assert.equal(pass204.status, 204);
    assert.equal(pass204.headers.get('access-control-allow-origin'), '*');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('UI templates do not redirect users to play.xbox.com on sign-in or game launch', async () => {
  const filesToCheck = [
    'public/js/views/cards.js',
    'public/js/views/home.js',
    'public/js/views/discover.js',
    'public/js/views/game-page.js',
    'public/js/views/fortnite.js',
    'public/js/views/account.js',
    'public/js/views/loading-stream.js',
    'public/js/app.js',
    'public/js/i18n.js',
  ];
  for (const rel of filesToCheck) {
    const content = await fs.readFile(path.resolve(rel), 'utf8');
    assert.equal(content.includes('xbox.com/play'), false, `${rel} should not redirect to xbox.com/play`);
    assert.equal(content.includes('play.xbox.com'), false, `${rel} should not contain play.xbox.com redirect links`);
  }
});

test('staticBackend executes Microsoft OAuth2, Relay detection (Node & CORS Worker), and full in-site GSSV WebRTC signaling', async () => {
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
    await assert.rejects(() => staticBackend.playSession('BT5P2X999VH2'), (err) => err.status === 401);

    // 2) Microsoft OAuth2 Device Code + JWT fallback when Xbox XBL is CORS-blocked
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
            refresh_token: 'ms-refresh-token',
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
    assert.equal(authorized.auth.offeringId, 'xbox-microsoft-account');
    assert.equal(authorized.auth.liveStream, false);

    // Signed-in without liveStream signals relayRequired instead of redirecting
    await assert.rejects(() => staticBackend.playSession('BT5P2X999VH2'), (err) => err.payload?.relayRequired === true);

    // 3) Connect a Cloudflare CORS Relay -> upgradeSession -> full in-site GSSV WebRTC signaling!
    const proxiedTargets = [];
    globalThis.fetch = async (url, init) => {
      const s = String(url);
      if (s === 'https://x4-cors.workers.dev/api/health') {
        return new Response('Not found', { status: 404 });
      }
      if (s === 'https://x4-cors.workers.dev/health') {
        return new Response(JSON.stringify({ ok: true, mode: 'xbox-cors-relay' }), { status: 200 });
      }
      if (s === 'https://x4-cors.workers.dev/proxy') {
        const reqPayload = JSON.parse(init.body);
        proxiedTargets.push(`${reqPayload.method} ${reqPayload.url}`);
        if (reqPayload.url.includes('login.microsoftonline.com')) {
          return new Response(JSON.stringify({ access_token: 'ms-access-2', refresh_token: 'ms-ref-2', expires_in: 3600 }), { status: 200 });
        }
        if (reqPayload.url.includes('user.auth.xboxlive.com')) {
          return new Response(JSON.stringify({ Token: 'xbl-tok', DisplayClaims: { xui: [{ uhs: 'u123' }] } }), { status: 200 });
        }
        if (reqPayload.url.includes('xsts.auth.xboxlive.com')) {
          return new Response(JSON.stringify({ Token: 'xsts-tok', DisplayClaims: { xui: [{ uhs: 'u123', gtg: 'MasterChief' }] } }), { status: 200 });
        }
        if (reqPayload.url.includes('/v2/login/user')) {
          return new Response(
            JSON.stringify({
              gsToken: 'gs-live-token',
              durationInSeconds: 14400,
              offeringSettings: {
                offeringId: 'xgpuweb',
                regions: [{ name: 'EastUS', continent: 'North America', baseUri: 'https://eus.gssv-play-prod.xboxlive.com', isDefault: true }],
              },
            }),
            { status: 200 }
          );
        }
        if (reqPayload.url.endsWith('/v5/sessions/cloud/play')) {
          return new Response(JSON.stringify({ sessionPath: '/v5/sessions/cloud/sess-99' }), { status: 200 });
        }
        if (reqPayload.url.endsWith('/v5/sessions/cloud/sess-99/state')) {
          return new Response(JSON.stringify({ state: 'ReadyToConnect' }), { status: 200 });
        }
        if (reqPayload.url.includes('login.live.com/oauth20_token.srf')) {
          return new Response(JSON.stringify({ access_token: 'passport-tok' }), { status: 200 });
        }
        if (reqPayload.url.endsWith('/v5/sessions/cloud/sess-99/connect')) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (reqPayload.url.endsWith('/v5/sessions/cloud/sess-99/sdp')) {
          if (reqPayload.method === 'POST') return new Response(JSON.stringify({ ok: true }), { status: 200 });
          return new Response(JSON.stringify({ exchangeResponse: JSON.stringify({ sdp: 'v=0 answer' }) }), { status: 200 });
        }
        if (reqPayload.url.endsWith('/v5/sessions/cloud/sess-99/ice')) {
          if (reqPayload.method === 'POST') return new Response(JSON.stringify({ ok: true }), { status: 200 });
          return new Response(JSON.stringify({ exchangeResponse: JSON.stringify([{ candidate: 'cand:1', sdpMid: '0', sdpMLineIndex: 0 }]) }), { status: 200 });
        }
        if (reqPayload.url.endsWith('/v5/sessions/cloud/sess-99')) {
          return new Response(null, { status: 204 });
        }
      }
      return new Response('Unhandled', { status: 404 });
    };

    const probedCors = await probeAndSetRelayUrl('https://x4-cors.workers.dev/');
    assert.equal(probedCors.type, 'cors-proxy');
    assert.equal(getRelayType(), 'cors-proxy');
    assert.equal(getCorsProxyUrl(), 'https://x4-cors.workers.dev/proxy');
    assert.equal(isStaticMode(), true);

    const upgraded = await staticBackend.upgradeSession();
    assert.equal(upgraded.ok, true);
    assert.equal(upgraded.auth.liveStream, true);
    assert.equal(upgraded.auth.gamertag, 'MasterChief');
    assert.equal(upgraded.auth.offeringId, 'xgpuweb');

    const playRes = await staticBackend.playSession('BT5P2X999VH2');
    assert.equal(playRes.sessionId, 'sess-99');
    const stateRes = await staticBackend.getSessionState('sess-99');
    assert.equal(stateRes.state, 'ReadyToConnect');
    await staticBackend.connectSession('sess-99');
    await staticBackend.sendSdpOffer('sess-99', 'v=0 offer');
    const sdpAns = await staticBackend.getSdpAnswer('sess-99');
    assert.ok(sdpAns.exchangeResponse.includes('v=0 answer'));
    await staticBackend.sendIceCandidates('sess-99', ['cand:local']);
    const iceRes = await staticBackend.getIceCandidates('sess-99');
    assert.ok(iceRes.exchangeResponse.includes('cand:1'));
    await staticBackend.deleteSession('sess-99');
    assert.ok(proxiedTargets.some((t) => t.endsWith('/v5/sessions/cloud/play')));
    assert.ok(proxiedTargets.some((t) => t.endsWith('/v5/sessions/cloud/sess-99/connect')));

    // 4) Node Relay detection overrides static mode cleanly
    const savedRelay = setRelayUrl('http://localhost:3000/');
    assert.equal(savedRelay, 'http://localhost:3000');
    assert.equal(getRelayUrl(), 'http://localhost:3000');
    assert.equal(getRelayType(), 'node');
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
