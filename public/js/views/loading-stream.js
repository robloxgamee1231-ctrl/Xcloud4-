/* SPDX-License-Identifier: GPL-3.0-only */
/* Fullscreen 4-step Loading Screen + Active Stream Viewport + Quick Stream Menu + On-Screen Virtual Pad + Rumble/Shader Overlay. */

import { t, w, trStage } from '../i18n.js';
import { icon } from '../icons.js';
import { CloudStreamSession } from '../webrtc-player.js';
import { NetHudController } from '../net-hud.js';
import { escapeHtml, showModal } from './cards.js';

export async function launchGameStream({ title, profile, settings, keyboardDriver, onExit }) {
  const overlay = document.createElement('div');
  overlay.id = 'x4StreamOverlay';
  overlay.className = 'x4-stream-overlay';

  const heroArt = title.heroUrl || title.coverUrl || `/api/artwork/${title.productId}/hero.svg`;
  const hud = new NetHudController();
  const touchPref = settings?.lab?.enabled ? settings.lab.touchOverlay : 'auto';
  const isCoarsePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches;
  let quickMenuOpen = false;
  let touchPadVisible = touchPref === 'on' || (touchPref === 'auto' && isCoarsePointer);
  let rumbleTimeout = 0;

  overlay.innerHTML = `
    <!-- 4-step Launch Loading Screen -->
    <div class="x4-loading-screen" id="x4LoadingScreen">
      <div class="x4-loading-bg" style="background-image:url('${escapeHtml(heroArt)}')"></div>
      <div class="x4-loading-scrim"></div>
      <div class="x4-loading-center">
        <span class="x4-pill is-accent">${escapeHtml(profile.label)} · ${profile.width}x${profile.height} @ ${profile.fps}fps</span>
        <h1>${escapeHtml(title.title)}</h1>
        <p class="x4-muted" id="x4LoadingStageText">${t('X4_TR_SESSION_CREATING')}</p>

        <div class="x4-loading-steps" id="x4LoadingSteps">
          <div class="x4-lstep is-active" data-step="1"><span>1</span><em>${t('X4_TR_SESSION_CREATING')}</em></div>
          <div class="x4-lstep" data-step="2"><span>2</span><em>${t('X4_TR_SESSION_CONNECTING')}</em></div>
          <div class="x4-lstep" data-step="3"><span>3</span><em>${t('X4_TR_SESSION_NEGOTIATING')}</em></div>
          <div class="x4-lstep" data-step="4"><span>4</span><em>${t('X4_TR_SESSION_READY')}</em></div>
        </div>

        <div class="x4-loading-wait" id="x4LoadingWait" hidden></div>

        <button class="x4-btn is-secondary x4-focusable" id="x4CancelLaunchBtn" type="button">
          ${icon('x')} <span>${t('X4_TR_UI2_SETTINGS_LAB_CANCEL')}</span>
        </button>
      </div>
    </div>

    <!-- Active Stream Viewport -->
    <div class="x4-stream-stage" id="x4StreamStage" hidden>
      <video id="x4RemoteVideo" class="x4-hidden-media" autoplay playsinline></video>
      <audio id="x4RemoteAudio" class="x4-hidden-media" autoplay></audio>
      <canvas id="x4StreamCanvas" class="x4-stream-canvas"></canvas>

      <div id="x4HudContainer" class="x4-hud-anchor"></div>

      <div id="x4RumbleMeter" class="x4-rumble-toast" hidden>
        ${icon('device-gamepad')}
        <span id="x4RumbleLabel">${w('hapticsActive')}</span>
      </div>

      <div id="x4StreamNotice" class="x4-stream-notice" hidden></div>

      <div class="x4-stream-toolbar">
        <button class="x4-pill-btn x4-focusable" id="x4QuickMenuTrigger" type="button" title="Quick Menu (M / Esc)">
          ${icon('settings')} <span>${w('quickMenuTitle')}</span>
        </button>
      </div>

      <div class="x4-quick-menu" id="x4QuickMenu" hidden>
        <div class="x4-quick-menu-head">
          <strong>${escapeHtml(title.title)}</strong>
          <span class="x4-pill is-accent" id="x4StreamModeBadge"></span>
        </div>
        <div class="x4-quick-menu-grid">
          <button class="x4-btn is-secondary x4-focusable" data-qm="nexus" type="button">${icon('device-gamepad')} <span>${w('nexusPulse')}</span></button>
          <button class="x4-btn is-secondary x4-focusable" data-qm="mute" type="button">${icon('volume')} <span id="x4QmMuteLabel">${w('muteAudio')}</span></button>
          <button class="x4-btn is-secondary x4-focusable" data-qm="mic" type="button">${icon('microphone')} <span id="x4QmMicLabel">${w('toggleMic')}</span></button>
          <button class="x4-btn is-secondary x4-focusable" data-qm="hud" type="button">${icon('activity')} <span id="x4QmHudLabel">${w('cycleHud')}: ${escapeHtml(hud.getModeLabel())}</span></button>
          <button class="x4-btn is-secondary x4-focusable" data-qm="cas" type="button">${icon('device-desktop')} <span id="x4QmCasLabel">CAS: 0.4</span></button>
          <button class="x4-btn is-secondary x4-focusable" data-qm="fullscreen" type="button">${icon('device-desktop')} <span>Fullscreen</span></button>
          <button class="x4-btn is-secondary x4-focusable" data-qm="keyframe" type="button">${icon('refresh')} <span>${w('requestKeyframe')}</span></button>
          <button class="x4-btn is-secondary x4-focusable" data-qm="vpad" type="button">${icon('info-circle')} <span>${w('virtualPadTitle')}</span></button>
          <button class="x4-btn is-danger x4-focusable" data-qm="exit" type="button">${icon('x')} <span>${w('exitStream')}</span></button>
        </div>
        <div class="x4-vpad-box" id="x4VpadBox" ${touchPadVisible ? '' : 'hidden'}>${w('virtualPadHint')}</div>
      </div>

      <!-- Interactive On-Screen Virtual Controller -->
      <div class="x4-touch-overlay" id="x4TouchOverlay" ${touchPadVisible ? '' : 'hidden'}>
        <div class="x4-touch-left">
          <div class="x4-touch-shoulders">
            <button class="x4-tbtn is-shoulder" data-tbtn="lt" type="button">LT</button>
            <button class="x4-tbtn is-shoulder" data-tbtn="lb" type="button">LB</button>
          </div>
          <div class="x4-touch-dpad">
            <span></span><button class="x4-tbtn" data-tbtn="up" type="button">▲</button><span></span>
            <button class="x4-tbtn" data-tbtn="left" type="button">◀</button><span class="x4-dpad-core"></span><button class="x4-tbtn" data-tbtn="right" type="button">▶</button>
            <span></span><button class="x4-tbtn" data-tbtn="down" type="button">▼</button><span></span>
          </div>
          <div class="x4-touch-stick" data-tstick="left" aria-label="Left Stick">
            <div class="x4-touch-stick-knob"></div>
          </div>
        </div>

        <div class="x4-touch-center-sys">
          <button class="x4-tbtn is-sys" data-tbtn="view" type="button">View</button>
          <button class="x4-tbtn is-sys is-nexus" data-tbtn="nexus" type="button">Xbox</button>
          <button class="x4-tbtn is-sys" data-tbtn="menu" type="button">Menu</button>
        </div>

        <div class="x4-touch-right">
          <div class="x4-touch-shoulders">
            <button class="x4-tbtn is-shoulder" data-tbtn="rb" type="button">RB</button>
            <button class="x4-tbtn is-shoulder" data-tbtn="rt" type="button">RT</button>
          </div>
          <div class="x4-touch-abxy">
            <span></span><button class="x4-tbtn is-y" data-tbtn="y" type="button">Y</button><span></span>
            <button class="x4-tbtn is-x" data-tbtn="x" type="button">X</button><span></span><button class="x4-tbtn is-b" data-tbtn="b" type="button">B</button>
            <span></span><button class="x4-tbtn is-a" data-tbtn="a" type="button">A</button><span></span>
          </div>
          <div class="x4-touch-stick" data-tstick="right" aria-label="Right Stick">
            <div class="x4-touch-stick-knob"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const loadingEl = overlay.querySelector('#x4LoadingScreen');
  const stageEl = overlay.querySelector('#x4StreamStage');
  const stageTextEl = overlay.querySelector('#x4LoadingStageText');
  const waitEl = overlay.querySelector('#x4LoadingWait');
  const stepEls = Array.from(overlay.querySelectorAll('.x4-lstep'));
  const canvasEl = overlay.querySelector('#x4StreamCanvas');
  const videoEl = overlay.querySelector('#x4RemoteVideo');
  const audioEl = overlay.querySelector('#x4RemoteAudio');
  const hudEl = overlay.querySelector('#x4HudContainer');
  const quickMenuEl = overlay.querySelector('#x4QuickMenu');
  const rumbleEl = overlay.querySelector('#x4RumbleMeter');
  const rumbleLabelEl = overlay.querySelector('#x4RumbleLabel');
  const noticeEl = overlay.querySelector('#x4StreamNotice');
  const modeBadgeEl = overlay.querySelector('#x4StreamModeBadge');
  const touchEl = overlay.querySelector('#x4TouchOverlay');

  const showNotice = (msg) => {
    noticeEl.textContent = msg;
    noticeEl.hidden = false;
    setTimeout(() => {
      noticeEl.hidden = true;
    }, 3500);
  };

  let hudTimer = 0;
  const session = new CloudStreamSession({
    title,
    profile,
    settings,
    keyboardDriver,
    hud,
    onStage: ({ step, key, waitSec }) => {
      stageTextEl.textContent = trStage(t(key));
      stepEls.forEach((el) => {
        const s = Number(el.dataset.step);
        el.classList.toggle('is-done', s < step);
        el.classList.toggle('is-active', s === step);
      });
      if (waitSec > 0) {
        waitEl.hidden = false;
        waitEl.textContent = `Queue ETA: ~${Math.ceil(waitSec / 60)} min`;
      } else {
        waitEl.hidden = true;
      }
      if (step >= 4) {
        loadingEl.hidden = true;
        stageEl.hidden = false;
        modeBadgeEl.textContent = session.demoMode ? w('streamSim') : w('streamLive');
        const casNames = ['Off', '0.4', '0.7'];
        overlay.querySelector('#x4QmCasLabel').textContent = `CAS: ${casNames[session.liveSharpness] || '0.4'}`;
        hud.renderInto(hudEl);
        hudTimer = setInterval(() => hud.renderInto(hudEl), 500);
      }
    },
    onRumble: (ev) => {
      rumbleEl.hidden = false;
      rumbleLabelEl.textContent = `${w('hapticsActive')} P${ev.gamepadIndex + 1}: L ${ev.leftMotor}% · R ${ev.rightMotor}% · LT ${ev.leftTrigger}% · RT ${ev.rightTrigger}%`;
      clearTimeout(rumbleTimeout);
      rumbleTimeout = setTimeout(() => {
        rumbleEl.hidden = true;
      }, Math.max(300, ev.durationMs || 300));
    },
    onServerNotice: (msg) => showNotice(msg),
    onClosed: () => cleanupAndClose(),
  });

  // Bind Virtual Touch / Pointer Controller buttons + sticks
  for (const btn of overlay.querySelectorAll('[data-tbtn]')) {
    const name = btn.getAttribute('data-tbtn');
    const press = (e) => {
      e.preventDefault();
      btn.classList.add('is-pressed');
      keyboardDriver.setTouchButton(name, true);
    };
    const release = (e) => {
      e.preventDefault();
      btn.classList.remove('is-pressed');
      keyboardDriver.setTouchButton(name, false);
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  }

  for (const stick of overlay.querySelectorAll('[data-tstick]')) {
    const side = stick.getAttribute('data-tstick');
    const knob = stick.querySelector('.x4-touch-stick-knob');
    let activeId = null;
    const updateStick = (clientX, clientY) => {
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const maxR = rect.width * 0.4;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      keyboardDriver.setTouchStick(side, dx / maxR, -dy / maxR);
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      activeId = e.pointerId;
      stick.setPointerCapture?.(e.pointerId);
      updateStick(e.clientX, e.clientY);
    });
    stick.addEventListener('pointermove', (e) => {
      if (activeId !== e.pointerId) return;
      updateStick(e.clientX, e.clientY);
    });
    const resetStick = (e) => {
      if (activeId !== e.pointerId) return;
      activeId = null;
      knob.style.transform = 'translate(0px, 0px)';
      keyboardDriver.setTouchStick(side, 0, 0);
    };
    stick.addEventListener('pointerup', resetStick);
    stick.addEventListener('pointercancel', resetStick);
  }

  // Allow mouse aiming/firing directly on the demo canvas (clicks feed RT)
  canvasEl.addEventListener('pointerdown', (e) => {
    if (e.button === 0) keyboardDriver.setTouchButton('rt', true);
    else if (e.button === 2) keyboardDriver.setTouchButton('lt', true);
  });
  canvasEl.addEventListener('pointerup', () => {
    keyboardDriver.setTouchButton('rt', false);
    keyboardDriver.setTouchButton('lt', false);
  });
  canvasEl.addEventListener('pointermove', (e) => {
    if (e.buttons & 1 || document.pointerLockElement === canvasEl) {
      keyboardDriver.feedPointerDelta(e.movementX || 0, e.movementY || 0);
    }
  });

  const cleanupAndClose = async () => {
    clearInterval(hudTimer);
    window.removeEventListener('keydown', onKey);
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
    await session.stop();
    overlay.remove();
    if (onExit) onExit();
  };

  const toggleQuickMenu = (force) => {
    quickMenuOpen = force !== undefined ? force : !quickMenuOpen;
    quickMenuEl.hidden = !quickMenuOpen;
  };

  const confirmExit = () => {
    showModal({
      title: t('X4_TR_UI2_MODAL_EXIT_TITLE'),
      bodyHtml: `<p>${t('X4_TR_UI2_MODAL_EXIT_BODY')}</p>`,
      buttons: [
        { label: t('X4_TR_UI2_SETTINGS_LAB_CANCEL'), onClick: () => {} },
        { label: w('exitStream'), danger: true, onClick: () => cleanupAndClose() },
      ],
    });
  };

  const onKey = (e) => {
    if (e.code === 'Escape') {
      e.preventDefault();
      if (!loadingEl.hidden) {
        cleanupAndClose();
      } else {
        toggleQuickMenu();
      }
    } else if (e.code === 'KeyM' && loadingEl.hidden) {
      toggleQuickMenu();
    } else if (e.code === 'KeyH' && loadingEl.hidden) {
      hud.cycleMode();
      hud.renderInto(hudEl);
      overlay.querySelector('#x4QmHudLabel').textContent = `${w('cycleHud')}: ${hud.getModeLabel()}`;
    }
  };
  window.addEventListener('keydown', onKey);

  overlay.querySelector('#x4CancelLaunchBtn').addEventListener('click', () => cleanupAndClose());
  overlay.querySelector('#x4QuickMenuTrigger').addEventListener('click', () => toggleQuickMenu());
  quickMenuEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-qm]');
    if (!btn) return;
    const cmd = btn.getAttribute('data-qm');
    if (cmd === 'nexus') {
      session.pulseNexus();
      showNotice('Xbox Guide (Nexus) pulsed');
    } else if (cmd === 'mute') {
      const m = session.toggleMute();
      overlay.querySelector('#x4QmMuteLabel').textContent = m ? 'Audio Muted' : w('muteAudio');
    } else if (cmd === 'mic') {
      const m = session.toggleMic();
      overlay.querySelector('#x4QmMicLabel').textContent = m ? 'Mic Muted' : 'Mic Active';
    } else if (cmd === 'hud') {
      hud.cycleMode();
      hud.renderInto(hudEl);
      overlay.querySelector('#x4QmHudLabel').textContent = `${w('cycleHud')}: ${hud.getModeLabel()}`;
    } else if (cmd === 'cas') {
      const lvl = session.cycleSharpness();
      const names = ['Off', '0.4', '0.7'];
      overlay.querySelector('#x4QmCasLabel').textContent = `CAS: ${names[lvl]}`;
      showNotice(`FidelityFX CAS: ${names[lvl]}`);
    } else if (cmd === 'fullscreen') {
      if (!document.fullscreenElement) {
        overlay.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    } else if (cmd === 'keyframe') {
      session.requestKeyframe();
      showNotice('Keyframe requested');
    } else if (cmd === 'vpad') {
      touchPadVisible = !touchPadVisible;
      touchEl.hidden = !touchPadVisible;
      overlay.querySelector('#x4VpadBox').hidden = !touchPadVisible;
    } else if (cmd === 'exit') {
      confirmExit();
    }
  });

  try {
    await session.start(canvasEl, videoEl, audioEl);
  } catch (err) {
    stageTextEl.textContent = `Error: ${err.message}`;
    showNotice(err.message);
  }
}
