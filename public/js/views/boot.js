/* SPDX-License-Identifier: GPL-3.0-only */
/* Authentic 5-step XCloud4 Boot Splash matching src/ui/ui2_boot.c. */

import { t, w } from '../i18n.js';
import { brandWordmark } from '../icons.js';

export async function runBootSequence(rootEl, { isLab, onPrepare }) {
  const version = isLab ? '0.7.111-lab' : '1.3.0-beta';
  const steps = [
    { pct: 18, key: 'X4_TR_BOOT_FONTS' },
    { pct: 40, key: 'X4_TR_BOOT_CACHE' },
    { pct: 64, key: 'X4_TR_BOOT_SESSION' },
    { pct: 86, key: 'X4_TR_BOOT_CATALOG' },
    { pct: 100, key: 'X4_TR_BOOT_READY' },
  ];

  rootEl.innerHTML = `
    <div class="x4-boot-screen">
      <div class="x4-boot-bg" style="background-image:url('/assets/branding/${isLab ? 'pic1-lab.png' : 'pic1.png'}')"></div>
      <div class="x4-boot-scrim"></div>
      <div class="x4-boot-center">
        <div class="x4-boot-brand-row">
          ${brandWordmark(false)}
          ${isLab ? `<span class="x4-lab-pill">${w('labBadge')}</span>` : ''}
        </div>
        <p class="x4-boot-tagline">${t('X4_TR_BOOT_TAGLINE')}</p>
        <div class="x4-boot-progress-track">
          <div class="x4-boot-progress-fill" id="x4BootFill" style="width:8%"></div>
        </div>
        <div class="x4-boot-meta">
          <span id="x4BootStep">${t(steps[0].key)}</span>
          <span class="x4-boot-ver">v${version}</span>
        </div>
      </div>
      <div class="x4-boot-rim"></div>
    </div>
  `;

  const fillEl = rootEl.querySelector('#x4BootFill');
  const stepEl = rootEl.querySelector('#x4BootStep');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < steps.length; i++) {
    fillEl.style.width = `${steps[i].pct}%`;
    stepEl.textContent = t(steps[i].key);
    if (i === 2 && onPrepare) {
      await Promise.all([onPrepare(), wait(200)]);
    } else {
      await wait(140);
    }
  }
  await wait(160);
}
