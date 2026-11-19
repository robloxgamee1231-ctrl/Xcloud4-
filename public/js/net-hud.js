/* SPDX-License-Identifier: GPL-3.0-only */
/* 4-mode Network HUD & degraded-connection detector adapted from XCloud4 net_hud.c. */

import { t } from './i18n.js';

export const HUD_MODES = {
  OFF: 0,
  WARNING: 1,
  BASIC: 2,
  FULL: 3,
};

const STORAGE_KEY = 'xcloud4_net_hud_mode';

export class NetHudController {
  constructor() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw !== null ? Number(raw) : NaN;
    this.mode = Number.isInteger(saved) && saved >= 0 && saved <= 3 ? saved : HUD_MODES.WARNING;
    this.frameTimes = [];
    this.maxFrameHistory = 64;
    this.warningUntil = 0;
    this.stats = {
      width: 1920,
      height: 1080,
      fps: 60,
      mbps: 0,
      lossPct: 0,
      rttMs: -1,
      jitterMs: 0,
      droppedFrames: 0,
      profileLabel: '1080p-HQ',
      shaderMode: 'CAS 0.4',
      reconnecting: false,
      warningReason: '',
    };
  }

  cycleMode() {
    this.mode = (this.mode + 1) % 4;
    localStorage.setItem(STORAGE_KEY, String(this.mode));
    return this.mode;
  }

  getModeLabel() {
    const keys = ['X4_TR_NET_HUD_OFF', 'X4_TR_NET_HUD_WARNING', 'X4_TR_NET_HUD_BASIC', 'X4_TR_NET_HUD_FULL'];
    return t(keys[this.mode] || 'X4_TR_NET_HUD_WARNING');
  }

  recordFrameInterval(ms) {
    if (!(ms > 0 && ms <= 250)) return;
    this.frameTimes.push(ms);
    if (this.frameTimes.length > this.maxFrameHistory) {
      this.frameTimes.shift();
    }
  }

  updateStats(partial) {
    Object.assign(this.stats, partial);
    const now = performance.now();
    const unstable =
      this.stats.rttMs > 140 ||
      this.stats.lossPct > 1.5 ||
      this.stats.jitterMs > 30 ||
      this.stats.reconnecting;
    if (unstable) {
      this.warningUntil = now + 3000;
      if (this.stats.reconnecting) this.stats.warningReason = 'Reconnecting';
      else if (this.stats.lossPct > 1.5) this.stats.warningReason = `Loss ${this.stats.lossPct.toFixed(1)}%`;
      else if (this.stats.rttMs > 140) this.stats.warningReason = `RTT ${this.stats.rttMs} ms`;
      else this.stats.warningReason = `Jitter ${this.stats.jitterMs.toFixed(0)} ms`;
    } else if (now >= this.warningUntil) {
      this.stats.warningReason = '';
    }
  }

  renderInto(container) {
    if (!container) return;
    if (this.mode === HUD_MODES.OFF) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }

    const now = performance.now();
    const hasWarning = now < this.warningUntil || this.stats.reconnecting;
    if (this.mode === HUD_MODES.WARNING && !hasWarning) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }

    container.hidden = false;
    const s = this.stats;
    const rttText = s.rttMs >= 0 ? `${Math.round(s.rttMs)} ms` : '--';
    const resText = `${s.height || 1080}p`;
    const fpsText = `${Math.round(s.fps || 0)} fps`;
    const mbpsText = `${(s.mbps || 0).toFixed(1)} Mbps`;
    const lossText = `${(s.lossPct || 0).toFixed(1)}%`;

    if (this.mode === HUD_MODES.WARNING) {
      container.innerHTML = `
        <div class="x4-nethud x4-nethud-warning">
          <span class="x4-nethud-dot is-amber"></span>
          <span>${t('X4_TR_NET_HUD_UNSTABLE')} · ${s.warningReason || rttText}</span>
        </div>`;
      return;
    }

    if (this.mode === HUD_MODES.BASIC) {
      container.innerHTML = `
        <div class="x4-nethud x4-nethud-basic ${hasWarning ? 'is-warn' : ''}">
          <span class="x4-nethud-pill">${resText}</span>
          <span>${fpsText}</span>
          <span>${mbpsText}</span>
          <span>RTT ${rttText}</span>
          <span>Loss ${lossText}</span>
        </div>`;
      return;
    }

    // FULL mode with 40ms frame-time bar chart
    const bars = this.frameTimes
      .slice(-48)
      .map((ms) => {
        const pct = Math.min(100, Math.round((ms / 40) * 100));
        const cls = ms > 25 ? 'is-high' : ms > 19 ? 'is-mid' : '';
        return `<span class="x4-hud-bar ${cls}" style="height:${Math.max(8, pct)}%"></span>`;
      })
      .join('');

    const maxMs = this.frameTimes.length ? Math.max(...this.frameTimes).toFixed(1) : '16.7';

    container.innerHTML = `
      <div class="x4-nethud x4-nethud-full ${hasWarning ? 'is-warn' : ''}">
        <div class="x4-nethud-row">
          <span class="x4-nethud-pill">${s.profileLabel}</span>
          <strong>${resText} · ${fpsText}</strong>
          <span>${mbpsText}</span>
          <span>RTT ${rttText}</span>
          <span>Loss ${lossText}</span>
          <span>${s.shaderMode}</span>
        </div>
        <div class="x4-nethud-graph-wrap">
          <div class="x4-nethud-graph">${bars}</div>
          <div class="x4-nethud-graph-meta">
            <span>Frame Δ (40 ms scale)</span>
            <span>Peak ${maxMs} ms · Jitter ${(s.jitterMs || 0).toFixed(1)} ms</span>
          </div>
        </div>
      </div>`;
  }
}
