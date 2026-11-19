/* SPDX-License-Identifier: GPL-3.0-only */
/* 6-language localization runtime backed by upstream XCloud4 lang.c dictionary. */

let i18nData = { tables: {}, stages: [], categories: {} };
let activeSetting = 'auto';
let resolvedLang = 'en';
let currentVersion = '1.3.0-beta';
let currentAppVersion = '01.47';

export const SUPPORTED_LANGUAGES = [
  { code: 'auto', labelKey: 'X4_TR_AUTO' },
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Deutsch' },
];

export async function initI18n() {
  const res = await fetch(new URL('./i18n-data.json', import.meta.url));
  i18nData = await res.json();
  setLanguage('auto');
}

export function detectBrowserLanguage() {
  const nav = (navigator.language || 'en-US').toLowerCase();
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('pt')) return 'pt-BR';
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('it')) return 'it';
  if (nav.startsWith('de')) return 'de';
  return 'en';
}

export function setLanguage(langSetting) {
  activeSetting = langSetting || 'auto';
  resolvedLang = activeSetting === 'auto' ? detectBrowserLanguage() : activeSetting;
  if (!i18nData.tables[resolvedLang]) resolvedLang = 'en';
  document.documentElement.lang = resolvedLang;
}

export function setIdentityVersions(isLab) {
  currentVersion = isLab ? '0.7.111-lab' : '1.3.0-beta';
  currentAppVersion = isLab ? '01.79' : '01.47';
}

export function getResolvedLanguage() {
  return resolvedLang;
}

export function getLanguageSetting() {
  return activeSetting;
}

function formatPrintf(template, args) {
  let str = String(template)
    .replaceAll('{version}', currentVersion)
    .replaceAll('{app_version}', currentAppVersion);
  if (!args.length) return str;
  let idx = 0;
  return str.replace(/%(?:0?(\d+))?(?:ll)?([sudxX])/g, (match, width, spec) => {
    if (idx >= args.length) return match;
    const val = args[idx++];
    if (spec === 's') return String(val ?? '');
    if (spec === 'x' || spec === 'X') {
      let hex = (Number(val) >>> 0).toString(16);
      if (spec === 'X') hex = hex.toUpperCase();
      if (width) hex = hex.padStart(Number(width), '0');
      return hex;
    }
    let numStr = String(Math.trunc(Number(val) || 0));
    if (width) numStr = numStr.padStart(Number(width), '0');
    return numStr;
  });
}

export function t(key, ...args) {
  const tbl = i18nData.tables[resolvedLang] || i18nData.tables.en || {};
  const fallback = i18nData.tables.en || {};
  const raw = tbl[key] ?? fallback[key] ?? key;
  return formatPrintf(raw, args);
}

export function tCount(count, singularKey, pluralKey, ...args) {
  const key = Number(count) === 1 ? singularKey : pluralKey;
  return t(key, ...args);
}

export function trCategory(rawCategory) {
  if (!rawCategory) return '';
  const key = i18nData.categories?.[rawCategory];
  if (key) return t(key);
  return rawCategory;
}

export function trStage(stage) {
  if (!stage) return '';
  const match = i18nData.stages?.find((s) => s.key === stage);
  if (match) return match[resolvedLang] || match.en || stage;
  return stage;
}

const WEB_COPY = {
  es: {
    labToggle: 'Lab (R3)',
    labBadge: 'LAB',
    demoModeBtn: 'Probar modo demo (Sandbox)',
    demoBadge: 'SANDBOX PREVIEW',
    demoExplain: 'El entorno actual bloquea microsoftonline.com / xboxlive.com. Usa el modo demo interactivo para probar todo el cliente, el catálogo, los shaders y el motor de mandos.',
    streamLive: 'WebRTC en vivo',
    streamSim: 'Simulador interactivo',
    keyboardHint: 'Teclado: Flechas/WASD navegar · Enter abrir · Esc volver · F9 Modo Lab · G mando virtual',
    virtualPadTitle: 'Mando virtual (Teclado)',
    virtualPadHint: 'WASD Stick Izq · Flechas/Ratón Stick Der · Espacio A · C B · Q LB · E RB · Tab View · Enter Menu',
    openStoreQr: 'Ver en Xbox Store (QR)',
    scriptInspect: 'Ver código Lua',
    serverPingBtn: 'Medir latencia',
    msUnit: 'ms',
    noController: 'Sin mando físico (usa teclado o conecta uno por USB/BT)',
    connectedPads: 'mandos conectados',
    gyroDemoTip: 'Giroscopio / Ratón activo',
    casCompare: 'Filtro WebGL activo',
    quickMenuTitle: 'Menú rápido de sesión',
    nexusPulse: 'Botón Xbox (Nexus)',
    muteAudio: 'Silenciar audio',
    toggleMic: 'Micrófono',
    cycleHud: 'Cambiar HUD de red',
    requestKeyframe: 'Forzar keyframe / recargar vídeo',
    exitStream: 'Salir del juego',
    hapticsActive: 'Vibración',
  },
  en: {
    labToggle: 'Lab (R3)',
    labBadge: 'LAB',
    demoModeBtn: 'Try Demo Mode (Sandbox)',
    demoBadge: 'SANDBOX PREVIEW',
    demoExplain: 'This sandbox restricts outbound access to microsoftonline.com and xboxlive.com. Launch Sandbox Demo Mode to inspect signed-in features, catalog views, WebGL shaders, and controller scripts.',
    streamLive: 'Live WebRTC',
    streamSim: 'Interactive Preview Stream',
    keyboardHint: 'Keyboard: Arrows/WASD navigate · Enter select · Esc back · F9 Lab Mode · G virtual gamepad',
    virtualPadTitle: 'Virtual Gamepad (Keyboard)',
    virtualPadHint: 'WASD Left Stick · Arrows Right Stick · Space A · C B · F X · R Y · Q/E LB/RB · 1/3 LT/RT',
    openStoreQr: 'Xbox Store QR',
    scriptInspect: 'Inspect Lua source',
    serverPingBtn: 'Measure latency',
    msUnit: 'ms',
    noController: 'No physical controller detected (use keyboard or plug in USB/BT pad)',
    connectedPads: 'controllers connected',
    gyroDemoTip: 'Gyro / Pointer active',
    casCompare: 'WebGL Pipeline active',
    quickMenuTitle: 'Quick Stream Menu',
    nexusPulse: 'Xbox Guide (Nexus)',
    muteAudio: 'Mute Audio',
    toggleMic: 'Microphone',
    cycleHud: 'Cycle Network HUD',
    requestKeyframe: 'Request Keyframe / Reload',
    exitStream: 'Exit Game',
    hapticsActive: 'Rumble',
  },
  'pt-BR': {
    labToggle: 'Lab (R3)',
    labBadge: 'LAB',
    demoModeBtn: 'Testar Modo Demo (Sandbox)',
    demoBadge: 'SANDBOX PREVIEW',
    demoExplain: 'Este ambiente restringe o acesso a microsoftonline.com e xboxlive.com. Use o Modo Demo para explorar todo o catálogo, shaders WebGL e scripts de controle.',
    streamLive: 'WebRTC ao vivo',
    streamSim: 'Stream Interativo',
    keyboardHint: 'Teclado: Setas/WASD navegar · Enter selecionar · Esc voltar · F9 Lab · G controle virtual',
    virtualPadTitle: 'Controle Virtual (Teclado)',
    virtualPadHint: 'WASD Analógico Esq · Setas Dir · Espaço A · C B · F X · R Y · Q/E LB/RB',
    openStoreQr: 'QR da Xbox Store',
    scriptInspect: 'Ver fonte Lua',
    serverPingBtn: 'Medir latência',
    msUnit: 'ms',
    noController: 'Nenhum controle físico conectado',
    connectedPads: 'controles conectados',
    gyroDemoTip: 'Giroscópio ativo',
    casCompare: 'Pipeline WebGL ativo',
    quickMenuTitle: 'Menu Rápido do Stream',
    nexusPulse: 'Botão Xbox (Nexus)',
    muteAudio: 'Silenciar áudio',
    toggleMic: 'Microfone',
    cycleHud: 'Alternar HUD de rede',
    requestKeyframe: 'Forçar Keyframe',
    exitStream: 'Sair do Jogo',
    hapticsActive: 'Vibração',
  },
  fr: {
    labToggle: 'Lab (R3)',
    labBadge: 'LAB',
    demoModeBtn: 'Mode Démo (Sandbox)',
    demoBadge: 'APERÇU SANDBOX',
    demoExplain: 'Cet environnement restreint microsoftonline.com et xboxlive.com. Lancez le mode démo pour tester toutes les vues, shaders WebGL et scripts manette.',
    streamLive: 'WebRTC en direct',
    streamSim: 'Flux interactif',
    keyboardHint: 'Clavier : Flèches/WASD naviguer · Entrée valider · Échap retour · F9 Lab',
    virtualPadTitle: 'Manette virtuelle (Clavier)',
    virtualPadHint: 'WASD Stick G · Flèches Stick D · Espace A · C B · F X · R Y · Q/E LB/RB',
    openStoreQr: 'QR Xbox Store',
    scriptInspect: 'Voir le script Lua',
    serverPingBtn: 'Mesurer la latence',
    msUnit: 'ms',
    noController: 'Aucune manette détectée',
    connectedPads: 'manettes connectées',
    gyroDemoTip: 'Gyroscope actif',
    casCompare: 'Pipeline WebGL actif',
    quickMenuTitle: 'Menu rapide',
    nexusPulse: 'Bouton Xbox (Nexus)',
    muteAudio: 'Couper le son',
    toggleMic: 'Microphone',
    cycleHud: 'Changer le HUD réseau',
    requestKeyframe: 'Forcer image clé',
    exitStream: 'Quitter le jeu',
    hapticsActive: 'Vibrations',
  },
  it: {
    labToggle: 'Lab (R3)',
    labBadge: 'LAB',
    demoModeBtn: 'Modalità Demo (Sandbox)',
    demoBadge: 'ANTEPRIMA SANDBOX',
    demoExplain: 'Questo ambiente limita microsoftonline.com e xboxlive.com. Avvia la modalità demo per testare catalogo, shader WebGL e script controller.',
    streamLive: 'WebRTC live',
    streamSim: 'Stream interattivo',
    keyboardHint: 'Tastiera: Frecce/WASD naviga · Invio seleziona · Esc indietro · F9 Lab',
    virtualPadTitle: 'Controller virtuale',
    virtualPadHint: 'WASD Stick SX · Frecce DX · Spazio A · C B · F X · R Y · Q/E LB/RB',
    openStoreQr: 'QR Xbox Store',
    scriptInspect: 'Vedi sorgente Lua',
    serverPingBtn: 'Misura latenza',
    msUnit: 'ms',
    noController: 'Nessun controller rilevato',
    connectedPads: 'controller connessi',
    gyroDemoTip: 'Giroscopio attivo',
    casCompare: 'Pipeline WebGL attiva',
    quickMenuTitle: 'Menu rapido',
    nexusPulse: 'Pulsante Xbox',
    muteAudio: 'Disattiva audio',
    toggleMic: 'Microfono',
    cycleHud: 'Cambia HUD rete',
    requestKeyframe: 'Richiedi Keyframe',
    exitStream: 'Esci dal gioco',
    hapticsActive: 'Vibrazione',
  },
  de: {
    labToggle: 'Lab (R3)',
    labBadge: 'LAB',
    demoModeBtn: 'Demo-Modus (Sandbox)',
    demoBadge: 'SANDBOX-VORSCHAU',
    demoExplain: 'Diese Umgebung blockiert microsoftonline.com und xboxlive.com. Starte den Demo-Modus, um Katalog, WebGL-Shader und Controller-Skripte zu testen.',
    streamLive: 'Live-WebRTC',
    streamSim: 'Interaktiver Stream',
    keyboardHint: 'Tastatur: Pfeile/WASD navigieren · Enter wählen · Esc zurück · F9 Lab',
    virtualPadTitle: 'Virtueller Controller',
    virtualPadHint: 'WASD Links · Pfeile Rechts · Leertaste A · C B · F X · R Y · Q/E LB/RB',
    openStoreQr: 'Xbox Store QR',
    scriptInspect: 'Lua-Code ansehen',
    serverPingBtn: 'Latenz messen',
    msUnit: 'ms',
    noController: 'Kein physischer Controller erkannt',
    connectedPads: 'Controller verbunden',
    gyroDemoTip: 'Gyroskop aktiv',
    casCompare: 'WebGL-Pipeline aktiv',
    quickMenuTitle: 'Stream-Schnellmenü',
    nexusPulse: 'Xbox-Taste (Nexus)',
    muteAudio: 'Ton stummschalten',
    toggleMic: 'Mikrofon',
    cycleHud: 'Netzwerk-HUD wechseln',
    requestKeyframe: 'Keyframe anfordern',
    exitStream: 'Spiel beenden',
    hapticsActive: 'Vibration',
  },
};

export function w(key) {
  return (WEB_COPY[resolvedLang] || WEB_COPY.en)[key] ?? WEB_COPY.en[key] ?? key;
}
