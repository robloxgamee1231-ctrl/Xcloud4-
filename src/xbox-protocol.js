/* SPDX-License-Identifier: GPL-3.0-only */
/* Xbox Cloud Gaming & Microsoft OAuth2/Store protocol module modeled on asp11edgr/XCloud4. */
import crypto from 'node:crypto';
import net from 'node:net';
import {
  SIGL_GUIDS,
  isValidProductId,
  normalizeLocaleMarket,
  buildPlayXboxUrl,
  formatStoreImageUrl,
  parseDisplayCatalogProducts,
  fetchSiglIds,
  fetchSiglWithFallback,
  fetchDisplayCatalogChunks,
  fetchFullXboxCatalogSnapshot,
} from '../public/js/xbox-catalog.js';

export {
  SIGL_GUIDS,
  isValidProductId,
  normalizeLocaleMarket,
  buildPlayXboxUrl,
  formatStoreImageUrl,
  parseDisplayCatalogProducts,
  fetchSiglIds,
  fetchSiglWithFallback,
  fetchDisplayCatalogChunks,
  fetchFullXboxCatalogSnapshot,
};

export const APP_IDENTITY = {
  publicVersion: '1.3.0-beta',
  labVersion: '0.7.111-lab',
  developer: 'ASAP_EDGR',
  license: 'GPL-3.0',
  sourceUrl: 'https://github.com/asp11edgr/XCloud4',
  supportUrl: 'https://ko-fi.com/asapedgr',
  releasesUrlPublic: 'https://api.github.com/repos/asp11edgr/XCloud4/releases/latest',
  releasesUrlLab: 'https://api.github.com/repos/asp11edgr/XCloud4/releases?per_page=10',
};

export const OAUTH_CONFIG = {
  clientIdRef: '1f907974-e22b-4810-a9de-d9647380c97e',
  clientIdOwn: 'f9ac8684-1032-4131-bb47-d2f58da9bb93',
  scope: 'xboxlive.signin openid profile offline_access',
  deviceCodeUrl: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode',
  tokenUrl: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
  passportUrl: 'https://login.live.com/oauth20_token.srf',
  passportScope: 'service::http://Passport.NET/purpose::PURPOSE_XBOX_CLOUD_CONSOLE_TRANSFER_TOKEN',
  xblUserAuthUrl: 'https://user.auth.xboxlive.com/user/authenticate',
  xstsAuthUrl: 'https://xsts.auth.xboxlive.com/xsts/authorize',
  gssvLoginUrl: 'https://xgpuweb.gssv-play-prod.xboxlive.com/v2/login/user',
  gssvF2pLoginUrl: 'https://xgpuwebf2p.gssv-play-prod.xboxlive.com/v2/login/user',
  cloudTimePrefix: 'https://contentaccess.exp.xboxservices.com/all/v1?market=',
  cloudTimeSuffix: '&offering=xgpuweb',
  verificationUri: 'https://www.microsoft.com/link',
  fortniteTitleId: 'BT5P2X999VH2',
  xboxAccessKey: '4BDB3609-C1F1-4195-9B37-FEFF45DA8B8E',
};

// Better xCloud MIT bypass server IP table (access_country.h)
export const ACCESS_COUNTRIES = [
  { code: 'Auto', nameKey: 'X4_TR_AUTO', ip: null },
  { code: 'US', name: 'United States', ip: '143.244.47.65' },
  { code: 'BR', name: 'Brazil', ip: '169.150.198.66' },
  { code: 'JP', name: 'Japan', ip: '138.199.21.239' },
  { code: 'KR', name: 'South Korea', ip: '121.125.60.151' },
  { code: 'PL', name: 'Poland', ip: '45.134.212.66' },
];

export const STREAM_PROFILES = {
  '720p60': {
    id: '720p60',
    label: '720p60',
    width: 1280,
    height: 720,
    fps: 60,
    bitrateKbps: 9000,
    osName: 'windows',
    displayInfo: false,
    resolutionAlias: null,
    h264Fmtp: 'profile-level-id=42e01f;level-asymmetry-allowed=1;packetization-mode=1',
  },
  '720p-HQ': {
    id: '720p-HQ',
    label: '720p-HQ',
    width: 1280,
    height: 720,
    fps: 60,
    bitrateKbps: 12000,
    osName: 'windows',
    displayInfo: true,
    resolutionAlias: '720HQ',
    h264Fmtp: 'profile-level-id=42e01f;level-asymmetry-allowed=1;packetization-mode=1',
  },
  '1080p-G': {
    id: '1080p-G',
    label: '1080p-G',
    width: 1920,
    height: 1080,
    fps: 60,
    bitrateKbps: 12000,
    osName: 'linux',
    displayInfo: true,
    resolutionAlias: '1080',
    h264Fmtp: 'profile-level-id=42e020;level-asymmetry-allowed=1;packetization-mode=1',
  },
  '1080p-G8': {
    id: '1080p-G8',
    label: '1080p-G8',
    width: 1920,
    height: 1080,
    fps: 60,
    bitrateKbps: 12000,
    osName: 'windows',
    displayInfo: true,
    resolutionAlias: '1080',
    h264Fmtp: 'profile-level-id=42e020;level-asymmetry-allowed=1;packetization-mode=1',
  },
  '1080p-H': {
    id: '1080p-H',
    label: '1080p-H',
    width: 1920,
    height: 1080,
    fps: 60,
    bitrateKbps: 15000,
    osName: 'windows',
    displayInfo: false,
    resolutionAlias: '1080',
    h264Fmtp: 'profile-level-id=42e020;level-asymmetry-allowed=1;packetization-mode=1',
  },
  '1080p-HQ': {
    id: '1080p-HQ',
    label: '1080p-HQ',
    width: 1920,
    height: 1080,
    fps: 60,
    bitrateKbps: 18000,
    osName: 'windows',
    displayInfo: true,
    resolutionAlias: '1080HQ',
    h264Fmtp: 'profile-level-id=42e020;level-asymmetry-allowed=1;packetization-mode=1',
  },
};

export function resolveStreamProfile(settings) {
  if (settings?.lab?.enabled && settings.lab.profile && STREAM_PROFILES[settings.lab.profile]) {
    return STREAM_PROFILES[settings.lab.profile];
  }
  const q = settings?.public?.quality || '1080p-hq';
  if (q === '720p') return STREAM_PROFILES['720p60'];
  if (q === '1080p') return STREAM_PROFILES['1080p-G8'];
  return STREAM_PROFILES['1080p-HQ'];
}

export function getAccessCountryIp(code) {
  const found = ACCESS_COUNTRIES.find((c) => c.code === code);
  return found?.ip || null;
}

export function buildDeviceInfo(profile) {
  const p = typeof profile === 'string' ? (STREAM_PROFILES[profile] || STREAM_PROFILES['1080p-HQ']) : profile;
  if (p.id === '720p60') {
    return JSON.stringify({
      appInfo: {
        env: {
          clientAppId: 'XCloud4',
          clientAppType: 'native',
          clientAppVersion: '0.6.2',
          httpEnvironment: 'prod',
        },
      },
      dev: {
        hw: { make: 'Microsoft', model: 'Xbox One' },
        os: { name: 'windows', platform: 'console' },
      },
    });
  }
  if (p.id === '1080p-H') {
    return JSON.stringify({
      appInfo: {
        env: {
          clientAppId: 'XCloud4',
          clientAppType: 'native',
          clientAppVersion: '0.7.33',
          httpEnvironment: 'prod',
        },
      },
      dev: {
        hw: { make: 'Sony', model: 'PS4' },
        os: { name: 'windows', platform: 'console' },
      },
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
      os: { name: p.osName || 'windows', ver: '22631.2715', platform: 'desktop' },
      hw: { make: 'Microsoft', model: 'unknown', sdktype: 'web' },
      browser: { browserName: 'chrome', browserVersion: '140.0.3485.54' },
      displayInfo: {
        dimensions: { widthInPixels: 4096, heightInPixels: 2160 },
        pixelDensity: { dpiX: 1, dpiY: 1 },
      },
    },
  });
}

export function buildPlayBody(titleId, locale, profile) {
  if (!isValidTitleId(titleId)) {
    throw new Error('Invalid titleId');
  }
  const p = typeof profile === 'string' ? (STREAM_PROFILES[profile] || STREAM_PROFILES['1080p-HQ']) : profile;
  return JSON.stringify({
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
      osName: p.osName || 'windows',
    },
    serverId: '',
    fallbackRegionNames: [],
  });
}

export function isValidGssvBaseUri(baseUri) {
  if (typeof baseUri !== 'string') return false;
  return /^https:\/\/([a-z0-9-]+\.)+gssv-play-prod\.xboxlive\.com$/i.test(baseUri.trim());
}

export function isValidSessionId(sessionId) {
  return (
    typeof sessionId === 'string' &&
    /^[A-Za-z0-9_-]{1,128}$/.test(sessionId) &&
    sessionId !== 'play' &&
    sessionId !== 'active'
  );
}

export function isValidTitleId(titleId) {
  return typeof titleId === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(titleId);
}

export function isAllowedStoreImageUrl(url) {
  return (
    typeof url === 'string' &&
    url.length < 512 &&
    /^https:\/\/store-images\.s-microsoft\.com\/image\/[A-Za-z0-9._/-]+(\?w=\d+&h=\d+&q=85&format=jpg)?$/.test(url)
  );
}

export function classifyRegionContinent(name) {
  const n = String(name || '').toLowerCase();
  if (
    [
      'brazilsouth',
      'canadacentral',
      'canadaeast',
      'centralus',
      'chilecentral',
      'eastus',
      'eastus2',
      'mexicocentral',
      'northcentralus',
      'southcentralus',
      'westcentralus',
      'westus',
      'westus2',
      'westus3',
    ].includes(n)
  ) {
    return 'america';
  }
  if (
    [
      'francecentral',
      'germanywestcentral',
      'italynorth',
      'northeurope',
      'norwayeast',
      'polandcentral',
      'spaincentral',
      'swedencentral',
      'uksouth',
      'ukwest',
      'westeurope',
    ].includes(n)
  ) {
    return 'europe';
  }
  if (
    [
      'australiaeast',
      'australiasoutheast',
      'centralindia',
      'eastasia',
      'japaneast',
      'japanwest',
      'koreacentral',
      'koreasouth',
      'southeastasia',
      'southindia',
    ].includes(n)
  ) {
    return 'asia';
  }
  return 'other';
}

export function generateMsCv() {
  return `${crypto.randomBytes(12).toString('base64')}.0`;
}

export function isNetworkUnreachableError(err) {
  const msg = String(err?.cause?.code || err?.code || err?.message || '').toUpperCase();
  return (
    msg.includes('ENOTFOUND') ||
    msg.includes('EAI_AGAIN') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('EHOSTUNREACH') ||
    msg.includes('ENETUNREACH') ||
    msg.includes('FETCH FAILED')
  );
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function requestDeviceCode(clientId = OAUTH_CONFIG.clientIdRef) {
  const body = new URLSearchParams({
    client_id: clientId,
    scope: OAUTH_CONFIG.scope,
  });
  const res = await fetchWithTimeout(OAUTH_CONFIG.deviceCodeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data.error_description || data.error || `HTTP ${res.status}`), {
      httpStatus: res.status,
      oauthError: data.error,
    });
  }
  return data;
}

export async function pollDeviceToken(deviceCode, clientId = OAUTH_CONFIG.clientIdRef) {
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    client_id: clientId,
    device_code: deviceCode,
  });
  const res = await fetchWithTimeout(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function refreshOAuthToken(refreshToken, clientId = OAUTH_CONFIG.clientIdRef) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
    scope: OAUTH_CONFIG.scope,
  });
  const res = await fetchWithTimeout(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data.error_description || `Token refresh failed (${res.status})`), {
      httpStatus: res.status,
      oauthError: data.error,
    });
  }
  return data;
}

export async function requestConsoleTransferToken(refreshToken, clientId = OAUTH_CONFIG.clientIdRef) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: OAUTH_CONFIG.passportScope,
  });
  const res = await fetchWithTimeout(OAUTH_CONFIG.passportUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw Object.assign(new Error(data.error_description || `Passport token failed (${res.status})`), {
      httpStatus: res.status,
    });
  }
  return data.access_token;
}

export async function authenticateXboxLive(msAccessToken) {
  const res = await fetchWithTimeout(OAUTH_CONFIG.xblUserAuthUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-xbl-contract-version': '1',
    },
    body: JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${msAccessToken}`,
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.Token) {
    throw Object.assign(new Error(`Xbox Live auth failed (${res.status})`), { httpStatus: res.status, data });
  }
  const uhs = data.DisplayClaims?.xui?.[0]?.uhs || '';
  return { token: data.Token, uhs };
}

export async function authorizeXsts(xblToken, relyingParty = 'http://gssv.xboxlive.com/') {
  const res = await fetchWithTimeout(OAUTH_CONFIG.xstsAuthUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-xbl-contract-version': '1',
    },
    body: JSON.stringify({
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xblToken],
      },
      RelyingParty: relyingParty,
      TokenType: 'JWT',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.Token) {
    const xerr = Number(data?.XErr || 0);
    throw Object.assign(new Error(`XSTS failed (${res.status}) XErr=${xerr}`), {
      httpStatus: res.status,
      xerr,
      data,
    });
  }
  const xui = data.DisplayClaims?.xui?.[0] || {};
  return {
    token: data.Token,
    uhs: xui.uhs || '',
    gamertag: xui.gtg || xui.mgt || '',
  };
}

export async function loginGssv(xstsToken, accessCountry = 'Auto') {
  const ip = getAccessCountryIp(accessCountry);
  const attempts = [
    { url: OAUTH_CONFIG.gssvLoginUrl, offeringId: 'xgpuweb' },
    { url: OAUTH_CONFIG.gssvF2pLoginUrl, offeringId: 'xgpuwebf2p' },
  ];
  let lastError = null;
  for (const attempt of attempts) {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-gssv-client': 'XboxComBrowser',
    };
    if (ip) headers['X-Forwarded-For'] = ip;
    const res = await fetchWithTimeout(attempt.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token: xstsToken,
        offeringId: attempt.offeringId,
      }),
    });
    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (res.ok && data.gsToken) {
      const regions = Array.isArray(data.offeringSettings?.regions)
        ? data.offeringSettings.regions
            .filter((r) => isValidGssvBaseUri(r.baseUri))
            .map((r) => ({
              name: r.name,
              baseUri: r.baseUri.replace(/\/+$/, ''),
              networkTestHostname: r.networkTestHostname || '',
              isDefault: Boolean(r.isDefault),
              continent: classifyRegionContinent(r.name),
            }))
        : [];
      return {
        gsToken: data.gsToken,
        durationInSeconds: data.durationInSeconds || 14400,
        offeringId: attempt.offeringId,
        regions,
      };
    }
    lastError = Object.assign(new Error(`GSSV login failed (${res.status})`), {
      httpStatus: res.status,
      offeringId: attempt.offeringId,
      data,
    });
  }
  throw lastError;
}

// Protobuf & JSON parser for Cloud Time quota (contentaccess.exp.xboxservices.com)
export function parseCloudTimeResponse(buffer) {
  if (!buffer || buffer.length === 0) return { available: false, kind: 'none' };
  const text = buffer.toString('utf8').trim();
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const obj = JSON.parse(text);
      const rem = Number(obj.remainingGameplayTimeInSeconds ?? obj.RemainingGameplayTimeInSeconds);
      const max = Number(obj.maxGameplayTimeInSeconds ?? obj.MaxGameplayTimeInSeconds);
      if (Number.isFinite(rem) && rem >= 0) {
        return {
          available: true,
          kind: 'json',
          remainingSeconds: rem,
          maxSeconds: Number.isFinite(max) && max > 0 ? max : Math.max(rem, 3600),
          unlimited: false,
        };
      }
    } catch {
      // fall through to protobuf parser
    }
  }

  // Minimal safe protobuf wire parser matching src/auth/cloud_time.c
  const readVarint = (buf, pos) => {
    let val = 0n;
    let shift = 0n;
    let i = pos;
    while (i < buf.length && i - pos < 10) {
      const byte = BigInt(buf[i++]);
      val |= (byte & 0x7fn) << shift;
      if ((byte & 0x80n) === 0n) return { val: Number(val), next: i };
      shift += 7n;
    }
    return null;
  };

  const parseMsg = (buf) => {
    const fields = [];
    let pos = 0;
    while (pos < buf.length) {
      const tag = readVarint(buf, pos);
      if (!tag) break;
      pos = tag.next;
      const fieldNo = tag.val >>> 3;
      const wireType = tag.val & 7;
      if (wireType === 0) {
        const v = readVarint(buf, pos);
        if (!v) break;
        pos = v.next;
        fields.push({ fieldNo, wireType, val: v.val });
      } else if (wireType === 2) {
        const len = readVarint(buf, pos);
        if (!len || pos + len.val > buf.length) break;
        pos = len.next;
        fields.push({ fieldNo, wireType, buf: buf.subarray(pos, pos + len.val) });
        pos += len.val;
      } else if (wireType === 5) {
        if (pos + 4 > buf.length) break;
        fields.push({ fieldNo, wireType, val: buf.readUInt32LE(pos) });
        pos += 4;
      } else if (wireType === 1) {
        if (pos + 8 > buf.length) break;
        pos += 8;
      } else {
        break;
      }
    }
    return fields;
  };

  const rootFields = parseMsg(buffer);
  // Look for nested account/product quota buckets carrying remaining/max seconds
  let best = null;
  const walk = (fields, depth = 0) => {
    if (depth > 4) return;
    const nums = fields.filter((f) => f.wireType === 0).map((f) => f.val);
    // Heuristic: bucket with two plausible second counts where max >= rem
    const f1 = fields.find((f) => f.fieldNo === 1 && f.wireType === 0)?.val;
    const f2 = fields.find((f) => f.fieldNo === 2 && f.wireType === 0)?.val;
    const f3 = fields.find((f) => f.fieldNo === 3 && f.wireType === 0)?.val;
    if (typeof f1 === 'number' && typeof f2 === 'number' && f1 >= 0 && f2 > 0 && f1 <= f2 && f2 <= 86400 * 30) {
      best = { remainingSeconds: f1, maxSeconds: f2, kind: depth <= 1 ? 'account' : 'product' };
    } else if (typeof f2 === 'number' && typeof f3 === 'number' && f2 >= 0 && f3 > 0 && f2 <= f3 && f3 <= 86400 * 30) {
      best = { remainingSeconds: f2, maxSeconds: f3, kind: depth <= 1 ? 'account' : 'product' };
    } else if (nums.length === 2 && nums[0] <= nums[1] && nums[1] <= 86400 * 30 && nums[1] >= 60) {
      best = { remainingSeconds: nums[0], maxSeconds: nums[1], kind: depth <= 1 ? 'account' : 'product' };
    }
    for (const f of fields) {
      if (f.wireType === 2 && f.buf.length >= 2) {
        walk(parseMsg(f.buf), depth + 1);
      }
    }
  };
  walk(rootFields);
  if (best) {
    return { available: true, ...best, unlimited: false };
  }
  return { available: true, kind: 'unlimited', remainingSeconds: null, maxSeconds: null, unlimited: true };
}

export async function fetchCloudTime(uhs, mpXstsToken, market = 'US') {
  const safeMarket = /^[A-Z]{2}$/.test(market) ? market : 'US';
  const url = `${OAUTH_CONFIG.cloudTimePrefix}${safeMarket}${OAUTH_CONFIG.cloudTimeSuffix}`;
  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      Authorization: `XBL3.0 x=${uhs};${mpXstsToken}`,
      'MS-CV': generateMsCv(),
    },
  });
  if (!res.ok) {
    throw Object.assign(new Error(`CloudTime HTTP ${res.status}`), { httpStatus: res.status });
  }
  const ab = await res.arrayBuffer();
  return parseCloudTimeResponse(Buffer.from(ab));
}

export async function fetchCloudCatalog(baseUri, gsToken, deviceInfo) {
  if (!isValidGssvBaseUri(baseUri)) throw new Error('Invalid region baseUri');
  const res = await fetchWithTimeout(`${baseUri}/v2/titles`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${gsToken}`,
      'x-gssv-client': 'XboxComBrowser',
      'X-MS-Device-Info': deviceInfo,
    },
  });
  if (!res.ok) throw Object.assign(new Error(`Catalog HTTP ${res.status}`), { httpStatus: res.status });
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

export async function fetchCloudMru(baseUri, gsToken, deviceInfo) {
  if (!isValidGssvBaseUri(baseUri)) throw new Error('Invalid region baseUri');
  const res = await fetchWithTimeout(`${baseUri}/v2/titles/mru?mr=25`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${gsToken}`,
      'x-gssv-client': 'XboxComBrowser',
      'X-MS-Device-Info': deviceInfo,
    },
  });
  if (!res.ok) throw Object.assign(new Error(`MRU HTTP ${res.status}`), { httpStatus: res.status });
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

export async function fetchSiglList(guid, market = 'US', locale = 'en-US') {
  return fetchSiglIds(guid, market, locale);
}

export async function fetchDisplayCatalogBatch(productIds, market = 'US', locale = 'en-US', options = {}) {
  return fetchDisplayCatalogChunks(productIds, market, locale, {
    chunkSize: 20,
    concurrency: 5,
    ...options,
  });
}

export async function probeHostRttMs(hostname, timeoutMs = 2500) {
  const cleanHost = String(hostname || '').replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
  if (!cleanHost || !/^[A-Za-z0-9.-]+$/.test(cleanHost)) return null;
  return new Promise((resolve) => {
    const start = performance.now();
    const sock = net.createConnection({ host: cleanHost, port: 443 });
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(val);
    };
    sock.setTimeout(timeoutMs);
    sock.on('connect', () => finish(Math.max(1, Math.round(performance.now() - start))));
    sock.on('timeout', () => finish(null));
    sock.on('error', () => finish(null));
  });
}

export async function gssvSessionRequest(method, baseUri, pathSuffix, gsToken, deviceInfo, bodyObj = undefined) {
  if (!isValidGssvBaseUri(baseUri)) throw new Error('Invalid GSSV region URI');
  const url = `${baseUri}${pathSuffix}`;
  const headers = {
    Authorization: `Bearer ${gsToken}`,
    'x-gssv-client': 'XboxComBrowser',
    'X-MS-Device-Info': deviceInfo,
  };
  const init = { method, headers };
  if (bodyObj !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
  }
  const res = await fetchWithTimeout(url, init, 25000);
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  return { ok: res.ok, status: res.status, json, raw: text };
}
