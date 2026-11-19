/* SPDX-License-Identifier: GPL-3.0-only */
/* Fetches the live Xbox Cloud Gaming SIGL lists + DisplayCatalog metadata into a static JSON snapshot. */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchFullXboxCatalogSnapshot } from '../public/js/xbox-catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

export async function syncXboxCatalog(outFile = path.join(REPO_ROOT, '_site', 'data', 'xbox-catalog.json'), opts = {}) {
  const market = opts.market || 'US';
  const locale = opts.locale || 'en-US';
  const maxAttempts = Number(opts.attempts || 3);

  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const snap = await fetchFullXboxCatalogSnapshot({
        market,
        locale,
        includeAll: true,
        concurrency: 6,
        timeoutMs: 20000,
      });
      const payload = {
        ...snap,
        source: 'live-snapshot',
      };
      await fs.mkdir(path.dirname(outFile), { recursive: true });
      await fs.writeFile(outFile, JSON.stringify(payload));
      return payload;
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  throw lastErr;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const posArgs = args.filter((a) => !a.startsWith('--'));
  const target = posArgs[0]
    ? path.resolve(posArgs[0])
    : path.join(REPO_ROOT, '_site', 'data', 'xbox-catalog.json');

  try {
    const snap = await syncXboxCatalog(target);
    const total = Object.keys(snap.metadata || {}).length;
    console.log(
      `Synced ${total} real Xbox Cloud Gaming titles (free=${snap.lists.free.length}, new=${snap.lists.new.length}, popular=${snap.lists.popular.length}, leaving=${snap.lists.leaving.length}) -> ${target}`
    );
  } catch (err) {
    console.warn(`[sync-xbox-catalog] Failed to fetch live Microsoft/Xbox catalog: ${err.message}`);
    if (strict) process.exit(1);
  }
}
