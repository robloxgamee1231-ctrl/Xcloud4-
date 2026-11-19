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
    streamLive: 'WebRTC en vivo',
    keyboardHint: 'Teclado: Flechas/WASD navegar · Enter abrir · Esc volver · F9 Modo Lab · / Buscar',
    searchPlaceholder: 'Buscar juegos en Xbox Cloud Gaming...',
    allGamesChip: 'Todos los juegos',
    jumpBackIn: 'Volver a jugar',
    myLibrary: 'Mi biblioteca',
    msSignInBtn: 'Iniciar sesión con Microsoft',
    playNowBtn: 'Jugar ahora en la nube',
    signInModalSub: 'Autoriza tu cuenta de Microsoft sin salir de XCloud4.',
    openLinkPopup: 'Abrir ventana de Microsoft (no sale de aquí)',
    relaySetupTitle: 'Conectar Relay para juego en la nube',
    relaySetupBody: 'GitHub Pages es un sitio estático y los navegadores bloquean las peticiones CORS hacia Xbox GSSV. Introduce la URL de tu servidor XCloud4 Node o Worker Cloudflare (`workers/xcloud4-relay.js`) para jugar en WebRTC dentro de esta página.',
    relayModeNode: 'Relay Node activo',
    relayModeCors: 'Relay CORS Cloudflare activo',
    relayPlaceholder: 'https://tu-relay.workers.dev o http://localhost:3000',
    connectRelayTitle: 'Relay XCloud4 (Node o Cloudflare Worker)',
    connectRelayBtn: 'Conectar Relay',
    clearRelayBtn: 'Desconectar',
    virtualPadTitle: 'Mando virtual (Teclado)',
    virtualPadHint: 'WASD Stick Izq · Flechas/Ratón Stick Der · Espacio A · C B · Q LB · E RB · Tab View · Enter Menu',
    openStoreQr: 'Ver en Xbox Store (QR)',
    scriptInspect: 'Ver código Lua',
    serverPingBtn: 'Medir latencia',
    msUnit: 'ms',
    noController: 'Sin mando físico (usa teclado o conecta uno por USB/BT)',
    connectedPads: 'mandos conectados',
    gyroTip: 'Giroscopio / Ratón activo',
    casCompare: 'Filtro WebGL activo',
    quickMenuTitle: 'Menú rápido de sesión',
    nexusPulse: 'Botón Xbox (Nexus)',
    muteAudio: 'Silenciar audio',
    toggleMic: 'Micrófono',
    cycleHud: 'Cambiar HUD de red',
    requestKeyframe: 'Forzar keyframe / recargar vídeo',
    exitStream: 'Salir del juego',
    hapticsActive: 'Vibración',
    liveCatalogBadge: 'Catálogo Xbox en vivo',
  },
  en: {
    labToggle: 'Lab (R3)',
    labBadge: 'LAB',
    streamLive: 'Live WebRTC',
    keyboardHint: 'Keyboard: Arrows/WASD navigate · Enter select · Esc back · F9 Lab Mode · / Search',
    searchPlaceholder: 'Search Xbox Cloud Gaming...',
    allGamesChip: 'All Games',
    jumpBackIn: 'Jump back in',
    myLibrary: 'My Library',
    msSignInBtn: 'Sign in with Microsoft',
    playNowBtn: 'Play in Cloud Now',
    signInModalSub: 'Authorize your Microsoft account right inside XCloud4 without leaving this site.',
    openLinkPopup: 'Open Microsoft Code Window (stays here)',
    relaySetupTitle: 'Connect Cloud Stream Relay',
    relaySetupBody: 'Static hosting blocks direct browser CORS calls to Xbox GSSV streaming endpoints. Enter an XCloud4 Node URL or Cloudflare CORS Relay URL (workers/xcloud4-relay.js) to stream WebRTC directly on this site.',
    relayModeNode: 'Node Relay connected',
    relayModeCors: 'Cloudflare CORS Relay connected',
    relayPlaceholder: 'https://your-relay.workers.dev or http://localhost:3000',
    connectRelayTitle: 'XCloud4 Relay (Node or Cloudflare Worker)',
    connectRelayBtn: 'Connect Relay',
    clearRelayBtn: 'Disconnect',
    virtualPadTitle: 'Virtual Gamepad (Keyboard)',
    virtualPadHint: 'WASD Left Stick · Arrows Right Stick · Space A · C B · F X · R Y · Q/E LB/RB · 1/3 LT/RT',
    openStoreQr: 'Xbox Store QR',
    scriptInspect: 'Inspect Lua source',
    serverPingBtn: 'Measure latency',
    msUnit: 'ms',
    noController: 'No physical controller detected (use keyboard or plug in USB/BT pad)',
    connectedPads: 'controllers connected',
    gyroTip: 'Gyro / Pointer active',
    casCompare: 'WebGL Pipeline active',
    quickMenuTitle: 'Quick Stream Menu',
    nexusPulse: 'Xbox Guide (Nexus)',
    muteAudio: 'Mute Audio',
    toggleMic: 'Microphone',
    cycleHud: 'Cycle Network HUD',
    requestKeyframe: 'Request Keyframe / Reload',
    exitStream: 'Exit Game',
    hapticsActive: 'Rumble',
    liveCatalogBadge: 'Live Xbox Catalog',
  },
  'pt-BR': {
    labToggle: 'Lab (R3)',
    labBadge: 'LAB',
    streamLive: 'WebRTC ao vivo',
    keyboardHint: 'Teclado: Setas/WASD navegar · Enter selecionar · Esc voltar · F9 Lab · / Buscar',
    searchPlaceholder: 'Buscar no Xbox Cloud Gaming...',
    allGamesChip: 'Todos os jogos',
    jumpBackIn: 'Voltar a jogar',
    myLibrary: 'Minha biblioteca',
    msSignInBtn: 'Entrar com a Microsoft',
    playNowBtn: 'Jogar na nuvem agora',
    signInModalSub: 'Autorize sua conta Microsoft sem sair do XCloud4.',
    openLinkPopup: 'Abrir janela da Microsoft (permanece aqui)',
    relaySetupTitle: 'Conectar Relay para nuvem',
    relaySetupBody: 'Hospedagem estática bloqueia CORS direto para o Xbox GSSV. Conecte um Relay Node ou Cloudflare Worker (workers/xcloud4-relay.js) para jogar em WebRTC aqui mesmo.',
    relayModeNode: 'Relay Node conectado',
    relayModeCors: 'Relay CORS Cloudflare conectado',
    relayPlaceholder: 'https://seu-relay.workers.dev ou http://localhost:3000',
    connectRelayTitle: 'Relay XCloud4 (Node ou Cloudflare Worker)',
    connectRelayBtn: 'Conectar Relay',
    clearRelayBtn: 'Desconectar',
    virtualPadTitle: 'Controle Virtual (Teclado)',
    virtualPadHint: 'WASD Analógico Esq · Setas Dir · Espaço A · C B · F X · R Y · Q/E LB/RB',
    openStoreQr: 'QR da Xbox Store',
    scriptInspect: 'Ver fonte Lua',
    serverPingBtn: 'Medir latência',
    msUnit: 'ms',
    noController: 'Nenhum controle físico conectado',
    connectedPads: 'controles conectados',
    gyroTip: 'Giroscópio ativo',
    casCompare: 'Pipeline WebGL ativo',
    quickMenuTitle: 'Menu Rápido do Stream',
    nexusPulse: 'Botão Xbox (Nexus)',
    muteAudio: 'Silenciar áudio',
    toggleMic: 'Microfone',
    cycleHud: 'Alternar HUD de rede',
    requestKeyframe: 'Forçar Keyframe',
    exitStream: 'Sair do Jogo',
    hapticsActive: 'Vibração',
    liveCatalogBadge: 'Catálogo Xbox ao vivo',
  },
  fr: {
    labToggle: 'Lab (R3)',
    labBadge: 'LAB',
    streamLive: 'WebRTC en direct',
    keyboardHint: 'Clavier : Flèches/WASD naviguer · Entrée valider · Échap retour · F9 Lab · / Rechercher',
    searchPlaceholder: 'Rechercher sur Xbox Cloud Gaming...',
    allGamesChip: 'Tous les jeux',
    jumpBackIn: 'Reprendre',
    myLibrary: 'Ma bibliothèque',
    msSignInBtn: 'Se connecter avec Microsoft',
    playNowBtn: 'Jouer dans le cloud ici',
    signInModalSub: 'Autorisez votre compte Microsoft sans quitter XCloud4.',
    openLinkPopup: 'Ouvrir la fenêtre Microsoft (reste ici)',
    relaySetupTitle: 'Connecter un relais Cloud Gaming',
    relaySetupBody: 'L’hébergement statique bloque les appels CORS vers Xbox GSSV. Saisissez un relais Node ou Cloudflare Worker (workers/xcloud4-relay.js) pour jouer en WebRTC sur ce site.',
    relayModeNode: 'Relais Node connecté',
    relayModeCors: 'Relais CORS Cloudflare connecté',
    relayPlaceholder: 'https://votre-relais.workers.dev ou http://localhost:3000',
    connectRelayTitle: 'Relais XCloud4 (Node ou Cloudflare Worker)',
    connectRelayBtn: 'Connecter le relais',
    clearRelayBtn: 'Déconnecter',
    virtualPadTitle: 'Manette virtuelle (Clavier)',
    virtualPadHint: 'WASD Stick G · Flèches Stick D · Espace A · C B · F X · R Y · Q/E LB/RB',
    openStoreQr: 'QR Xbox Store',
    scriptInspect: 'Voir le script Lua',
    serverPingBtn: 'Mesurer la latence',
    msUnit: 'ms',
    noController: 'Aucune manette détectée',
    connectedPads: 'manettes connectées',
    gyroTip: 'Gyroscope actif',
    casCompare: 'Pipeline WebGL actif',
    quickMenuTitle: 'Menu rapide',
    nexusPulse: 'Bouton Xbox (Nexus)',
    muteAudio: 'Couper le son',
    toggleMic: 'Microphone',
    cycleHud: 'Changer le HUD réseau',
    requestKeyframe: 'Forcer image clé',
    exitStream: 'Quitter le jeu',
    hapticsActive: 'Vibrations',
    liveCatalogBadge: 'Catalogue Xbox en direct',
  },
  it: {
    labToggle: 'Lab (R3)',
    labBadge: 'LAB',
    streamLive: 'WebRTC live',
    keyboardHint: 'Tastiera: Frecce/WASD naviga · Invio seleziona · Esc indietro · F9 Lab · / Cerca',
    searchPlaceholder: 'Cerca su Xbox Cloud Gaming...',
    allGamesChip: 'Tutti i giochi',
    jumpBackIn: 'Riprendi a giocare',
    myLibrary: 'La mia libreria',
    msSignInBtn: 'Accedi con Microsoft',
    playNowBtn: 'Gioca nel cloud ora',
    signInModalSub: 'Autorizza il tuo account Microsoft senza uscire da XCloud4.',
    openLinkPopup: 'Apri finestra codice Microsoft (resta qui)',
    relaySetupTitle: 'Connetti Relay Cloud Gaming',
    relaySetupBody: 'L’hosting statico blocca il CORS diretto verso Xbox GSSV. Inserisci un Relay Node o Cloudflare Worker (workers/xcloud4-relay.js) per lo streaming WebRTC qui.',
    relayModeNode: 'Relay Node connesso',
    relayModeCors: 'Relay CORS Cloudflare connesso',
    relayPlaceholder: 'https://tuo-relay.workers.dev o http://localhost:3000',
    connectRelayTitle: 'Relay XCloud4 (Node o Cloudflare Worker)',
    connectRelayBtn: 'Connetti Relay',
    clearRelayBtn: 'Disconnetti',
    virtualPadTitle: 'Controller virtuale',
    virtualPadHint: 'WASD Stick SX · Frecce DX · Spazio A · C B · F X · R Y · Q/E LB/RB',
    openStoreQr: 'QR Xbox Store',
    scriptInspect: 'Vedi sorgente Lua',
    serverPingBtn: 'Misura latenza',
    msUnit: 'ms',
    noController: 'Nessun controller rilevato',
    connectedPads: 'controller connessi',
    gyroTip: 'Giroscopio attivo',
    casCompare: 'Pipeline WebGL attiva',
    quickMenuTitle: 'Menu rapido',
    nexusPulse: 'Pulsante Xbox',
    muteAudio: 'Disattiva audio',
    toggleMic: 'Microfono',
    cycleHud: 'Cambia HUD rete',
    requestKeyframe: 'Richiedi Keyframe',
    exitStream: 'Esci dal gioco',
    hapticsActive: 'Vibrazione',
    liveCatalogBadge: 'Catalogo Xbox Live',
  },
  de: {
    labToggle: 'Lab (R3)',
    labBadge: 'LAB',
    streamLive: 'Live-WebRTC',
    keyboardHint: 'Tastatur: Pfeile/WASD navigieren · Enter wählen · Esc zurück · F9 Lab · / Suchen',
    searchPlaceholder: 'Xbox Cloud Gaming durchsuchen...',
    allGamesChip: 'Alle Spiele',
    jumpBackIn: 'Weiterspielen',
    myLibrary: 'Meine Bibliothek',
    msSignInBtn: 'Mit Microsoft anmelden',
    playNowBtn: 'Jetzt in der Cloud spielen',
    signInModalSub: 'Autorisiere dein Microsoft-Konto direkt in XCloud4, ohne diese Seite zu verlassen.',
    openLinkPopup: 'Microsoft-Codefenster öffnen (bleibt hier)',
    relaySetupTitle: 'Cloud-Stream-Relay verbinden',
    relaySetupBody: 'Statisches Hosting blockiert direktes CORS zu Xbox GSSV. Verbinde ein Node-Relay oder einen Cloudflare-Worker (workers/xcloud4-relay.js) für direktes WebRTC.',
    relayModeNode: 'Node-Relay verbunden',
    relayModeCors: 'Cloudflare-CORS-Relay verbunden',
    relayPlaceholder: 'https://dein-relay.workers.dev oder http://localhost:3000',
    connectRelayTitle: 'XCloud4-Relay (Node oder Cloudflare Worker)',
    connectRelayBtn: 'Relay verbinden',
    clearRelayBtn: 'Trennen',
    virtualPadTitle: 'Virtueller Controller',
    virtualPadHint: 'WASD Links · Pfeile Rechts · Leertaste A · C B · F X · R Y · Q/E LB/RB',
    openStoreQr: 'Xbox Store QR',
    scriptInspect: 'Lua-Code ansehen',
    serverPingBtn: 'Latenz messen',
    msUnit: 'ms',
    noController: 'Kein physischer Controller erkannt',
    connectedPads: 'Controller verbunden',
    gyroTip: 'Gyroskop aktiv',
    casCompare: 'WebGL-Pipeline aktiv',
    quickMenuTitle: 'Stream-Schnellmenü',
    nexusPulse: 'Xbox-Taste (Nexus)',
    muteAudio: 'Ton stummschalten',
    toggleMic: 'Mikrofon',
    cycleHud: 'Netzwerk-HUD wechseln',
    requestKeyframe: 'Keyframe anfordern',
    exitStream: 'Spiel beenden',
    hapticsActive: 'Vibration',
    liveCatalogBadge: 'Live-Xbox-Katalog',
  },
};

export function w(key) {
  return (WEB_COPY[resolvedLang] || WEB_COPY.en)[key] ?? WEB_COPY.en[key] ?? key;
}
