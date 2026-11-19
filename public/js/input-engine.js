/* SPDX-License-Identifier: GPL-3.0-only */
/* Xbox Cloud Gaming Input 1.0 binary encoder, FourMotorRumble parser, and Web Gamepad + Keyboard driver. */

export const XBOX_BUTTONS = {
  NEXUS: 1 << 1,
  MENU: 1 << 2,
  VIEW: 1 << 3,
  A: 1 << 4,
  B: 1 << 5,
  X: 1 << 6,
  Y: 1 << 7,
  UP: 1 << 8,
  DOWN: 1 << 9,
  LEFT: 1 << 10,
  RIGHT: 1 << 11,
  LB: 1 << 12,
  RB: 1 << 13,
  L3: 1 << 14,
  R3: 1 << 15,
};

export function createNeutralPad(connected = false) {
  return {
    connected,
    buttons: 0,
    leftX: 0,
    leftY: 0,
    rightX: 0,
    rightY: 0,
    leftTrigger: 0,
    rightTrigger: 0,
  };
}

export function clampAxisI16(val) {
  const n = Math.round(Number(val) || 0);
  return Math.max(-32767, Math.min(32767, n));
}

export function clampTriggerU16(val) {
  const n = Math.round(Number(val) || 0);
  return Math.max(0, Math.min(65535, n));
}

export function floatToAxisI16(f) {
  const v = Math.max(-1, Math.min(1, Number(f) || 0));
  return clampAxisI16(v * 32767);
}

export function floatToTriggerU16(f) {
  const v = Math.max(0, Math.min(1, Number(f) || 0));
  return clampTriggerU16(v * 65535);
}

// ClientMetadata report: u16 type=8, u32 sequence, f64 elapsedMs, u8 supportedTouchPoints=0 (15 bytes LE)
export function encodeClientMetadataReport(sequence = 1, elapsedMs = 0) {
  const buf = new ArrayBuffer(15);
  const dv = new DataView(buf);
  dv.setUint16(0, 8, true);
  dv.setUint32(2, sequence >>> 0, true);
  dv.setFloat64(6, Number(elapsedMs) || 0, true);
  dv.setUint8(14, 0);
  return new Uint8Array(buf);
}

// Gamepad input 1.0 report: 15-byte prefix + N * 23-byte gamepad blocks
export function encodeGamepadReport(sequence, elapsedMs, pads, includeMask = 1) {
  const indices = [0];
  for (let i = 1; i < 4; i++) {
    if (includeMask & (1 << i)) indices.push(i);
  }
  const count = indices.length;
  const buf = new ArrayBuffer(15 + count * 23);
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);

  dv.setUint16(0, 2, true);
  dv.setUint32(2, sequence >>> 0, true);
  dv.setFloat64(6, Number(elapsedMs) || 0, true);
  dv.setUint8(14, count);

  let off = 15;
  for (const idx of indices) {
    const p = pads[idx] || createNeutralPad(false);
    dv.setUint8(off, idx);
    dv.setUint16(off + 1, p.buttons & 0xfffe, true);
    dv.setInt16(off + 3, clampAxisI16(p.leftX), true);
    dv.setInt16(off + 5, clampAxisI16(p.leftY), true);
    dv.setInt16(off + 7, clampAxisI16(p.rightX), true);
    dv.setInt16(off + 9, clampAxisI16(p.rightY), true);
    dv.setUint16(off + 11, clampTriggerU16(p.leftTrigger), true);
    dv.setUint16(off + 13, clampTriggerU16(p.rightTrigger), true);
    // Mixed physicality endianness matching upstream rtc_transport.c
    dv.setUint32(off + 15, 1, true);
    bytes[off + 19] = 0;
    bytes[off + 20] = 0;
    bytes[off + 21] = 0;
    bytes[off + 22] = 1;
    off += 23;
  }
  return bytes;
}

export function parseRumbleReport(bufferLike) {
  const bytes = bufferLike instanceof Uint8Array ? bufferLike : new Uint8Array(bufferLike);
  if (!bytes || bytes.length === 0 || bytes[0] !== 128) {
    return { kind: 'other' };
  }
  if (bytes.length !== 12 && bytes.length !== 13) {
    return { kind: 'malformed' };
  }
  const at = bytes.length === 13 ? 2 : 1;
  if (bytes.length === 13) {
    const typeLe = bytes[0] | (bytes[1] << 8);
    if (typeLe !== 128) return { kind: 'unsupported' };
  }
  if (bytes[at] !== 0 || bytes[at + 1] >= 4) {
    return { kind: 'unsupported' };
  }
  for (let i = at + 2; i < at + 6; i++) {
    if (bytes[i] > 100) return { kind: 'malformed' };
  }
  return {
    kind: 'valid',
    gamepadIndex: bytes[at + 1],
    leftMotor: bytes[at + 2],
    rightMotor: bytes[at + 3],
    leftTrigger: bytes[at + 4],
    rightTrigger: bytes[at + 5],
    durationMs: bytes[at + 6] | (bytes[at + 7] << 8),
    delayMs: bytes[at + 8] | (bytes[at + 9] << 8),
    repeat: bytes[at + 10],
  };
}

// Reads standard W3C Web Gamepad API mapping -> normalized floating state + Xbox frame
export function readBrowserGamepad(gp) {
  if (!gp || !gp.connected) return null;
  const b = (i) => Boolean(gp.buttons[i]?.pressed);
  const val = (i) => Number(gp.buttons[i]?.value || 0);

  let buttons = 0;
  if (b(0)) buttons |= XBOX_BUTTONS.A;
  if (b(1)) buttons |= XBOX_BUTTONS.B;
  if (b(2)) buttons |= XBOX_BUTTONS.X;
  if (b(3)) buttons |= XBOX_BUTTONS.Y;
  if (b(4)) buttons |= XBOX_BUTTONS.LB;
  if (b(5)) buttons |= XBOX_BUTTONS.RB;
  if (b(8)) buttons |= XBOX_BUTTONS.VIEW;
  if (b(9)) buttons |= XBOX_BUTTONS.MENU;
  if (b(10)) buttons |= XBOX_BUTTONS.L3;
  if (b(11)) buttons |= XBOX_BUTTONS.R3;
  if (b(12)) buttons |= XBOX_BUTTONS.UP;
  if (b(13)) buttons |= XBOX_BUTTONS.DOWN;
  if (b(14)) buttons |= XBOX_BUTTONS.LEFT;
  if (b(15)) buttons |= XBOX_BUTTONS.RIGHT;
  if (b(16)) buttons |= XBOX_BUTTONS.NEXUS;

  const lx = Number(gp.axes[0] || 0);
  const ly = -Number(gp.axes[1] || 0); // Xbox +Y is up
  const rx = Number(gp.axes[2] || 0);
  const ry = -Number(gp.axes[3] || 0);

  return {
    connected: true,
    id: gp.id || 'Gamepad',
    index: gp.index,
    buttons,
    leftX: floatToAxisI16(lx),
    leftY: floatToAxisI16(ly),
    rightX: floatToAxisI16(rx),
    rightY: floatToAxisI16(ry),
    leftTrigger: floatToTriggerU16(val(6)),
    rightTrigger: floatToTriggerU16(val(7)),
    floatState: {
      lx,
      ly,
      rx,
      ry,
      l2: val(6),
      r2: val(7),
      cross: b(0),
      circle: b(1),
      square: b(2),
      triangle: b(3),
      l1: b(4),
      r1: b(5),
      touchpad: b(8),
      options: b(9),
      l3: b(10),
      r3: b(11),
      up: b(12),
      down: b(13),
      left: b(14),
      right: b(15),
    },
  };
}

export class KeyboardGamepadDriver {
  constructor() {
    this.keys = new Set();
    this.touchButtons = new Set();
    this.touchSticks = { lx: 0, ly: 0, rx: 0, ry: 0 };
    this.nexusPulseUntil = 0;
    this.mouseGyro = { gx: 0, gy: 0, gz: 0, lastAt: 0 };
    this.onKeyDown = (e) => {
      if (this._isTextFocused()) return;
      this.keys.add(e.code);
    };
    this.onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this.onBlur = () => {
      this.keys.clear();
      this.clearTouch();
    };
    this.onDeviceMotion = (e) => {
      const rr = e.rotationRate;
      if (rr) {
        // deg/s -> rad/s
        const degToRad = Math.PI / 180;
        this.mouseGyro = {
          gx: (rr.alpha || 0) * degToRad,
          gy: (rr.beta || 0) * degToRad,
          gz: (rr.gamma || 0) * degToRad,
          lastAt: performance.now(),
        };
      }
    };
  }

  _isTextFocused() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  attach() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('devicemotion', this.onDeviceMotion);
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('devicemotion', this.onDeviceMotion);
    this.keys.clear();
    this.clearTouch();
  }

  setTouchButton(name, pressed) {
    if (pressed) this.touchButtons.add(name);
    else this.touchButtons.delete(name);
  }

  setTouchStick(side, x, y) {
    if (side === 'left') {
      this.touchSticks.lx = Math.max(-1, Math.min(1, Number(x) || 0));
      this.touchSticks.ly = Math.max(-1, Math.min(1, Number(y) || 0));
    } else {
      this.touchSticks.rx = Math.max(-1, Math.min(1, Number(x) || 0));
      this.touchSticks.ry = Math.max(-1, Math.min(1, Number(y) || 0));
    }
  }

  clearTouch() {
    this.touchButtons.clear();
    this.touchSticks = { lx: 0, ly: 0, rx: 0, ry: 0 };
  }

  pulseNexus(durationMs = 180) {
    this.nexusPulseUntil = performance.now() + durationMs;
  }

  feedPointerDelta(dx, dy) {
    const scale = 0.08;
    this.mouseGyro = {
      gx: -dy * scale,
      gy: dx * scale,
      gz: 0,
      lastAt: performance.now(),
    };
  }

  readVirtualFrame() {
    const k = (code) => this.keys.has(code);
    const tb = (name) => this.touchButtons.has(name);
    let buttons = 0;
    const cross = k('Space') || tb('a');
    const circle = k('KeyC') || tb('b');
    const square = k('KeyF') || tb('x');
    const triangle = k('KeyR') || tb('y');
    const l1 = k('KeyQ') || tb('lb');
    const r1 = k('KeyE') || tb('rb');
    const touchpad = k('Tab') || tb('view');
    const options = k('Enter') || tb('menu');
    const l3 = k('ShiftLeft') || tb('l3');
    const r3 = k('KeyV') || tb('r3');
    const up = k('KeyI') || tb('up');
    const down = k('KeyK') || tb('down');
    const left = k('KeyJ') || tb('left');
    const right = k('KeyL') || tb('right');

    if (cross) buttons |= XBOX_BUTTONS.A;
    if (circle) buttons |= XBOX_BUTTONS.B;
    if (square) buttons |= XBOX_BUTTONS.X;
    if (triangle) buttons |= XBOX_BUTTONS.Y;
    if (l1) buttons |= XBOX_BUTTONS.LB;
    if (r1) buttons |= XBOX_BUTTONS.RB;
    if (touchpad) buttons |= XBOX_BUTTONS.VIEW;
    if (options) buttons |= XBOX_BUTTONS.MENU;
    if (l3) buttons |= XBOX_BUTTONS.L3;
    if (r3) buttons |= XBOX_BUTTONS.R3;
    if (up) buttons |= XBOX_BUTTONS.UP;
    if (down) buttons |= XBOX_BUTTONS.DOWN;
    if (left) buttons |= XBOX_BUTTONS.LEFT;
    if (right) buttons |= XBOX_BUTTONS.RIGHT;
    if (performance.now() < this.nexusPulseUntil || tb('nexus')) buttons |= XBOX_BUTTONS.NEXUS;

    const klx = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
    const kly = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0);
    const krx = (k('ArrowRight') ? 1 : 0) - (k('ArrowLeft') ? 1 : 0);
    const kry = (k('ArrowUp') ? 1 : 0) - (k('ArrowDown') ? 1 : 0);

    const lx = Math.max(-1, Math.min(1, klx + this.touchSticks.lx));
    const ly = Math.max(-1, Math.min(1, kly + this.touchSticks.ly));
    const rx = Math.max(-1, Math.min(1, krx + this.touchSticks.rx));
    const ry = Math.max(-1, Math.min(1, kry + this.touchSticks.ry));
    const l2 = (k('Digit1') || k('MouseRight') || tb('lt')) ? 1 : 0;
    const r2 = (k('Digit3') || k('MouseLeft') || tb('rt')) ? 1 : 0;

    // Decay pointer-emulated gyro quickly when idle
    const gyroFresh = performance.now() - this.mouseGyro.lastAt < 80;
    const gyro = gyroFresh ? this.mouseGyro : { gx: 0, gy: 0, gz: 0 };

    return {
      connected: true,
      isVirtual: true,
      buttons,
      leftX: floatToAxisI16(lx),
      leftY: floatToAxisI16(ly),
      rightX: floatToAxisI16(rx),
      rightY: floatToAxisI16(ry),
      leftTrigger: floatToTriggerU16(l2),
      rightTrigger: floatToTriggerU16(r2),
      floatState: {
        lx,
        ly,
        rx,
        ry,
        l2,
        r2,
        cross,
        circle,
        square,
        triangle,
        l1,
        r1,
        touchpad,
        options,
        l3,
        r3,
        up,
        down,
        left,
        right,
        gyro,
      },
    };
  }
}

export async function triggerBrowserRumble(gamepadIndex, event) {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return false;
  const pads = navigator.getGamepads();
  const gp = pads?.[gamepadIndex];
  const actuator = gp?.vibrationActuator;
  if (!actuator || typeof actuator.playEffect !== 'function') return false;
  try {
    const duration = Math.min(5000, Math.max(20, event.durationMs || 150));
    await actuator.playEffect('dual-rumble', {
      startDelay: Math.min(1000, event.delayMs || 0),
      duration,
      weakMagnitude: Math.min(1, Math.max(0, (event.rightMotor || 0) / 100)),
      strongMagnitude: Math.min(1, Math.max(0, (event.leftMotor || 0) / 100)),
    });
    return true;
  } catch {
    return false;
  }
}
