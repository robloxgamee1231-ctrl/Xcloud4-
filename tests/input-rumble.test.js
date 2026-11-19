// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  XBOX_BUTTONS,
  encodeClientMetadataReport,
  encodeGamepadReport,
  parseRumbleReport,
  KeyboardGamepadDriver,
} from '../public/js/input-engine.js';
import { ControllerScriptEngine } from '../public/js/script-engine.js';
import { HUD_MODES, NetHudController } from '../public/js/net-hud.js';

// Provide minimal localStorage stub for Node unit testing of NetHudController
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
}

test('ClientMetadata and Gamepad binary Input 1.0 packets match exact upstream wire layout', () => {
  const meta = encodeClientMetadataReport(0, 1234.5);
  assert.equal(meta.byteLength, 15);
  const metaDv = new DataView(meta.buffer);
  assert.equal(metaDv.getUint16(0, true), 8);
  assert.equal(metaDv.getUint32(2, true), 0);
  assert.equal(metaDv.getFloat64(6, true), 1234.5);
  assert.equal(metaDv.getUint8(14), 0);

  const pkt = encodeGamepadReport(
    42,
    9876.25,
    [
      {
        connected: true,
        buttons: XBOX_BUTTONS.A | XBOX_BUTTONS.NEXUS | 0x0001, // bit 0 must be masked off (& 0xfffe)
        leftX: 16384,
        leftY: -16384,
        rightX: 0,
        rightY: 32767,
        leftTrigger: 65535,
        rightTrigger: 32768,
      },
    ],
    1
  );

  assert.equal(pkt.byteLength, 15 + 23);
  const dv = new DataView(pkt.buffer);
  assert.equal(dv.getUint16(0, true), 2);  // INPUT_GAMEPAD
  assert.equal(dv.getUint32(2, true), 42);
  assert.equal(dv.getFloat64(6, true), 9876.25);
  assert.equal(dv.getUint8(14), 1);        // 1 pad
  assert.equal(dv.getUint8(15), 0);        // pad index 0
  assert.equal(dv.getUint16(16, true), XBOX_BUTTONS.A | XBOX_BUTTONS.NEXUS);
  assert.equal(dv.getInt16(18, true), 16384);
  assert.equal(dv.getInt16(20, true), -16384);
  assert.equal(dv.getInt16(24, true), 32767);
  assert.equal(dv.getUint16(26, true), 65535);
  assert.equal(dv.getUint16(28, true), 32768);
  assert.equal(dv.getUint32(30, true), 1); // physical 1 (LE)
  assert.equal(dv.getUint32(34, false), 1); // virtual 1 (BE)
});

test('FourMotorRumble parser handles 12-byte and 13-byte payloads accurately', () => {
  const p12 = new Uint8Array(12);
  p12[0] = 128;
  p12[1] = 0;  // subtype 0
  p12[2] = 0;  // gamepad index
  p12[3] = 80; // leftMotor %
  p12[4] = 45; // rightMotor %
  p12[5] = 20;
  p12[6] = 10;

  const r12 = parseRumbleReport(p12);
  assert.equal(r12.kind, 'valid');
  assert.equal(r12.leftMotor, 80);
  assert.equal(r12.rightMotor, 45);
  assert.equal(r12.leftTrigger, 20);
  assert.equal(r12.rightTrigger, 10);

  const p13 = new Uint8Array(13);
  new DataView(p13.buffer).setUint16(0, 128, true);
  p13[2] = 0;
  p13[3] = 0;
  p13[4] = 95;
  p13[5] = 55;
  const r13 = parseRumbleReport(p13);
  assert.equal(r13.kind, 'valid');
  assert.equal(r13.leftMotor, 95);
  assert.equal(r13.rightMotor, 55);

  const pBadMotor = new Uint8Array(p13);
  pBadMotor[4] = 120; // > 100 is malformed
  assert.equal(parseRumbleReport(pBadMotor).kind, 'malformed');

  const wrongType = new Uint8Array(12);
  assert.equal(parseRumbleReport(wrongType).kind, 'other');
});

test('ControllerScriptEngine implements sticks.lua, reasignar.lua, turbo.lua, and giroscopio.lua', () => {
  const engine = new ControllerScriptEngine();
  const makeFrame = (floatState) => ({
    connected: true,
    buttons: 0,
    leftX: 0,
    leftY: 0,
    rightX: 0,
    rightY: 0,
    leftTrigger: 0,
    rightTrigger: 0,
    floatState,
  });

  // sticks.lua: small drift inside deadzone -> zeroed; outside -> boosted & curved
  engine.setScript('sticks.lua');
  const stickOut = engine.apply(makeFrame({
    lx: 0.03, ly: -0.02, rx: 0.5, ry: 0, lt: 0, rt: 0,
  }));
  assert.equal(stickOut.leftX, 0);
  assert.equal(stickOut.leftY, 0);
  assert.ok(stickOut.rightX > 5000);

  // reasignar.lua: Cross -> B, Circle -> A
  engine.setScript('reasignar.lua');
  const remapOut = engine.apply(makeFrame({
    lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0,
    cross: true, circle: false,
  }));
  assert.ok((remapOut.buttons & XBOX_BUTTONS.B) !== 0);
  assert.equal(remapOut.buttons & XBOX_BUTTONS.A, 0);

  // turbo.lua: holding Cross cycles A rapidly across frames
  engine.setScript('turbo.lua');
  const states = [];
  for (let i = 0; i < 6; i += 1) {
    const o = engine.apply(makeFrame({
      lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, cross: true,
    }), 0.02);
    states.push((o.buttons & XBOX_BUTTONS.A) !== 0);
  }
  assert.ok(states.includes(true) && states.includes(false));

  // giroscopio.lua: adds gyro delta when l2 is held
  engine.setScript('giroscopio.lua');
  const gyroOut = engine.apply(makeFrame({
    lx: 0, ly: 0, rx: 0, ry: 0, lt: 1, rt: 0, l2: 1.0,
    gyro: { gx: 0.4, gy: -0.2, gz: 0 },
  }), 1 / 60);
  assert.notEqual(gyroOut.rightX, 0);
  assert.notEqual(gyroOut.rightY, 0);
});

test('NetHudController cycles 4 modes, records frame intervals, and flags unstable connections', () => {
  const hud = new NetHudController();
  assert.equal(hud.mode, HUD_MODES.WARNING);
  assert.equal(hud.cycleMode(), HUD_MODES.BASIC);
  assert.equal(hud.cycleMode(), HUD_MODES.FULL);

  hud.recordFrameInterval(16.6);
  hud.recordFrameInterval(33.2);
  assert.equal(hud.frameTimes.length, 2);

  hud.updateStats({ rttMs: 35, lossPct: 0, jitterMs: 2 });
  assert.equal(hud.stats.warningReason, '');

  hud.updateStats({ rttMs: 165, lossPct: 0, jitterMs: 2 });
  assert.ok(hud.stats.warningReason.includes('RTT 165'));
});

test('KeyboardGamepadDriver virtual touch overlay and ScriptEngine.configure() wire Lab 21-24 params', () => {
  if (typeof globalThis.document === 'undefined') {
    globalThis.document = { activeElement: null };
  }
  const drv = new KeyboardGamepadDriver();
  drv.setTouchButton('a', true);
  drv.setTouchButton('rt', true);
  drv.setTouchStick('left', 0.5, -0.5);
  const frame = drv.readVirtualFrame();
  assert.ok((frame.buttons & XBOX_BUTTONS.A) !== 0);
  assert.equal(frame.rightTrigger, 65535);
  assert.ok(frame.leftX > 15000 && frame.leftY < -15000);
  drv.clearTouch();
  const cleared = drv.readVirtualFrame();
  assert.equal(cleared.buttons, 0);
  assert.equal(cleared.leftX, 0);

  const engine = new ControllerScriptEngine();
  engine.setScript('sticks.lua');
  engine.configure({ gyroSensitivity: 1.6, stickDeadzone: 0.16, turboRateHz: 20 });
  assert.equal(engine.gyroState.sensX, 1.6);
  assert.equal(engine.sticksConfig.leftDeadzone, 0.16);
  assert.equal(engine.turboState.rateHz, 20);
  // 0.12 stick magnitude falls inside 0.16 configured deadzone -> zeroed
  const out = engine.apply({
    connected: true,
    buttons: 0,
    leftX: 0, leftY: 0, rightX: 0, rightY: 0,
    leftTrigger: 0, rightTrigger: 0,
    floatState: { lx: 0.12, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 },
  });
  assert.equal(out.leftX, 0);
});
