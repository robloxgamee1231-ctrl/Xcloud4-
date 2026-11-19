/* SPDX-License-Identifier: GPL-3.0-only */
/* Shared Xbox Cloud Gaming SIGL + Microsoft DisplayCatalog v7.0 + play.xbox.com helpers (Browser & Node). */

export const SIGL_GUIDS = {
  all: '29a81209-df6f-41fd-a528-2ae6b91f719c',
  allWithByog: 'ce573635-7c18-4d0c-9d68-90b932393470',
  free: 'd8f4afcd-882a-49e3-86b3-f61fa0172b75',
  new: '06323672-b8c8-43cc-b0de-32d5a9834749',
  newAlt: '44a55037-770f-4bbf-bde5-a9fa27dba1da',
  popular: '6a589fa0-d493-472b-8e20-3813699d7056',
  popularAlt: 'e7590b22-e299-44db-ae22-25c61405454c',
  leaving: '31ff2361-2772-4622-849b-f4f1abb4ad1b',
  leavingAlt: '393f05bf-e596-4ef6-9487-6d4fa0eab987',
  touch: '9c86f07a-f3e8-45ad-82a0-a1f759597059',
  mkb: '8fa264dd-124f-4af3-97e8-596fcdf4b486',
};

export const FORTNITE_PRODUCT_ID = 'BT5P2X999VH2';

export function isValidProductId(productId) {
  return typeof productId === 'string' && /^[A-Za-z0-9]{8,16}$/.test(productId);
}

export function normalizeLocaleMarket(langSetting, queryMarket, queryLocale) {
  if (/^[A-Z]{2}$/.test(queryMarket || '') && /^[a-z]{2}-[A-Z]{2}$/.test(queryLocale || '')) {
    return { market: queryMarket, locale: queryLocale };
  }
  switch (langSetting) {
    case 'es': return { market: 'ES', locale: 'es-ES' };
    case 'pt-BR': return { market: 'BR', locale: 'pt-BR' };
    case 'fr': return { market: 'FR', locale: 'fr-FR' };
    case 'it': return { market: 'IT', locale: 'it-IT' };
    case 'de': return { market: 'DE', locale: 'de-DE' };
    default: return { market: 'US', locale: 'en-US' };
  }
}

export function slugifyXboxTitle(title) {
  const slug = String(title || 'game')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return slug || 'game';
}

export function buildPlayXboxUrl(productId, title = 'game') {
  const safeId = encodeURIComponent(String(productId || FORTNITE_PRODUCT_ID).trim());
  const slug = slugifyXboxTitle(title);
  return `https://www.xbox.com/play/games/${slug}/${safeId}`;
}

export function formatStoreImageUrl(uri, width, height) {
  if (typeof uri !== 'string') return '';
  let clean = uri.trim();
  if (clean.startsWith('https:')) clean = clean.slice(6);
  else if (clean.startsWith('http:')) clean = clean.slice(5);
  if (!clean.startsWith('//store-images.s-microsoft.com/image/')) return '';
  const stem = clean.split('?')[0];
  return `https:${stem}?w=${width}&h=${height}&q=85&format=jpg`;
}

export function parseDisplayCatalogProducts(json, options = {}) {
  const freeSet = options.freeSet instanceof Set ? options.freeSet : null;
  const products = Array.isArray(json?.Products) ? json.Products : [];
  const result = {};

  for (const prod of products) {
    const productId = prod?.ProductId;
    if (!isValidProductId(productId)) continue;

    const loc = prod?.LocalizedProperties?.[0] || {};
    const props = prod?.Properties || {};
    const mkt = prod?.MarketProperties?.[0] || {};

    let ageRating = '';
    if (Array.isArray(mkt.ContentRatings)) {
      const esrb = mkt.ContentRatings.find((r) => r.RatingSystem === 'ESRB' && r.RatingId);
      const pegi = mkt.ContentRatings.find((r) => r.RatingSystem === 'PEGI' && r.RatingId);
      ageRating = (esrb || pegi)?.RatingId || '';
    }
    const releaseDate = typeof mkt.OriginalReleaseDate === 'string' ? mkt.OriginalReleaseDate.slice(0, 10) : '';
    const year = /^\d{4}/.test(releaseDate) ? releaseDate.slice(0, 4) : '';

    let coverUrl = '';
    let heroUrl = '';
    let posterUrl = '';
    const screenshots = [];

    const imgs = Array.isArray(loc.Images) ? loc.Images : [];
    const pickBest = (ranks) => {
      let best = 0;
      let bestUri = '';
      for (const im of imgs) {
        const r = ranks[im.ImagePurpose] || 0;
        if (r > best && im.Uri) {
          best = r;
          bestUri = im.Uri;
        }
      }
      return bestUri;
    };

    const rawCover = pickBest({ TiledHeroArt: 6, BrandedKeyArt: 5, SuperHeroArt: 4, TitledHeroArt: 3, BoxArt: 2, Poster: 1 });
    const rawHero = pickBest({ SuperHeroArt: 5, TitledHeroArt: 4, BrandedKeyArt: 3, TiledHeroArt: 2, BoxArt: 1 });
    const rawPoster = pickBest({ Poster: 3, BoxArt: 2, BrandedKeyArt: 1 });

    if (rawCover) coverUrl = formatStoreImageUrl(rawCover, 384, 216);
    if (rawHero) heroUrl = formatStoreImageUrl(rawHero, 1920, 1080);
    if (rawPoster) posterUrl = formatStoreImageUrl(rawPoster, 550, 825);

    for (const im of imgs) {
      if (im.ImagePurpose === 'Screenshot' && im.Uri && screenshots.length < 6) {
        const thumb = formatStoreImageUrl(im.Uri, 524, 295);
        const full = formatStoreImageUrl(im.Uri, 1920, 1080);
        if (thumb && full) screenshots.push({ thumb, full });
      }
    }

    const attrs = Array.isArray(props.Attributes) ? props.Attributes.map((a) => a.Name).filter(Boolean) : [];
    const altXboxId = Array.isArray(prod?.AlternateIds)
      ? prod.AlternateIds.find((a) => a.IdType === 'XboxTitleId')?.Value || ''
      : '';
    const title = loc.ProductTitle || productId;
    const isFree =
      Boolean(freeSet?.has(productId)) ||
      productId === FORTNITE_PRODUCT_ID ||
      prod?.DisplaySkuAvailabilities?.[0]?.Availabilities?.[0]?.OrderManagementData?.Price?.ListPrice === 0;

    result[productId] = {
      productId,
      titleId: altXboxId || productId,
      title,
      publisher: loc.PublisherName || '',
      developer: loc.DeveloperName || '',
      shortDescription: loc.ShortDescription || loc.ProductDescription || '',
      description: loc.ProductDescription || loc.ShortDescription || '',
      category: props.Category || 'Other',
      year,
      releaseDate,
      ageRating,
      freeToPlay: isFree,
      attributes: attrs,
      coverUrl: coverUrl || heroUrl || posterUrl,
      heroUrl: heroUrl || coverUrl || posterUrl,
      posterUrl: posterUrl || coverUrl || heroUrl,
      screenshots,
      playUrl: buildPlayXboxUrl(productId, title),
    };
  }
  return result;
}

async function fetchJsonWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!res.ok) {
      throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { httpStatus: res.status });
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSiglIds(guid, market = 'US', locale = 'en-US', timeoutMs = 15000) {
  const safeMarket = /^[A-Z]{2}$/.test(market) ? market : 'US';
  const safeLocale = /^[a-z]{2}-[A-Z]{2}$/.test(locale) ? locale : 'en-US';
  const url = `https://catalog.gamepass.com/sigls/v2?id=${encodeURIComponent(guid)}&market=${safeMarket}&language=${safeLocale}`;
  const arr = await fetchJsonWithTimeout(url, timeoutMs);
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => item?.id).filter((id) => isValidProductId(id));
}

export async function fetchSiglWithFallback(primaryGuid, fallbackGuid, market = 'US', locale = 'en-US', timeoutMs = 15000) {
  try {
    const list = await fetchSiglIds(primaryGuid, market, locale, timeoutMs);
    if (list.length > 0) return list;
  } catch {
    // try fallback GUID below
  }
  if (!fallbackGuid || fallbackGuid === primaryGuid) return [];
  try {
    return await fetchSiglIds(fallbackGuid, market, locale, timeoutMs);
  } catch {
    return [];
  }
}

export async function fetchDisplayCatalogChunks(
  productIds,
  market = 'US',
  locale = 'en-US',
  { freeSet = null, chunkSize = 20, concurrency = 4, timeoutMs = 15000 } = {}
) {
  const unique = [...new Set((productIds || []).filter(isValidProductId))];
  if (unique.length === 0) return {};
  const safeMarket = /^[A-Z]{2}$/.test(market) ? market : 'US';
  const safeLocale = /^[a-z]{2}-[A-Z]{2}$/.test(locale) ? locale : 'en-US';
  const safeChunk = Math.max(1, Math.min(20, chunkSize));

  const chunks = [];
  for (let i = 0; i < unique.length; i += safeChunk) {
    chunks.push(unique.slice(i, i + safeChunk));
  }

  const out = {};
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, chunks.length));

  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < chunks.length) {
      const chunk = chunks[cursor++];
      const url = `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${chunk.join(',')}&market=${safeMarket}&languages=${safeLocale}&fieldsTemplate=Details`;
      try {
        const json = await fetchJsonWithTimeout(url, timeoutMs);
        Object.assign(out, parseDisplayCatalogProducts(json, { freeSet }));
      } catch {
        // Continue remaining chunks cleanly
      }
    }
  });

  await Promise.all(workers);
  return out;
}

export async function fetchFullXboxCatalogSnapshot({
  market = 'US',
  locale = 'en-US',
  includeAll = true,
  initialLimit = 48,
  concurrency = 5,
  timeoutMs = 15000,
} = {}) {
  const [freeRaw, newest, popular, leaving, allRaw] = await Promise.all([
    fetchSiglIds(SIGL_GUIDS.free, market, locale, timeoutMs).catch(() => []),
    fetchSiglWithFallback(SIGL_GUIDS.new, SIGL_GUIDS.newAlt, market, locale, timeoutMs),
    fetchSiglWithFallback(SIGL_GUIDS.popular, SIGL_GUIDS.popularAlt, market, locale, timeoutMs),
    fetchSiglWithFallback(SIGL_GUIDS.leaving, SIGL_GUIDS.leavingAlt, market, locale, timeoutMs),
    fetchSiglWithFallback(SIGL_GUIDS.all, SIGL_GUIDS.allWithByog, market, locale, timeoutMs),
  ]);

  const freeSet = new Set(freeRaw);
  if (freeRaw.length > 0 && !freeSet.has(FORTNITE_PRODUCT_ID)) {
    freeRaw.unshift(FORTNITE_PRODUCT_ID);
    freeSet.add(FORTNITE_PRODUCT_ID);
  }

  const allOrdered = [...new Set([...freeRaw, ...popular, ...newest, ...leaving, ...allRaw])];
  if (allOrdered.length === 0) {
    throw new Error('All Xbox Cloud Gaming SIGL endpoints failed or returned empty lists');
  }

  const targetIds = includeAll ? allOrdered : allOrdered.slice(0, initialLimit);
  const metadata = await fetchDisplayCatalogChunks(targetIds, market, locale, {
    freeSet,
    chunkSize: 20,
    concurrency,
    timeoutMs,
  });

  if (Object.keys(metadata).length === 0) {
    throw new Error('Microsoft DisplayCatalog returned 0 products');
  }

  // Ensure shelf arrays only reference IDs with real metadata if possible
  const filterKnown = (arr) => arr.filter((id) => Boolean(metadata[id]));
  const lists = {
    free: freeRaw.length ? filterKnown(freeRaw) : [FORTNITE_PRODUCT_ID].filter((id) => metadata[id]),
    new: filterKnown(newest),
    popular: filterKnown(popular),
    leaving: filterKnown(leaving),
    all: allOrdered,
  };

  if (lists.popular.length === 0) {
    lists.popular = Object.keys(metadata).slice(0, 24);
  }

  return {
    generatedAt: new Date().toISOString(),
    market,
    locale,
    source: 'live',
    lists,
    metadata,
  };
}
