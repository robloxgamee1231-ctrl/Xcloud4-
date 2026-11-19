/* SPDX-License-Identifier: GPL-3.0-only */
/* Browser-side LocalStorage, Microsoft OAuth2, Xbox GSSV WebRTC signaling, and static-hosting backend (zero redirects, zero demo). */

import { appUrl, getCorsProxyUrl } from './paths.js';
import {
  FALLBACK_REGIONS,
  buildFallbackCatalogMap,
  buildStaticPublicLists,
  renderFallbackArtworkDataUrl,
} from './fallback-catalog.js';
import {
  normalizeLocaleMarket,
  isValidProductId,
  fetchFullXboxCatalogSnapshot,
  fetchDisplayCatalogChunks,
} from './xbox-catalog.js';

const STORAGE_KEY = 'xcloud4_static_state_v1';
const CATALOG_CACHE_TTL_MS = 10 * 60_000;

const MS_OAUTH_CLIENT_ID = '1f907974-e22b-4810-a9de-d9647380c97e';
const MS_OAUTH_SCOPE = 'xboxlive.signin openid profile offline_access';
const PASSPORT_SCOPE = 'service::http://Passport.NET/purpose::PURPOSE_XBOX_CLOUD_CONSOLE_TRANSFER_TOKEN';
const XBOX_ACCESS_KEY = '4BDB3609-C1F1-4195-9B37-FEFF45DA8B8E';

let activeDeviceLogin = null;
const activeStaticSessions = new Map();
let catalogCache = {
  ts: 0,
  market: '',
  locale: '',
  source: '',
  lists: null,
  metadata: null,
  allHydrated: false,
};
let inflightInitial = null;
let inflightHydrate = null;

export function resetStaticCatalogCache() {
  catalogCache = {
    ts: 0,
    market: '',
    locale: '',
    source: '',
    lists: null,
    metadata: null,
    allHydrated: false,
  };
  inflightInitial = null;
  inflightHydrate = null;
  activeDeviceLogin = null;
  activeStaticSessions.clear();
}

async function xboxFetch(url, options = {}) {
  const proxyUrl = getCorsProxyUrl();
  if (proxyUrl) {
    return fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: typeof options.body === 'string' ? options.body : undefined,
      }),
    });
  }
  return fetch(url, options);
}

function decodeJwtClaims(jwt) {
  try {
    const parts = String(jwt || '').split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch {
    return null;
  }
}

function buildStaticDeviceInfo(profile) {
  const p = profile || STREAM_PROFILES['1080p-HQ'];
  if (p.id === '720p60') {
    return JSON.stringify({
      appInfo: { env: { clientAppId: 'XCloud4', clientAppType: 'native', clientAppVersion: '0.6.2', httpEnvironment: 'prod' } },
      dev: { hw: { make: 'Microsoft', model: 'Xbox One' }, os: { name: 'windows', platform: 'console' } },
    });
  }
  if (p.id === '1080p-H') {
    return JSON.stringify({
      appInfo: { env: { clientAppId: 'XCloud4', clientAppType: 'native', clientAppVersion: '0.7.33', httpEnvironment: 'prod' } },
      dev: { hw: { make: 'Sony', model: 'PS4' }, os: { name: 'windows', platform: 'console' } },
    });
  }
  return JSON.stringify({
    appInfo: {
      env: {
        clientAppId: 'www.xbox.com',
        clientAppType: 'browser',
        clientAppVersion: '26.1.97',
        clientSdkVersion: '10.3.7',
        httpEnvironment: 'prod',
        sdkInstallId: '',
      },
    },
    dev: {
      os: { name: 'windows', ver: '22631.2715', platform: 'desktop' },
      hw: { make: 'Microsoft', model: 'unknown', sdktype: 'web' },
      browser: { browserName: 'chrome', browserVersion: '140.0.3485.54' },
      displayInfo: { dimensions: { widthInPixels: 4096, heightInPixels: 2160 }, pixelDensity: { dpiX: 1, dpiY: 1 } },
    },
  });
}

function getCountryIp(code) {
  return ACCESS_COUNTRIES.find((c) => c.code === code)?.ip || null;
}

async function tryBrowserXboxAuthExchange(accessToken, refreshToken = '', accessCountry = 'Auto') {
  const xblRes = await xboxFetch('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-xbl-contract-version': '1' },
    body: JSON.stringify({
      Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${accessToken}` },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    }),
  });
  if (!xblRes.ok) throw new Error(`XBL HTTP ${xblRes.status}`);
  const xbl = await xblRes.json();
  const xblToken = xbl?.Token;
  const uhs = xbl?.DisplayClaims?.xui?.[0]?.uhs || '';
  if (!xblToken) throw new Error('Missing XBL token');

  const authorizeRelyingParty = async (rp) => {
    const r = await xboxFetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-xbl-contract-version': '1' },
      body: JSON.stringify({
        Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
        RelyingParty: rp,
        TokenType: 'JWT',
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.Token) {
      throw Object.assign(new Error(`XSTS HTTP ${r.status}`), { xerr: Number(data?.XErr || 0) });
    }
    const xui = data?.DisplayClaims?.xui?.[0] || {};
    return { token: data.Token, uhs: xui.uhs || uhs, gtg: xui.gtg || xui.mgt || '' };
  };

  const xstsGssv = await authorizeRelyingParty('http://gssv.xboxlive.com/');
  let gamertag = xstsGssv.gtg || '';
  if (!gamertag) {
    try {
      const xstsLive = await authorizeRelyingParty('http://xboxlive.com');
      gamertag = xstsLive.gtg || '';
    } catch {
      // Optional gamertag claim
    }
  }

  const xffIp = getCountryIp(accessCountry);
  for (const offeringId of ['xgpuweb', 'xgpuwebf2p']) {
    const headers = { 'Content-Type': 'application/json', 'x-gssv-client': 'XboxComBrowser' };
    if (xffIp) headers['X-Forwarded-For'] = xffIp;
    const gRes = await xboxFetch(`https://${offeringId}.gssv-play-prod.xboxlive.com/v2/login/user`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token: xstsGssv.token, offeringId }),
    });
    if (gRes.ok) {
      const g = await gRes.json();
      if (g?.gsToken) {
        return {
          provider: 'xbox',
          liveStream: true,
          gamertag: gamertag || 'Xbox Player',
          uhs: xstsGssv.uhs,
          xblToken,
          refreshToken,
          gsToken: g.gsToken,
          gsExpiresAt: Date.now() + Number(g.durationInSeconds || 14400) * 1000,
          offeringId: g.offeringSettings?.offeringId || offeringId,
          regions: Array.isArray(g.offeringSettings?.regions) ? g.offeringSettings.regions : FALLBACK_REGIONS,
        };
      }
    }
  }
  throw new Error('GSSV login failed');
}

async function gssvRequest(method, baseUri, endpoint, gsToken, deviceInfo, body = null) {
  const headers = {
    Authorization: `Bearer ${gsToken}`,
    'X-MS-Device-Info': deviceInfo,
    Accept: 'application/json',
  };
  const init = { method, headers };
  if (body !== null && body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await xboxFetch(`${baseUri}${endpoint}`, init);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, json, text };
}

async function fetchDeployedSnapshot() {
  const res = await fetch(appUrl('data/xbox-catalog.json'), { method: 'GET' });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.metadata || Object.keys(data.metadata).length === 0) return null;
  return data;
}

async function ensureStaticCatalog({ market, locale, hydrateAll = false } = {}) {
  const fresh =
    catalogCache.metadata &&
    catalogCache.market === market &&
    catalogCache.locale === locale &&
    Date.now() - catalogCache.ts < CATALOG_CACHE_TTL_MS;

  if (fresh && (!hydrateAll || catalogCache.allHydrated)) {
    return catalogCache;
  }

  if (!fresh) {
    if (!inflightInitial) {
      inflightInitial = (async () => {
        try {
          const live = await fetchFullXboxCatalogSnapshot({
            market,
            locale,
            includeAll: false,
            initialLimit: 48,
            concurrency: 5,
            timeoutMs: 12000,
          });
          catalogCache = {
            ts: Date.now(),
            market,
            locale,
            source: 'live',
            lists: live.lists,
            metadata: { ...live.metadata },
            allHydrated: (live.lists?.all?.length || 0) <= Object.keys(live.metadata).length,
          };
          return catalogCache;
        } catch {
          try {
            const snap = await fetchDeployedSnapshot();
            if (snap) {
              catalogCache = {
                ts: Date.now(),
                market,
                locale,
                source: snap.source || 'live-snapshot',
                lists: snap.lists || { free: [], new: [], popular: [], leaving: [], all: Object.keys(snap.metadata) },
                metadata: { ...snap.metadata },
                allHydrated: true,
              };
              return catalogCache;
            }
          } catch {
            // Fall through to Tier 3
          }
          const fb = buildStaticPublicLists();
          catalogCache = {
            ts: Date.now(),
            market,
            locale,
            source: 'offline-fallback',
            lists: fb.lists,
            metadata: fb.metadata,
            allHydrated: true,
          };
          return catalogCache;
        } finally {
          inflightInitial = null;
        }
      })();
    }
    await inflightInitial;
  }

  if (
    hydrateAll &&
    !catalogCache.allHydrated &&
    catalogCache.source === 'live' &&
    Array.isArray(catalogCache.lists?.all)
  ) {
    if (!inflightHydrate) {
      inflightHydrate = (async () => {
        try {
          const missing = catalogCache.lists.all.filter((id) => !catalogCache.metadata[id]);
          if (missing.length > 0) {
            const freeSet = new Set(catalogCache.lists.free || []);
            const extra = await fetchDisplayCatalogChunks(missing, market, locale, {
              freeSet,
              chunkSize: 20,
              concurrency: 6,
              timeoutMs: 14000,
            });
            Object.assign(catalogCache.metadata, extra);
          }
          catalogCache.allHydrated = true;
        } finally {
          inflightHydrate = null;
        }
      })();
    }
    await inflightHydrate;
  }

  return catalogCache;
}

const APP_IDENTITY = {
  publicVersion: '1.3.0-beta',
  labVersion: '0.7.111-lab',
  developer: 'ASAP_EDGR',
  license: 'GPL-3.0',
  sourceUrl: 'https://github.com/asp11edgr/XCloud4',
  supportUrl: 'https://ko-fi.com/asapedgr',
  releasesUrlPublic: 'https://api.github.com/repos/asp11edgr/XCloud4/releases/latest',
  releasesUrlLab: 'https://api.github.com/repos/asp11edgr/XCloud4/releases?per_page=10',
};

const ACCESS_COUNTRIES = [
  { code: 'Auto', nameKey: 'X4_TR_AUTO', ip: null },
  { code: 'US', name: 'United States', ip: '143.244.47.65' },
  { code: 'BR', name: 'Brazil', ip: '169.150.198.66' },
  { code: 'JP', name: 'Japan', ip: '138.199.21.239' },
  { code: 'KR', name: 'South Korea', ip: '121.125.60.151' },
  { code: 'PL', name: 'Poland', ip: '45.134.212.66' },
];

const STREAM_PROFILES = {
  '720p60': { id: '720p60', label: '720p60', width: 1280, height: 720, fps: 60, bitrateKbps: 9000, resolutionAlias: null },
  '720p-HQ': { id: '720p-HQ', label: '720p-HQ', width: 1280, height: 720, fps: 60, bitrateKbps: 12000, resolutionAlias: '720HQ' },
  '1080p-G': { id: '1080p-G', label: '1080p-G', width: 1920, height: 1080, fps: 60, bitrateKbps: 12000, resolutionAlias: '1080' },
  '1080p-G8': { id: '1080p-G8', label: '1080p-G8', width: 1920, height: 1080, fps: 60, bitrateKbps: 12000, resolutionAlias: '1080' },
  '1080p-H': { id: '1080p-H', label: '1080p-H', width: 1920, height: 1080, fps: 60, bitrateKbps: 15000, resolutionAlias: '1080' },
  '1080p-HQ': { id: '1080p-HQ', label: '1080p-HQ', width: 1920, height: 1080, fps: 60, bitrateKbps: 18000, resolutionAlias: '1080HQ' },
};

const DEFAULT_SETTINGS = {
  public: {
    quality: '1080p-hq',
    serverName: 'Auto',
    accessCountry: 'Auto',
    language: 'auto',
    rememberSession: true,
    controllersCount: 1,
    multiplayerEnabled: false,
    microphoneEnabled: false,
    microphoneFrameMs: 20,
  },
  lab: {
    enabled: false,
    profile: '1080p-HQ',
    spsColor: 'auto',
    depth: 'auto',
    gpuForceCpu: false,
    input60hz: false,
    rumbleEnabled: true,
    audioEnabled: true,
    vsync: 'auto',
    convertMode: 'smooth',
    sharpness: 1,
    dither: true,
    deband: true,
    resolutionCadence: '300ms',
    scriptName: '',
    scriptWarningAccepted: false,
    recoveryMode: 'nack',
    lossSim: 0,
    nackPolicy: 't46b',
    rrMode: 'edge',
    rembMode: 'adaptive',
    rembFixedMbps: 20,
    gyroSensitivity: 0.85,
    stickDeadzone: 0.08,
    turboRateHz: 10,
    touchOverlay: 'auto',
  },
};

const LICENSE_FILES = [
  'AMD_FidelityFX_CAS.txt',
  'Better-xCloud-MIT-LICENSE.txt',
  'Inter-OFL.txt',
  'JoyShockMapper-MIT.txt',
  'Lua-MIT.txt',
  'NotoSans-OFL.txt',
  'Tabler-Icons-MIT.txt',
  'qrcodegen-MIT.txt',
];

function resolveProfile(settings) {
  if (settings?.lab?.enabled && STREAM_PROFILES[settings.lab.profile]) {
    return STREAM_PROFILES[settings.lab.profile];
  }
  const q = settings?.public?.quality || '1080p-hq';
  if (q === '720p') return STREAM_PROFILES['720p60'];
  if (q === '1080p') return STREAM_PROFILES['1080p-G8'];
  return STREAM_PROFILES['1080p-HQ'];
}

function defaultState() {
  return {
    auth: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    favorites: [],
    myGames: [],
    localRecents: {},
  };
}

function readLocalState() {
  try {
    if (typeof localStorage === 'undefined') return defaultState();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      ...defaultState(),
      ...parsed,
      settings: {
        public: { ...DEFAULT_SETTINGS.public, ...(parsed.settings?.public || {}) },
        lab: { ...DEFAULT_SETTINGS.lab, ...(parsed.settings?.lab || {}) },
      },
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      myGames: Array.isArray(parsed.myGames) ? parsed.myGames : [],
      localRecents: parsed.localRecents && typeof parsed.localRecents === 'object' ? parsed.localRecents : {},
    };
  } catch {
    return defaultState();
  }
}

function writeLocalState(st) {
  try {
    if (typeof localStorage === 'undefined') return;
    const snap = structuredClone(st);
    if (snap.settings?.public?.rememberSession === false) snap.auth = null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    // Ignore storage quota errors
  }
}

function sanitizeAuth(auth) {
  if (!auth) return { signedIn: false };
  return {
    signedIn: true,
    liveStream: Boolean(auth.gsToken),
    provider: auth.provider || 'microsoft',
    gamertag: auth.gamertag || 'Xbox Player',
    email: auth.email || '',
    uhs: auth.uhs || '',
    offeringId: auth.offeringId || 'xgpuweb',
    regions: Array.isArray(auth.regions) ? auth.regions : FALLBACK_REGIONS,
    activeRegion: auth.activeRegion || FALLBACK_REGIONS[0],
    expiresAt: auth.expiresAt || Date.now() + 3600_000,
    hasRefreshToken: Boolean(auth.refreshToken),
    cloudTime: auth.cloudTime || null,
  };
}

async function ensureStaticGssvAuth() {
  const st = readLocalState();
  if (!st.auth) throw Object.assign(new Error('Not signed in'), { status: 401 });
  if (st.auth.gsToken && Date.now() < (st.auth.gsExpiresAt || 0) - 60_000) {
    return { st, auth: st.auth };
  }
  if (st.auth.refreshToken) {
    try {
      const refRes = await xboxFetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: MS_OAUTH_CLIENT_ID,
          refresh_token: st.auth.refreshToken,
          scope: MS_OAUTH_SCOPE,
        }).toString(),
      });
      if (refRes.ok) {
        const tokens = await refRes.json();
        const xbx = await tryBrowserXboxAuthExchange(
          tokens.access_token,
          tokens.refresh_token || st.auth.refreshToken,
          st.settings?.public?.accessCountry || 'Auto'
        );
        const activeRegion =
          xbx.regions.find((r) => r.name === st.settings.public.serverName) ||
          xbx.regions.find((r) => r.isDefault) ||
          xbx.regions[0] ||
          null;
        st.auth = {
          ...st.auth,
          ...xbx,
          activeRegion,
          expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
        };
        writeLocalState(st);
        return { st, auth: st.auth };
      }
    } catch {
      // Fall through
    }
  }
  throw Object.assign(
    new Error('Xbox Cloud WebRTC requires an XCloud4 Relay (Node server or Cloudflare CORS Relay) so Xbox GSSV signaling works inside the site.'),
    { status: 401, payload: { relayRequired: true } }
  );
}

async function probeRegionBrowserRttMs(host, timeoutMs = 1800) {
  const cleanHost = String(host || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (!cleanHost) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    await fetch(`https://${cleanHost}/`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return Math.max(1, Math.round(end - start));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const staticBackend = {
  async getState() {
    const st = readLocalState();
    return {
      identity: APP_IDENTITY,
      auth: sanitizeAuth(st.auth),
      settings: st.settings,
      activeProfile: resolveProfile(st.settings),
      accessCountries: ACCESS_COUNTRIES,
      streamProfiles: STREAM_PROFILES,
      favorites: st.favorites,
      myGames: st.myGames,
      localRecents: st.localRecents,
      staticSiteMode: true,
    };
  },

  async saveSettings(payload) {
    const st = readLocalState();
    if (payload?.public && typeof payload.public === 'object') {
      const p = payload.public;
      if (['720p', '1080p', '1080p-hq'].includes(p.quality)) st.settings.public.quality = p.quality;
      if (typeof p.serverName === 'string' && p.serverName.length <= 64) st.settings.public.serverName = p.serverName;
      if (ACCESS_COUNTRIES.some((c) => c.code === p.accessCountry)) st.settings.public.accessCountry = p.accessCountry;
      if (['auto', 'es', 'en', 'pt-BR', 'fr', 'it', 'de'].includes(p.language)) st.settings.public.language = p.language;
      if (typeof p.rememberSession === 'boolean') st.settings.public.rememberSession = p.rememberSession;
      if (Number.isInteger(p.controllersCount) && p.controllersCount >= 1 && p.controllersCount <= 4) {
        st.settings.public.controllersCount = p.controllersCount;
      }
      if (typeof p.multiplayerEnabled === 'boolean') st.settings.public.multiplayerEnabled = p.multiplayerEnabled;
      if (typeof p.microphoneEnabled === 'boolean') st.settings.public.microphoneEnabled = p.microphoneEnabled;
      if ([10, 20].includes(p.microphoneFrameMs)) st.settings.public.microphoneFrameMs = p.microphoneFrameMs;
    }
    if (payload?.lab && typeof payload.lab === 'object') {
      const l = payload.lab;
      if (typeof l.enabled === 'boolean') st.settings.lab.enabled = l.enabled;
      if (STREAM_PROFILES[l.profile]) st.settings.lab.profile = l.profile;
      if (['auto', 'bt709', 'bt601'].includes(l.spsColor)) st.settings.lab.spsColor = l.spsColor;
      if (['auto', '1', '2'].includes(String(l.depth))) st.settings.lab.depth = String(l.depth);
      if (typeof l.gpuForceCpu === 'boolean') st.settings.lab.gpuForceCpu = l.gpuForceCpu;
      if (typeof l.input60hz === 'boolean') st.settings.lab.input60hz = l.input60hz;
      if (typeof l.rumbleEnabled === 'boolean') st.settings.lab.rumbleEnabled = l.rumbleEnabled;
      if (typeof l.audioEnabled === 'boolean') st.settings.lab.audioEnabled = l.audioEnabled;
      if (['auto', 'always', 'never', 'synced', 't27'].includes(l.vsync)) st.settings.lab.vsync = l.vsync;
      if (['smooth', 'nearest'].includes(l.convertMode)) st.settings.lab.convertMode = l.convertMode;
      if ([0, 1, 2].includes(l.sharpness)) st.settings.lab.sharpness = l.sharpness;
      if (typeof l.dither === 'boolean') st.settings.lab.dither = l.dither;
      if (typeof l.deband === 'boolean') st.settings.lab.deband = l.deband;
      if (['300ms', 'once', 'retry5s'].includes(l.resolutionCadence)) st.settings.lab.resolutionCadence = l.resolutionCadence;
      if (['', 'giroscopio.lua', 'sticks.lua', 'reasignar.lua', 'turbo.lua'].includes(l.scriptName)) {
        st.settings.lab.scriptName = l.scriptName;
      }
      if (typeof l.scriptWarningAccepted === 'boolean') st.settings.lab.scriptWarningAccepted = l.scriptWarningAccepted;
      if (['nack', 'rtx', 'flexfec'].includes(l.recoveryMode)) st.settings.lab.recoveryMode = l.recoveryMode;
      if ([0, 1, 3].includes(l.lossSim)) st.settings.lab.lossSim = l.lossSim;
      if (['t43', 't46b'].includes(l.nackPolicy)) st.settings.lab.nackPolicy = l.nackPolicy;
      if (['edge', 'zero', 'repaired'].includes(l.rrMode)) st.settings.lab.rrMode = l.rrMode;
      if (['off', 'fixed', 'adaptive'].includes(l.rembMode)) st.settings.lab.rembMode = l.rembMode;
      if ([10, 15, 20, 30].includes(l.rembFixedMbps)) st.settings.lab.rembFixedMbps = l.rembFixedMbps;
      if ([0.5, 0.85, 1.25, 1.6].includes(Number(l.gyroSensitivity))) st.settings.lab.gyroSensitivity = Number(l.gyroSensitivity);
      if ([0.04, 0.08, 0.12, 0.16].includes(Number(l.stickDeadzone))) st.settings.lab.stickDeadzone = Number(l.stickDeadzone);
      if ([5, 10, 15, 20].includes(Number(l.turboRateHz))) st.settings.lab.turboRateHz = Number(l.turboRateHz);
      if (['auto', 'on', 'off'].includes(l.touchOverlay)) st.settings.lab.touchOverlay = l.touchOverlay;
    }
    if (st.auth?.regions?.length) {
      st.auth.activeRegion =
        st.auth.regions.find((r) => r.name === st.settings.public.serverName) ||
        st.auth.regions.find((r) => r.isDefault) ||
        st.auth.regions[0];
    }
    writeLocalState(st);
    return {
      ok: true,
      settings: st.settings,
      activeProfile: resolveProfile(st.settings),
      auth: sanitizeAuth(st.auth),
    };
  },

  async resetSettings(keepLabEnabled = false) {
    const st = readLocalState();
    const keepLab = Boolean(keepLabEnabled && st.settings.lab.enabled);
    st.settings = structuredClone(DEFAULT_SETTINGS);
    st.settings.lab.enabled = keepLab;
    writeLocalState(st);
    return {
      ok: true,
      settings: st.settings,
      activeProfile: resolveProfile(st.settings),
      auth: sanitizeAuth(st.auth),
    };
  },

  async startDeviceCode() {
    try {
      const res = await xboxFetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: MS_OAUTH_CLIENT_ID,
          scope: MS_OAUTH_SCOPE,
        }).toString(),
      });
      const data = await res.json();
      if (!res.ok || !data?.device_code) {
        throw Object.assign(new Error(data?.error_description || `Microsoft OAuth HTTP ${res.status}`), {
          status: res.status || 502,
          payload: { oauthError: data?.error || 'devicecode_failed' },
        });
      }
      activeDeviceLogin = {
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri || 'https://www.microsoft.com/link',
        expiresAt: Date.now() + Number(data.expires_in || 900) * 1000,
        interval: Number(data.interval || 5),
      };
      return {
        ok: true,
        userCode: activeDeviceLogin.userCode,
        verificationUri: activeDeviceLogin.verificationUri,
        expiresIn: Number(data.expires_in || 900),
        interval: activeDeviceLogin.interval,
      };
    } catch (err) {
      if (err.payload) throw err;
      throw Object.assign(
        new Error('Unable to reach Microsoft OAuth from this browser. Connect an XCloud4 Relay URL or retry when online.'),
        { status: 503, payload: { oauthUnavailable: true, staticSiteMode: true } }
      );
    }
  },

  async pollDeviceCode() {
    if (!activeDeviceLogin || Date.now() > activeDeviceLogin.expiresAt) {
      activeDeviceLogin = null;
      throw Object.assign(new Error('Device code expired. Start sign-in again.'), {
        status: 400,
        payload: { status: 'expired' },
      });
    }
    const res = await xboxFetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: MS_OAUTH_CLIENT_ID,
        device_code: activeDeviceLogin.deviceCode,
      }).toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      const code = data?.error || 'unknown';
      if (code === 'authorization_pending' || code === 'slow_down') {
        return { ok: true, status: 'pending', errorCode: code };
      }
      activeDeviceLogin = null;
      throw Object.assign(new Error(data?.error_description || code), {
        status: 400,
        payload: { status: code },
      });
    }

    activeDeviceLogin = null;
    const st = readLocalState();
    const claims = decodeJwtClaims(data.id_token);

    let authRecord = null;
    try {
      const xbx = await tryBrowserXboxAuthExchange(
        data.access_token,
        data.refresh_token || '',
        st.settings?.public?.accessCountry || 'Auto'
      );
      const activeRegion =
        xbx.regions.find((r) => r.name === st.settings.public.serverName) ||
        xbx.regions.find((r) => r.isDefault) ||
        xbx.regions[0] ||
        null;
      authRecord = {
        ...xbx,
        activeRegion,
        email: claims?.email || claims?.preferred_username || '',
        expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
      };
    } catch {
      const activeRegion =
        FALLBACK_REGIONS.find((r) => r.name === st.settings.public.serverName) ||
        FALLBACK_REGIONS.find((r) => r.isDefault) ||
        FALLBACK_REGIONS[0];
      authRecord = {
        provider: 'microsoft',
        liveStream: false,
        refreshToken: data.refresh_token || '',
        gamertag: claims?.name || claims?.preferred_username || claims?.email || 'Xbox Player',
        email: claims?.email || claims?.preferred_username || '',
        uhs: claims?.sub || '',
        offeringId: 'xbox-microsoft-account',
        regions: FALLBACK_REGIONS,
        activeRegion,
        expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
      };
    }

    st.auth = authRecord;
    writeLocalState(st);
    return { ok: true, status: 'authorized', auth: sanitizeAuth(st.auth) };
  },

  async logout(forget = false) {
    const st = readLocalState();
    st.auth = null;
    activeDeviceLogin = null;
    activeStaticSessions.clear();
    if (forget) {
      st.favorites = [];
      st.myGames = [];
      st.localRecents = {};
    }
    writeLocalState(st);
    return { ok: true, auth: { signedIn: false } };
  },

  async upgradeSession() {
    const st = readLocalState();
    if (!st.auth) return { ok: false, auth: { signedIn: false } };
    if (st.auth.gsToken && Date.now() < (st.auth.gsExpiresAt || 0) - 60_000) {
      return { ok: true, auth: sanitizeAuth(st.auth) };
    }
    if (st.auth.refreshToken) {
      const refRes = await xboxFetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: MS_OAUTH_CLIENT_ID,
          refresh_token: st.auth.refreshToken,
          scope: MS_OAUTH_SCOPE,
        }).toString(),
      });
      if (refRes.ok) {
        const tokens = await refRes.json();
        const xbx = await tryBrowserXboxAuthExchange(
          tokens.access_token,
          tokens.refresh_token || st.auth.refreshToken,
          st.settings?.public?.accessCountry || 'Auto'
        );
        const activeRegion =
          xbx.regions.find((r) => r.name === st.settings.public.serverName) ||
          xbx.regions.find((r) => r.isDefault) ||
          xbx.regions[0] ||
          null;
        st.auth = {
          ...st.auth,
          ...xbx,
          activeRegion,
          expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
        };
        writeLocalState(st);
        return { ok: true, auth: sanitizeAuth(st.auth) };
      }
    }
    return { ok: false, auth: sanitizeAuth(st.auth) };
  },

  async getPublicLists(reqMarket, reqLocale) {
    const st = readLocalState();
    const { market, locale } = normalizeLocaleMarket(st.settings?.public?.language, reqMarket, reqLocale);
    const cache = await ensureStaticCatalog({ market, locale, hydrateAll: false });
    return {
      lists: cache.lists,
      metadata: cache.metadata,
      source: cache.source,
      market: cache.market,
      locale: cache.locale,
    };
  },

  async getCatalog() {
    const st = readLocalState();
    const { market, locale } = normalizeLocaleMarket(st.settings?.public?.language);
    const cache = await ensureStaticCatalog({ market, locale, hydrateAll: true });
    return {
      items: Object.values(cache.metadata || {}),
      source: cache.source,
      market: cache.market,
      locale: cache.locale,
    };
  },

  async getRecents() {
    const st = readLocalState();
    if (st.auth?.gsToken && st.auth?.activeRegion?.baseUri) {
      try {
        const profile = resolveProfile(st.settings);
        const r = await gssvRequest('GET', st.auth.activeRegion.baseUri, '/v2/mru?mr=25', st.auth.gsToken, buildStaticDeviceInfo(profile));
        if (r.ok && Array.isArray(r.json?.results)) {
          return {
            mru: r.json.results.map((x) => x.details?.productId || x.titleId).filter(Boolean),
            localRecents: st.localRecents,
            source: 'live',
          };
        }
      } catch {
        // Fallback to local
      }
    }
    return { localRecents: st.localRecents, mru: [] };
  },

  async getProductDetails(id) {
    if (!isValidProductId(id)) {
      throw Object.assign(new Error('Invalid product ID'), { status: 400 });
    }
    const st = readLocalState();
    const { market, locale } = normalizeLocaleMarket(st.settings?.public?.language);
    if (catalogCache.metadata?.[id] && catalogCache.source !== 'offline-fallback') {
      return { item: catalogCache.metadata[id], source: catalogCache.source };
    }
    try {
      const fetched = await fetchDisplayCatalogChunks([id], market, locale, { timeoutMs: 8000 });
      if (fetched[id]) {
        if (!catalogCache.metadata) catalogCache.metadata = {};
        catalogCache.metadata[id] = fetched[id];
        return { item: fetched[id], source: 'live' };
      }
    } catch {
      // Fall through to snapshot / fallback
    }
    const cache = await ensureStaticCatalog({ market, locale, hydrateAll: false });
    if (cache.metadata?.[id]) {
      return { item: cache.metadata[id], source: cache.source };
    }
    const map = buildFallbackCatalogMap(renderFallbackArtworkDataUrl);
    if (map[id]) return { item: map[id], source: 'offline-fallback' };
    throw Object.assign(new Error('Product not found'), { status: 404 });
  },

  async toggleFavorite(productId) {
    const st = readLocalState();
    const idx = st.favorites.indexOf(productId);
    if (idx === -1) st.favorites.push(productId);
    else st.favorites.splice(idx, 1);
    writeLocalState(st);
    return { favorites: st.favorites };
  },

  async toggleMyGames(productId) {
    const st = readLocalState();
    const idx = st.myGames.indexOf(productId);
    if (idx === -1) st.myGames.push(productId);
    else st.myGames.splice(idx, 1);
    writeLocalState(st);
    return { myGames: st.myGames };
  },

  async recordPlayTime(productId, titleId, title, deltaSec) {
    const st = readLocalState();
    const prev = st.localRecents[productId] || { productId, titleId: titleId || productId, title: title || productId, playTimeSec: 0 };
    st.localRecents[productId] = {
      ...prev,
      titleId: titleId || prev.titleId,
      title: title || prev.title,
      playTimeSec: (prev.playTimeSec || 0) + Math.max(0, Number(deltaSec || 0)),
      lastPlayedAt: Date.now(),
    };
    writeLocalState(st);
    return { localRecents: st.localRecents };
  },

  async getCloudTime() {
    const st = readLocalState();
    if (!st.auth) throw Object.assign(new Error('Not signed in'), { status: 401 });
    return { cloudTime: st.auth.cloudTime || { available: false, reason: 'connect-relay' } };
  },

  async pingServers() {
    const st = readLocalState();
    const regions = st.auth?.regions?.length ? st.auth.regions : FALLBACK_REGIONS;
    const results = await Promise.all(
      regions.map(async (r) => {
        const host = r.networkTestHostname || r.baseUri;
        const rttMs = await probeRegionBrowserRttMs(host, 1800);
        return {
          name: r.name,
          continent: r.continent,
          isDefault: Boolean(r.isDefault),
          rttMs,
        };
      })
    );
    return { regions: results };
  },

  async playSession(titleId) {
    const { st, auth } = await ensureStaticGssvAuth();
    const profile = resolveProfile(st.settings);
    const { locale } = normalizeLocaleMarket(st.settings?.public?.language);
    const baseUri = auth.activeRegion?.baseUri || auth.regions?.[0]?.baseUri;
    const deviceInfo = buildStaticDeviceInfo(profile);
    const playBody = JSON.stringify({
      clientSessionId: '',
      titleId,
      systemUpdateGroup: '',
      settings: {
        nanoVersion: 'V3;WebrtcTransport.dll',
        enableOptionalDataCollection: false,
        enableTextToSpeech: false,
        highContrast: 0,
        locale: locale || 'en-US',
        useIceConnection: false,
        timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
        sdkType: 'web',
        osName: 'windows',
      },
      serverId: '',
      fallbackRegionNames: [],
    });
    const resPlay = await gssvRequest('POST', baseUri, '/v5/sessions/cloud/play', auth.gsToken, deviceInfo, playBody);
    if (!resPlay.ok || !resPlay.json?.sessionPath) {
      throw Object.assign(new Error(resPlay.json?.errorDetails?.message || resPlay.json?.message || 'Play request failed'), {
        status: resPlay.status || 502,
      });
    }
    const sessionId = String(resPlay.json.sessionPath).split('/').filter(Boolean).pop();
    activeStaticSessions.set(sessionId, { baseUri, profile, deviceInfo });
    return { ok: true, sessionId, profile };
  },

  async getWaitTime(titleId) {
    const { auth, st } = await ensureStaticGssvAuth();
    const baseUri = auth.activeRegion?.baseUri || auth.regions?.[0]?.baseUri;
    const r = await gssvRequest('GET', baseUri, `/v1/waittime/${encodeURIComponent(titleId)}`, auth.gsToken, buildStaticDeviceInfo(resolveProfile(st.settings)));
    return r.json || { estimatedTotalWaitTimeInSeconds: 0 };
  },

  async getSessionState(id) {
    const sess = activeStaticSessions.get(id);
    if (!sess) throw Object.assign(new Error('Unknown session'), { status: 404 });
    const { auth } = await ensureStaticGssvAuth();
    const r = await gssvRequest('GET', sess.baseUri, `/v5/sessions/cloud/${id}/state`, auth.gsToken, sess.deviceInfo);
    return r.json || {};
  },

  async connectSession(id) {
    const sess = activeStaticSessions.get(id);
    if (!sess) throw Object.assign(new Error('Unknown session'), { status: 404 });
    const { auth } = await ensureStaticGssvAuth();
    let userToken = '';
    if (auth.refreshToken) {
      const pRes = await xboxFetch('https://login.live.com/oauth20_token.srf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: MS_OAUTH_CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: auth.refreshToken,
          scope: PASSPORT_SCOPE,
        }).toString(),
      });
      const pData = await pRes.json().catch(() => ({}));
      userToken = pData?.access_token || '';
    }
    const r = await gssvRequest('POST', sess.baseUri, `/v5/sessions/cloud/${id}/connect`, auth.gsToken, sess.deviceInfo, { userToken });
    return r.json || { ok: r.ok };
  },

  async sendSdpOffer(id, sdp) {
    const sess = activeStaticSessions.get(id);
    if (!sess) throw Object.assign(new Error('Unknown session'), { status: 404 });
    const { auth } = await ensureStaticGssvAuth();
    const r = await gssvRequest('POST', sess.baseUri, `/v5/sessions/cloud/${id}/sdp`, auth.gsToken, sess.deviceInfo, {
      messageType: 'offer',
      sdp,
      requestId: '1',
      configuration: {
        chatConfiguration: { format: 'opus', maxChannels: 1, minVersion: 1, maxVersion: 1 },
        control: { minVersion: 1, maxVersion: 3 },
        input: { minVersion: 1, maxVersion: 9 },
        message: { minVersion: 1, maxVersion: 1 },
        reliableinput: { minVersion: 1, maxVersion: 9 },
        unreliableinput: { minVersion: 1, maxVersion: 9 },
      },
    });
    return r.json || {};
  },

  async getSdpAnswer(id) {
    const sess = activeStaticSessions.get(id);
    if (!sess) throw Object.assign(new Error('Unknown session'), { status: 404 });
    const { auth } = await ensureStaticGssvAuth();
    const r = await gssvRequest('GET', sess.baseUri, `/v5/sessions/cloud/${id}/sdp`, auth.gsToken, sess.deviceInfo);
    if (r.status === 204) return { pending: true };
    return r.json || {};
  },

  async sendIceCandidates(id, candidates) {
    const sess = activeStaticSessions.get(id);
    if (!sess) throw Object.assign(new Error('Unknown session'), { status: 404 });
    const { auth } = await ensureStaticGssvAuth();
    const r = await gssvRequest('POST', sess.baseUri, `/v5/sessions/cloud/${id}/ice`, auth.gsToken, sess.deviceInfo, {
      messageType: 'iceCandidate',
      candidates: (candidates || []).map((c) => (typeof c === 'string' ? c : JSON.stringify(c))),
      requestId: '1',
    });
    return r.json || {};
  },

  async getIceCandidates(id) {
    const sess = activeStaticSessions.get(id);
    if (!sess) throw Object.assign(new Error('Unknown session'), { status: 404 });
    const { auth } = await ensureStaticGssvAuth();
    const r = await gssvRequest('GET', sess.baseUri, `/v5/sessions/cloud/${id}/ice`, auth.gsToken, sess.deviceInfo);
    if (r.status === 204) return { pending: true, candidates: [] };
    return r.json || {};
  },

  async keepaliveSession(id) {
    const sess = activeStaticSessions.get(id);
    if (!sess) return { ok: false };
    const { auth } = await ensureStaticGssvAuth();
    const r = await gssvRequest('POST', sess.baseUri, `/v5/sessions/cloud/${id}/keepalive`, auth.gsToken, sess.deviceInfo, '');
    return r.json || { ok: r.ok };
  },

  async deleteSession(id) {
    const sess = activeStaticSessions.get(id);
    if (!sess) return { ok: true };
    try {
      const { auth } = await ensureStaticGssvAuth();
      await gssvRequest('DELETE', sess.baseUri, `/v5/sessions/cloud/${id}`, auth.gsToken, sess.deviceInfo);
    } finally {
      activeStaticSessions.delete(id);
    }
    return { ok: true };
  },

  async checkUpdates() {
    const st = readLocalState();
    const lab = st.settings.lab.enabled;
    const currentVersion = lab ? APP_IDENTITY.labVersion : APP_IDENTITY.publicVersion;
    const targetUrl = lab ? APP_IDENTITY.releasesUrlLab : APP_IDENTITY.releasesUrlPublic;
    const res = await fetch(targetUrl, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
    const data = await res.json();
    const release = Array.isArray(data)
      ? data.find((r) => r.prerelease || String(r.tag_name || '').includes('lab')) || data[0]
      : data;
    const latestTag = release?.tag_name || currentVersion;
    const cleanLatest = String(latestTag).replace(/^v/i, '');
    return {
      ok: true,
      currentVersion,
      latestTag,
      isLatest: cleanLatest === currentVersion,
      htmlUrl: release?.html_url || `${APP_IDENTITY.sourceUrl}/releases`,
      publishedAt: release?.published_at || '',
      name: release?.name || latestTag,
    };
  },

  async getLicenses() {
    const entries = await Promise.all(
      LICENSE_FILES.map(async (name) => {
        try {
          const res = await fetch(appUrl(`docs/licenses/${name}`));
          if (!res.ok) return null;
          return { name, text: await res.text() };
        } catch {
          return null;
        }
      })
    );
    return { licenses: entries.filter(Boolean) };
  },
};
