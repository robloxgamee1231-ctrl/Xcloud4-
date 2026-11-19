/* SPDX-License-Identifier: GPL-3.0-only */
import fs from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_SETTINGS = {
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

export function createInitialState() {
  return {
    version: 1,
    auth: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    favorites: [],
    myGames: [],
    localRecents: {},
    lastPublicMeta: {},
  };
}

export class StateStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'state.json');
    this.state = createInitialState();
    this._writeQueue = Promise.resolve();
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.state = {
          ...createInitialState(),
          ...parsed,
          settings: {
            public: { ...DEFAULT_SETTINGS.public, ...(parsed.settings?.public || {}) },
            lab: { ...DEFAULT_SETTINGS.lab, ...(parsed.settings?.lab || {}) },
          },
          favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
          myGames: Array.isArray(parsed.myGames) ? parsed.myGames : [],
          localRecents: parsed.localRecents && typeof parsed.localRecents === 'object' ? parsed.localRecents : {},
        };
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn('[StateStore] Failed to load state, resetting to defaults:', err.message);
      }
      this.state = createInitialState();
    }
    return this.state;
  }

  async save() {
    this._writeQueue = this._writeQueue.then(async () => {
      await fs.mkdir(this.dataDir, { recursive: true });
      const snapshot = structuredClone(this.state);
      if (snapshot.settings?.public?.rememberSession === false) {
        snapshot.auth = null;
      }
      const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmpPath, JSON.stringify(snapshot, null, 2), { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tmpPath, this.filePath);
    });
    return this._writeQueue;
  }

  getSanitizedAuth() {
    const auth = this.state.auth;
    if (!auth) return { signedIn: false };
    return {
      signedIn: true,
      liveStream: Boolean(auth.gsToken),
      provider: auth.provider || 'xbox',
      gamertag: auth.gamertag || 'Xbox Player',
      uhs: auth.uhs || '',
      offeringId: auth.offeringId || 'xgpuweb',
      regions: Array.isArray(auth.regions) ? auth.regions : [],
      activeRegion: auth.activeRegion || null,
      expiresAt: auth.expiresAt || 0,
      hasRefreshToken: Boolean(auth.refreshToken),
      cloudTime: auth.cloudTime || null,
    };
  }
}
