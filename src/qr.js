/* SPDX-License-Identifier: GPL-3.0-only */
/* Minimal, self-contained ISO/IEC 18004 QR Code (Versions 1-6, Byte Mode, ECC-M) SVG generator. */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    EXP[i + 255] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGeneratorPoly(ecCount) {
  let poly = [1];
  for (let i = 0; i < ecCount; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const res = new Uint8Array(data.length + ecCount);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

// Version specs for ECC level M: [version, size, dataCodewords, ecPerBlock, blocksG1, dataG1, blocksG2, dataG2, alignmentCenters]
const VERSIONS_M = [
  { ver: 1, size: 21, totalData: 16, ecPerBlock: 10, g1Blocks: 1, g1Data: 16, g2Blocks: 0, g2Data: 0, align: [] },
  { ver: 2, size: 25, totalData: 28, ecPerBlock: 16, g1Blocks: 1, g1Data: 28, g2Blocks: 0, g2Data: 0, align: [6, 18] },
  { ver: 3, size: 29, totalData: 44, ecPerBlock: 26, g1Blocks: 1, g1Data: 44, g2Blocks: 0, g2Data: 0, align: [6, 22] },
  { ver: 4, size: 33, totalData: 64, ecPerBlock: 18, g1Blocks: 2, g1Data: 32, g2Blocks: 0, g2Data: 0, align: [6, 26] },
  { ver: 5, size: 37, totalData: 86, ecPerBlock: 24, g1Blocks: 2, g1Data: 43, g2Blocks: 0, g2Data: 0, align: [6, 30] },
  { ver: 6, size: 41, totalData: 108, ecPerBlock: 16, g1Blocks: 4, g1Data: 27, g2Blocks: 0, g2Data: 0, align: [6, 34] },
  { ver: 7, size: 45, totalData: 124, ecPerBlock: 18, g1Blocks: 4, g1Data: 31, g2Blocks: 0, g2Data: 0, align: [6, 22, 38] },
  { ver: 8, size: 49, totalData: 154, ecPerBlock: 22, g1Blocks: 2, g1Data: 38, g2Blocks: 2, g2Data: 39, align: [6, 24, 42] },
];

function encodeByteData(bytes) {
  // Byte mode: 4-bit mode (0100) + 8-bit char count (versions 1..8) + payload
  const spec = VERSIONS_M.find((v) => bytes.length + 2 <= v.totalData);
  if (!spec) throw new Error('QR payload too long');

  const bits = [];
  const pushBits = (val, count) => {
    for (let i = count - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) pushBits(b, 8);

  const maxBits = spec.totalData * 8;
  const term = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < term; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    codewords.push(b);
  }
  const padBytes = [0xec, 0x11];
  let pi = 0;
  while (codewords.length < spec.totalData) {
    codewords.push(padBytes[pi % 2]);
    pi++;
  }

  // Split into RS blocks and interleave
  const blocks = [];
  const eccBlocks = [];
  let offset = 0;
  for (let i = 0; i < spec.g1Blocks; i++) {
    const slice = Uint8Array.from(codewords.slice(offset, offset + spec.g1Data));
    offset += spec.g1Data;
    blocks.push(slice);
    eccBlocks.push(rsEncode(slice, spec.ecPerBlock));
  }
  for (let i = 0; i < spec.g2Blocks; i++) {
    const slice = Uint8Array.from(codewords.slice(offset, offset + spec.g2Data));
    offset += spec.g2Data;
    blocks.push(slice);
    eccBlocks.push(rsEncode(slice, spec.ecPerBlock));
  }

  const finalBytes = [];
  const maxDataLen = Math.max(spec.g1Data, spec.g2Data || 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of blocks) {
      if (i < blk.length) finalBytes.push(blk[i]);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const eblk of eccBlocks) {
      finalBytes.push(eblk[i]);
    }
  }

  return { spec, finalBytes };
}

function buildMatrix(spec, finalBytes) {
  const n = spec.size;
  const grid = Array.from({ length: n }, () => new Int8Array(n).fill(-1));
  const isFunc = Array.from({ length: n }, () => new Uint8Array(n));

  const setFunc = (r, c, val) => {
    if (r >= 0 && r < n && c >= 0 && c < n) {
      grid[r][c] = val ? 1 : 0;
      isFunc[r][c] = 1;
    }
  };

  const drawFinder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || r >= n || c < 0 || c >= n) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const dark =
          inOuter &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        setFunc(r, c, dark ? 1 : 0);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, n - 7);
  drawFinder(n - 7, 0);

  // Timing patterns
  for (let i = 8; i < n - 8; i++) {
    setFunc(6, i, i % 2 === 0 ? 1 : 0);
    setFunc(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Alignment patterns
  const centers = spec.align;
  for (const r of centers) {
    for (const c of centers) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
          setFunc(r + dr, c + dc, dark ? 1 : 0);
        }
      }
    }
  }

  // Reserve format info + dark module
  setFunc(n - 8, 8, 1);
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      if (!isFunc[8][i]) setFunc(8, i, 0);
      if (!isFunc[i][8]) setFunc(i, 8, 0);
    }
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunc[8][n - 1 - i]) setFunc(8, n - 1 - i, 0);
    if (!isFunc[n - 1 - i][8]) setFunc(n - 1 - i, 8, 0);
  }

  // Reserve version info for ver >= 7
  if (spec.ver >= 7) {
    let rem = spec.ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vbits = (spec.ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = (vbits >>> i) & 1;
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunc(a, b, bit);
      setFunc(b, a, bit);
    }
  }

  // Place data bits in zig-zag
  const allBits = [];
  for (const byte of finalBytes) {
    for (let b = 7; b >= 0; b--) allBits.push((byte >> b) & 1);
  }
  let bitIdx = 0;
  let dir = -1;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      const r = dir === -1 ? n - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!isFunc[r][c]) {
          grid[r][c] = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
        }
      }
    }
    dir = -dir;
  }

  const maskFn = (mask, r, c) => {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
  };

  const applyFormat = (mat, mask) => {
    // ECC M = 00
    const data = (0b00 << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) mat[8][i] = (bits >>> i) & 1;
    mat[8][7] = (bits >>> 6) & 1;
    mat[8][8] = (bits >>> 7) & 1;
    mat[7][8] = (bits >>> 8) & 1;
    for (let i = 9; i < 15; i++) mat[14 - i][8] = (bits >>> i) & 1;
    for (let i = 0; i < 8; i++) mat[8][n - 1 - i] = (bits >>> i) & 1;
    for (let i = 8; i < 15; i++) mat[n - 15 + i][8] = (bits >>> i) & 1;
    mat[n - 8][8] = 1;
  };

  const penaltyScore = (mat) => {
    let score = 0;
    // Rule 1: adjacent modules
    for (let r = 0; r < n; r++) {
      let run = 1;
      for (let c = 1; c < n; c++) {
        if (mat[r][c] === mat[r][c - 1]) run++;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
    for (let c = 0; c < n; c++) {
      let run = 1;
      for (let r = 1; r < n; r++) {
        if (mat[r][c] === mat[r - 1][c]) run++;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
    // Rule 2: 2x2 blocks
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const v = mat[r][c];
        if (v === mat[r][c + 1] && v === mat[r + 1][c] && v === mat[r + 1][c + 1]) score += 3;
      }
    }
    // Rule 4: dark ratio
    let dark = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (mat[r][c]) dark++;
    const pct = (dark * 100) / (n * n);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  };

  let bestMat = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = grid.map((row, r) =>
      row.map((val, c) => (isFunc[r][c] ? val : val ^ (maskFn(mask, r, c) ? 1 : 0)))
    );
    applyFormat(candidate, mask);
    const sc = penaltyScore(candidate);
    if (sc < bestScore) {
      bestScore = sc;
      bestMat = candidate;
    }
  }
  return bestMat;
}

export function generateQrMatrix(text) {
  const bytes = new TextEncoder().encode(String(text));
  const { spec, finalBytes } = encodeByteData(bytes);
  return buildMatrix(spec, finalBytes);
}

export function generateQrSvg(text, options = {}) {
  const quiet = Number.isInteger(options.quiet) ? options.quiet : 3;
  const fg = options.fg || '#070E18';
  const bg = options.bg || '#FFFFFF';
  const matrix = generateQrMatrix(text);
  const size = matrix.length;
  const total = size + quiet * 2;
  let d = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        d += `M${c + quiet},${r + quiet}h1v1h-1z`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`;
}
