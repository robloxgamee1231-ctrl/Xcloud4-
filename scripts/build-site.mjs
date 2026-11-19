/* SPDX-License-Identifier: GPL-3.0-only */
/* Assembles a self-contained static GitHub Pages bundle from public/ + docs/licenses/. */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

export async function buildStaticSite(outDir = path.join(REPO_ROOT, '_site')) {
  const publicDir = path.join(REPO_ROOT, 'public');
  const licensesDir = path.join(REPO_ROOT, 'docs', 'licenses');

  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  await fs.cp(publicDir, outDir, { recursive: true });

  await fs.mkdir(path.join(outDir, 'docs'), { recursive: true });
  await fs.cp(licensesDir, path.join(outDir, 'docs', 'licenses'), { recursive: true });

  for (const docFile of ['LICENSE', 'NOTICE.md']) {
    try {
      await fs.copyFile(path.join(REPO_ROOT, docFile), path.join(outDir, docFile));
    } catch {
      // Optional root doc
    }
  }

  // GitHub Pages SPA 404 fallback + disable Jekyll underscore stripping
  await fs.copyFile(path.join(outDir, 'index.html'), path.join(outDir, '404.html'));
  await fs.writeFile(path.join(outDir, '.nojekyll'), '');
  return outDir;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const target = process.argv[2] ? path.resolve(process.argv[2]) : path.join(REPO_ROOT, '_site');
  const out = await buildStaticSite(target);
  console.log(`Static GitHub Pages site built at ${out}`);
}
