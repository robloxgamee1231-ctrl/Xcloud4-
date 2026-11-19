/* SPDX-License-Identifier: GPL-3.0-only */
/* Crisp Tabler Icons v3.24.0 outline SVGs (MIT) + UI 2.0 brand mark. */

const SVG_ATTRS = `xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

export const ICONS = {
  home: `<svg ${SVG_ATTRS}><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></svg>`,
  world: `<svg ${SVG_ATTRS}><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M3.6 9h16.8" /><path d="M3.6 15h16.8" /><path d="M11.5 3a17 17 0 0 0 0 18" /><path d="M12.5 3a17 17 0 0 1 0 18" /></svg>`,
  'device-desktop': `<svg ${SVG_ATTRS}><path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10z" /><path d="M7 20h10" /><path d="M9 16v4" /><path d="M15 16v4" /></svg>`,
  'device-gamepad': `<svg ${SVG_ATTRS}><path d="M2 6m0 2a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2z" /><path d="M6 12h4m-2 -2v4" /><path d="M15 11l0 .01" /><path d="M18 13l0 .01" /></svg>`,
  search: `<svg ${SVG_ATTRS}><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>`,
  settings: `<svg ${SVG_ATTRS}><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>`,
  heart: `<svg ${SVG_ATTRS}><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" /></svg>`,
  'heart-filled': `<svg ${SVG_ATTRS} fill="currentColor"><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" /></svg>`,
  'info-circle': `<svg ${SVG_ATTRS}><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg>`,
  user: `<svg ${SVG_ATTRS}><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>`,
  server: `<svg ${SVG_ATTRS}><path d="M3 4m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M3 12m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M7 8l0 .01" /><path d="M7 16l0 .01" /></svg>`,
  microphone: `<svg ${SVG_ATTRS}><path d="M9 2m0 3a3 3 0 0 1 3 -3h0a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3h0a3 3 0 0 1 -3 -3z" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M8 21l8 0" /><path d="M12 17l0 4" /></svg>`,
  'microphone-off': `<svg ${SVG_ATTRS}><path d="M3 3l18 18" /><path d="M9 5a3 3 0 0 1 6 0v5a3 3 0 0 1 -.13 .874m-2 2a3 3 0 0 1 -3.87 -2.872v-1" /><path d="M5 10a7 7 0 0 0 10.846 5.85m2 -2a6.967 6.967 0 0 0 1.152 -3.85" /><path d="M8 21l8 0" /><path d="M12 17l0 4" /></svg>`,
  'chevron-right': `<svg ${SVG_ATTRS}><path d="M9 6l6 6l-6 6" /></svg>`,
  'chevron-left': `<svg ${SVG_ATTRS}><path d="M15 6l-6 6l6 6" /></svg>`,
  flask: `<svg ${SVG_ATTRS}><path d="M9 3l6 0" /><path d="M10 9l4 0" /><path d="M10 3v6l-4 11a.7 .7 0 0 0 .5 1h11a.7 .7 0 0 0 .5 -1l-4 -11v-6" /></svg>`,
  wifi: `<svg ${SVG_ATTRS}><path d="M12 18l.01 0" /><path d="M9.172 15.172a4 4 0 0 1 5.656 0" /><path d="M6.343 12.343a8 8 0 0 1 11.314 0" /><path d="M3.515 9.515c4.686 -4.687 12.284 -4.687 17 0" /></svg>`,
  play: `<svg ${SVG_ATTRS} fill="currentColor"><path d="M7 4v16l13 -8z" /></svg>`,
  volume: `<svg ${SVG_ATTRS}><path d="M15 8a5 5 0 0 1 0 8" /><path d="M17.7 5a9 9 0 0 1 0 14" /><path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5" /></svg>`,
  'volume-off': `<svg ${SVG_ATTRS}><path d="M15 8a5 5 0 0 1 1.912 4.934m-1.377 2.602a5 5 0 0 1 -.535 .464" /><path d="M17.7 5a9 9 0 0 1 2.362 11.086m-1.676 2.299a9 9 0 0 1 -.686 .615" /><path d="M9.069 5.054l.431 -.554a.8 .8 0 0 1 1.5 .5v2m0 4v8a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l1.294 -1.664" /><path d="M3 3l18 18" /></svg>`,
  refresh: `<svg ${SVG_ATTRS}><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>`,
  x: `<svg ${SVG_ATTRS}><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>`,
  check: `<svg ${SVG_ATTRS}><path d="M5 12l5 5l10 -10" /></svg>`,
  plus: `<svg ${SVG_ATTRS}><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>`,
  'external-link': `<svg ${SVG_ATTRS}><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" /><path d="M11 13l9 -9" /><path d="M15 4h5v5" /></svg>`,
  qrcode: `<svg ${SVG_ATTRS}><path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M7 17l0 .01" /><path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M7 7l0 .01" /><path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M17 7l0 .01" /><path d="M14 14l3 0" /><path d="M20 14l0 .01" /><path d="M14 14l0 3" /><path d="M14 20l3 0" /><path d="M17 17l3 0" /><path d="M20 17l0 3" /></svg>`,
  activity: `<svg ${SVG_ATTRS}><path d="M3 12h4l3 8l4 -16l3 8h4" /></svg>`,
};

export function icon(name, cls = '') {
  return `<span class="x4-icon ${cls}" aria-hidden="true">${ICONS[name] || ''}</span>`;
}

export function brandWordmark(compact = false) {
  return `
  <div class="x4-wordmark ${compact ? 'is-compact' : ''}">
    <svg class="x4-cloud-emblem" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="x4CloudGrad" x1="4" y1="8" x2="60" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#00D4FF"/>
          <stop offset="100%" stop-color="#22E36E"/>
        </linearGradient>
      </defs>
      <path d="M18 36H48C54.6274 36 60 30.6274 60 24C60 17.756 55.2314 12.6267 49.1398 12.054C47.129 6.20088 41.5736 2 35 2C26.7157 2 20 8.71573 20 17C20 17.2858 20.008 17.5698 20.0237 17.8516C18.775 17.3036 17.3982 17 15.95 17C10.4548 17 6 21.4548 6 26.95C6 31.9479 9.67905 36 14.8 36H18Z"
        stroke="url(#x4CloudGrad)" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M25 22H31M28 19V25M39 20.5H39.02M43 23.5H43.02" stroke="url(#x4CloudGrad)" stroke-width="3" stroke-linecap="round"/>
    </svg>
    <span class="x4-wordmark-text">XCloud<span class="x4-wordmark-4">4</span></span>
  </div>`;
}
