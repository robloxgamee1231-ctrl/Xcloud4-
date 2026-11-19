/* SPDX-License-Identifier: GPL-3.0-only */
/* Public 8-section Settings + 24-row Lab Mode Panel matching picture_settings.c, server_settings.c, access_country.c, stream_settings.c. */

import { t, w, SUPPORTED_LANGUAGES } from '../i18n.js';
import { icon } from '../icons.js';
import { readBrowserGamepad } from '../input-engine.js';
import { STOCK_SCRIPTS } from '../script-engine.js';
import { escapeHtml } from './cards.js';

export const SETTINGS_SECTIONS = [
  { id: 'stream', icon: 'device-desktop', labelKey: 'X4_TR_UI2_SETTINGS_TRANSMISSION' },
  { id: 'server', icon: 'server', labelKey: 'X4_TR_SERVER_TITLE' },
  { id: 'country', icon: 'world', labelKey: 'X4_TR_ACCESS_COUNTRY_TITLE' },
  { id: 'controllers', icon: 'device-gamepad', labelKey: 'X4_TR_CONTROLLERS_TITLE' },
  { id: 'microphone', icon: 'microphone', labelKey: 'X4_TR_MICROPHONE_TITLE' },
  { id: 'account', icon: 'user', labelKey: 'X4_TR_U49_ACCOUNT_TITLE' },
  { id: 'about', icon: 'info-circle', labelKey: 'X4_TR_U49_ABOUT_TITLE' },
  { id: 'interface', icon: 'settings', labelKey: 'X4_TR_LANG_TITLE' },
];

export function renderSettingsView(state) {
  const { draftSettings, settingsSection, auth, accessCountries, serverPings, settingsDirty } = state;
  const pub = draftSettings.public;
  const lab = draftSettings.lab;

  const navHtml = `
    <div class="x4-settings-nav">
      ${SETTINGS_SECTIONS.map(
        (sec) => `
          <button class="x4-settings-tab ${settingsSection === sec.id ? 'is-active' : ''} x4-focusable"
            data-settings-section="${sec.id}" type="button">
            ${icon(sec.icon)}
            <span>${t(sec.labelKey)}</span>
          </button>`
      ).join('')}
      ${
        lab.enabled
          ? `<button class="x4-settings-tab is-lab ${settingsSection === 'lab' ? 'is-active' : ''} x4-focusable"
               data-settings-section="lab" type="button">
               ${icon('flask')}
               <span>Lab · Advanced (24)</span>
             </button>`
          : ''
      }
    </div>
  `;

  let bodyHtml = '';
  if (settingsSection === 'stream') {
    const qualities = [
      { id: '720p', title: t('X4_TR_PICTURE_720'), help: t('X4_TR_U49_QUALITY_720_HELP') },
      { id: '1080p', title: t('X4_TR_PICTURE_1080'), help: t('X4_TR_U49_QUALITY_NORMAL_HELP') },
      { id: '1080p-hq', title: t('X4_TR_PICTURE_1080_HQ'), help: t('X4_TR_U49_QUALITY_HIGH_HELP') },
    ];
    bodyHtml = `
      <div class="x4-panel">
        <h2>${t('X4_TR_UI2_SETTINGS_QUALITY')}</h2>
        <div class="x4-choice-list">
          ${qualities
            .map(
              (q) => `
                <button class="x4-choice-row ${pub.quality === q.id ? 'is-selected' : ''} x4-focusable"
                  data-setting-pub="quality" data-value="${q.id}" type="button">
                  <div>
                    <strong>${escapeHtml(q.title)}</strong>
                    <p class="x4-muted">${escapeHtml(q.help)}</p>
                  </div>
                  <span class="x4-radio ${pub.quality === q.id ? 'is-on' : ''}"></span>
                </button>`
            )
            .join('')}
        </div>
      </div>`;
  } else if (settingsSection === 'server') {
    const rawRegions = serverPings?.length ? serverPings : (auth.regions?.length ? auth.regions : []);
    const groups = { america: [], europe: [], asia: [], other: [] };
    for (const r of rawRegions) {
      (groups[r.continent] || groups.other).push(r);
    }
    const groupNames = {
      america: 'America',
      europe: 'Europe',
      asia: 'Asia & Oceania',
      other: 'Other Regions',
    };
    bodyHtml = `
      <div class="x4-panel">
        <div class="x4-panel-head">
          <div>
            <h2>${t('X4_TR_SERVER_TITLE')}</h2>
            <p class="x4-muted">${t('X4_TR_UI2_SETTINGS_AUTO_SERVER')}</p>
          </div>
          <button class="x4-btn is-secondary x4-focusable" data-action="ping-servers" type="button">
            ${icon('activity')} <span>${w('serverPingBtn')}</span>
          </button>
        </div>

        <div class="x4-choice-list">
          <button class="x4-choice-row ${pub.serverName === 'Auto' ? 'is-selected' : ''} x4-focusable"
            data-setting-pub="serverName" data-value="Auto" type="button">
            <div>
              <strong>${t('X4_TR_AUTO')}</strong>
              <p class="x4-muted">${t('X4_TR_UI2_SETTINGS_AUTO_SERVER')}</p>
            </div>
            <span class="x4-radio ${pub.serverName === 'Auto' ? 'is-on' : ''}"></span>
          </button>
        </div>

        ${Object.entries(groups)
          .filter(([, arr]) => arr.length > 0)
          .map(
            ([key, arr]) => `
              <div class="x4-server-group">
                <h4>${groupNames[key]}</h4>
                <div class="x4-choice-list">
                  ${arr
                    .map((r) => {
                      const pingText = r.rttMs != null ? `${r.rttMs} ${w('msUnit')}` : '—';
                      const pingCls =
                        r.rttMs == null ? '' : r.rttMs < 55 ? 'is-ok' : r.rttMs < 120 ? 'is-amber' : 'is-danger';
                      return `
                        <button class="x4-choice-row ${pub.serverName === r.name ? 'is-selected' : ''} x4-focusable"
                          data-setting-pub="serverName" data-value="${escapeHtml(r.name)}" type="button">
                          <div>
                            <strong>${escapeHtml(r.name)} ${r.isDefault ? '· Default' : ''}</strong>
                          </div>
                          <div class="x4-server-right">
                            <span class="x4-pill ${pingCls}">${pingText}</span>
                            <span class="x4-radio ${pub.serverName === r.name ? 'is-on' : ''}"></span>
                          </div>
                        </button>`;
                    })
                    .join('')}
                </div>
              </div>`
          )
          .join('')}
      </div>`;
  } else if (settingsSection === 'country') {
    bodyHtml = `
      <div class="x4-panel">
        <h2>${t('X4_TR_ACCESS_COUNTRY_TITLE')}</h2>
        <p class="x4-muted">${t('X4_TR_ACCESS_COUNTRY_HELP')}</p>
        <div class="x4-choice-list">
          ${(accessCountries || [])
            .map((c) => {
              const label = c.nameKey ? t(c.nameKey) : c.name;
              const sub = c.ip ? `X-Forwarded-For: ${c.ip}` : 'Direct connection (no header)';
              return `
                <button class="x4-choice-row ${pub.accessCountry === c.code ? 'is-selected' : ''} x4-focusable"
                  data-setting-pub="accessCountry" data-value="${escapeHtml(c.code)}" type="button">
                  <div>
                    <strong>${escapeHtml(label)} (${escapeHtml(c.code)})</strong>
                    <p class="x4-muted">${escapeHtml(sub)}</p>
                  </div>
                  <span class="x4-radio ${pub.accessCountry === c.code ? 'is-on' : ''}"></span>
                </button>`;
            })
            .join('')}
        </div>
      </div>`;
  } else if (settingsSection === 'controllers') {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    const connected = pads.map(readBrowserGamepad).filter(Boolean);

    bodyHtml = `
      <div class="x4-panel">
        <h2>${t('X4_TR_CONTROLLERS_TITLE')}</h2>
        <div class="x4-choice-list">
          <div class="x4-setting-row">
            <div>
              <strong>${t('X4_TR_CONTROLLERS_MULTIPLAYER')}</strong>
              <p class="x4-muted">${t('X4_TR_CONTROLLERS_MULTIPLAYER_HELP')}</p>
            </div>
            <button class="x4-toggle ${pub.multiplayerEnabled ? 'is-on' : ''} x4-focusable"
              data-toggle-pub="multiplayerEnabled" type="button" aria-pressed="${pub.multiplayerEnabled}">
              <span></span>
            </button>
          </div>

          <div class="x4-setting-row">
            <div>
              <strong>${t('X4_TR_CONTROLLERS_COUNT')}</strong>
            </div>
            <div class="x4-seg">
              ${[1, 2, 3, 4]
                .map(
                  (n) => `
                    <button class="x4-seg-btn ${pub.controllersCount === n ? 'is-active' : ''} x4-focusable"
                      data-setting-pub-num="controllersCount" data-value="${n}" type="button">${n}</button>`
                )
                .join('')}
            </div>
          </div>
        </div>

        <div class="x4-panel-head x4-mt-md">
          <h3>${connected.length ? `${connected.length} ${w('connectedPads')}` : w('noController')}</h3>
          <button class="x4-btn is-secondary x4-focusable" data-action="test-rumble" type="button">
            ${icon('device-gamepad')} <span>Test Rumble</span>
          </button>
        </div>
        <div class="x4-pads-live" id="x4PadsInspector">
          ${
            connected.length
              ? connected
                  .map(
                    (p, i) => `
                      <div class="x4-pad-slot">
                        <strong>${t('X4_TR_UI2_SETTINGS_CONTROLLER_FMT', i + 1)}</strong>
                        <span class="x4-muted">${escapeHtml(p.id)}</span>
                        <span class="x4-pill is-accent">Buttons: 0x${p.buttons.toString(16).padStart(4, '0')}</span>
                      </div>`
                  )
                  .join('')
              : `<div class="x4-info-banner">${icon('device-gamepad')}<span>${w('virtualPadHint')}</span></div>`
          }
        </div>
      </div>`;
  } else if (settingsSection === 'microphone') {
    bodyHtml = `
      <div class="x4-panel">
        <h2>${t('X4_TR_MICROPHONE_TITLE')}</h2>
        <div class="x4-choice-list">
          <div class="x4-setting-row">
            <div>
              <strong>${t('X4_TR_MICROPHONE_ENABLE')}</strong>
              <p class="x4-muted">${t('X4_TR_MICROPHONE_HELP')}</p>
            </div>
            <button class="x4-toggle ${pub.microphoneEnabled ? 'is-on' : ''} x4-focusable"
              data-toggle-pub="microphoneEnabled" type="button" aria-pressed="${pub.microphoneEnabled}">
              <span></span>
            </button>
          </div>

          <div class="x4-setting-row">
            <div>
              <strong>${t('X4_TR_MICROPHONE_FRAME_MS')}</strong>
            </div>
            <div class="x4-seg">
              ${[10, 20]
                .map(
                  (ms) => `
                    <button class="x4-seg-btn ${pub.microphoneFrameMs === ms ? 'is-active' : ''} x4-focusable"
                      data-setting-pub-num="microphoneFrameMs" data-value="${ms}" type="button">${ms} ms</button>`
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>`;
  } else if (settingsSection === 'account') {
    bodyHtml = `
      <div class="x4-panel">
        <h2>${t('X4_TR_U49_ACCOUNT_TITLE')}</h2>
        <div class="x4-choice-list">
          <div class="x4-setting-row">
            <div>
              <strong>${t('X4_TR_ACCOUNT_REMEMBER')}</strong>
              <p class="x4-muted">${t('X4_TR_U49_ACCOUNT_PRIVACY')}</p>
            </div>
            <button class="x4-toggle ${pub.rememberSession ? 'is-on' : ''} x4-focusable"
              data-toggle-pub="rememberSession" type="button" aria-pressed="${pub.rememberSession}">
              <span></span>
            </button>
          </div>
        </div>
        <div class="x4-mt-md">
          <button class="x4-btn is-primary x4-focusable" data-action="navigate" data-route="account" type="button">
            ${icon('user')} <span>${t('X4_TR_U49_ACCOUNT_TITLE')}</span>
          </button>
        </div>
      </div>`;
  } else if (settingsSection === 'about') {
    bodyHtml = `
      <div class="x4-panel">
        <h2>${t('X4_TR_U49_ABOUT_TITLE')}</h2>
        <p class="x4-muted">${t('X4_TR_U49_ABOUT_DESCRIPTION')}</p>
        <div class="x4-mt-md">
          <button class="x4-btn is-primary x4-focusable" data-action="navigate" data-route="about" type="button">
            ${icon('info-circle')} <span>${t('X4_TR_U49_ABOUT_TITLE')}</span>
          </button>
        </div>
      </div>`;
  } else if (settingsSection === 'interface') {
    bodyHtml = `
      <div class="x4-panel">
        <h2>${t('X4_TR_LANG_TITLE')}</h2>
        <div class="x4-choice-list">
          ${SUPPORTED_LANGUAGES.map(
            (l) => `
              <button class="x4-choice-row ${pub.language === l.code ? 'is-selected' : ''} x4-focusable"
                data-setting-pub="language" data-value="${l.code}" type="button">
                <div>
                  <strong>${escapeHtml(l.labelKey ? t(l.labelKey) : l.label)}</strong>
                </div>
                <span class="x4-radio ${pub.language === l.code ? 'is-on' : ''}"></span>
              </button>`
          ).join('')}
        </div>
      </div>`;
  } else if (settingsSection === 'lab') {
    bodyHtml = renderLabRows(lab);
  }

  return `
    <div class="x4-page">
      <div class="x4-page-header">
        <div>
          <h1 class="x4-page-title">${t('X4_TR_U49_SETTINGS')}</h1>
          <p class="x4-muted">${t('X4_TR_UI2_SETTINGS_SECTION')}</p>
        </div>
        <div class="x4-save-bar">
          ${
            settingsDirty
              ? `<button class="x4-btn is-secondary x4-focusable" data-action="discard-settings" type="button">${t('X4_TR_UI2_SETTINGS_DISCARD')}</button>
                 <button class="x4-btn is-primary x4-focusable" data-action="save-settings" type="button">${t('X4_TR_UI2_SETTINGS_SAVE')}</button>`
              : `<button class="x4-btn is-ghost x4-focusable" data-action="reset-settings" type="button">Reset Defaults</button>`
          }
        </div>
      </div>

      <div class="x4-settings-layout">
        ${navHtml}
        <div class="x4-settings-content">${bodyHtml}</div>
      </div>
    </div>
  `;
}

function renderLabRows(lab) {
  const seg = (key, opts, isNum = false) => `
    <div class="x4-seg">
      ${opts
        .map(
          (o) => `
            <button class="x4-seg-btn ${String(lab[key]) === String(o.v) ? 'is-active' : ''} x4-focusable"
              data-setting-lab="${key}" data-value="${o.v}" data-num="${isNum ? '1' : '0'}" type="button">${escapeHtml(o.l)}</button>`
        )
        .join('')}
    </div>`;

  const tog = (key) => `
    <button class="x4-toggle ${lab[key] ? 'is-on' : ''} x4-focusable"
      data-toggle-lab="${key}" type="button" aria-pressed="${Boolean(lab[key])}">
      <span></span>
    </button>`;

  return `
    <div class="x4-panel is-lab-panel">
      <div class="x4-panel-head">
        <div>
          <h2><span class="x4-lab-pill">${w('labBadge')}</span> Stream & Decoder Pipeline</h2>
          <p class="x4-muted">24 experimental transport, shader, input, and controller script parameters from XCloud4 Lab.</p>
        </div>
      </div>

      <div class="x4-lab-list">
        <div class="x4-setting-row">
          <div><strong>1. Request Profile</strong><p class="x4-muted">DeviceInfo + ResolutionAlias + Bitrate cap</p></div>
          ${seg('profile', [
            { v: '720p60', l: '720p60' },
            { v: '720p-HQ', l: '720p-HQ' },
            { v: '1080p-G', l: '1080p-G' },
            { v: '1080p-G8', l: '1080p-G8' },
            { v: '1080p-H', l: '1080p-H' },
            { v: '1080p-HQ', l: '1080p-HQ' },
          ])}
        </div>

        <div class="x4-setting-row">
          <div><strong>2. SPS Color Matrix</strong><p class="x4-muted">BT.709 HD vs BT.601 fallback</p></div>
          ${seg('spsColor', [
            { v: 'auto', l: 'Auto BT.709' },
            { v: 'bt709', l: 'BT.709' },
            { v: 'bt601', l: 'BT.601' },
          ])}
        </div>

        <div class="x4-setting-row">
          <div><strong>3. Decoder Buffer Depth</strong></div>
          ${seg('depth', [
            { v: 'auto', l: 'Auto' },
            { v: '1', l: '1' },
            { v: '2', l: '2' },
          ])}
        </div>

        <div class="x4-setting-row">
          <div><strong>4. Force CPU Conversion</strong><p class="x4-muted">Bypass GPU staging shader path</p></div>
          ${tog('gpuForceCpu')}
        </div>

        <div class="x4-setting-row">
          <div><strong>5. Input Polling Cadence</strong><p class="x4-muted">Immediate (2ms/8ms cap) vs Legacy 60Hz</p></div>
          ${seg('input60hz', [
            { v: false, l: 'Immediate' },
            { v: true, l: '60 Hz' },
          ])}
        </div>

        <div class="x4-setting-row">
          <div><strong>6. FourMotorRumble Haptics</strong></div>
          ${tog('rumbleEnabled')}
        </div>

        <div class="x4-setting-row">
          <div><strong>7. Opus Audio Output</strong></div>
          ${tog('audioEnabled')}
        </div>

        <div class="x4-setting-row">
          <div><strong>8. VSync Policy</strong><p class="x4-muted">${escapeHtml(t('X4_LAB_VSYNC_T27_HELP'))}</p></div>
          ${seg('vsync', [
            { v: 'auto', l: 'Auto' },
            { v: 'always', l: 'Always' },
            { v: 'never', l: 'Never' },
            { v: 'synced', l: 'Synced' },
            { v: 't27', l: 'T27' },
          ])}
        </div>

        <div class="x4-setting-row">
          <div><strong>9. Scaling Filter</strong></div>
          ${seg('convertMode', [
            { v: 'smooth', l: 'Smooth' },
            { v: 'nearest', l: 'Nearest' },
          ])}
        </div>

        <div class="x4-setting-row">
          <div><strong>10. FidelityFX CAS Sharpness</strong><p class="x4-muted">WebGL 5-tap contrast adaptive sharpening</p></div>
          ${seg(
            'sharpness',
            [
              { v: 0, l: 'Off' },
              { v: 1, l: 'CAS 0.4' },
              { v: 2, l: 'CAS 0.7' },
            ],
            true
          )}
        </div>

        <div class="x4-setting-row">
          <div><strong>11. Triangular Micro-Dither</strong></div>
          ${tog('dither')}
        </div>

        <div class="x4-setting-row">
          <div><strong>12. 4-Tap Debanding</strong></div>
          ${tog('deband')}
        </div>

        <div class="x4-setting-row">
          <div><strong>13. Resolution Request Cadence</strong></div>
          ${seg('resolutionCadence', [
            { v: '300ms', l: '300ms' },
            { v: 'once', l: 'Once' },
            { v: 'retry5s', l: 'Retry 5s' },
          ])}
        </div>

        <div class="x4-setting-row is-col">
          <div class="x4-setting-row-top">
            <div>
              <strong>14. Controller Accessibility Script</strong>
              <p class="x4-muted">Sandboxed runtime matching XCloud4 stock Lua scripts</p>
            </div>
            ${
              lab.scriptName
                ? `<button class="x4-btn is-secondary x4-focusable" data-action="inspect-lua" data-script="${escapeHtml(lab.scriptName)}" type="button">
                     ${w('scriptInspect')}
                   </button>`
                : ''
            }
          </div>
          <div class="x4-script-grid">
            ${STOCK_SCRIPTS.map(
              (s) => `
                <button class="x4-script-card ${lab.scriptName === s.id ? 'is-selected' : ''} x4-focusable"
                  data-select-script="${escapeHtml(s.id)}" type="button">
                  <strong>${escapeHtml(s.titleKey ? t(s.titleKey) : s.name)}</strong>
                  <span class="x4-muted">${escapeHtml(s.summary || s.desc)}</span>
                </button>`
            ).join('')}
          </div>
        </div>

        <div class="x4-setting-row">
          <div><strong>15. Packet Recovery</strong></div>
          ${seg('recoveryMode', [
            { v: 'nack', l: 'NACK' },
            { v: 'rtx', l: 'RTX' },
            { v: 'flexfec', l: 'FlexFEC' },
          ])}
        </div>

        <div class="x4-setting-row">
          <div><strong>16. Simulated Packet Loss</strong></div>
          ${seg(
            'lossSim',
            [
              { v: 0, l: '0%' },
              { v: 1, l: '1%' },
              { v: 3, l: '3%' },
            ],
            true
          )}
        </div>

        <div class="x4-setting-row">
          <div><strong>17. NACK Policy</strong></div>
          ${seg('nackPolicy', [
            { v: 't43', l: 'T43 Legacy' },
            { v: 't46b', l: 'T46B' },
          ])}
        </div>

        <div class="x4-setting-row">
          <div><strong>18. Video RR Accounting</strong></div>
          ${seg('rrMode', [
            { v: 'edge', l: 'Edge' },
            { v: 'zero', l: 'Zero' },
            { v: 'repaired', l: 'Repaired' },
          ])}
        </div>

        <div class="x4-setting-row">
          <div><strong>19. ${escapeHtml(t('X4_LAB_REMB_TITLE'))}</strong><p class="x4-muted">${escapeHtml(t('X4_LAB_REMB_HELP'))}</p></div>
          ${seg('rembMode', [
            { v: 'off', l: 'Off' },
            { v: 'fixed', l: t('X4_LAB_REMB_FIXED') },
            { v: 'adaptive', l: t('X4_LAB_REMB_ADAPTIVE') },
          ])}
        </div>

        <div class="x4-setting-row">
          <div><strong>20. ${escapeHtml(t('X4_LAB_REMB_FIXED_TITLE'))}</strong><p class="x4-muted">${escapeHtml(t('X4_LAB_REMB_FIXED_HELP'))}</p></div>
          ${seg(
            'rembFixedMbps',
            [
              { v: 10, l: '10 Mbps' },
              { v: 15, l: '15 Mbps' },
              { v: 20, l: '20 Mbps' },
              { v: 30, l: '30 Mbps' },
            ],
            true
          )}
        </div>

        <div class="x4-setting-row">
          <div><strong>21. Gyro Aim Sensitivity</strong><p class="x4-muted">Applies to giroscopio.lua stepped gyro aiming multiplier</p></div>
          ${seg(
            'gyroSensitivity',
            [
              { v: 0.5, l: '0.5x' },
              { v: 0.85, l: '0.85x' },
              { v: 1.25, l: '1.25x' },
              { v: 1.6, l: '1.6x' },
            ],
            true
          )}
        </div>

        <div class="x4-setting-row">
          <div><strong>22. Stick Deadzone Threshold</strong><p class="x4-muted">Applies to sticks.lua radial inner deadzone filtering</p></div>
          ${seg(
            'stickDeadzone',
            [
              { v: 0.04, l: '4%' },
              { v: 0.08, l: '8%' },
              { v: 0.12, l: '12%' },
              { v: 0.16, l: '16%' },
            ],
            true
          )}
        </div>

        <div class="x4-setting-row">
          <div><strong>23. Turbo Pulse Frequency</strong><p class="x4-muted">Applies to turbo.lua rapid-fire toggle rate (Hz)</p></div>
          ${seg(
            'turboRateHz',
            [
              { v: 5, l: '5 Hz' },
              { v: 10, l: '10 Hz' },
              { v: 15, l: '15 Hz' },
              { v: 20, l: '20 Hz' },
            ],
            true
          )}
        </div>

        <div class="x4-setting-row">
          <div><strong>24. On-Screen Virtual Controller</strong><p class="x4-muted">Show touch/click virtual Xbox pad overlay during streaming</p></div>
          ${seg('touchOverlay', [
            { v: 'auto', l: 'Auto' },
            { v: 'on', l: 'Always On' },
            { v: 'off', l: 'Off' },
          ])}
        </div>
      </div>
    </div>
  `;
}
