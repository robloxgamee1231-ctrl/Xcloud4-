/* SPDX-License-Identifier: GPL-3.0-only */
/* Client-side Sandbox Demo & LocalStorage backend for static hosting (e.g. GitHub Pages). */

import { appUrl } from './paths.js';
import {
  FALLBACK_REGIONS,
  buildFallbackCatalogMap,
  buildStaticPublicLists,
  renderFallbackArtworkDataUrl,
} from './fallback-catalog.js';

const STORAGE_KEY = 'xcloud4_static_state_v1';

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
  '720p60': { id: '720p60', label: '720p60', width: 1280, height: 720, fps: 60, bitrateKbps: 9000 },
  '720p-HQ': { id: '720p-HQ', label: '720p-HQ', width: 1280, height: 720, fps: 60, bitrateKbps: 12000 },
  '1080p-G': { id: '1080p-G', label: '1080p-G', width: 1920, height: 1080, fps: 60, bitrateKbps: 12000 },
  '1080p-G8': { id: '1080p-G8', label: '1080p-G8', width: 1920, height: 1080, fps: 60, bitrateKbps: 12000 },
  '1080p-H': { id: '1080p-H', label: '1080p-H', width: 1920, height: 1080, fps: 60, bitrateKbps: 15000 },
  '1080p-HQ': { id: '1080p-HQ', label: '1080p-HQ', width: 1920, height: 1080, fps: 60, bitrateKbps: 18000 },
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
    demoMode: true,
    gamertag: auth.gamertag || 'XCloud4Preview',
    uhs: auth.uhs || 'demo-uhs-001',
    offeringId: auth.offeringId || 'xgpuweb',
    regions: Array.isArray(auth.regions) ? auth.regions : FALLBACK_REGIONS,
    activeRegion: auth.activeRegion || FALLBACK_REGIONS[0],
    expiresAt: auth.expiresAt || Date.now() + 86400_000,
    hasRefreshToken: false,
    cloudTime: auth.cloudTime || { available: true, kind: 'account', remainingSeconds: 3000, maxSeconds: 3600, unlimited: false },
  };
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
    throw Object.assign(
      new Error('Live Microsoft OAuth / Xbox GSSV requires running the XCloud4 Node.js server (`npm start`). Static hosting runs in Sandbox Demo Mode.'),
      { status: 503, payload: { sandboxUnavailable: true, staticSiteMode: true } }
    );
  },

  async pollDeviceCode() {
    return { status: 'pending' };
  },

  async demoSignIn(gamertag) {
    const st = readLocalState();
    const cleanTag = String(gamertag || 'XCloud4Preview').replace(/[^\w .-]/g, '').slice(0, 24) || 'XCloud4Preview';
    const match = FALLBACK_REGIONS.find((r) => r.name === st.settings.public.serverName) || FALLBACK_REGIONS[0];
    st.auth = {
      demoMode: true,
      gamertag: cleanTag,
      uhs: 'demo-uhs-001',
      offeringId: 'xgpuweb',
      regions: FALLBACK_REGIONS,
      activeRegion: match,
      expiresAt: Date.now() + 86400_000,
      cloudTime: { available: true, kind: 'account', remainingSeconds: 3000, maxSeconds: 3600, unlimited: false },
    };
    writeLocalState(st);
    return { ok: true, auth: sanitizeAuth(st.auth) };
  },

  async logout(forget = false) {
    const st = readLocalState();
    st.auth = null;
    if (forget) {
      st.favorites = [];
      st.myGames = [];
      st.localRecents = {};
    }
    writeLocalState(st);
    return { ok: true, auth: { signedIn: false } };
  },

  async getPublicLists() {
    return buildStaticPublicLists();
  },

  async getCatalog() {
    const map = buildFallbackCatalogMap(renderFallbackArtworkDataUrl);
    return { items: Object.values(map), source: 'sandbox-fallback' };
  },

  async getRecents() {
    const st = readLocalState();
    return { localRecents: st.localRecents, remoteMru: [] };
  },

  async getProductDetails(id) {
    const map = buildFallbackCatalogMap(renderFallbackArtworkDataUrl);
    if (map[id]) return { item: map[id], source: 'sandbox-fallback' };
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
    return { cloudTime: st.auth.cloudTime, demoMode: true };
  },

  async pingServers() {
    return {
      regions: FALLBACK_REGIONS.map((r) => ({
        name: r.name,
        continent: r.continent,
        isDefault: Boolean(r.isDefault),
        rttMs: r.simLatencyMs,
        simulated: true,
      })),
    };
  },

  async playSession(titleId) {
    const st = readLocalState();
    const sid = `static-demo-${Date.now().toString(36)}`;
    return {
      ok: true,
      demoMode: true,
      sessionId: sid,
      titleId,
      state: 'Provisioned',
      profile: resolveProfile(st.settings),
    };
  },

  async getWaitTime() { return { estimatedTotalWaitTimeInSeconds: 0 }; },
  async getSessionState() { return { ok: true, demoMode: true, state: 'Provisioned' }; },
  async connectSession() { return { ok: true, demoMode: true }; },
  async sendSdpOffer() { return { ok: true, demoMode: true }; },
  async getSdpAnswer() { return { ok: true, demoMode: true, exchangeResponse: { sdp: '' } }; },
  async sendIceCandidates() { return { ok: true, demoMode: true }; },
  async getIceCandidates() { return { ok: true, demoMode: true, exchangeResponse: { candidates: [] } }; },
  async keepaliveSession() { return { ok: true, demoMode: true }; },
  async deleteSession() { return { ok: true }; },

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
