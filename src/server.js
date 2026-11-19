/* SPDX-License-Identifier: GPL-3.0-only */
/* XCloud4 Web Edition backend relay and static SPA host. */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StateStore, DEFAULT_SETTINGS } from './state-store.js';
import {
  APP_IDENTITY,
  OAUTH_CONFIG,
  SIGL_GUIDS,
  ACCESS_COUNTRIES,
  STREAM_PROFILES,
  resolveStreamProfile,
  buildDeviceInfo,
  buildPlayBody,
  isValidGssvBaseUri,
  isValidSessionId,
  isValidTitleId,
  isValidProductId,
  isNetworkUnreachableError,
  requestDeviceCode,
  pollDeviceToken,
  refreshOAuthToken,
  requestConsoleTransferToken,
  authenticateXboxLive,
  authorizeXsts,
  loginGssv,
  fetchCloudTime,
  fetchCloudCatalog,
  fetchCloudMru,
  fetchSiglList,
  fetchDisplayCatalogBatch,
  probeHostRttMs,
  gssvSessionRequest,
} from './xbox-protocol.js';
import {
  FALLBACK_TITLES,
  FALLBACK_REGIONS,
  buildFallbackCatalogMap,
  buildFallbackPublicLists,
  renderFallbackArtworkSvg,
} from './fallback-catalog.js';
import { generateQrSvg } from './qr.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.lua': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, obj) {
  const payload = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

async function readJsonBody(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error('Payload too large'), { httpStatus: 413 });
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function normalizeLocaleMarket(langSetting, queryMarket, queryLocale) {
  if (/^[A-Z]{2}$/.test(queryMarket || '') && /^[a-z]{2}-[A-Z]{2}$/.test(queryLocale || '')) {
    return { market: queryMarket, locale: queryLocale };
  }
  switch (langSetting) {
    case 'es': return { market: 'ES', locale: 'es-ES' };
    case 'pt-BR': return { market: 'BR', locale: 'pt-BR' };
    case 'fr': return { market: 'FR', locale: 'fr-FR' };
    case 'it': return { market: 'IT', locale: 'it-IT' };
    case 'de': return { market: 'DE', locale: 'de-DE' };
    default: return { market: 'US', locale: 'en-US' };
  }
}

export async function createAppServer(options = {}) {
  const publicDir = options.publicDir || path.join(REPO_ROOT, 'public');
  const dataDir = options.dataDir || path.join(REPO_ROOT, '.xcloud4-data');
  const store = new StateStore(dataDir);
  await store.load();

  // Ephemeral in-memory caches for public SIGLs, Store metadata, active device flow & active play sessions
  const metaCache = new Map();
  let siglCache = { ts: 0, market: '', locale: '', lists: null };
  let activeDeviceLogin = null;
  const activeSessions = new Map(); // sessionId -> { baseUri, titleId, demoMode, createdAt, status }

  async function completeXboxAuthFlow(tokens) {
    const xbl = await authenticateXboxLive(tokens.access_token);
    const xstsGssv = await authorizeXsts(xbl.token, 'http://gssv.xboxlive.com/');
    let gamertag = xstsGssv.gamertag;
    if (!gamertag) {
      try {
        const xstsLive = await authorizeXsts(xbl.token, 'http://xboxlive.com');
        gamertag = xstsLive.gamertag;
      } catch {
        // Optional display enrichment
      }
    }
    const gssv = await loginGssv(xstsGssv.token, store.state.settings.public.accessCountry);
    let cloudTime = null;
    try {
      const { market } = normalizeLocaleMarket(store.state.settings.public.language);
      const xstsMp = await authorizeXsts(xbl.token, 'http://mp.microsoft.com/');
      cloudTime = await fetchCloudTime(xstsMp.uhs || xbl.uhs, xstsMp.token, market);
    } catch {
      cloudTime = { available: false, kind: 'none' };
    }

    const savedServer = store.state.settings.public.serverName;
    const chosenRegion =
      gssv.regions.find((r) => r.name === savedServer) ||
      gssv.regions.find((r) => r.isDefault) ||
      gssv.regions[0] ||
      null;

    store.state.auth = {
      demoMode: false,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
      xblToken: xbl.token,
      uhs: xbl.uhs,
      gamertag: gamertag || 'Xbox Player',
      gsToken: gssv.gsToken,
      gsExpiresAt: Date.now() + Number(gssv.durationInSeconds || 14400) * 1000,
      offeringId: gssv.offeringId,
      regions: gssv.regions,
      activeRegion: chosenRegion,
      cloudTime,
    };
    await store.save();
    return store.getSanitizedAuth();
  }

  function getActiveRegionBaseUri() {
    const auth = store.state.auth;
    if (!auth) return null;
    const preferred = store.state.settings.public.serverName;
    const match =
      auth.regions?.find((r) => r.name === preferred) ||
      auth.activeRegion ||
      auth.regions?.find((r) => r.isDefault) ||
      auth.regions?.[0];
    return match?.baseUri || null;
  }

  async function ensureFreshSessionAuth() {
    const auth = store.state.auth;
    if (!auth) throw Object.assign(new Error('Not signed in'), { httpStatus: 401 });
    if (auth.demoMode) return auth;
    if (Date.now() < (auth.gsExpiresAt || 0) - 60_000) return auth;
    if (!auth.refreshToken) throw Object.assign(new Error('Session expired'), { httpStatus: 401 });
    const refreshed = await refreshOAuthToken(auth.refreshToken, OAUTH_CONFIG.clientIdRef);
    await completeXboxAuthFlow(refreshed);
    return store.state.auth;
  }

  async function handleApi(req, res, url) {
    const pathname = url.pathname;
    const method = req.method;

    // Health check
    if (method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        app: 'XCloud4 Web Edition',
        version: store.state.settings.lab.enabled ? APP_IDENTITY.labVersion : APP_IDENTITY.publicVersion,
        time: new Date().toISOString(),
      });
    }

    // Read current state
    if (method === 'GET' && pathname === '/api/state') {
      const profile = resolveStreamProfile(store.state.settings);
      return sendJson(res, 200, {
        identity: APP_IDENTITY,
        auth: store.getSanitizedAuth(),
        settings: store.state.settings,
        activeProfile: profile,
        accessCountries: ACCESS_COUNTRIES,
        streamProfiles: STREAM_PROFILES,
        favorites: store.state.favorites,
        myGames: store.state.myGames,
        localRecents: store.state.localRecents,
      });
    }

    // Save public + lab settings
    if (method === 'POST' && pathname === '/api/settings') {
      const body = await readJsonBody(req);
      const curPub = store.state.settings.public;
      const curLab = store.state.settings.lab;

      if (body.public && typeof body.public === 'object') {
        const p = body.public;
        if (['720p', '1080p', '1080p-hq'].includes(p.quality)) curPub.quality = p.quality;
        if (typeof p.serverName === 'string' && p.serverName.length <= 64) curPub.serverName = p.serverName;
        if (ACCESS_COUNTRIES.some((c) => c.code === p.accessCountry)) curPub.accessCountry = p.accessCountry;
        if (['auto', 'es', 'en', 'pt-BR', 'fr', 'it', 'de'].includes(p.language)) curPub.language = p.language;
        if (typeof p.rememberSession === 'boolean') curPub.rememberSession = p.rememberSession;
        if (Number.isInteger(p.controllersCount) && p.controllersCount >= 1 && p.controllersCount <= 4) {
          curPub.controllersCount = p.controllersCount;
        }
        if (typeof p.multiplayerEnabled === 'boolean') curPub.multiplayerEnabled = p.multiplayerEnabled;
        if (typeof p.microphoneEnabled === 'boolean') curPub.microphoneEnabled = p.microphoneEnabled;
        if ([10, 20].includes(p.microphoneFrameMs)) curPub.microphoneFrameMs = p.microphoneFrameMs;
      }

      if (body.lab && typeof body.lab === 'object') {
        const l = body.lab;
        if (typeof l.enabled === 'boolean') curLab.enabled = l.enabled;
        if (STREAM_PROFILES[l.profile]) curLab.profile = l.profile;
        if (['auto', 'bt709', 'bt601'].includes(l.spsColor)) curLab.spsColor = l.spsColor;
        if (['auto', '1', '2'].includes(String(l.depth))) curLab.depth = String(l.depth);
        if (typeof l.gpuForceCpu === 'boolean') curLab.gpuForceCpu = l.gpuForceCpu;
        if (typeof l.input60hz === 'boolean') curLab.input60hz = l.input60hz;
        if (typeof l.rumbleEnabled === 'boolean') curLab.rumbleEnabled = l.rumbleEnabled;
        if (typeof l.audioEnabled === 'boolean') curLab.audioEnabled = l.audioEnabled;
        if (['auto', 'always', 'never', 'synced', 't27'].includes(l.vsync)) curLab.vsync = l.vsync;
        if (['smooth', 'nearest'].includes(l.convertMode)) curLab.convertMode = l.convertMode;
        if ([0, 1, 2].includes(l.sharpness)) curLab.sharpness = l.sharpness;
        if (typeof l.dither === 'boolean') curLab.dither = l.dither;
        if (typeof l.deband === 'boolean') curLab.deband = l.deband;
        if (['300ms', 'once', 'retry5s'].includes(l.resolutionCadence)) curLab.resolutionCadence = l.resolutionCadence;
        if (['', 'giroscopio.lua', 'sticks.lua', 'reasignar.lua', 'turbo.lua'].includes(l.scriptName)) {
          curLab.scriptName = l.scriptName;
        }
        if (typeof l.scriptWarningAccepted === 'boolean') curLab.scriptWarningAccepted = l.scriptWarningAccepted;
        if (['nack', 'rtx', 'flexfec'].includes(l.recoveryMode)) curLab.recoveryMode = l.recoveryMode;
        if ([0, 1, 3].includes(l.lossSim)) curLab.lossSim = l.lossSim;
        if (['t43', 't46b'].includes(l.nackPolicy)) curLab.nackPolicy = l.nackPolicy;
        if (['edge', 'zero', 'repaired'].includes(l.rrMode)) curLab.rrMode = l.rrMode;
        if (['off', 'fixed', 'adaptive'].includes(l.rembMode)) curLab.rembMode = l.rembMode;
        if ([10, 15, 20, 30].includes(l.rembFixedMbps)) curLab.rembFixedMbps = l.rembFixedMbps;
        if ([0.5, 0.85, 1.25, 1.6].includes(Number(l.gyroSensitivity))) curLab.gyroSensitivity = Number(l.gyroSensitivity);
        if ([0.04, 0.08, 0.12, 0.16].includes(Number(l.stickDeadzone))) curLab.stickDeadzone = Number(l.stickDeadzone);
        if ([5, 10, 15, 20].includes(Number(l.turboRateHz))) curLab.turboRateHz = Number(l.turboRateHz);
        if (['auto', 'on', 'off'].includes(l.touchOverlay)) curLab.touchOverlay = l.touchOverlay;
      }

      if (store.state.auth?.regions?.length) {
        const match =
          store.state.auth.regions.find((r) => r.name === curPub.serverName) ||
          store.state.auth.regions.find((r) => r.isDefault) ||
          store.state.auth.regions[0];
        store.state.auth.activeRegion = match;
      }

      await store.save();
      return sendJson(res, 200, {
        ok: true,
        settings: store.state.settings,
        activeProfile: resolveStreamProfile(store.state.settings),
        auth: store.getSanitizedAuth(),
      });
    }

    // Reset settings back to defaults (preserving Lab active flag if requested)
    if (method === 'POST' && pathname === '/api/settings/reset') {
      const body = await readJsonBody(req);
      const keepLabEnabled = Boolean(body?.keepLabEnabled && store.state.settings.lab.enabled);
      store.state.settings = structuredClone(DEFAULT_SETTINGS);
      store.state.settings.lab.enabled = keepLabEnabled;
      await store.save();
      return sendJson(res, 200, {
        ok: true,
        settings: store.state.settings,
        activeProfile: resolveStreamProfile(store.state.settings),
        auth: store.getSanitizedAuth(),
      });
    }

    // QR SVG helper endpoint
    if (method === 'GET' && pathname === '/api/qr.svg') {
      const text = url.searchParams.get('text') || 'https://www.microsoft.com/link';
      if (text.length > 200) return sendJson(res, 400, { error: 'QR text too long' });
      const svg = generateQrSvg(text);
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' });
      res.end(svg);
      return;
    }

    // Auth: request Microsoft Device Code
    if (method === 'POST' && pathname === '/api/auth/device-code') {
      try {
        const dc = await requestDeviceCode(OAUTH_CONFIG.clientIdRef);
        activeDeviceLogin = {
          deviceCode: dc.device_code,
          userCode: dc.user_code,
          verificationUri: dc.verification_uri || OAUTH_CONFIG.verificationUri,
          expiresAt: Date.now() + Number(dc.expires_in || 900) * 1000,
          intervalSec: Number(dc.interval || 5),
        };
        return sendJson(res, 200, {
          ok: true,
          userCode: activeDeviceLogin.userCode,
          verificationUri: activeDeviceLogin.verificationUri,
          expiresIn: Number(dc.expires_in || 900),
          interval: activeDeviceLogin.intervalSec,
        });
      } catch (err) {
        if (isNetworkUnreachableError(err)) {
          return sendJson(res, 503, {
            ok: false,
            sandboxUnavailable: true,
            error: 'Microsoft OAuth endpoint is unreachable in this restricted environment.',
          });
        }
        return sendJson(res, 502, { ok: false, error: err.message });
      }
    }

    // Auth: poll Device Token
    if (method === 'POST' && pathname === '/api/auth/poll') {
      if (!activeDeviceLogin || Date.now() > activeDeviceLogin.expiresAt) {
        return sendJson(res, 400, { ok: false, status: 'expired', error: 'Device code expired' });
      }
      try {
        const polled = await pollDeviceToken(activeDeviceLogin.deviceCode, OAUTH_CONFIG.clientIdRef);
        if (!polled.ok) {
          const errCode = polled.data?.error || 'unknown';
          if (errCode === 'authorization_pending' || errCode === 'slow_down') {
            return sendJson(res, 200, { ok: true, status: 'pending', errorCode: errCode });
          }
          activeDeviceLogin = null;
          return sendJson(res, 400, { ok: false, status: errCode, error: polled.data?.error_description || errCode });
        }
        activeDeviceLogin = null;
        const authSummary = await completeXboxAuthFlow(polled.data);
        return sendJson(res, 200, { ok: true, status: 'authorized', auth: authSummary });
      } catch (err) {
        return sendJson(res, 502, { ok: false, status: 'error', error: err.message, xerr: err.xerr || 0 });
      }
    }

    // Auth: explicit Sandbox Demo Sign-In (for inspecting signed-in flows when Microsoft egress is restricted)
    if (method === 'POST' && pathname === '/api/auth/demo') {
      const body = await readJsonBody(req);
      const gamertag = typeof body.gamertag === 'string' && body.gamertag.trim()
        ? body.gamertag.trim().slice(0, 24)
        : 'XCloud4Preview';
      const prefServer = store.state.settings.public.serverName;
      const activeRegion =
        FALLBACK_REGIONS.find((r) => r.name === prefServer) ||
        FALLBACK_REGIONS.find((r) => r.isDefault) ||
        FALLBACK_REGIONS[0];

      store.state.auth = {
        demoMode: true,
        gamertag,
        uhs: 'demo-sandbox',
        offeringId: 'xgpuweb',
        regions: FALLBACK_REGIONS,
        activeRegion,
        expiresAt: Date.now() + 86400_000,
        gsExpiresAt: Date.now() + 86400_000,
        cloudTime: {
          available: true,
          kind: 'account',
          remainingSeconds: 54 * 60,
          maxSeconds: 60 * 60,
          unlimited: false,
        },
      };
      // Seed one sample recent if empty so Home Continue/Recents showcases immediately
      if (Object.keys(store.state.localRecents).length === 0) {
        store.state.localRecents['9PP5G1F0C2B6'] = {
          productId: '9PP5G1F0C2B6',
          titleId: 'HaloInfinite',
          title: 'Halo Infinite',
          playTimeSec: 2760,
          lastPlayedAt: Date.now() - 3600_000 * 5,
        };
      }
      await store.save();
      return sendJson(res, 200, { ok: true, auth: store.getSanitizedAuth() });
    }

    // Auth: Logout / Forget
    if (method === 'POST' && pathname === '/api/auth/logout') {
      const body = await readJsonBody(req);
      store.state.auth = null;
      activeDeviceLogin = null;
      if (body.forget) {
        store.state.favorites = [];
        store.state.myGames = [];
        store.state.localRecents = {};
      }
      await store.save();
      return sendJson(res, 200, { ok: true, auth: store.getSanitizedAuth() });
    }

    // Public SIGL lists + DisplayCatalog metadata (live with graceful sandbox fallback)
    if (method === 'GET' && pathname === '/api/catalog/public-lists') {
      const { market, locale } = normalizeLocaleMarket(
        store.state.settings.public.language,
        url.searchParams.get('market'),
        url.searchParams.get('locale')
      );
      const cacheValid =
        siglCache.lists &&
        siglCache.market === market &&
        siglCache.locale === locale &&
        Date.now() - siglCache.ts < 5 * 60_000;

      if (cacheValid) {
        return sendJson(res, 200, siglCache.payload);
      }

      try {
        const [free, newest, popular, leaving] = await Promise.all([
          fetchSiglList(SIGL_GUIDS.free, market, locale),
          fetchSiglList(SIGL_GUIDS.new, market, locale),
          fetchSiglList(SIGL_GUIDS.popular, market, locale),
          fetchSiglList(SIGL_GUIDS.leaving, market, locale),
        ]);
        const uniqueIds = [...new Set([...free.slice(0, 16), ...newest.slice(0, 16), ...popular.slice(0, 16), ...leaving.slice(0, 16)])];
        const fetchedMeta = await fetchDisplayCatalogBatch(uniqueIds.slice(0, 32), market, locale);
        for (const [k, v] of Object.entries(fetchedMeta)) metaCache.set(k, v);
        const payload = {
          lists: { free, new: newest, popular, leaving },
          metadata: fetchedMeta,
          source: 'live',
          market,
          locale,
        };
        siglCache = { ts: Date.now(), market, locale, lists: payload.lists, payload };
        return sendJson(res, 200, payload);
      } catch (err) {
        const fallback = buildFallbackPublicLists();
        for (const [k, v] of Object.entries(fallback.metadata)) metaCache.set(k, v);
        return sendJson(res, 200, { ...fallback, market, locale, fallbackReason: err.message });
      }
    }

    // Full catalog (requires signed-in session; uses live GSSV /v2/titles or demo fallback)
    if (method === 'GET' && pathname === '/api/catalog') {
      const { market, locale } = normalizeLocaleMarket(store.state.settings.public.language);
      if (!store.state.auth) {
        const fallback = buildFallbackPublicLists();
        return sendJson(res, 200, {
          items: Object.values(fallback.metadata),
          source: 'public-preview',
          signedIn: false,
        });
      }
      if (store.state.auth.demoMode) {
        const map = buildFallbackCatalogMap();
        return sendJson(res, 200, {
          items: Object.values(map),
          source: 'sandbox-demo',
          signedIn: true,
        });
      }
      try {
        const auth = await ensureFreshSessionAuth();
        const baseUri = getActiveRegionBaseUri();
        const profile = resolveStreamProfile(store.state.settings);
        const rawTitles = await fetchCloudCatalog(baseUri, auth.gsToken, buildDeviceInfo(profile));
        const productIds = rawTitles.map((r) => r.details?.productId).filter(isValidProductId);
        const uncached = productIds.filter((id) => !metaCache.has(id)).slice(0, 24);
        if (uncached.length > 0) {
          const meta = await fetchDisplayCatalogBatch(uncached, market, locale);
          for (const [k, v] of Object.entries(meta)) metaCache.set(k, v);
        }
        const items = rawTitles.map((r) => {
          const pid = r.details?.productId || r.titleId;
          const m = metaCache.get(pid) || {};
          return {
            productId: pid,
            titleId: r.titleId,
            title: m.title || r.titleId,
            publisher: m.publisher || '',
            developer: m.developer || '',
            category: m.category || 'Other',
            year: m.year || '',
            releaseDate: m.releaseDate || '',
            ageRating: m.ageRating || '',
            freeToPlay: Boolean(r.details?.isFreeToPlay || pid === OAUTH_CONFIG.fortniteTitleId),
            attributes: m.attributes || [],
            shortDescription: m.shortDescription || '',
            description: m.description || '',
            coverUrl: m.coverUrl || '',
            heroUrl: m.heroUrl || m.coverUrl || '',
            posterUrl: m.posterUrl || m.coverUrl || '',
            screenshots: m.screenshots || [],
          };
        });
        return sendJson(res, 200, { items, source: 'live', signedIn: true });
      } catch (err) {
        return sendJson(res, err.httpStatus || 502, { ok: false, error: err.message });
      }
    }

    // MRU Recents + Local Recents merged
    if (method === 'GET' && pathname === '/api/catalog/recents') {
      const localList = Object.values(store.state.localRecents).sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
      if (!store.state.auth || store.state.auth.demoMode) {
        return sendJson(res, 200, {
          mru: localList.map((r) => r.productId),
          localRecents: store.state.localRecents,
          source: store.state.auth?.demoMode ? 'sandbox-demo' : 'local',
        });
      }
      try {
        const auth = await ensureFreshSessionAuth();
        const baseUri = getActiveRegionBaseUri();
        const profile = resolveStreamProfile(store.state.settings);
        const mruRaw = await fetchCloudMru(baseUri, auth.gsToken, buildDeviceInfo(profile));
        const mru = mruRaw.map((x) => x.details?.productId || x.titleId).filter(Boolean);
        return sendJson(res, 200, { mru, localRecents: store.state.localRecents, source: 'live' });
      } catch (err) {
        return sendJson(res, 200, {
          mru: localList.map((r) => r.productId),
          localRecents: store.state.localRecents,
          error: err.message,
        });
      }
    }

    // Product metadata details
    if (method === 'GET' && pathname.startsWith('/api/catalog/product/')) {
      const productId = pathname.slice('/api/catalog/product/'.length).trim();
      if (!isValidProductId(productId)) {
        return sendJson(res, 400, { error: 'Invalid product ID' });
      }
      if (metaCache.has(productId)) {
        return sendJson(res, 200, { item: metaCache.get(productId), source: 'cache' });
      }
      const { market, locale } = normalizeLocaleMarket(store.state.settings.public.language);
      try {
        const fetched = await fetchDisplayCatalogBatch([productId], market, locale);
        if (fetched[productId]) {
          metaCache.set(productId, fetched[productId]);
          return sendJson(res, 200, { item: fetched[productId], source: 'live' });
        }
      } catch {
        // Fallback below
      }
      const fallbackMap = buildFallbackCatalogMap();
      if (fallbackMap[productId]) {
        return sendJson(res, 200, { item: fallbackMap[productId], source: 'sandbox-fallback' });
      }
      return sendJson(res, 404, { error: 'Product not found' });
    }

    // Library mutations: Favorites, My Games, PlayTime
    if (method === 'POST' && pathname === '/api/library/favorite') {
      const body = await readJsonBody(req);
      const id = String(body.productId || '');
      if (!id || id.length > 64) return sendJson(res, 400, { error: 'Invalid productId' });
      const idx = store.state.favorites.indexOf(id);
      if (idx === -1) store.state.favorites.push(id);
      else store.state.favorites.splice(idx, 1);
      await store.save();
      return sendJson(res, 200, { favorites: store.state.favorites });
    }

    if (method === 'POST' && pathname === '/api/library/mygames') {
      const body = await readJsonBody(req);
      const id = String(body.productId || '');
      if (!id || id.length > 64) return sendJson(res, 400, { error: 'Invalid productId' });
      const idx = store.state.myGames.indexOf(id);
      if (idx === -1) store.state.myGames.push(id);
      else store.state.myGames.splice(idx, 1);
      await store.save();
      return sendJson(res, 200, { myGames: store.state.myGames });
    }

    if (method === 'POST' && pathname === '/api/library/playtime') {
      const body = await readJsonBody(req);
      const id = String(body.productId || '');
      const titleId = String(body.titleId || id);
      const deltaSec = Math.max(0, Math.min(86400, Math.round(Number(body.deltaSec || 0))));
      if (!id || id.length > 64) return sendJson(res, 400, { error: 'Invalid productId' });
      const prev = store.state.localRecents[id] || { productId: id, titleId, title: String(body.title || id), playTimeSec: 0 };
      store.state.localRecents[id] = {
        ...prev,
        titleId,
        title: typeof body.title === 'string' && body.title ? body.title : prev.title,
        playTimeSec: (prev.playTimeSec || 0) + deltaSec,
        lastPlayedAt: Date.now(),
      };
      await store.save();
      return sendJson(res, 200, { localRecents: store.state.localRecents });
    }

    // Cloud Time quota refresh
    if (method === 'GET' && pathname === '/api/account/cloud-time') {
      if (!store.state.auth) return sendJson(res, 401, { error: 'Not signed in' });
      if (store.state.auth.demoMode) {
        return sendJson(res, 200, { cloudTime: store.state.auth.cloudTime, demoMode: true });
      }
      try {
        const auth = await ensureFreshSessionAuth();
        const { market } = normalizeLocaleMarket(store.state.settings.public.language);
        const xstsMp = await authorizeXsts(auth.xblToken, 'http://mp.microsoft.com/');
        const ct = await fetchCloudTime(xstsMp.uhs || auth.uhs, xstsMp.token, market);
        store.state.auth.cloudTime = ct;
        await store.save();
        return sendJson(res, 200, { cloudTime: ct });
      } catch (err) {
        return sendJson(res, 502, { error: err.message });
      }
    }

    // Server Latency Probe
    if (method === 'GET' && pathname === '/api/servers/ping') {
      const regions = store.state.auth?.regions?.length ? store.state.auth.regions : FALLBACK_REGIONS;
      const results = await Promise.all(
        regions.map(async (r) => {
          const host = r.networkTestHostname || r.baseUri;
          const rttMs = store.state.auth?.demoMode ? null : await probeHostRttMs(host, 1800);
          return {
            name: r.name,
            continent: r.continent,
            isDefault: Boolean(r.isDefault),
            rttMs: rttMs ?? (r.simLatencyMs || null),
            simulated: rttMs === null && Boolean(r.simLatencyMs),
          };
        })
      );
      return sendJson(res, 200, { regions: results });
    }

    // Session Play / Lifecycle / WebRTC Signaling Relay
    if (method === 'POST' && pathname === '/api/session/play') {
      const body = await readJsonBody(req);
      const titleId = String(body.titleId || '');
      if (!isValidTitleId(titleId)) return sendJson(res, 400, { error: 'Invalid titleId' });
      if (!store.state.auth) return sendJson(res, 401, { error: 'Sign in required' });

      const profile = resolveStreamProfile(store.state.settings);
      const { locale } = normalizeLocaleMarket(store.state.settings.public.language);

      if (store.state.auth.demoMode) {
        const sid = `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        activeSessions.set(sid, {
          sessionId: sid,
          titleId,
          demoMode: true,
          createdAt: Date.now(),
          profile,
        });
        return sendJson(res, 200, {
          ok: true,
          demoMode: true,
          sessionId: sid,
          state: 'Provisioned',
          profile,
        });
      }

      try {
        const auth = await ensureFreshSessionAuth();
        const baseUri = getActiveRegionBaseUri();
        const deviceInfo = buildDeviceInfo(profile);
        const playBody = buildPlayBody(titleId, locale, profile);
        const resPlay = await gssvSessionRequest('POST', baseUri, '/v5/sessions/cloud/play', auth.gsToken, deviceInfo, playBody);
        if (!resPlay.ok || !resPlay.json?.sessionPath) {
          return sendJson(res, resPlay.status || 502, {
            ok: false,
            error: resPlay.json?.errorDetails?.message || resPlay.json?.message || 'Play request failed',
            code: resPlay.json?.errorDetails?.code || '',
            details: resPlay.json,
          });
        }
        const sessionId = String(resPlay.json.sessionPath).split('/').filter(Boolean).pop();
        if (!isValidSessionId(sessionId)) {
          return sendJson(res, 502, { ok: false, error: 'Invalid sessionPath returned by Xbox' });
        }
        activeSessions.set(sessionId, {
          sessionId,
          titleId,
          baseUri,
          demoMode: false,
          createdAt: Date.now(),
          profile,
        });
        return sendJson(res, 200, { ok: true, demoMode: false, sessionId, profile });
      } catch (err) {
        return sendJson(res, err.httpStatus || 502, { ok: false, error: err.message });
      }
    }

    // WaitTime ETA
    if (method === 'GET' && pathname.startsWith('/api/session/waittime/')) {
      const titleId = pathname.slice('/api/session/waittime/'.length);
      if (!isValidTitleId(titleId)) return sendJson(res, 400, { error: 'Invalid titleId' });
      if (store.state.auth?.demoMode) return sendJson(res, 200, { estimatedTotalWaitTimeInSeconds: 0 });
      try {
        const auth = await ensureFreshSessionAuth();
        const baseUri = getActiveRegionBaseUri();
        const deviceInfo = buildDeviceInfo(resolveStreamProfile(store.state.settings));
        const r = await gssvSessionRequest('GET', baseUri, `/v1/waittime/${titleId}`, auth.gsToken, deviceInfo);
        return sendJson(res, r.status || 200, r.json || {});
      } catch (err) {
        return sendJson(res, 502, { error: err.message });
      }
    }

    // Session routes: /api/session/:id/(state|connect|sdp|ice|keepalive) and DELETE /api/session/:id
    const sessionMatch = pathname.match(/^\/api\/session\/([A-Za-z0-9_-]{1,128})(?:\/(state|connect|sdp|ice|keepalive))?$/);
    if (sessionMatch) {
      const [, sessionId, sub] = sessionMatch;
      if (!isValidSessionId(sessionId)) return sendJson(res, 400, { error: 'Invalid sessionId' });
      const sess = activeSessions.get(sessionId);
      if (!sess) return sendJson(res, 404, { error: 'Unknown session' });

      if (sess.demoMode) {
        if (method === 'DELETE' && !sub) {
          activeSessions.delete(sessionId);
          return sendJson(res, 200, { ok: true });
        }
        return sendJson(res, 200, {
          ok: true,
          demoMode: true,
          state: 'Provisioned',
          exchangeResponse: { sdp: '', candidates: [] },
        });
      }

      try {
        const auth = await ensureFreshSessionAuth();
        const deviceInfo = buildDeviceInfo(sess.profile);
        if (method === 'DELETE' && !sub) {
          const r = await gssvSessionRequest('DELETE', sess.baseUri, `/v5/sessions/cloud/${sessionId}`, auth.gsToken, deviceInfo);
          activeSessions.delete(sessionId);
          return sendJson(res, r.status || 200, { ok: r.ok });
        }
        if (method === 'GET' && sub === 'state') {
          const r = await gssvSessionRequest('GET', sess.baseUri, `/v5/sessions/cloud/${sessionId}/state`, auth.gsToken, deviceInfo);
          return sendJson(res, r.status || 200, r.json || {});
        }
        if (method === 'POST' && sub === 'connect') {
          const passportToken = await requestConsoleTransferToken(auth.refreshToken, OAUTH_CONFIG.clientIdRef);
          const r = await gssvSessionRequest(
            'POST',
            sess.baseUri,
            `/v5/sessions/cloud/${sessionId}/connect`,
            auth.gsToken,
            deviceInfo,
            JSON.stringify({ userToken: passportToken })
          );
          return sendJson(res, r.status || 200, r.json || { status: r.status });
        }
        if (method === 'POST' && sub === 'sdp') {
          const body = await readJsonBody(req);
          const payload = {
            messageType: 'offer',
            sdp: body.sdp,
            requestId: '1',
            configuration: {
              chatConfiguration: { format: 'opus', maxChannels: 1, minVersion: 1, maxVersion: 1 },
              control: { minVersion: 1, maxVersion: 3 },
              input: { minVersion: 1, maxVersion: 9 },
              message: { minVersion: 1, maxVersion: 1 },
              reliableinput: { minVersion: 1, maxVersion: 9 },
              unreliableinput: { minVersion: 1, maxVersion: 9 },
            },
          };
          const r = await gssvSessionRequest('POST', sess.baseUri, `/v5/sessions/cloud/${sessionId}/sdp`, auth.gsToken, deviceInfo, payload);
          return sendJson(res, r.status || 200, r.json || {});
        }
        if (method === 'GET' && sub === 'sdp') {
          const r = await gssvSessionRequest('GET', sess.baseUri, `/v5/sessions/cloud/${sessionId}/sdp`, auth.gsToken, deviceInfo);
          if (r.status === 204) return sendJson(res, 200, { pending: true });
          return sendJson(res, r.status || 200, r.json || {});
        }
        if (method === 'POST' && sub === 'ice') {
          const body = await readJsonBody(req);
          const candidates = Array.isArray(body.candidates) ? body.candidates : [];
          const payload = {
            messageType: 'iceCandidate',
            candidates: candidates.map((c) => (typeof c === 'string' ? c : JSON.stringify(c))),
            requestId: '1',
          };
          const r = await gssvSessionRequest('POST', sess.baseUri, `/v5/sessions/cloud/${sessionId}/ice`, auth.gsToken, deviceInfo, payload);
          return sendJson(res, r.status || 200, r.json || {});
        }
        if (method === 'GET' && sub === 'ice') {
          const r = await gssvSessionRequest('GET', sess.baseUri, `/v5/sessions/cloud/${sessionId}/ice`, auth.gsToken, deviceInfo);
          if (r.status === 204) return sendJson(res, 200, { pending: true, candidates: [] });
          return sendJson(res, r.status || 200, r.json || {});
        }
        if (method === 'POST' && sub === 'keepalive') {
          const r = await gssvSessionRequest('POST', sess.baseUri, `/v5/sessions/cloud/${sessionId}/keepalive`, auth.gsToken, deviceInfo, '');
          return sendJson(res, r.status || 200, r.json || { ok: r.ok });
        }
      } catch (err) {
        return sendJson(res, err.httpStatus || 502, { ok: false, error: err.message });
      }
    }

    // GitHub Updates check (live against api.github.com/repos/asp11edgr/XCloud4/releases!)
    if (method === 'GET' && pathname === '/api/updates/check') {
      const lab = store.state.settings.lab.enabled;
      const targetUrl = lab ? APP_IDENTITY.releasesUrlLab : APP_IDENTITY.releasesUrlPublic;
      const currentVer = lab ? APP_IDENTITY.labVersion : APP_IDENTITY.publicVersion;
      try {
        const resGh = await fetch(targetUrl, {
          headers: {
            'User-Agent': `XCloud4/${currentVer}`,
            Accept: 'application/vnd.github+json',
          },
        });
        if (!resGh.ok) {
          return sendJson(res, 502, { ok: false, error: `GitHub HTTP ${resGh.status}` });
        }
        const data = await resGh.json();
        const release = Array.isArray(data) ? data[0] : data;
        const latestTag = release?.tag_name || currentVer;
        const cleanLatest = latestTag.replace(/^v/i, '');
        return sendJson(res, 200, {
          ok: true,
          currentVersion: currentVer,
          latestTag,
          isLatest: cleanLatest === currentVer,
          htmlUrl: release?.html_url || `${APP_IDENTITY.sourceUrl}/releases`,
          publishedAt: release?.published_at || '',
          name: release?.name || latestTag,
        });
      } catch (err) {
        return sendJson(res, 502, { ok: false, error: err.message });
      }
    }

    // Bespoke SVG fallback artwork
    if (method === 'GET' && pathname.startsWith('/api/artwork/')) {
      const parts = pathname.slice('/api/artwork/'.length).split('/');
      const productId = parts[0] || '';
      const kind = parts[1] || 'cover.svg';
      if (!isValidProductId(productId)) return sendJson(res, 400, { error: 'Invalid productId' });
      const svg = renderFallbackArtworkSvg(productId, kind);
      res.writeHead(200, {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(svg);
      return;
    }

    // Retained third-party license reader
    if (method === 'GET' && pathname === '/api/licenses') {
      const licDir = path.join(REPO_ROOT, 'docs', 'licenses');
      try {
        const files = (await fs.readdir(licDir)).filter((f) => !f.startsWith('.')).sort();
        const entries = await Promise.all(
          files.map(async (file) => ({
            name: file,
            text: await fs.readFile(path.join(licDir, file), 'utf8'),
          }))
        );
        return sendJson(res, 200, { licenses: entries });
      } catch {
        return sendJson(res, 200, { licenses: [] });
      }
    }

    return sendJson(res, 404, { error: 'API route not found' });
  }

  async function serveStatic(req, res, url) {
    let relPath = decodeURIComponent(url.pathname);
    if (relPath === '/') relPath = '/index.html';
    const resolved = path.resolve(publicDir, '.' + relPath);
    if (!resolved.startsWith(path.resolve(publicDir) + path.sep) && resolved !== path.resolve(publicDir, 'index.html')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    try {
      const st = await fs.stat(resolved);
      const targetFile = st.isDirectory() ? path.join(resolved, 'index.html') : resolved;
      const ext = path.extname(targetFile).toLowerCase();
      const data = await fs.readFile(targetFile);
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.ttf' || ext === '.png' ? 'public, max-age=86400' : 'no-cache',
      });
      res.end(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback for client routes
        if (!path.extname(relPath)) {
          const indexData = await fs.readFile(path.join(publicDir, 'index.html'));
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
          res.end(indexData);
          return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
      } else {
        await serveStatic(req, res, url);
      }
    } catch (err) {
      console.error('[Server] Request error:', err);
      if (!res.headersSent) {
        sendJson(res, err.httpStatus || 500, { ok: false, error: err.message || 'Internal error' });
      }
    }
  });

  return { server, store, FALLBACK_TITLES, DEFAULT_SETTINGS };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  const { server } = await createAppServer();
  server.listen(port, host, () => {
    console.log(`XCloud4 Web Edition listening on http://${host}:${port}`);
  });
}
