# XCloud4 Web Edition

Unofficial **Xbox Cloud Gaming** browser client and protocol relay faithfully bringing [`asp11edgr/XCloud4`](https://github.com/asp11edgr/XCloud4) to any modern web browser.

## Features

- **play.xbox.com-Inspired HUD & Shell**: Translucent top HUD bar with live search (`/`), gamepad status indicator, featured hero spotlight carousel, quick genre/collection chips, horizontal shelf scrolling, and direct launching to **`play.xbox.com`**.
- **6-Language Localization (`Auto`, `es`, `en`, `pt-BR`, `fr`, `it`, `de`)**: Complete upstream string dictionary, stage message translation, Store category translation, and localized pluralization.
- **Full Microsoft & Xbox Cloud Gaming Authentication & Relay (`src/xbox-protocol.js`, `src/server.js`, `public/js/static-backend.js`)**:
  - Browser & relay OAuth2 Device Code authentication (`login.microsoftonline.com`) with QR code (`microsoft.com/link`) and optional session persistence.
  - Xbox Live user auth (`user.auth.xboxlive.com`), XSTS (`xsts.auth.xboxlive.com`), Passport console transfer token (`login.live.com`), and GSSV login (`xgpuweb` / `xgpuwebf2p`) with optional Better xCloud `X-Forwarded-For` access country table (`Auto`, `US`, `BR`, `JP`, `KR`, `PL`).
  - Optional XCloud4 Relay URL configuration right inside the Account view so GitHub Pages users running `npm start` can enable native in-app WebRTC streaming.
  - Game Pass SIGLs (`Free`, `New`, `Popular`, `Leaving`), Microsoft Store DisplayCatalog v7.0 metadata, MRU recents, local play-time/favorites library, and Cloud Gaming Time Quota (`contentaccess.exp.xboxservices.com`, protobuf + JSON parser).
  - Dedicated **Fortnite F2P** launcher (`BT5P2X999VH2`), Discover shelves, paginated Catalog Grid with filters, Game Details pages with Screenshots lightbox & Store QR, Live Search with On-Screen Keyboard, Support (`ko-fi.com/asapedgr`), and About with live GitHub Release checks.
- **WebRTC Streaming + WebGL Post-Processing + Input 1.0 (`public/js/webrtc-player.js`, `input-engine.js`, `script-engine.js`)**:
  - Native browser `RTCPeerConnection` with `chatV1`, `controlV1`, `input 1.0` (unordered/unreliable), and `messageV1` DataChannels + Microphone audio track support.
  - Hardware **WebGL** pipeline implementing **AMD FidelityFX CAS** (Off / 0.4 / 0.7), Smooth/Nearest scaling, Triangular Micro-Dither, and 4-Tap Debanding.
  - Multi-controller **Web Gamepad API** (up to 4 gamepads) + **Virtual Keyboard/Mouse Gamepad**, binary Input 1.0 packet encoding (`ClientMetadata` + 23-byte per-pad blocks), **FourMotorRumble** decoder (`GamepadHapticActuator`), and **Lab Controller Script Engine** (`giroscopio.lua`, `sticks.lua`, `reasignar.lua`, `turbo.lua`).
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

## GitHub Pages Static Site

The frontend (`public/`) automatically fetches live **Xbox Cloud Gaming SIGLs** (`catalog.gamepass.com/sigls/v2` including the full Cloud Gaming gallery `29a81209-df6f-41fd-a528-2ae6b91f719c`) and **Microsoft Store DisplayCatalog v7.0** metadata (`displaycatalog.mp.microsoft.com`), falls back seamlessly to the deploy-time `data/xbox-catalog.json` snapshot built by `.github/workflows/pages.yml` (`scripts/sync-xbox-catalog.mjs`), supports Microsoft Device Code OAuth2 + `play.xbox.com` sign-in, and launches every game directly on **`play.xbox.com`** (`https://www.xbox.com/play/games/<slug>/<productId>`) alongside local `localStorage` persistence—for example on GitHub Pages at **https://robloxgamee1231-ctrl.github.io/Xcloud4-/**.

Build the static bundle locally into `_site/`:

```bash
npm run build:site
# Optional: sync live Microsoft/Xbox Cloud Gaming catalog snapshot into _site/data/xbox-catalog.json
npm run sync:catalog
```

## License

GPL-3.0-only — see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
