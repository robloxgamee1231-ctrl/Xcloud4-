/* SPDX-License-Identifier: GPL-3.0-only */
/* Main XCloud4 UI 2.0 Browser Application Shell & In-Site Xbox Cloud HUD Router. */

import { api } from './api.js';
import { appUrl, getCorsProxyUrl, getRelayUrl, isStaticMode, probeAndSetRelayUrl, setRelayUrl } from './paths.js';
import { buildPlayXboxUrl } from './xbox-catalog.js';
import { initI18n, setLanguage, setIdentityVersions, t, w } from './i18n.js';
import { icon, brandWordmark } from './icons.js';
import { KeyboardGamepadDriver, readBrowserGamepad, triggerBrowserRumble, XBOX_BUTTONS } from './input-engine.js';
import { generateQrSvg } from './qrcode-svg.js';
import { runBootSequence } from './views/boot.js';
import { showModal, closeModal, escapeHtml } from './views/cards.js';
import { renderHomeView } from './views/home.js';
import { renderDiscoverView } from './views/discover.js';
import { renderCatalogView } from './views/catalog.js';
import { renderMyGamesView } from './views/my-games.js';
import { renderSearchView } from './views/search.js';
import { renderGamePageView } from './views/game-page.js';
import { renderFortniteView } from './views/fortnite.js';
import { renderAccountView } from './views/account.js';
import { renderSettingsView } from './views/settings.js';
import { renderSupportView } from './views/support.js';
import { renderAboutView } from './views/about.js';
import { launchGameStream } from './views/loading-stream.js';

const HUD_NAV = [
  { id: 'home', icon: 'home', labelKey: 'X4_TR_APPLE_HOME' },
  { id: 'discover', icon: 'world', labelKey: 'X4_TR_DISCOVER' },
  { id: 'catalog', icon: 'device-desktop', labelKey: 'X4_TR_CATALOG_TITLE' },
  { id: 'my-games', icon: 'device-gamepad', labelKey: 'X4_TR_U49_MY_GAMES' },
  { id: 'fortnite', icon: 'play', label: 'Fortnite', freeBadge: true },
];

const state = {
  route: 'home',
  history: [],
  heroIndex: 0,
  selectedProductId: null,
  selectedProductDetail: null,
  auth: { signedIn: false },
  settings: null,
  draftSettings: null,
  settingsDirty: false,
  settingsSection: 'stream',
  activeProfile: null,
  accessCountries: [],
  serverPings: [],
  catalogItems: [],
  catalogSource: 'offline-fallback',
  publicLists: { free: [], new: [], popular: [], leaving: [] },
  favorites: [],
  myGames: [],
  localRecents: {},
  catalogFilter: { collection: 'all', genre: 'ALL', access: 'all', sort: 'featured', page: 1 },
  myGamesFilter: { tab: 'favorites', sort: 'recent' },
  searchQuery: '',
  searchShowAll: false,
  showOsk: false,
  deviceLogin: null,
  updateCheck: null,
};

const keyboardDriver = new KeyboardGamepadDriver();
let devicePollTimer = 0;
let clockTimer = 0;
let connectedPadCount = 0;

function formatClock() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function preserveFocusRender() {
  const activeId = document.activeElement?.id;
  const isSearchFocus = activeId === 'x4SearchInput' || activeId === 'x4HudSearchInput';
  const selStart = isSearchFocus ? document.activeElement.selectionStart : null;
  renderShell();
  if (isSearchFocus) {
    const again = document.getElementById(activeId);
    if (again) {
      again.focus();
      if (selStart !== null) again.setSelectionRange(selStart, selStart);
    }
  }
}

async function syncStateFromBackend() {
  const res = await api.getState();
  state.auth = res.auth || { signedIn: false };
  state.settings = res.settings;
  state.draftSettings = structuredClone(res.settings);
  state.settingsDirty = false;
  state.activeProfile = res.activeProfile;
  state.accessCountries = res.accessCountries || [];
  state.favorites = res.favorites || [];
  state.myGames = res.myGames || [];
  state.localRecents = res.localRecents || {};

  setLanguage(state.settings.public.language);
  setIdentityVersions(Boolean(state.settings.lab.enabled));
}

function mergeCatalogItems(pubMeta, catItems) {
  const mergedMap = new Map();
  for (const item of Object.values(pubMeta || {})) {
    if (item?.productId) mergedMap.set(item.productId, item);
  }
  for (const item of catItems || []) {
    if (item?.productId) {
      mergedMap.set(item.productId, { ...(mergedMap.get(item.productId) || {}), ...item });
    }
  }
  return Array.from(mergedMap.values());
}

async function refreshCatalogData() {
  try {
    const [pub, rec] = await Promise.all([
      api.getPublicLists(),
      api.getRecents(),
    ]);
    state.publicLists = pub.lists || state.publicLists;
    state.catalogSource = pub.source || state.catalogSource;
    state.catalogItems = mergeCatalogItems(pub.metadata, []);
    if (rec?.localRecents) state.localRecents = rec.localRecents;

    // Background hydrate full catalog (~400+ titles) without blocking initial paint
    api.getCatalog().then((cat) => {
      const nextItems = mergeCatalogItems(pub.metadata, cat?.items || []);
      if (cat?.source) state.catalogSource = cat.source;
      if (nextItems.length >= state.catalogItems.length) {
        state.catalogItems = nextItems;
        if (!document.getElementById('x4StreamOverlay') && !document.getElementById('x4ModalOverlay')) {
          preserveFocusRender();
        }
      }
    }).catch(() => {});
  } catch (err) {
    console.warn('Catalog refresh error:', err);
  }
}

function showToast(msg, variant = 'info') {
  const existing = document.getElementById('x4Toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'x4Toast';
  el.className = `x4-toast is-${variant}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function checkCloudTimeAlerts() {
  const ct = state.auth?.cloudTime;
  if (!ct?.available || ct.unlimited || !Number.isFinite(ct.remainingSeconds)) return;
  const mins = Math.round(ct.remainingSeconds / 60);
  if (mins <= 0) {
    showToast(`${t('X4_TR_UI2_MODAL_CLOUD_TITLE')}: 0 min remaining`, 'danger');
  } else if (mins <= 5) {
    showToast(`${t('X4_TR_UI2_MODAL_CLOUD_TITLE')}: ${mins} min remaining`, 'danger');
  } else if (mins <= 15) {
    showToast(`${t('X4_TR_UI2_MODAL_CLOUD_TITLE')}: ${mins} min remaining`, 'amber');
  }
}

function padChipLabel(count) {
  return count > 0 ? `P${count} Ready` : 'KB / Touch';
}

function renderShell() {
  const root = document.getElementById('app');
  const isLab = Boolean(state.settings?.lab?.enabled);
  const avatarLetter = state.auth?.signedIn ? (state.auth.gamertag || 'X')[0].toUpperCase() : '';
  const qualityBadge = isLab ? state.activeProfile?.label || '1080p-HQ' : (state.settings?.public?.quality || '1080p-hq').toUpperCase();
  const serverBadge = state.settings?.public?.serverName || 'Auto';

  let pageHtml = '';
  if (state.route === 'home') pageHtml = renderHomeView(state);
  else if (state.route === 'discover') pageHtml = renderDiscoverView(state);
  else if (state.route === 'catalog') pageHtml = renderCatalogView(state);
  else if (state.route === 'my-games') pageHtml = renderMyGamesView(state);
  else if (state.route === 'search') pageHtml = renderSearchView(state);
  else if (state.route === 'game') {
    const item =
      state.selectedProductDetail ||
      state.catalogItems.find((g) => g.productId === state.selectedProductId);
    pageHtml = renderGamePageView(state, item);
  } else if (state.route === 'fortnite') pageHtml = renderFortniteView(state);
  else if (state.route === 'account') pageHtml = renderAccountView(state);
  else if (state.route === 'settings') pageHtml = renderSettingsView(state);
  else if (state.route === 'support') pageHtml = renderSupportView();
  else if (state.route === 'about') pageHtml = renderAboutView(state);

  const hudNavBtn = (item) => `
    <button class="x4-hud-link ${state.route === item.id ? 'is-active' : ''} x4-focusable"
      data-action="navigate" data-route="${item.id}" type="button">
      ${icon(item.icon)}
      <span>${item.label ? escapeHtml(item.label) : t(item.labelKey)}</span>
      ${item.freeBadge ? `<span class="x4-hud-free-dot">FREE</span>` : ''}
    </button>`;

  root.innerHTML = `
    <div class="x4-shell ${isLab ? 'is-lab-mode' : ''}">
      <header class="x4-hud-bar" aria-label="Xbox Cloud HUD">
        <div class="x4-hud-left">
          <button class="x4-brand-btn x4-focusable" data-action="navigate" data-route="home" type="button" title="XCloud4 Home">
            ${brandWordmark(true)}
            ${isLab ? `<span class="x4-lab-pill">${w('labBadge')}</span>` : ''}
          </button>

          <nav class="x4-hud-nav" aria-label="Primary Navigation">
            ${HUD_NAV.map(hudNavBtn).join('')}
          </nav>
        </div>

        <div class="x4-hud-center">
          <div class="x4-hud-search">
            ${icon('search')}
            <input id="x4HudSearchInput" class="x4-hud-search-input x4-focusable" type="search"
              value="${escapeHtml(state.searchQuery)}"
              placeholder="${escapeHtml(w('searchPlaceholder'))}" autocomplete="off" aria-label="Search games" />
            <kbd class="x4-hud-kbd">/</kbd>
          </div>
        </div>

        <div class="x4-hud-right">
          <button id="x4HudPadChip" class="x4-hud-pill ${connectedPadCount > 0 ? 'is-pad-ready' : ''} x4-focusable"
            data-action="open-controllers" type="button" title="Controller Status">
            ${icon('device-gamepad')}
            <span>${padChipLabel(connectedPadCount)}</span>
          </button>

          <button class="x4-hud-pill x4-hide-sm x4-focusable" data-action="navigate" data-route="settings" type="button" title="Stream Region & Quality">
            ${icon('wifi')}
            <span>${escapeHtml(serverBadge)} · ${escapeHtml(qualityBadge)}</span>
          </button>

          <button class="x4-hud-icon-btn ${isLab ? 'is-lab-on' : ''} x4-focusable"
            data-action="toggle-lab" type="button" title="${escapeHtml(w('labToggle'))} (F9)">
            ${icon('flask')}
          </button>

          <button class="x4-hud-icon-btn ${state.route === 'settings' ? 'is-active' : ''} x4-focusable"
            data-action="navigate" data-route="settings" type="button" title="${escapeHtml(t('X4_TR_U49_SETTINGS'))}">
            ${icon('settings')}
          </button>

          <span class="x4-cap-clock x4-hide-md" id="x4TopClock">${formatClock()}</span>

          ${
            state.auth?.signedIn
              ? `<button class="x4-hud-profile is-signed-in x4-focusable" data-action="navigate" data-route="account" type="button" title="${escapeHtml(state.auth.gamertag)}">
                   <span class="x4-hud-avatar">${escapeHtml(avatarLetter)}<span class="x4-online-dot is-online"></span></span>
                   <span class="x4-hud-gamertag">${escapeHtml(state.auth.gamertag)}</span>
                 </button>`
              : `<button class="x4-hud-signin x4-focusable" data-action="open-signin-modal" type="button">
                   ${icon('user')} <span>${w('msSignInBtn')}</span>
                 </button>`
          }
        </div>
      </header>

      <main class="x4-content" id="x4MainContent">
        ${pageHtml}

        <footer class="x4-app-footer">
          <div class="x4-footer-left">
            <strong>XCloud4</strong>
            <span>v${isLab ? '0.7.111-lab' : '1.3.0-beta'}</span>
            <span>·</span>
            <span>Xbox Cloud WebRTC</span>
          </div>
          <div class="x4-footer-links">
            <button class="x4-footer-link x4-focusable" data-action="navigate" data-route="account" type="button">${t('X4_TR_U49_ACCOUNT_TITLE')}</button>
            <button class="x4-footer-link x4-focusable" data-action="navigate" data-route="settings" type="button">${t('X4_TR_U49_SETTINGS')}</button>
            <button class="x4-footer-link x4-focusable" data-action="navigate" data-route="about" type="button">${t('X4_TR_U49_ABOUT_TITLE')}</button>
            <button class="x4-footer-link x4-focusable" data-action="navigate" data-route="support" type="button">${t('X4_TR_U49_SUPPORT_TITLE')}</button>
          </div>
        </footer>
      </main>
    </div>
  `;

  bindViewInputs();
}

function navigateTo(route, { pushHistory = true, forceDiscard = false } = {}) {
  if (state.route === 'settings' && route !== 'settings' && state.settingsDirty && !forceDiscard) {
    showModal({
      title: t('X4_TR_UI2_SETTINGS_UNSAVED_TITLE'),
      bodyHtml: `<p>${t('X4_TR_UI2_SETTINGS_UNSAVED_BODY')}</p>`,
      buttons: [
        {
          label: t('X4_TR_UI2_SETTINGS_DISCARD'),
          onClick: () => {
            state.draftSettings = structuredClone(state.settings);
            state.settingsDirty = false;
            setLanguage(state.settings.public.language);
            navigateTo(route, { pushHistory, forceDiscard: true });
          },
        },
        {
          label: t('X4_TR_UI2_SETTINGS_SAVE'),
          primary: true,
          onClick: async () => {
            await persistSettings();
            navigateTo(route, { pushHistory, forceDiscard: true });
          },
        },
      ],
    });
    return;
  }

  if (pushHistory && state.route !== route) {
    state.history.push({ route: state.route, productId: state.selectedProductId });
  }
  state.route = route;
  renderShell();
  const main = document.getElementById('x4MainContent');
  if (main) main.scrollTop = 0;

  if (route === 'settings' && state.settingsSection === 'server' && state.serverPings.length === 0) {
    api.pingServers().then((r) => {
      state.serverPings = r.regions || [];
      if (state.route === 'settings' && state.settingsSection === 'server') renderShell();
    }).catch(() => {});
  }
}

async function openGamePage(productId) {
  state.history.push({ route: state.route, productId: state.selectedProductId });
  state.selectedProductId = productId;
  state.selectedProductDetail = state.catalogItems.find((i) => i.productId === productId) || null;
  state.route = 'game';
  renderShell();
  const main = document.getElementById('x4MainContent');
  if (main) main.scrollTop = 0;
  try {
    const res = await api.getProductDetails(productId);
    if (res?.item && state.selectedProductId === productId) {
      state.selectedProductDetail = { ...(state.selectedProductDetail || {}), ...res.item };
      if (state.route === 'game') renderShell();
    }
  } catch {
    // Keep base catalog details
  }
}

async function persistSettings() {
  const prevLang = state.settings?.public?.language;
  const res = await api.saveSettings(state.draftSettings);
  state.settings = res.settings;
  state.draftSettings = structuredClone(res.settings);
  state.activeProfile = res.activeProfile;
  state.auth = res.auth || state.auth;
  state.settingsDirty = false;
  setLanguage(state.settings.public.language);
  setIdentityVersions(Boolean(state.settings.lab.enabled));
  showToast('Settings saved', 'ok');
  renderShell();
  if (prevLang !== state.settings.public.language) {
    await refreshCatalogData();
    renderShell();
  }
}

async function toggleLabMode() {
  const nextLab = !state.settings.lab.enabled;
  state.draftSettings.lab.enabled = nextLab;
  const res = await api.saveSettings({ lab: { enabled: nextLab } });
  state.settings = res.settings;
  state.draftSettings = structuredClone(res.settings);
  state.activeProfile = res.activeProfile;
  setIdentityVersions(nextLab);
  if (!nextLab && state.settingsSection === 'lab') {
    state.settingsSection = 'stream';
  }
  showToast(nextLab ? 'Lab Mode activated (v0.7.111-lab)' : 'Public Mode restored (v1.3.0-beta)', 'ok');
  renderShell();
}

let msAuthPopupWindow = null;

function openMicrosoftPopup(otcUrl) {
  try {
    msAuthPopupWindow = window.open(
      otcUrl,
      'xcloud4_microsoft_signin',
      'popup=yes,width=500,height=700,noopener=no'
    );
    if (msAuthPopupWindow?.focus) msAuthPopupWindow.focus();
  } catch {
    // Popup blocker fallback still shows code & QR inside modal
  }
}

function closeMicrosoftPopup() {
  try {
    if (msAuthPopupWindow && !msAuthPopupWindow.closed) {
      msAuthPopupWindow.close();
    }
  } catch {
    // Ignore cross-origin close restrictions
  }
  msAuthPopupWindow = null;
}

async function inspectRelayWorkerCode() {
  try {
    const code = await fetch(appUrl('workers/xcloud4-relay.js')).then((r) => r.text());
    showModal({
      title: 'Cloudflare Worker Xbox Relay (workers/xcloud4-relay.js)',
      bodyHtml: `
        <p class="x4-muted">Deploy this zero-dependency script on Cloudflare Workers (free tier) and paste its <code>https://*.workers.dev</code> URL into XCloud4 Relay so GitHub Pages can stream WebRTC directly in-site.</p>
        <pre class="x4-code-viewer">${escapeHtml(code)}</pre>`,
      buttons: [
        {
          label: 'Copy Worker Script',
          onClick: async () => {
            await navigator.clipboard?.writeText(code).catch(() => {});
            showToast('Worker script copied', 'ok');
          },
          closeOnClick: false,
        },
        { label: 'Close', primary: true },
      ],
    });
  } catch (err) {
    showToast(err.message || 'Unable to load worker script', 'danger');
  }
}

async function openRelaySetupModal({ pendingProductId = null, customMessage = '' } = {}) {
  const currentRelay = getRelayUrl();
  const modal = showModal({
    title: w('relaySetupTitle'),
    bodyHtml: `
      <div class="x4-modal-stack">
        <p class="x4-muted">${escapeHtml(customMessage || w('relaySetupBody'))}</p>
        <label class="x4-input-label">
          <span>Relay URL</span>
          <input id="x4ModalRelayInput" class="x4-input x4-focusable" type="url"
            value="${escapeHtml(currentRelay)}" placeholder="${escapeHtml(w('relayPlaceholder'))}" autocomplete="off" />
        </label>
        <div id="x4ModalRelayStatus" class="x4-muted"></div>
      </div>`,
    buttons: [
      { label: t('X4_TR_UI2_SETTINGS_LAB_CANCEL') },
      {
        label: 'Cloudflare Worker Code',
        onClick: () => inspectRelayWorkerCode(),
        closeOnClick: false,
      },
      {
        label: w('connectRelayBtn'),
        primary: true,
        closeOnClick: false,
        onClick: async () => {
          const input = document.getElementById('x4ModalRelayInput');
          const statusEl = document.getElementById('x4ModalRelayStatus');
          if (statusEl) statusEl.textContent = 'Checking relay health...';
          try {
            const res = await probeAndSetRelayUrl(input?.value || '');
            state.serverPings = [];
            if (res.type === 'cors-proxy') {
              await api.upgradeSession().catch(() => {});
            }
            await syncStateFromBackend();
            await refreshCatalogData();
            closeModal();
            renderShell();
            showToast(`Relay connected (${res.type})`, 'ok');
            if (pendingProductId) {
              if (!state.auth?.signedIn || (res.type === 'node' && !state.auth?.liveStream)) {
                openMicrosoftSignInModal({
                  onSuccess: () => startPlayTitle(pendingProductId),
                });
              } else {
                startPlayTitle(pendingProductId);
              }
            }
          } catch (err) {
            if (statusEl) statusEl.textContent = err.message;
            showToast(err.message, 'danger');
          }
        },
      },
    ],
  });
  return modal;
}

async function openMicrosoftSignInModal({ onSuccess = null } = {}) {
  clearInterval(devicePollTimer);
  const modal = showModal({
    title: w('msSignInBtn'),
    bodyHtml: `<div class="x4-modal-stack"><p class="x4-muted">${escapeHtml(w('signInModalSub'))}</p><div id="x4AuthModalBody"><p class="x4-muted">Requesting Microsoft sign-in code...</p></div></div>`,
    buttons: [
      {
        label: t('X4_TR_UI2_SETTINGS_LAB_CANCEL'),
        onClick: () => {
          clearInterval(devicePollTimer);
          closeMicrosoftPopup();
          state.deviceLogin = null;
        },
      },
    ],
  });

  const renderModalError = (message) => {
    const body = modal.querySelector('#x4AuthModalBody');
    if (!body) return;
    body.innerHTML = `
      <div class="x4-warn-box">
        <strong>Microsoft OAuth Unavailable</strong>
        <p>${escapeHtml(message)}</p>
        <div class="x4-account-cta-row">
          <button class="x4-btn is-primary x4-focusable" id="x4AuthRetryBtn" type="button">${icon('refresh')} <span>Retry</span></button>
          <button class="x4-btn is-secondary x4-focusable" id="x4AuthRelayBtn" type="button">${icon('server')} <span>${w('connectRelayBtn')}</span></button>
        </div>
      </div>`;
    body.querySelector('#x4AuthRetryBtn')?.addEventListener('click', () => {
      closeModal();
      openMicrosoftSignInModal({ onSuccess });
    });
    body.querySelector('#x4AuthRelayBtn')?.addEventListener('click', () => {
      closeModal();
      openRelaySetupModal();
    });
  };

  try {
    const res = await api.startDeviceCode();
    const expiresAt = Date.now() + res.expiresIn * 1000;
    state.deviceLogin = {
      userCode: res.userCode,
      verificationUri: res.verificationUri,
      expiresAt,
    };
    const uri = res.verificationUri || 'https://www.microsoft.com/link';
    const otcUrl = `${uri}${uri.includes('?') ? '&' : '?'}otc=${encodeURIComponent(res.userCode)}`;
    const qrSvg = generateQrSvg(otcUrl);

    const body = modal.querySelector('#x4AuthModalBody');
    if (!body || !document.getElementById('x4ModalOverlay')) return;
    body.innerHTML = `
      <div class="x4-device-box">
        <div class="x4-qr-card">${qrSvg}</div>
        <div class="x4-device-steps">
          <div class="x4-step-line"><span class="x4-step-num">1</span><span>${t('X4_TR_U49_ACCOUNT_STEP_SCAN')} <strong>${escapeHtml(uri)}</strong></span></div>
          <div class="x4-step-line"><span class="x4-step-num">2</span><span>${t('X4_TR_U49_ACCOUNT_STEP_CODE')}</span></div>
          <div class="x4-code-row">
            <code class="x4-device-code">${escapeHtml(res.userCode)}</code>
            <button class="x4-btn is-secondary x4-focusable" id="x4ModalCopyCode" type="button">Copy</button>
          </div>
          <div class="x4-account-cta-row">
            <button class="x4-btn is-primary x4-focusable" id="x4ModalOpenPopup" type="button">
              ${icon('world')} <span>${escapeHtml(w('openLinkPopup'))}</span>
            </button>
          </div>
          <div class="x4-muted" id="x4ModalAuthWait">${t('X4_TR_U49_ACCOUNT_WAIT')}</div>
        </div>
      </div>`;

    body.querySelector('#x4ModalCopyCode')?.addEventListener('click', async () => {
      await navigator.clipboard?.writeText(res.userCode).catch(() => {});
      showToast(`Code ${res.userCode} copied`, 'ok');
    });
    body.querySelector('#x4ModalOpenPopup')?.addEventListener('click', () => {
      openMicrosoftPopup(otcUrl);
    });

    devicePollTimer = setInterval(async () => {
      if (!document.getElementById('x4ModalOverlay')) {
        clearInterval(devicePollTimer);
        closeMicrosoftPopup();
        return;
      }
      const rem = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      const waitEl = document.getElementById('x4ModalAuthWait');
      if (waitEl) waitEl.textContent = `${t('X4_TR_U49_ACCOUNT_WAIT')} (${Math.floor(rem / 60)}m ${rem % 60}s)`;

      try {
        const polled = await api.pollDeviceCode();
        if (polled.status === 'authorized') {
          clearInterval(devicePollTimer);
          closeMicrosoftPopup();
          state.deviceLogin = null;
          state.auth = polled.auth;
          closeModal();
          await refreshCatalogData();
          checkCloudTimeAlerts();
          showToast(`Signed in as ${state.auth?.gamertag || 'Xbox Player'}`, 'ok');
          renderShell();
          if (onSuccess) onSuccess();
        }
      } catch (err) {
        clearInterval(devicePollTimer);
        closeMicrosoftPopup();
        state.deviceLogin = null;
        renderModalError(err.message || 'Sign-in failed');
      }
    }, (res.interval || 5) * 1000);
  } catch (err) {
    renderModalError(err.message || 'Unable to start Microsoft sign-in');
  }
}

async function startDeviceLoginFlow() {
  try {
    const res = await api.startDeviceCode();
    state.deviceLogin = {
      userCode: res.userCode,
      verificationUri: res.verificationUri,
      expiresAt: Date.now() + res.expiresIn * 1000,
    };
    renderShell();
    clearInterval(devicePollTimer);
    devicePollTimer = setInterval(async () => {
      try {
        const polled = await api.pollDeviceCode();
        if (polled.status === 'authorized') {
          clearInterval(devicePollTimer);
          closeMicrosoftPopup();
          state.deviceLogin = null;
          state.auth = polled.auth;
          await refreshCatalogData();
          checkCloudTimeAlerts();
          showToast(`Signed in as ${state.auth?.gamertag || 'Xbox Player'}`, 'ok');
          renderShell();
        }
      } catch (err) {
        clearInterval(devicePollTimer);
        closeMicrosoftPopup();
        state.deviceLogin = null;
        showToast(err.message || 'Sign-in failed', 'danger');
        renderShell();
      }
    }, (res.interval || 5) * 1000);
  } catch (err) {
    if (err.payload?.oauthUnavailable || err.payload?.networkUnavailable) {
      state.deviceLogin = { oauthUnavailable: true, error: err.message };
      renderShell();
    } else {
      showToast(err.message, 'danger');
    }
  }
}

async function startPlayTitle(productId) {
  if (!state.auth?.signedIn) {
    await openMicrosoftSignInModal({
      onSuccess: () => startPlayTitle(productId),
    });
    return;
  }

  const hasStreamTransport =
    Boolean(state.auth?.liveStream) || !isStaticMode() || Boolean(getCorsProxyUrl());
  if (!hasStreamTransport) {
    await openRelaySetupModal({ pendingProductId: productId });
    return;
  }

  const item =
    state.selectedProductDetail?.productId === productId
      ? state.selectedProductDetail
      : state.catalogItems.find((i) => i.productId === productId) || { productId, titleId: productId, title: productId };

  await launchGameStream({
    title: item,
    profile: state.activeProfile,
    settings: state.settings,
    keyboardDriver,
    onExit: async () => {
      await syncStateFromBackend();
      await refreshCatalogData();
      renderShell();
    },
  });
}

function bindViewInputs() {
  const hudSearch = document.getElementById('x4HudSearchInput');
  if (hudSearch) {
    hudSearch.addEventListener('input', (e) => {
      const pos = e.target.selectionStart;
      state.searchQuery = e.target.value;
      state.searchShowAll = false;
      if (state.route !== 'search') state.route = 'search';
      renderShell();
      const again = document.getElementById('x4HudSearchInput');
      if (again) {
        again.focus();
        again.setSelectionRange(pos, pos);
      }
    });
    hudSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && state.route !== 'search') {
        navigateTo('search');
      }
    });
  }

  const genreEl = document.getElementById('x4CatGenre');
  if (genreEl) {
    genreEl.addEventListener('change', (e) => {
      state.catalogFilter.genre = e.target.value;
      state.catalogFilter.page = 1;
      renderShell();
    });
  }
  const accessEl = document.getElementById('x4CatAccess');
  if (accessEl) {
    accessEl.addEventListener('change', (e) => {
      state.catalogFilter.access = e.target.value;
      state.catalogFilter.page = 1;
      renderShell();
    });
  }
  const sortEl = document.getElementById('x4CatSort');
  if (sortEl) {
    sortEl.addEventListener('change', (e) => {
      state.catalogFilter.sort = e.target.value;
      state.catalogFilter.page = 1;
      renderShell();
    });
  }
  const mySortEl = document.getElementById('x4MyGamesSort');
  if (mySortEl) {
    mySortEl.addEventListener('change', (e) => {
      state.myGamesFilter.sort = e.target.value;
      renderShell();
    });
  }
  const searchInput = document.getElementById('x4SearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const pos = e.target.selectionStart;
      state.searchQuery = e.target.value;
      state.searchShowAll = false;
      renderShell();
      const again = document.getElementById('x4SearchInput');
      if (again) {
        again.focus();
        again.setSelectionRange(pos, pos);
      }
    });
  }
}

async function handleDelegatedClick(e) {
  const target = e.target.closest('button, [data-action]');
  if (!target) return;

  // Shelf horizontal scroll buttons
  if (target.dataset.shelfScroll) {
    const dir = Number(target.dataset.shelfScroll);
    const id = target.dataset.shelfId;
    const track = document.querySelector(`[data-shelf-track="${id}"]`);
    if (track) {
      const step = Math.max(280, Math.round(track.clientWidth * 0.78));
      track.scrollBy({ left: dir * step, behavior: 'smooth' });
    }
    return;
  }

  // Hero spotlight controls
  if (target.dataset.heroStep) {
    state.heroIndex += Number(target.dataset.heroStep);
    renderShell();
    return;
  }
  if (target.dataset.heroIdx !== undefined) {
    state.heroIndex = Number(target.dataset.heroIdx);
    renderShell();
    return;
  }

  // Collection pills inside catalog
  if (target.dataset.catCollection) {
    state.catalogFilter.collection = target.dataset.catCollection;
    state.catalogFilter.page = 1;
    renderShell();
    return;
  }

  const action = target.dataset.action;
  if (action === 'navigate') {
    const route = target.dataset.route;
    if (route) navigateTo(route);
    return;
  }
  if (action === 'open-controllers') {
    state.settingsSection = 'controllers';
    navigateTo('settings');
    return;
  }
  if (action === 'browse-collection') {
    state.catalogFilter.collection = target.dataset.collection || 'all';
    state.catalogFilter.genre = 'ALL';
    state.catalogFilter.access = target.dataset.collection === 'free' ? 'free' : 'all';
    state.catalogFilter.page = 1;
    navigateTo('catalog');
    return;
  }
  if (action === 'browse-genre') {
    state.catalogFilter.collection = 'all';
    state.catalogFilter.genre = target.dataset.genre || 'ALL';
    state.catalogFilter.access = 'all';
    state.catalogFilter.page = 1;
    navigateTo('catalog');
    return;
  }
  if (action === 'back') {
    const prev = state.history.pop();
    if (prev) {
      if (prev.route === 'game' && prev.productId) openGamePage(prev.productId);
      else navigateTo(prev.route, { pushHistory: false });
    } else {
      navigateTo('home', { pushHistory: false });
    }
    return;
  }
  if (action === 'open-game') {
    const pid = target.dataset.productId;
    if (pid) openGamePage(pid);
    return;
  }
  if (action === 'play-game') {
    const pid = target.dataset.productId;
    if (pid) startPlayTitle(pid);
    return;
  }
  if (action === 'open-signin-modal') {
    await openMicrosoftSignInModal();
    return;
  }
  if (action === 'open-relay-modal') {
    await openRelaySetupModal();
    return;
  }
  if (action === 'inspect-relay-worker') {
    await inspectRelayWorkerCode();
    return;
  }
  if (action === 'open-ms-popup') {
    const otcUrl = target.dataset.otcUrl;
    if (otcUrl) openMicrosoftPopup(otcUrl);
    return;
  }
  if (action === 'save-relay') {
    const input = document.getElementById('x4RelayInput');
    try {
      const res = await probeAndSetRelayUrl(input?.value || '');
      state.serverPings = [];
      if (res.type === 'cors-proxy') {
        await api.upgradeSession().catch(() => {});
      }
      await syncStateFromBackend();
      await refreshCatalogData();
      renderShell();
      showToast(res.url ? `Relay connected (${res.type}): ${res.url}` : 'Relay cleared', 'ok');
    } catch (err) {
      showToast(err.message, 'danger');
    }
    return;
  }
  if (action === 'clear-relay') {
    setRelayUrl('');
    state.serverPings = [];
    await syncStateFromBackend();
    await refreshCatalogData();
    renderShell();
    showToast('Relay disconnected', 'ok');
    return;
  }
  if (action === 'toggle-lab') {
    await toggleLabMode();
    return;
  }
  if (action === 'toggle-favorite') {
    const pid = target.dataset.productId;
    const res = await api.toggleFavorite(pid);
    state.favorites = res.favorites || [];
    renderShell();
    return;
  }
  if (action === 'toggle-mygames') {
    const pid = target.dataset.productId;
    const res = await api.toggleMyGames(pid);
    state.myGames = res.myGames || [];
    renderShell();
    return;
  }
  if (action === 'store-qr') {
    const pid = target.dataset.productId;
    const item =
      state.selectedProductDetail?.productId === pid
        ? state.selectedProductDetail
        : state.catalogItems.find((g) => g.productId === pid);
    const url = item?.playUrl || buildPlayXboxUrl(pid, item?.title || 'game');
    showModal({
      title: w('openStoreQr'),
      bodyHtml: `<div class="x4-qr-modal-center"><div class="x4-qr-card is-lg">${generateQrSvg(url)}</div><p class="x4-muted">${escapeHtml(url)}</p></div>`,
      buttons: [{ label: 'Close', primary: true }],
    });
    return;
  }
  if (action === 'zoom-shot') {
    const url = target.dataset.shotUrl;
    const title = target.dataset.shotTitle || 'Screenshot';
    showModal({
      title,
      bodyHtml: `<img class="x4-lightbox-img" src="${escapeHtml(url)}" alt="${escapeHtml(title)}" />`,
      buttons: [{ label: 'Close', primary: true }],
    });
    return;
  }
  if (action === 'start-device-login') {
    await startDeviceLoginFlow();
    return;
  }
  if (action === 'copy-device-code') {
    const code = target.dataset.code;
    if (code && navigator.clipboard) {
      await navigator.clipboard.writeText(code).catch(() => {});
      showToast(`Code ${code} copied`, 'ok');
    }
    return;
  }
  if (action === 'refresh-account' || action === 'refresh-cloud-time') {
    try {
      const res = await api.getCloudTime();
      state.auth.cloudTime = res.cloudTime;
      checkCloudTimeAlerts();
      renderShell();
      showToast('Account synced', 'ok');
    } catch (err) {
      showToast(err.message, 'danger');
    }
    return;
  }
  if (action === 'logout-prompt') {
    const forget = target.dataset.forget === 'true';
    showModal({
      title: forget ? t('X4_TR_U49_ACCOUNT_FORGET') : t('X4_TR_U49_ACCOUNT_SIGN_OUT'),
      bodyHtml: `<p>${forget ? t('X4_TR_U49_ACCOUNT_LOGOUT_BODY') : t('X4_TR_U49_ACCOUNT_LOGOUT_REMEMBER')}</p>`,
      buttons: [
        { label: t('X4_TR_UI2_SETTINGS_LAB_CANCEL') },
        {
          label: forget ? t('X4_TR_U49_ACCOUNT_FORGET') : t('X4_TR_U49_ACCOUNT_SIGN_OUT'),
          danger: forget,
          primary: !forget,
          onClick: async () => {
            const res = await api.logout(forget);
            state.auth = res.auth;
            if (forget) {
              state.favorites = [];
              state.myGames = [];
              state.localRecents = {};
            }
            renderShell();
          },
        },
      ],
    });
    return;
  }
  if (action === 'cancel-device-login') {
    clearInterval(devicePollTimer);
    state.deviceLogin = null;
    renderShell();
    return;
  }
  if (action === 'test-rumble') {
    const ok = await triggerBrowserRumble(0, { leftMotor: 75, rightMotor: 55, durationMs: 280 });
    showToast(ok ? 'Dual-motor haptic test triggered on Controller 1' : 'No physical haptic gamepad detected', ok ? 'ok' : 'amber');
    return;
  }
  if (action === 'reset-settings') {
    showModal({
      title: 'Reset Settings',
      bodyHtml: '<p>Restore all Public and Lab streaming preferences back to defaults?</p>',
      buttons: [
        { label: t('X4_TR_UI2_SETTINGS_LAB_CANCEL') },
        {
          label: 'Reset Defaults',
          danger: true,
          onClick: async () => {
            const res = await api.resetSettings(Boolean(state.settings?.lab?.enabled));
            state.settings = res.settings;
            state.draftSettings = structuredClone(res.settings);
            state.activeProfile = res.activeProfile;
            state.settingsDirty = false;
            setLanguage(state.settings.public.language);
            showToast('Settings restored to defaults', 'ok');
            renderShell();
          },
        },
      ],
    });
    return;
  }
  if (action === 'ping-servers') {
    showToast('Measuring server RTT...', 'info');
    const res = await api.pingServers();
    state.serverPings = res.regions || [];
    renderShell();
    return;
  }
  if (action === 'save-settings') {
    await persistSettings();
    return;
  }
  if (action === 'discard-settings') {
    state.draftSettings = structuredClone(state.settings);
    state.settingsDirty = false;
    setLanguage(state.settings.public.language);
    renderShell();
    return;
  }
  if (action === 'inspect-lua') {
    const script = target.dataset.script;
    const text = await fetch(appUrl(`assets/scripts/${encodeURIComponent(script)}`)).then((r) => r.text());
    showModal({
      title: script,
      bodyHtml: `<pre class="x4-code-viewer">${escapeHtml(text)}</pre>`,
      buttons: [{ label: 'Close', primary: true }],
    });
    return;
  }
  if (action === 'check-updates') {
    state.updateCheck = { checking: true };
    renderShell();
    try {
      state.updateCheck = await api.checkUpdates();
    } catch (err) {
      state.updateCheck = { error: err.message };
    }
    renderShell();
    return;
  }
  if (action === 'view-licenses') {
    const res = await api.getLicenses();
    const listHtml = (res.licenses || [])
      .map((l) => `<details class="x4-license-item"><summary>${escapeHtml(l.name)}</summary><pre class="x4-code-viewer">${escapeHtml(l.text)}</pre></details>`)
      .join('');
    showModal({
      title: 'Third-Party Notices & Licenses',
      bodyHtml: `<div class="x4-licenses-list">${listHtml}</div>`,
      buttons: [{ label: 'Close', primary: true }],
    });
    return;
  }

  // Catalog pagination / MyGames tabs / Search OSK / Settings controls
  if (target.dataset.catPage) {
    state.catalogFilter.page = Number(target.dataset.catPage);
    renderShell();
    return;
  }
  if (target.dataset.mygamesTab) {
    state.myGamesFilter.tab = target.dataset.mygamesTab;
    renderShell();
    return;
  }
  if (target.hasAttribute('data-search-toggle-osk')) {
    state.showOsk = !state.showOsk;
    renderShell();
    return;
  }
  if (target.hasAttribute('data-search-clear')) {
    state.searchQuery = '';
    state.searchShowAll = false;
    renderShell();
    return;
  }
  if (target.hasAttribute('data-search-show-all')) {
    state.searchShowAll = true;
    renderShell();
    return;
  }
  if (target.dataset.oskKey !== undefined) {
    state.searchQuery += target.dataset.oskKey;
    renderShell();
    return;
  }
  if (target.hasAttribute('data-osk-back')) {
    state.searchQuery = state.searchQuery.slice(0, -1);
    renderShell();
    return;
  }
  if (target.dataset.settingsSection) {
    state.settingsSection = target.dataset.settingsSection;
    renderShell();
    if (state.settingsSection === 'server' && state.serverPings.length === 0) {
      api.pingServers().then((r) => {
        state.serverPings = r.regions || [];
        if (state.route === 'settings' && state.settingsSection === 'server') renderShell();
      }).catch(() => {});
    }
    return;
  }
  if (target.dataset.settingPub) {
    const k = target.dataset.settingPub;
    state.draftSettings.public[k] = target.dataset.value;
    state.settingsDirty = true;
    if (k === 'language') setLanguage(target.dataset.value);
    renderShell();
    return;
  }
  if (target.dataset.settingPubNum) {
    const k = target.dataset.settingPubNum;
    state.draftSettings.public[k] = Number(target.dataset.value);
    state.settingsDirty = true;
    renderShell();
    return;
  }
  if (target.dataset.togglePub) {
    const k = target.dataset.togglePub;
    state.draftSettings.public[k] = !state.draftSettings.public[k];
    state.settingsDirty = true;
    renderShell();
    return;
  }
  if (target.dataset.settingLab) {
    const k = target.dataset.settingLab;
    const raw = target.dataset.value;
    const isNum = target.dataset.num === '1';
    state.draftSettings.lab[k] = isNum ? Number(raw) : raw === 'true' ? true : raw === 'false' ? false : raw;
    state.settingsDirty = true;
    renderShell();
    return;
  }
  if (target.dataset.toggleLab) {
    const k = target.dataset.toggleLab;
    state.draftSettings.lab[k] = !state.draftSettings.lab[k];
    state.settingsDirty = true;
    renderShell();
    return;
  }
  if (target.dataset.selectScript !== undefined) {
    const scriptId = target.dataset.selectScript;
    if (scriptId && !state.draftSettings.lab.scriptWarningAccepted) {
      showModal({
        title: 'Accessibility & Offline Script Notice',
        bodyHtml: `<p>XCloud4 controller scripts (such as <strong>${escapeHtml(scriptId)}</strong>) are designed strictly for comfort, ergonomics, and single-player accessibility. Do not use automation or turbo features in competitive online multiplayer.</p>`,
        buttons: [
          { label: t('X4_TR_UI2_SETTINGS_LAB_CANCEL') },
          {
            label: t('X4_TR_UI2_SETTINGS_LAB_APPLY'),
            primary: true,
            onClick: () => {
              state.draftSettings.lab.scriptWarningAccepted = true;
              state.draftSettings.lab.scriptName = scriptId;
              state.settingsDirty = true;
              renderShell();
            },
          },
        ],
      });
    } else {
      state.draftSettings.lab.scriptName = scriptId;
      state.settingsDirty = true;
      renderShell();
    }
  }
}

function moveGamepadFocus(dir) {
  const scope = document.getElementById('x4ModalOverlay') || document.getElementById('app');
  if (!scope) return;
  const focusables = Array.from(scope.querySelectorAll('.x4-focusable')).filter(
    (el) => !el.disabled && el.offsetParent !== null
  );
  if (!focusables.length) return;
  const active = document.activeElement;
  if (!active || !scope.contains(active)) {
    focusables[0].focus();
    focusables[0].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return;
  }
  const cur = active.getBoundingClientRect();
  const cx = cur.left + cur.width / 2;
  const cy = cur.top + cur.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const el of focusables) {
    if (el === active) continue;
    const r = el.getBoundingClientRect();
    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;
    const dx = ex - cx;
    const dy = ey - cy;
    const valid =
      (dir === 'up' && dy < -6) ||
      (dir === 'down' && dy > 6) ||
      (dir === 'left' && dx < -6) ||
      (dir === 'right' && dx > 6);
    if (!valid) continue;
    const primary = dir === 'up' || dir === 'down' ? Math.abs(dy) : Math.abs(dx);
    const ortho = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
    const score = primary + ortho * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) {
    best.focus();
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

// Global keyboard shortcuts (F9 Lab toggle, / Focus Search, Esc back/modal close) + Gamepad UI navigation
function setupGlobalInput() {
  keyboardDriver.attach();
  document.addEventListener('click', handleDelegatedClick);

  window.addEventListener('keydown', (e) => {
    if (document.getElementById('x4StreamOverlay')) return;
    const tag = document.activeElement?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === '/' && !typing) {
      const hudSearch = document.getElementById('x4HudSearchInput');
      if (hudSearch) {
        e.preventDefault();
        hudSearch.focus();
        return;
      }
    }
    if (e.code === 'F9') {
      e.preventDefault();
      toggleLabMode();
      return;
    }
    if (e.code === 'Escape') {
      if (document.getElementById('x4ModalOverlay')) {
        closeModal();
      } else if (state.route === 'game') {
        const prev = state.history.pop();
        navigateTo(prev?.route || 'home', { pushHistory: false });
      }
    }
  });

  // Live controller HUD indicator + Gamepad UI 2.0 spatial navigation + R3 Lab toggle
  let prevButtons = 0;
  let navCooldownUntil = 0;
  setInterval(() => {
    if (document.getElementById('x4StreamOverlay')) return;
    const rawPads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    const connected = rawPads.map(readBrowserGamepad).filter(Boolean);
    if (connected.length !== connectedPadCount) {
      connectedPadCount = connected.length;
      const chip = document.getElementById('x4HudPadChip');
      if (chip) {
        chip.classList.toggle('is-pad-ready', connectedPadCount > 0);
        const span = chip.querySelector('span');
        if (span) span.textContent = padChipLabel(connectedPadCount);
      }
    }

    const p0 = connected[0];
    if (p0) {
      const btns = p0.buttons;
      const justPressed = (mask) => Boolean(btns & mask) && !(prevButtons & mask);
      if (justPressed(XBOX_BUTTONS.R3) && !document.getElementById('x4ModalOverlay')) {
        toggleLabMode();
      } else if (justPressed(XBOX_BUTTONS.A)) {
        const el = document.activeElement;
        if (el && el.classList?.contains('x4-focusable')) el.click();
      } else if (justPressed(XBOX_BUTTONS.B)) {
        if (document.getElementById('x4ModalOverlay')) {
          closeModal();
        } else if (state.route === 'game') {
          const prev = state.history.pop();
          navigateTo(prev?.route || 'home', { pushHistory: false });
        }
      } else {
        const now = performance.now();
        const lx = p0.floatState?.lx || 0;
        const ly = p0.floatState?.ly || 0;
        let dir = null;
        if (justPressed(XBOX_BUTTONS.UP) || (ly > 0.6 && now >= navCooldownUntil)) dir = 'up';
        else if (justPressed(XBOX_BUTTONS.DOWN) || (ly < -0.6 && now >= navCooldownUntil)) dir = 'down';
        else if (justPressed(XBOX_BUTTONS.LEFT) || (lx < -0.6 && now >= navCooldownUntil)) dir = 'left';
        else if (justPressed(XBOX_BUTTONS.RIGHT) || (lx > 0.6 && now >= navCooldownUntil)) dir = 'right';
        if (dir) {
          moveGamepadFocus(dir);
          navCooldownUntil = now + 180;
        }
      }
      prevButtons = btns;
    } else {
      prevButtons = 0;
    }
    if (state.route === 'settings' && state.settingsSection === 'controllers') {
      const insp = document.getElementById('x4PadsInspector');
      if (insp && connected.length > 0) {
        insp.innerHTML = connected
          .map(
            (p, i) => `
              <div class="x4-pad-slot">
                <strong>${t('X4_TR_UI2_SETTINGS_CONTROLLER_FMT', i + 1)}</strong>
                <span class="x4-muted">${escapeHtml(p.id)}</span>
                <span class="x4-pill is-accent">Buttons: 0x${p.buttons.toString(16).padStart(4, '0')} · LX ${(p.floatState.lx).toFixed(2)}</span>
              </div>`
          )
          .join('');
      }
    }
  }, 90);
}

async function main() {
  const root = document.getElementById('app');
  await initI18n();
  await syncStateFromBackend();

  await runBootSequence(root, {
    isLab: Boolean(state.settings?.lab?.enabled),
    onPrepare: async () => {
      await refreshCatalogData();
    },
  });

  setupGlobalInput();
  renderShell();
  checkCloudTimeAlerts();

  clockTimer = setInterval(() => {
    const el = document.getElementById('x4TopClock');
    if (el) el.textContent = formatClock();
  }, 15_000);
}

main();
