# XCloud4 Web Edition

Unofficial **Xbox Cloud Gaming** browser client and protocol relay faithfully bringing [`asp11edgr/XCloud4`](https://github.com/asp11edgr/XCloud4) to any modern web browser with **in-site Microsoft sign-in** and **in-site WebRTC cloud streaming**.

## Features

- **In-Site Microsoft Sign-In & Cloud Streaming**: Sign in via Microsoft Device Code OAuth2 (`microsoft.com/link?otc=...` QR + compact popup) and launch every game directly inside the XCloud4 WebRTC viewport (`#x4StreamOverlay`) without redirecting away to external sites.
- **Dual Relay Modes for Static & Self-Hosted Deployments**:
  - **Node Server (`src/server.js`)**: Zero-dependency HTTP server executing Microsoft OAuth2, Xbox Live, XSTS, Passport, and full Xbox GSSV v5 WebRTC signaling.
  - **Cloudflare Worker CORS Relay (`workers/xcloud4-relay.js`)**: Optional single-file Worker exposing `GET /health` and `POST /proxy` (strictly allowlisted to Microsoft/Xbox/GSSV HTTPS hosts) so static GitHub Pages deployments can run full in-site WebRTC cloud streaming (`workers/wrangler.toml`).
- **6-Language Localization (`Auto`, `es`, `en`, `pt-BR`, `fr`, `it`, `de`)**: Complete upstream string dictionary, stage message translation, Store category translation, and localized pluralization.
- **Live Xbox Catalog (`public/js/xbox-catalog.js`, `src/xbox-protocol.js`)**:
  - Live Game Pass SIGLs (`Free`, `New`, `Popular`, `Leaving`, `All`) and Microsoft Store DisplayCatalog v7.0 metadata (`displaycatalog.mp.microsoft.com`), deploy-time JSON snapshot (`data/xbox-catalog.json`), and bespoke offline SVG fallback.
  - Dedicated **Fortnite F2P** launcher (`BT5P2X999VH2`), Discover shelves, paginated Catalog Grid with filters, Game Details pages with Screenshots lightbox & Store QR, Live Search with On-Screen Keyboard, Support (`ko-fi.com/asapedgr`), and About with live GitHub Release checks.
- **WebRTC Streaming + WebGL Post-Processing + Input 1.0 (`public/js/webrtc-player.js`, `input-engine.js`, `script-engine.js`)**:
  - Native browser `RTCPeerConnection` with `chatV1`, `controlV1`, `input 1.0` (unordered/unreliable), and `messageV1` DataChannels + Microphone audio track support.
  - Hardware **WebGL** pipeline implementing **AMD FidelityFX CAS** (Off / 0.4 / 0.7), Smooth/Nearest scaling, Triangular Micro-Dither, and 4-Tap Debanding.
  - Multi-controller **Web Gamepad API** (up to 4 gamepads) + **Virtual Keyboard/Mouse/Touch Gamepad**, binary Input 1.0 packet encoding (`ClientMetadata` + 23-byte per-pad blocks), **FourMotorRumble** decoder (`GamepadHapticActuator`), and **Lab Controller Script Engine** (`giroscopio.lua`, `sticks.lua`, `reasignar.lua`, `turbo.lua`).
  - **4-mode Network HUD** (`Off`, `Warning`, `Basic`, `Full` with 40ms frame-time bar chart) + **Quick Stream Menu**.

## Running Locally

Requires **Node.js >= 22** (zero external npm dependencies).

```bash
npm start
# or
PORT=3000 node src/server.js
```

Run tests:

```bash
npm test
```

## GitHub Pages + Cloudflare Worker CORS Relay

The frontend (`public/`) runs on GitHub Pages (e.g. **https://robloxgamee1231-ctrl.github.io/Xcloud4-/**), fetching live Xbox Catalog metadata and performing Microsoft Device Code OAuth2 right in the browser. To unlock full in-site Xbox GSSV WebRTC streaming from static hosting, connect either a local/self-hosted Node server (`npm start`) or deploy `workers/xcloud4-relay.js` via `wrangler deploy --config workers/wrangler.toml` and enter its URL in the Account / Relay modal.

Build the static bundle locally into `_site/`:

```bash
npm run build:site
# Optional: sync live Microsoft/Xbox Cloud Gaming catalog snapshot into _site/data/xbox-catalog.json
npm run sync:catalog
```

## License

GPL-3.0-only — see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
