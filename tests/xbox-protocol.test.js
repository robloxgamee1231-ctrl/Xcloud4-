// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { generateQrMatrix, generateQrSvg } from '../src/qr.js';
import { StateStore, DEFAULT_SETTINGS } from '../src/state-store.js';
import {
  ACCESS_COUNTRIES,
  STREAM_PROFILES,
  SIGL_GUIDS,
  OAUTH_CONFIG,
  buildDeviceInfo,
  parseCloudTimeResponse,
  parseDisplayCatalogProducts,
} from '../src/xbox-protocol.js';

test('QR generator produces valid square matrix and SVG for upstream URLs', () => {
  for (const url of [
    'https://www.microsoft.com/link',
    'https://ko-fi.com/asapedgr',
    'https://www.xbox.com/play/games/fortnite/BT5P2X999VH2',
  ]) {
    const mat = generateQrMatrix(url);
    assert.ok(Array.isArray(mat) && mat.length >= 21);
    assert.equal(mat.length, mat[0].length);
    const svg = generateQrSvg(url);
    assert.ok(svg.startsWith('<svg '));
    assert.ok(svg.includes('<path '));
  }
});

test('buildDeviceInfo builds 720p60, 1080p-H, and browser device headers accurately', () => {
  const p720 = JSON.parse(buildDeviceInfo('720p60'));
  assert.equal(p720.dev.hw.make, 'Microsoft');
  assert.equal(p720.dev.hw.model, 'Xbox One');
  assert.equal(ACCESS_COUNTRIES.find((c) => c.code === 'US').ip, '143.244.47.65');

  const p1080h = JSON.parse(buildDeviceInfo('1080p-H'));
  assert.equal(p1080h.dev.hw.make, 'Sony');
  assert.equal(p1080h.dev.hw.model, 'PS4');

  const pBrowser = JSON.parse(buildDeviceInfo('1080p-HQ'));
  assert.equal(pBrowser.appInfo.env.clientAppType, 'browser');
  assert.equal(pBrowser.dev.displayInfo.dimensions.widthInPixels, 4096);
  assert.equal(STREAM_PROFILES['1080p-HQ'].bitrateKbps, 18000);
  assert.equal(OAUTH_CONFIG.fortniteTitleId, 'BT5P2X999VH2');
  assert.equal(SIGL_GUIDS.free, 'd8f4afcd-882a-49e3-86b3-f61fa0172b75');
});

test('parseCloudTimeResponse parses both JSON and raw protobuf wire payloads', () => {
  const fromJson = parseCloudTimeResponse(Buffer.from(JSON.stringify({
    remainingGameplayTimeInSeconds: 33300,
    maxGameplayTimeInSeconds: 36000,
  })));
  assert.equal(fromJson.available, true);
  assert.equal(fromJson.kind, 'json');
  assert.equal(fromJson.remainingSeconds, 33300);
  assert.equal(fromJson.maxSeconds, 36000);

  // Hand-craft protobuf: field 1 varint = 18000, field 2 varint = 36000
  const buf = Buffer.from([
    0x08, 0xd0, 0x8c, 0x01, // field 1 = 18000
    0x10, 0xa0, 0x99, 0x02, // field 2 = 36000
  ]);
  const fromPb = parseCloudTimeResponse(buf);
  assert.equal(fromPb.available, true);
  assert.equal(fromPb.remainingSeconds, 18000);
  assert.equal(fromPb.maxSeconds, 36000);
});

test('parseDisplayCatalogProducts normalizes Store URLs and image dimensions', () => {
  const sample = {
    Products: [
      {
        ProductId: 'BT5P2X999VH2',
        LocalizedProperties: [
          {
            ProductTitle: 'Fortnite',
            ShortDescription: 'Drop in and play free via Xbox Cloud Gaming.',
            DeveloperName: 'Epic Games',
            PublisherName: 'Epic Games',
            Images: [
              { ImagePurpose: 'BoxArt', Uri: '//store-images.s-microsoft.com/image/apps.123', Width: 500, Height: 500 },
              { ImagePurpose: 'TitledHeroArt', Uri: 'https://store-images.s-microsoft.com/image/apps.456', Width: 1920, Height: 1080 },
              { ImagePurpose: 'Screenshot', Uri: 'https://store-images.s-microsoft.com/image/apps.789', Width: 1920, Height: 1080 },
            ],
          },
        ],
        MarketProperties: [{ OriginalReleaseDate: '2017-07-25T00:00:00Z' }],
        Properties: { Category: 'Shooter', Attributes: [{ Name: 'OnlineMultiplayer' }] },
      },
    ],
  };

  const map = parseDisplayCatalogProducts(sample);
  const game = map.BT5P2X999VH2;
  assert.ok(game);
  assert.equal(game.title, 'Fortnite');
  assert.equal(game.category, 'Shooter');
  assert.ok(game.coverUrl.includes('w=384&h=216'));
  assert.ok(game.heroUrl.includes('w=1920&h=1080'));
  assert.equal(game.screenshots.length, 1);
});

test('StateStore persists settings, favorites, recents, and sanitized auth securely', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'x4-state-'));
  try {
    const store = new StateStore(tmpDir);
    await store.load();

    assert.equal(store.state.settings.public.language, DEFAULT_SETTINGS.public.language);
    store.state.settings.public.language = 'es';
    store.state.settings.lab.enabled = true;
    store.state.settings.lab.sharpness = 2;
    store.state.favorites.push('BT5P2X999VH2');
    store.state.localRecents.BT5P2X999VH2 = { playSeconds: 180, lastPlayedAt: 1700000000000 };
    store.state.auth = {
      demoMode: false,
      gamertag: 'TestPlayer',
      uhs: '2533274812345678',
      refreshToken: 'SUPER_SECRET_REFRESH_TOKEN',
      gsToken: 'SUPER_SECRET_GSSV_TOKEN',
    };
    await store.save();

    const sanitized = store.getSanitizedAuth();
    assert.equal(sanitized.signedIn, true);
    assert.equal(sanitized.gamertag, 'TestPlayer');
    assert.equal('refreshToken' in sanitized, false);
    assert.equal('gsToken' in sanitized, false);

    const reloaded = new StateStore(tmpDir);
    await reloaded.load();
    assert.equal(reloaded.state.settings.public.language, 'es');
    assert.equal(reloaded.state.settings.lab.enabled, true);
    assert.deepEqual(reloaded.state.favorites, ['BT5P2X999VH2']);
    assert.equal(reloaded.state.localRecents.BT5P2X999VH2.playSeconds, 180);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
