/* SPDX-License-Identifier: GPL-3.0-only */
/* Browser WebRTC cloud streaming engine + FidelityFX CAS WebGL post-processor + Interactive Demo Canvas. */

import { api } from './api.js';
import {
  encodeClientMetadataReport,
  encodeGamepadReport,
  parseRumbleReport,
  readBrowserGamepad,
  triggerBrowserRumble,
  createNeutralPad,
  XBOX_BUTTONS,
} from './input-engine.js';
import { ControllerScriptEngine } from './script-engine.js';

const XBOX_ACCESS_KEY = '4BDB3609-C1F1-4195-9B37-FEFF45DA8B8E';
const CLIENT_INSTALL_ID = 'f9ac8684-1032-4131-bb47-d2f58da9bb93';

function randomUuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Hardware WebGL post-processor: AMD FidelityFX CAS (sharpen-only), Smooth/Nearest, Deband, Dither
export class WebGLVideoProcessor {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
    this.supported = Boolean(this.gl);
    if (!this.supported) return;

    const gl = this.gl;
    const vsSrc = `
      attribute vec2 aPos;
      varying vec2 vUv;
      void main() {
        vUv = aPos * 0.5 + 0.5;
        vUv.y = 1.0 - vUv.y;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;
    const fsSrc = `
      precision mediump float;
      uniform sampler2D uTex;
      uniform vec2 uTexelSize;
      uniform float uSharpness;
      uniform float uDeband;
      uniform float uDither;
      uniform float uTime;
      varying vec2 vUv;

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      vec3 sampleTex(vec2 uv) {
        return texture2D(uTex, clamp(uv, 0.0, 1.0)).rgb;
      }

      void main() {
        vec3 c = sampleTex(vUv);

        // Optional 4-tap deband smooth for shadow gradients
        if (uDeband > 0.5) {
          vec2 d = uTexelSize * 3.0;
          vec3 avg = (sampleTex(vUv + vec2(d.x, 0.0)) +
                      sampleTex(vUv - vec2(d.x, 0.0)) +
                      sampleTex(vUv + vec2(0.0, d.y)) +
                      sampleTex(vUv - vec2(0.0, d.y))) * 0.25;
          float diff = length(avg - c);
          float blend = smoothstep(0.04, 0.005, diff) * 0.35;
          c = mix(c, avg, blend);
        }

        // AMD FidelityFX CAS (5-tap sharpen-only contrast adaptive kernel)
        if (uSharpness > 0.01) {
          vec3 n = sampleTex(vUv + vec2(0.0, -uTexelSize.y));
          vec3 s = sampleTex(vUv + vec2(0.0,  uTexelSize.y));
          vec3 w = sampleTex(vUv + vec2(-uTexelSize.x, 0.0));
          vec3 e = sampleTex(vUv + vec2( uTexelSize.x, 0.0));

          vec3 mn = min(min(n, s), min(w, min(e, c)));
          vec3 mx = max(max(n, s), max(w, max(e, c)));
          vec3 amp = clamp(min(mn, 1.0 - mx) / max(mx, vec3(0.0001)), 0.0, 1.0);
          amp = sqrt(amp);
          float peak = mix(-0.125, -0.2, clamp(uSharpness, 0.0, 1.0));
          vec3 weight = amp * peak * uSharpness;
          c = clamp((c + (n + s + w + e) * weight) / (1.0 + 4.0 * weight), 0.0, 1.0);
        }

        // Triangular-PDF micro-dither
        if (uDither > 0.5) {
          float n1 = hash12(gl_FragCoord.xy + vec2(uTime, 0.0));
          float n2 = hash12(gl_FragCoord.xy + vec2(0.0, uTime));
          c += (n1 + n2 - 1.0) / 255.0;
        }

        gl_FragColor = vec4(c, 1.0);
      }
    `;

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog);
    this.program = prog;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.setFilterMode('smooth');

    this.uTexelSize = gl.getUniformLocation(prog, 'uTexelSize');
    this.uSharpness = gl.getUniformLocation(prog, 'uSharpness');
    this.uDeband = gl.getUniformLocation(prog, 'uDeband');
    this.uDither = gl.getUniformLocation(prog, 'uDither');
    this.uTime = gl.getUniformLocation(prog, 'uTime');
  }

  setFilterMode(mode) {
    if (!this.supported) return;
    const gl = this.gl;
    const filter = mode === 'nearest' ? gl.NEAREST : gl.LINEAR;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  }

  renderSource(source, width, height, opts) {
    if (!this.supported || !source) return;
    const gl = this.gl;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.useProgram(this.program);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch {
      return;
    }
    gl.uniform2f(this.uTexelSize, 1 / Math.max(1, width), 1 / Math.max(1, height));
    const sharp = opts.sharpness === 2 ? 0.85 : opts.sharpness === 1 ? 0.45 : 0.0;
    gl.uniform1f(this.uSharpness, sharp);
    gl.uniform1f(this.uDeband, opts.deband ? 1.0 : 0.0);
    gl.uniform1f(this.uDither, opts.dither ? 1.0 : 0.0);
    gl.uniform1f(this.uTime, (performance.now() % 1000) * 0.001);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

export class CloudStreamSession {
  constructor({ title, profile, settings, keyboardDriver, hud, onStage, onRumble, onServerNotice, onClosed }) {
    this.title = title;
    this.profile = profile;
    this.settings = settings;
    this.keyboardDriver = keyboardDriver;
    this.hud = hud;
    this.onStage = onStage || (() => {});
    this.onRumble = onRumble || (() => {});
    this.onServerNotice = onServerNotice || (() => {});
    this.onClosed = onClosed || (() => {});

    this.scriptEngine = new ControllerScriptEngine();
    this.scriptEngine.setScript(settings?.lab?.enabled ? settings.lab.scriptName : '');
    if (settings?.lab?.enabled) this.scriptEngine.configure(settings.lab);
    this.scriptEngine.onNotify = (msg) => this.onServerNotice(msg);

    this.sessionId = null;
    this.demoMode = false;
    this.aborted = false;
    this.pc = null;
    this.channels = {};
    this.micStream = null;
    this.videoEl = null;
    this.audioEl = null;
    this.webgl = null;
    this.audioCtx = null;
    this.sourceCanvas = null; // Used by Interactive Sandbox Demo stream
    this.rafId = 0;
    this.inputTimer = 0;
    this.statsTimer = 0;
    this.keepaliveTimer = 0;
    this.playTimeTimer = 0;
    this.startedAt = performance.now();
    this.lastFrameAt = performance.now();
    this.inputSequence = 0;
    this.muted = Boolean(settings?.lab?.enabled && settings.lab.audioEnabled === false);
    this.micMuted = !settings?.public?.microphoneEnabled;
    this.liveSharpness = settings?.lab?.enabled ? Number(settings.lab.sharpness ?? 1) : 1;
    this.announcedMask = 1;
    this.lastSentBytes = { video: 0, ts: 0 };

    // Demo arena interactive state
    this.sim = {
      x: 0.5,
      y: 0.55,
      aimX: 0.62,
      aimY: 0.42,
      particles: [],
      targets: Array.from({ length: 6 }, (_, i) => ({
        x: 0.2 + i * 0.13,
        y: 0.24 + (i % 2) * 0.12,
        vx: (i % 2 === 0 ? 1 : -1) * (0.08 + i * 0.02),
        hp: 100,
      })),
      score: 0,
      lastShotAt: 0,
      nexusGlow: 0,
      inputCount: 0,
      lastPadSnapshot: null,
    };
  }

  async start(renderCanvas, videoEl, audioEl) {
    this.renderCanvas = renderCanvas;
    this.videoEl = videoEl;
    this.audioEl = audioEl;
    this.webgl = new WebGLVideoProcessor(renderCanvas);
    if (this.webgl.supported) {
      this.webgl.setFilterMode(this.settings?.lab?.enabled ? this.settings.lab.convertMode : 'smooth');
    }

    try {
      this.onStage({ step: 1, key: 'X4_TR_SESSION_CREATING', waitSec: 0 });
      const playRes = await api.playSession(this.title.titleId || this.title.productId);
      if (this.aborted) return;

      this.sessionId = playRes.sessionId;
      this.demoMode = Boolean(playRes.demoMode);

      if (this.demoMode) {
        await this._startDemoFlow();
        return;
      }

      // Live Xbox session provisioning loop
      this.onStage({ step: 2, key: 'X4_TR_SESSION_WAITING', waitSec: 0 });
      await this._provisionAndNegotiateLive();
    } catch (err) {
      if (!this.aborted) {
        throw err;
      }
    }
  }

  async _startDemoFlow() {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(360);
    if (this.aborted) return;
    this.onStage({ step: 2, key: 'X4_TR_SESSION_CONNECTING', waitSec: 0 });
    await sleep(320);
    if (this.aborted) return;
    this.onStage({ step: 3, key: 'X4_TR_SESSION_NEGOTIATING', waitSec: 0 });
    await sleep(320);
    if (this.aborted) return;
    this.onStage({ step: 4, key: 'X4_TR_SESSION_READY', waitSec: 0 });

    this.sourceCanvas = document.createElement('canvas');
    this.sourceCanvas.width = this.profile.width;
    this.sourceCanvas.height = this.profile.height;

    this._startMediaLoops();
  }

  async _provisionAndNegotiateLive() {
    const startMs = Date.now();
    let connected = false;
    while (!this.aborted && Date.now() - startMs < 15 * 60_000) {
      const st = await api.getSessionState(this.sessionId);
      const state = st.state || '';
      if (state === 'WaitingForResources') {
        let waitSec = 0;
        try {
          const wt = await api.getWaitTime(this.title.titleId || this.title.productId);
          waitSec = Number(wt.estimatedTotalWaitTimeInSeconds || 0);
        } catch {
          // Optional ETA
        }
        this.onStage({ step: 2, key: 'X4_TR_SESSION_WAITING', waitSec });
      } else if (state === 'ReadyToConnect' && !connected) {
        this.onStage({ step: 2, key: 'X4_TR_SESSION_CONNECTING', waitSec: 0 });
        await api.connectSession(this.sessionId);
        connected = true;
      } else if (state === 'Provisioned') {
        break;
      } else if (state === 'Failed') {
        throw new Error(st.errorDetails?.message || 'Xbox session failed to provision');
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (this.aborted) return;

    this.onStage({ step: 3, key: 'X4_TR_SESSION_NEGOTIATING', waitSec: 0 });
    await this._establishRtc();
    this.onStage({ step: 4, key: 'X4_TR_SESSION_READY', waitSec: 0 });
    this._startMediaLoops();
  }

  async _establishRtc() {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      bundlePolicy: 'max-bundle',
    });
    this.pc = pc;

    // Optional microphone capture for live Xbox voice chat
    let micTrack = null;
    if (this.settings?.public?.microphoneEnabled && navigator.mediaDevices?.getUserMedia) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micTrack = this.micStream.getAudioTracks()[0] || null;
        if (micTrack) micTrack.enabled = !this.micMuted;
      } catch {
        // Microphone unavailable or denied
      }
    }

    if (micTrack) {
      pc.addTrack(micTrack, this.micStream);
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }
    pc.addTransceiver('video', { direction: 'recvonly' });

    pc.ontrack = (ev) => {
      const stream = ev.streams?.[0] || new MediaStream([ev.track]);
      if (ev.track.kind === 'video' && this.videoEl) {
        this.videoEl.srcObject = stream;
        this.videoEl.play().catch(() => {});
      } else if (ev.track.kind === 'audio' && this.audioEl) {
        this.audioEl.srcObject = stream;
        this.audioEl.muted = this.muted;
        this.audioEl.play().catch(() => {});
      }
    };

    const localCandidates = [];
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        localCandidates.push({
          candidate: ev.candidate.candidate,
          sdpMid: ev.candidate.sdpMid,
          sdpMLineIndex: ev.candidate.sdpMLineIndex,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.hud.updateStats({ reconnecting: true });
      } else if (pc.connectionState === 'connected') {
        this.hud.updateStats({ reconnecting: false });
      }
    };

    const defs = [
      { label: 'chat', protocol: 'chatV1', opts: { ordered: true } },
      { label: 'control', protocol: 'controlV1', opts: { ordered: true } },
      { label: 'input', protocol: '1.0', opts: { ordered: false, maxRetransmits: 0 } },
      { label: 'message', protocol: 'messageV1', opts: { ordered: true } },
    ];
    for (const d of defs) {
      const ch = pc.createDataChannel(d.label, { protocol: d.protocol, ...d.opts });
      ch.binaryType = 'arraybuffer';
      this.channels[d.label] = ch;
      ch.onopen = () => this._onChannelOpen(d.label, ch);
      ch.onmessage = (ev) => this._onChannelMessage(d.label, ev.data);
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await api.sendSdpOffer(this.sessionId, offer.sdp);

    let answerSdp = '';
    for (let i = 0; i < 40 && !this.aborted; i++) {
      const ans = await api.getSdpAnswer(this.sessionId);
      answerSdp = ans?.exchangeResponse?.sdp || ans?.sdp || '';
      if (answerSdp) break;
      await new Promise((r) => setTimeout(r, 750));
    }
    if (!answerSdp) throw new Error('Timed out waiting for Xbox WebRTC SDP answer');
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    if (localCandidates.length) {
      await api.sendIceCandidates(this.sessionId, localCandidates);
    }
    const remoteIce = await api.getIceCandidates(this.sessionId);
    const list = remoteIce?.exchangeResponse?.candidates || remoteIce?.candidates || [];
    for (const raw of list) {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed?.candidate) await pc.addIceCandidate(parsed);
      } catch {
        // Ignore malformed ICE candidate
      }
    }

    this.keepaliveTimer = setInterval(async () => {
      try {
        await api.keepaliveSession(this.sessionId);
      } catch (err) {
        if (err.status === 410) {
          this.onServerNotice('Session ended by server (410)');
          this.stop();
          this.onClosed();
        }
      }
    }, 30_000);
  }

  _onChannelOpen(label, ch) {
    if (label === 'message') {
      ch.send(JSON.stringify({ type: 'Handshake', version: 'messageV1', id: randomUuid(), cv: '0' }));
    } else if (label === 'input') {
      const meta = encodeClientMetadataReport(++this.inputSequence, performance.now() - this.startedAt);
      ch.send(meta);
    }
  }

  _sendMessageTarget(target, contentObj) {
    const ch = this.channels.message;
    if (!ch || ch.readyState !== 'open') return;
    ch.send(
      JSON.stringify({
        type: 'Message',
        content: JSON.stringify(contentObj),
        id: randomUuid(),
        target,
        cv: '',
      })
    );
  }

  _onChannelMessage(label, data) {
    if (label === 'input' && data instanceof ArrayBuffer) {
      const ev = parseRumbleReport(data);
      if (ev.kind === 'valid' && this.settings?.lab?.rumbleEnabled !== false) {
        this.onRumble(ev);
        triggerBrowserRumble(ev.gamepadIndex, ev);
      }
      return;
    }
    if (label === 'message' && typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'HandshakeAck') {
          this._sendStartupSequence();
        } else if (msg.target === '/streaming/sessionLifetimeManagement/serverInitiatedDisconnect') {
          const content = JSON.parse(msg.content || '{}');
          this.onServerNotice(content.reason || 'Server disconnected');
          this.stop();
          this.onClosed();
        } else if (msg.target === '/streaming/sessionLifetimeManagement/WarningForBeingIdle') {
          this.onServerNotice('Idle warning from Xbox server');
        }
      } catch {
        // Ignore malformed JSON messages
      }
    }
  }

  _sendStartupSequence() {
    const ctrl = this.channels.control;
    if (ctrl?.readyState === 'open') {
      ctrl.send(JSON.stringify({ message: 'authorizationRequest', accessKey: XBOX_ACCESS_KEY }));
      ctrl.send(JSON.stringify({ message: 'gamepadChanged', gamepadIndex: 0, wasAdded: true }));
    }
    this._sendMessageTarget('/streaming/systemUi/configuration', { version: [0, 2, 0], systemUis: [] });
    this._sendMessageTarget('/streaming/properties/clientappinstallidchanged', { clientAppInstallId: CLIENT_INSTALL_ID });
    this._sendMessageTarget('/streaming/characteristics/orientationchanged', { orientation: 0 });
    this._sendMessageTarget('/streaming/characteristics/touchinputenabledchanged', { touchInputEnabled: false });
    this._sendMessageTarget('/streaming/characteristics/clientdevicecapabilities', {
      supportsCustomResolution: true,
      supportsHevc: false,
      supportsHdr: false,
      supportsFps: this.profile.fps,
      maxWidth: this.profile.width,
      maxHeight: this.profile.height,
      maxBitrateKbps: this.profile.bitrateKbps,
    });
    this._sendMessageTarget('/streaming/characteristics/dimensionschanged', {
      horizontal: this.profile.width,
      vertical: this.profile.height,
      preferredWidth: this.profile.width,
      preferredHeight: this.profile.height,
      safeAreaLeft: 0,
      safeAreaTop: 0,
      safeAreaRight: this.profile.width,
      safeAreaBottom: this.profile.height,
      supportsCustomResolution: true,
    });
    if (ctrl?.readyState === 'open' && this.profile.resolutionAlias) {
      ctrl.send(
        JSON.stringify({
          message: 'userRequestedResolutionUpdate',
          resolutionAlias: this.profile.resolutionAlias,
        })
      );
    }
  }

  _shaderLabel() {
    const lab = this.settings?.lab || {};
    if (lab.enabled && lab.gpuForceCpu) return 'CPU 2D Fallback';
    const filter = lab.enabled && lab.convertMode === 'nearest' ? 'Nearest' : 'Smooth';
    const cas = this.liveSharpness === 2 ? 'CAS 0.7' : this.liveSharpness === 1 ? 'CAS 0.4' : 'No CAS';
    return `${filter} · ${cas}`;
  }

  _startMediaLoops() {
    const lab = this.settings?.lab || {};

    this.hud.updateStats({
      width: this.profile.width,
      height: this.profile.height,
      profileLabel: this.profile.label,
      shaderMode: this._shaderLabel(),
      rttMs: this.demoMode ? 18 : -1,
      mbps: this.demoMode ? this.profile.bitrateKbps / 1000 : 0,
    });

    const pollInputMs = lab.enabled && lab.input60hz ? 16 : 8;
    this.inputTimer = setInterval(() => this._sampleAndSendInput(pollInputMs / 1000), pollInputMs);

    this.statsTimer = setInterval(() => this._collectStats(), 1000);
    this.playTimeTimer = setInterval(() => {
      api.recordPlayTime(this.title.productId, this.title.titleId || this.title.productId, this.title.title, 10).catch(() => {});
    }, 10_000);

    const forceCpu = Boolean(lab.enabled && lab.gpuForceCpu);
    const ctx2d = !forceCpu && this.webgl?.supported ? null : this.renderCanvas.getContext('2d');

    const tick = (now) => {
      if (this.aborted) return;
      const dtMs = now - this.lastFrameAt;
      this.lastFrameAt = now;
      this.hud.recordFrameInterval(dtMs);

      if (this.demoMode && this.sourceCanvas) {
        this._drawDemoStreamFrame(dtMs / 1000);
      }

      const source = this.demoMode ? this.sourceCanvas : this.videoEl;
      const w = this.demoMode ? this.sourceCanvas.width : (this.videoEl?.videoWidth || this.profile.width);
      const h = this.demoMode ? this.sourceCanvas.height : (this.videoEl?.videoHeight || this.profile.height);

      if (source && (this.demoMode || (this.videoEl && this.videoEl.readyState >= 2))) {
        if (!forceCpu && this.webgl?.supported) {
          const dither = lab.enabled ? lab.dither : true;
          const deband = lab.enabled ? lab.deband : true;
          this.webgl.renderSource(source, w, h, { sharpness: this.liveSharpness, dither, deband });
        } else if (ctx2d) {
          if (this.renderCanvas.width !== w || this.renderCanvas.height !== h) {
            this.renderCanvas.width = w;
            this.renderCanvas.height = h;
          }
          ctx2d.imageSmoothingEnabled = !(lab.enabled && lab.convertMode === 'nearest');
          ctx2d.drawImage(source, 0, 0, w, h);
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  _readAllGamepads(dtSec) {
    const rawPads = typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    const pads = [];
    let connectedMask = 0;

    for (let i = 0; i < 4; i++) {
      const parsed = readBrowserGamepad(rawPads[i]);
      if (parsed) {
        connectedMask |= 1 << i;
        pads[i] = i === 0 ? this.scriptEngine.apply(parsed, dtSec) : parsed;
      } else {
        pads[i] = createNeutralPad(false);
      }
    }

    // If no physical gamepad in slot 0, use Virtual Keyboard/Mouse Pad
    if (!(connectedMask & 1)) {
      const v = this.keyboardDriver.readVirtualFrame();
      pads[0] = this.scriptEngine.apply(v, dtSec);
      connectedMask |= 1;
    }

    return { pads, connectedMask };
  }

  _sampleAndSendInput(dtSec) {
    const { pads, connectedMask } = this._readAllGamepads(dtSec);
    this.sim.lastPadSnapshot = pads[0];
    this.sim.inputCount++;

    if (this.demoMode) {
      this._stepDemoPhysics(pads[0], dtSec);
      return;
    }

    const inputCh = this.channels.input;
    const ctrlCh = this.channels.control;
    const allowMp = Boolean(this.settings?.public?.multiplayerEnabled);
    const maxPads = allowMp ? Math.min(4, this.settings?.public?.controllersCount || 1) : 1;

    if (allowMp && ctrlCh?.readyState === 'open') {
      for (let i = 1; i < maxPads; i++) {
        const bit = 1 << i;
        const present = Boolean(connectedMask & bit);
        const announced = Boolean(this.announcedMask & bit);
        if (present !== announced) {
          ctrlCh.send(JSON.stringify({ message: 'gamepadChanged', gamepadIndex: i, wasAdded: present }));
          if (present) this.announcedMask |= bit;
          else this.announcedMask &= ~bit;
        }
      }
    }

    if (inputCh?.readyState === 'open' && inputCh.bufferedAmount === 0) {
      const pkt = encodeGamepadReport(++this.inputSequence, performance.now() - this.startedAt, pads, this.announcedMask);
      inputCh.send(pkt);
    }
  }

  _stepDemoPhysics(pad, dt) {
    const s = this.sim;
    const lx = (pad.leftX || 0) / 32767;
    const ly = (pad.leftY || 0) / 32767;
    const rx = (pad.rightX || 0) / 32767;
    const ry = (pad.rightY || 0) / 32767;

    s.x = Math.max(0.08, Math.min(0.92, s.x + lx * 0.42 * dt));
    s.y = Math.max(0.18, Math.min(0.88, s.y - ly * 0.42 * dt));
    s.aimX = Math.max(0.05, Math.min(0.95, s.aimX + rx * 0.65 * dt));
    s.aimY = Math.max(0.10, Math.min(0.90, s.aimY - ry * 0.65 * dt));

    for (const tg of s.targets) {
      tg.x += tg.vx * dt;
      if (tg.x < 0.1 || tg.x > 0.9) tg.vx = -tg.vx;
    }

    const firing = Boolean(pad.buttons & XBOX_BUTTONS.A) || pad.rightTrigger > 32768;
    const now = performance.now();
    if (firing && now - s.lastShotAt > 75) {
      s.lastShotAt = now;
      const dx = s.aimX - s.x;
      const dy = s.aimY - s.y;
      const mag = Math.hypot(dx, dy) || 1;
      s.particles.push({ x: s.x, y: s.y, vx: (dx / mag) * 1.15, vy: (dy / mag) * 1.15, life: 1.0 });
      this._playDemoTone(360, 0.045, 0.025);

      // Check immediate hit along reticle + emit FourMotorRumble test packet
      for (const tg of s.targets) {
        if (Math.hypot(tg.x - s.aimX, tg.y - s.aimY) < 0.055) {
          s.score += 100;
          tg.hp = tg.hp <= 25 ? 100 : tg.hp - 25;
          this._playDemoTone(tg.hp === 100 ? 880 : 620, 0.08, 0.045);
          if (this.settings?.lab?.rumbleEnabled !== false) {
            this.onRumble({
              kind: 'valid',
              gamepadIndex: 0,
              leftMotor: 65,
              rightMotor: 40,
              leftTrigger: 35,
              rightTrigger: 80,
              durationMs: 140,
            });
          }
          break;
        }
      }
    }

    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 1.4;
      if (p.life <= 0) s.particles.splice(i, 1);
    }
    if (pad.buttons & XBOX_BUTTONS.NEXUS) s.nexusGlow = 1;
    else s.nexusGlow = Math.max(0, s.nexusGlow - dt * 2.5);
  }

  _drawDemoStreamFrame() {
    const ctx = this.sourceCanvas.getContext('2d');
    const w = this.sourceCanvas.width;
    const h = this.sourceCanvas.height;
    const tNow = performance.now() * 0.001;
    const s = this.sim;

    // Rich dark gradient sky + terrain grid (great for testing FidelityFX CAS & Deband!)
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#070E18');
    bg.addColorStop(0.55, '#0D2235');
    bg.addColorStop(1, '#091A24');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle perspective grid
    ctx.strokeStyle = 'rgba(50, 243, 139, 0.13)';
    ctx.lineWidth = 1.5;
    for (let gx = 0; gx <= 16; gx++) {
      const x = (gx / 16) * w;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.48);
      ctx.lineTo(w * 0.5 + (x - w * 0.5) * 2.4, h);
      ctx.stroke();
    }
    for (let gy = 0; gy < 9; gy++) {
      const p = ((gy + (tNow * 1.2) % 1) / 9);
      const y = h * 0.48 + p * p * h * 0.52;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Targets
    for (const tg of s.targets) {
      const tx = tg.x * w;
      const ty = tg.y * h;
      ctx.fillStyle = 'rgba(245, 166, 35, 0.16)';
      ctx.beginPath();
      ctx.arc(tx, ty, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#F5A623';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tx, ty, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#32F38B';
      ctx.fillRect(tx - 24, ty - 34, 48 * (tg.hp / 100), 5);
    }

    // Projectiles
    for (const p of s.particles) {
      ctx.fillStyle = `rgba(50, 243, 139, ${p.life})`;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player craft
    const px = s.x * w;
    const py = s.y * h;
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = '#32F38B';
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(20, 18);
    ctx.lineTo(0, 9);
    ctx.lineTo(-20, 18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Aim Reticle
    const ax = s.aimX * w;
    const ay = s.aimY * h;
    ctx.strokeStyle = '#32F38B';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ax, ay, 18, 0, Math.PI * 2);
    ctx.moveTo(ax - 26, ay);
    ctx.lineTo(ax - 10, ay);
    ctx.moveTo(ax + 10, ay);
    ctx.lineTo(ax + 26, ay);
    ctx.moveTo(ax, ay - 26);
    ctx.lineTo(ax, ay - 10);
    ctx.moveTo(ax, ay + 10);
    ctx.lineTo(ax, ay + 26);
    ctx.stroke();

    // Stream telemetry banner (positioned neatly below Quick Menu button)
    ctx.fillStyle = 'rgba(7, 14, 24, 0.72)';
    ctx.fillRect(24, 84, 580, 82);
    ctx.strokeStyle = 'rgba(50, 243, 139, 0.35)';
    ctx.strokeRect(24, 84, 580, 82);
    ctx.fillStyle = '#F6F9FD';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText(`${this.title.title} · Interactive Stream Preview`, 42, 117);
    ctx.fillStyle = '#B1C1D2';
    ctx.font = '15px Inter, sans-serif';
    const scriptTag = this.scriptEngine.activeScript ? `Script: ${this.scriptEngine.activeScript}` : 'Script: Off';
    ctx.fillText(`Score ${s.score} · ${this.profile.label} · ${scriptTag} · Input #${s.inputCount}`, 42, 146);

    if (s.nexusGlow > 0.01) {
      ctx.fillStyle = `rgba(50, 243, 139, ${s.nexusGlow * 0.25})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  async _collectStats() {
    if (this.demoMode) {
      const simRtt = 16 + Math.round(Math.sin(performance.now() * 0.002) * 3);
      const simMbps = (this.profile.bitrateKbps / 1000) * (0.94 + Math.random() * 0.08);
      this.hud.updateStats({
        fps: 60,
        mbps: simMbps,
        lossPct: (this.settings?.lab?.enabled ? this.settings.lab.lossSim : 0),
        rttMs: simRtt,
        jitterMs: 1.8,
      });
      return;
    }
    if (!this.pc) return;
    try {
      const stats = await this.pc.getStats();
      let videoBytes = 0;
      let fps = 0;
      let lost = 0;
      let recv = 0;
      let jitterMs = 0;
      let rttMs = -1;
      let height = this.profile.height;
      stats.forEach((rep) => {
        if (rep.type === 'inbound-rtp' && rep.kind === 'video') {
          videoBytes = rep.bytesReceived || 0;
          fps = rep.framesPerSecond || 0;
          lost = rep.packetsLost || 0;
          recv = rep.packetsReceived || 0;
          jitterMs = (rep.jitter || 0) * 1000;
          if (rep.frameHeight) height = rep.frameHeight;
        }
        if (rep.type === 'candidate-pair' && rep.nominated && rep.currentRoundTripTime != null) {
          rttMs = Math.round(rep.currentRoundTripTime * 1000);
        }
      });
      const now = performance.now();
      let mbps = 0;
      if (this.lastSentBytes.ts > 0 && now > this.lastSentBytes.ts) {
        const dt = (now - this.lastSentBytes.ts) / 1000;
        mbps = ((videoBytes - this.lastSentBytes.video) * 8) / (dt * 1_000_000);
      }
      this.lastSentBytes = { video: videoBytes, ts: now };
      const totalPkts = lost + recv;
      const lossPct = totalPkts > 0 ? (lost / totalPkts) * 100 : 0;
      this.hud.updateStats({ height, fps, mbps: Math.max(0, mbps), lossPct, rttMs, jitterMs });
    } catch {
      // Ignore transient getStats error
    }
  }

  _playDemoTone(freq = 440, durSec = 0.05, gainVal = 0.03) {
    if (this.muted || typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      if (!this.audioCtx) this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + durSec);
      osc.connect(gain).connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + durSec);
    } catch {
      // Audio context blocked before gesture
    }
  }

  cycleSharpness() {
    this.liveSharpness = (this.liveSharpness + 1) % 3;
    this.hud.updateStats({ shaderMode: this._shaderLabel() });
    return this.liveSharpness;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.audioEl) this.audioEl.muted = this.muted;
    return this.muted;
  }

  toggleMic() {
    this.micMuted = !this.micMuted;
    if (this.micStream) {
      for (const tr of this.micStream.getAudioTracks()) tr.enabled = !this.micMuted;
    }
    return this.micMuted;
  }

  requestKeyframe() {
    const ctrl = this.channels.control;
    if (ctrl?.readyState === 'open') {
      ctrl.send(JSON.stringify({ message: 'videoKeyframeRequested', ifrRequested: true }));
      return true;
    }
    return false;
  }

  pulseNexus() {
    this.keyboardDriver.pulseNexus(220);
  }

  async stop() {
    this.aborted = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.inputTimer) clearInterval(this.inputTimer);
    if (this.statsTimer) clearInterval(this.statsTimer);
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    if (this.playTimeTimer) clearInterval(this.playTimeTimer);
    if (this.keyboardDriver?.clearTouch) this.keyboardDriver.clearTouch();
    if (this.audioCtx) {
      try { await this.audioCtx.close(); } catch {}
      this.audioCtx = null;
    }

    if (this.micStream) {
      for (const tr of this.micStream.getTracks()) tr.stop();
      this.micStream = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch {}
      this.pc = null;
    }
    if (this.sessionId) {
      const sid = this.sessionId;
      this.sessionId = null;
      await api.deleteSession(sid).catch(() => {});
    }
  }
}
