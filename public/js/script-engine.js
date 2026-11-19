/* SPDX-License-Identifier: GPL-3.0-only */
/* Safe sandboxed JS implementation of XCloud4's 4 stock controller accessibility scripts:
 * giroscopio.lua, sticks.lua, reasignar.lua, turbo.lua */

import { XBOX_BUTTONS, floatToAxisI16, floatToTriggerU16 } from './input-engine.js';

export const STOCK_SCRIPTS = [
  { id: '', file: null, titleKey: 'X4_TR_OFF', desc: 'Direct passthrough without script processing.' },
  {
    id: 'giroscopio.lua',
    file: 'assets/scripts/giroscopio.lua',
    name: 'giroscopio.lua',
    summary: 'Gyroscope aiming to right stick with auto-calibration & JoyShockMapper stepped smoothing (L2 aim-only, L3+R3 manual cal).',
  },
  {
    id: 'sticks.lua',
    file: 'assets/scripts/sticks.lua',
    name: 'sticks.lua',
    summary: 'Independent left/right stick deadzones, anti-deadzones, sensitivity multipliers & linear/precision/quadratic response curves.',
  },
  {
    id: 'reasignar.lua',
    file: 'assets/scripts/reasignar.lua',
    name: 'reasignar.lua',
    summary: 'Accessibility button & trigger remapping (e.g. swaps Cross/Circle <-> B/A).',
  },
  {
    id: 'turbo.lua',
    file: 'assets/scripts/turbo.lua',
    name: 'turbo.lua',
    summary: 'Accessibility continuous-fire (Turbo 10 Hz) toggle for single-player / offline use.',
  },
];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export class ControllerScriptEngine {
  constructor() {
    this.activeScript = '';
    this.onNotify = null;
    this.resetState();
  }

  setScript(scriptId) {
    if (this.activeScript !== scriptId) {
      this.activeScript = scriptId || '';
      this.resetState();
    }
  }

  configure(lab = {}) {
    if (Number.isFinite(Number(lab.gyroSensitivity))) {
      const s = clamp(Number(lab.gyroSensitivity), 0.2, 3.0);
      this.gyroState.sensX = s;
      this.gyroState.sensY = s;
    }
    if (Number.isFinite(Number(lab.stickDeadzone))) {
      const dz = clamp(Number(lab.stickDeadzone), 0.0, 0.35);
      this.sticksConfig.leftDeadzone = dz;
      this.sticksConfig.rightDeadzone = Math.max(0.02, dz * 0.75);
    }
    if (Number.isFinite(Number(lab.turboRateHz))) {
      this.turboState.rateHz = clamp(Number(lab.turboRateHz), 2, 30);
    }
  }

  resetState() {
    // Giroscopio state
    this.gyroState = {
      aimOnly: true,
      sensX: 0.85,
      sensY: 0.85,
      invertX: false,
      invertY: false,
      gyroDeadzone: 0.02,
      gameAntiDeadzone: 0.08,
      smoothingThreshold: 0.35,
      biasX: 0,
      biasY: 0,
      biasZ: 0,
      stillTimer: 0,
      stillSamples: 0,
      stillSumX: 0,
      stillSumY: 0,
      smoothedX: 0,
      smoothedY: 0,
      manualCalPrev: false,
    };
    // Sticks state
    this.sticksConfig = {
      leftDeadzone: 0.08,
      leftAntiDeadzone: 0.0,
      leftSensitivity: 1.0,
      leftCurve: 'linear',
      rightDeadzone: 0.06,
      rightAntiDeadzone: 0.0,
      rightSensitivity: 1.0,
      rightCurve: 'precision',
    };
    // Reasignar state (matches reasignar.lua defaults: A<->Circle, B<->Cross)
    this.remapButtons = {
      a: 'circle',
      b: 'cross',
      x: 'square',
      y: 'triangle',
      lb: 'l1',
      rb: 'r1',
      ls: 'l3',
      rs: 'r3',
      view: 'touchpad',
      menu: 'options',
      up: 'up',
      down: 'down',
      left: 'left',
      right: 'right',
    };
    // Turbo state
    this.turboState = {
      button: 'a',
      rateHz: 10,
      timer: 0,
      state: false,
    };
  }

  apply(frame, dtSec = 1 / 60) {
    if (!frame || !frame.connected || !this.activeScript) return frame;
    const f = frame.floatState;
    if (!f) return frame;

    const out = {
      lx: f.lx || 0,
      ly: f.ly || 0,
      rx: f.rx || 0,
      ry: f.ry || 0,
      lt: f.l2 || 0,
      rt: f.r2 || 0,
      a: Boolean(f.cross),
      b: Boolean(f.circle),
      x: Boolean(f.square),
      y: Boolean(f.triangle),
      lb: Boolean(f.l1),
      rb: Boolean(f.r1),
      ls: Boolean(f.l3),
      rs: Boolean(f.r3),
      view: Boolean(f.touchpad),
      menu: Boolean(f.options),
      up: Boolean(f.up),
      down: Boolean(f.down),
      left: Boolean(f.left),
      right: Boolean(f.right),
    };

    if (this.activeScript === 'giroscopio.lua') {
      this._runGiroscopio(f, out, dtSec);
    } else if (this.activeScript === 'sticks.lua') {
      this._runSticks(f, out);
    } else if (this.activeScript === 'reasignar.lua') {
      this._runReasignar(f, out);
    } else if (this.activeScript === 'turbo.lua') {
      this._runTurbo(f, out, dtSec);
    }

    let buttons = frame.buttons & XBOX_BUTTONS.NEXUS;
    if (out.a) buttons |= XBOX_BUTTONS.A;
    if (out.b) buttons |= XBOX_BUTTONS.B;
    if (out.x) buttons |= XBOX_BUTTONS.X;
    if (out.y) buttons |= XBOX_BUTTONS.Y;
    if (out.lb) buttons |= XBOX_BUTTONS.LB;
    if (out.rb) buttons |= XBOX_BUTTONS.RB;
    if (out.ls) buttons |= XBOX_BUTTONS.L3;
    if (out.rs) buttons |= XBOX_BUTTONS.R3;
    if (out.view) buttons |= XBOX_BUTTONS.VIEW;
    if (out.menu) buttons |= XBOX_BUTTONS.MENU;
    if (out.up) buttons |= XBOX_BUTTONS.UP;
    if (out.down) buttons |= XBOX_BUTTONS.DOWN;
    if (out.left) buttons |= XBOX_BUTTONS.LEFT;
    if (out.right) buttons |= XBOX_BUTTONS.RIGHT;

    return {
      ...frame,
      buttons,
      leftX: floatToAxisI16(out.lx),
      leftY: floatToAxisI16(out.ly),
      rightX: floatToAxisI16(out.rx),
      rightY: floatToAxisI16(out.ry),
      leftTrigger: floatToTriggerU16(out.lt),
      rightTrigger: floatToTriggerU16(out.rt),
      scriptOut: out,
    };
  }

  _runGiroscopio(pad, out, dt) {
    const s = this.gyroState;
    const gx = pad.gyro?.gx || 0;
    const gy = pad.gyro?.gy || 0;
    const gz = pad.gyro?.gz || 0;

    const manualCal = Boolean(pad.l3 && pad.r3);
    if (manualCal && !s.manualCalPrev) {
      s.biasX = gx;
      s.biasY = gy;
      s.biasZ = gz;
      s.stillTimer = 0;
      s.stillSamples = 0;
      if (this.onNotify) this.onNotify('Gyroscope calibrated (L3 + R3)');
    }
    s.manualCalPrev = manualCal;

    const rawSpeed = Math.hypot(gx, gy, gz);
    if (rawSpeed < 0.06) {
      s.stillTimer += dt;
      s.stillSamples += 1;
      s.stillSumX += gx;
      s.stillSumY += gy;
      if (s.stillTimer >= 0.75 && s.stillSamples > 30) {
        s.biasX = s.biasX * 0.9 + (s.stillSumX / s.stillSamples) * 0.1;
        s.biasY = s.biasY * 0.9 + (s.stillSumY / s.stillSamples) * 0.1;
        s.stillTimer = 0;
        s.stillSamples = 0;
        s.stillSumX = 0;
        s.stillSumY = 0;
      }
    } else {
      s.stillTimer = 0;
      s.stillSamples = 0;
      s.stillSumX = 0;
      s.stillSumY = 0;
    }

    if (s.aimOnly && (pad.l2 || 0) < 0.15) {
      s.smoothedX = 0;
      s.smoothedY = 0;
      return;
    }

    const unbiasPitch = gx - s.biasX;
    const unbiasYaw = gy - s.biasY;
    const speed = Math.hypot(unbiasPitch, unbiasYaw);
    if (speed <= s.gyroDeadzone) {
      s.smoothedX = 0;
      s.smoothedY = 0;
      return;
    }

    let smoothFactor = 1.0;
    if (speed < s.smoothingThreshold) {
      const ratio = speed / s.smoothingThreshold;
      smoothFactor = 0.25 + 0.75 * ratio * ratio;
    }
    s.smoothedX += (unbiasYaw - s.smoothedX) * smoothFactor;
    s.smoothedY += (unbiasPitch - s.smoothedY) * smoothFactor;

    let targetRx = (s.invertX ? -s.smoothedX : s.smoothedX) * s.sensX;
    let targetRy = (s.invertY ? -s.smoothedY : s.smoothedY) * s.sensY;

    const gyroMag = Math.hypot(targetRx, targetRy);
    if (gyroMag > 0.001 && s.gameAntiDeadzone > 0) {
      const boosted = s.gameAntiDeadzone + gyroMag * (1 - s.gameAntiDeadzone);
      targetRx = (targetRx / gyroMag) * boosted;
      targetRy = (targetRy / gyroMag) * boosted;
    }

    out.rx = clamp(out.rx + targetRx, -1, 1);
    out.ry = clamp(out.ry + targetRy, -1, 1);
  }

  _applyStickCurve(val, curveType) {
    if (curveType === 'precision') return 0.5 * val + 0.5 * (val * val * val);
    if (curveType === 'quadratic') return val * val;
    return val;
  }

  _processStick(x, y, deadzone, antiDeadzone, sens, curveType) {
    const mag = Math.hypot(x, y);
    if (mag <= deadzone || mag <= 0.0001) return [0, 0];
    let norm = (mag - deadzone) / (1 - deadzone);
    if (norm > 1) norm = 1;
    const curved = this._applyStickCurve(norm, curveType);
    let finalMag = (antiDeadzone + curved * (1 - antiDeadzone)) * sens;
    if (finalMag > 1) finalMag = 1;
    return [(x / mag) * finalMag, (y / mag) * finalMag];
  }

  _runSticks(pad, out) {
    const c = this.sticksConfig;
    const [lx, ly] = this._processStick(pad.lx || 0, pad.ly || 0, c.leftDeadzone, c.leftAntiDeadzone, c.leftSensitivity, c.leftCurve);
    const [rx, ry] = this._processStick(pad.rx || 0, pad.ry || 0, c.rightDeadzone, c.rightAntiDeadzone, c.rightSensitivity, c.rightCurve);
    out.lx = lx;
    out.ly = ly;
    out.rx = rx;
    out.ry = ry;
  }

  _runReasignar(pad, out) {
    for (const [xboxBtn, psBtn] of Object.entries(this.remapButtons)) {
      if (pad[psBtn] !== undefined) out[xboxBtn] = Boolean(pad[psBtn]);
    }
  }

  _runTurbo(pad, out, dt) {
    const t = this.turboState;
    const psMap = { a: 'cross', b: 'circle', x: 'square', y: 'triangle', lb: 'l1', rb: 'r1', lt: 'l2', rt: 'r2' };
    const key = psMap[t.button] || t.button;
    const rawVal = pad[key];
    const isHeld = (t.button === 'lt' || t.button === 'rt') ? Number(rawVal || 0) > 0.5 : Boolean(rawVal);

    if (isHeld) {
      const period = 1 / t.rateHz;
      const halfPeriod = period * 0.5;
      t.timer = (t.timer + dt) % period;
      t.state = t.timer < halfPeriod;
      if (t.button === 'lt' || t.button === 'rt') {
        out[t.button] = t.state ? 1.0 : 0.0;
      } else {
        out[t.button] = t.state;
      }
    } else {
      t.timer = 0;
      t.state = false;
    }
  }
}
