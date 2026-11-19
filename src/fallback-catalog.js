/* SPDX-License-Identifier: GPL-3.0-only */
/* Shared fallback catalog & bespoke SVG artwork generator re-exported for server + static browser mode. */
export {
  FALLBACK_TITLES,
  FALLBACK_REGIONS,
  buildFallbackCatalogMap,
  buildFallbackPublicLists,
  renderFallbackArtworkSvg,
  renderFallbackArtworkDataUrl,
  buildStaticPublicLists,
} from '../public/js/fallback-catalog.js';
