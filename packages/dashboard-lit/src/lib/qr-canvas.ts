/**
 * Minimal QR code renderer.
 * Encodes a string into a QR code and draws it on a <canvas>.
 * If the data is a base64 data-URL, returns an <img> instead.
 *
 * Uses byte-mode encoding with error correction level L (7%).
 * Supports QR versions 1-40 (up to ~2953 bytes).
 */

// ── Galois Field GF(256) tables ──────────────────────────────────────────────

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x = x << 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    EXP[i] = EXP[i - 255];
  }
}

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

// ── Reed-Solomon generator polynomial ────────────────────────────────────────

function rsGenPoly(ecLen: number): Uint8Array {
  let g = new Uint8Array([1]);
  for (let i = 0; i < ecLen; i++) {
    const next = new Uint8Array(g.length + 1);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= gfMul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGenPoly(ecLen);
  const result = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const coeff = data[i] ^ result[0];
    result.copyWithin(0, 1);
    result[ecLen - 1] = 0;
    if (coeff !== 0) {
      for (let j = 0; j < ecLen; j++) {
        result[j] ^= gfMul(gen[j + 1], coeff);
      }
    }
  }
  return result;
}

// ── QR version/EC capacity tables (Level L only for compactness) ─────────────

// [totalCodewords, ecCodewordsPerBlock, numBlocks1, dataPerBlock1, numBlocks2, dataPerBlock2]
type VersionInfo = [number, number, number, number, number, number];

// EC level L parameters for versions 1-40
const VERSION_TABLE: VersionInfo[] = [
  /*  v1 */ [26, 7, 1, 19, 0, 0],
  /*  v2 */ [44, 10, 1, 34, 0, 0],
  /*  v3 */ [70, 15, 1, 55, 0, 0],
  /*  v4 */ [100, 20, 1, 80, 0, 0],
  /*  v5 */ [134, 26, 1, 108, 0, 0],
  /*  v6 */ [172, 18, 2, 68, 0, 0],
  /*  v7 */ [196, 20, 2, 78, 0, 0],
  /*  v8 */ [242, 24, 2, 97, 0, 0],
  /*  v9 */ [292, 30, 2, 116, 0, 0],
  /* v10 */ [346, 18, 2, 68, 2, 69],
  /* v11 */ [404, 20, 4, 81, 0, 0],
  /* v12 */ [466, 24, 2, 92, 2, 93],
  /* v13 */ [532, 26, 4, 107, 0, 0],
  /* v14 */ [581, 30, 3, 115, 1, 116],
  /* v15 */ [655, 22, 5, 87, 1, 88],
  /* v16 */ [733, 24, 5, 98, 1, 99],
  /* v17 */ [815, 28, 1, 107, 5, 108],
  /* v18 */ [901, 30, 5, 120, 1, 121],
  /* v19 */ [991, 28, 3, 113, 4, 114],
  /* v20 */ [1085, 28, 3, 107, 5, 108],
  /* v21 */ [1156, 28, 4, 116, 4, 117],
  /* v22 */ [1258, 28, 2, 111, 7, 112],
  /* v23 */ [1364, 30, 4, 121, 5, 122],
  /* v24 */ [1474, 30, 6, 117, 4, 118],
  /* v25 */ [1588, 26, 8, 106, 4, 107],
  /* v26 */ [1706, 28, 10, 114, 2, 115],
  /* v27 */ [1828, 30, 8, 122, 4, 123],
  /* v28 */ [1921, 30, 3, 117, 10, 118],
  /* v29 */ [2051, 30, 7, 116, 7, 117],
  /* v30 */ [2185, 30, 5, 115, 10, 116],
  /* v31 */ [2323, 30, 13, 115, 3, 116],
  /* v32 */ [2465, 30, 17, 115, 0, 0],
  /* v33 */ [2611, 30, 17, 115, 1, 116],
  /* v34 */ [2761, 30, 13, 115, 6, 116],
  /* v35 */ [2876, 30, 12, 121, 7, 122],
  /* v36 */ [3034, 30, 6, 121, 14, 122],
  /* v37 */ [3196, 30, 17, 122, 4, 123],
  /* v38 */ [3362, 30, 4, 122, 18, 123],
  /* v39 */ [3532, 30, 20, 117, 4, 118],
  /* v40 */ [3706, 30, 19, 118, 6, 119],
];

// Alignment pattern positions per version (2-40)
const ALIGNMENT_POSITIONS: number[][] = [
  [], // v1 has none
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
];

// ── Bit helpers ──────────────────────────────────────────────────────────────

class BitBuffer {
  private buffer: number[] = [];
  length = 0;

  put(num: number, bitLength: number): void {
    for (let i = bitLength - 1; i >= 0; i--) {
      this.buffer.push((num >>> i) & 1);
    }
    this.length += bitLength;
  }

  getBit(index: number): boolean {
    return this.buffer[index] === 1;
  }
}

// ── QR matrix operations ─────────────────────────────────────────────────────

function createMatrix(version: number): { modules: (boolean | null)[][]; size: number } {
  const size = version * 4 + 17;
  const modules: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array.from<boolean | null>({ length: size }).fill(null),
  );
  return { modules, size };
}

function placeFinderPattern(
  modules: (boolean | null)[][],
  size: number,
  row: number,
  col: number,
): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const mr = row + r;
      const mc = col + c;
      if (mr < 0 || mr >= size || mc < 0 || mc >= size) {
        continue;
      }
      const inOuter = r === -1 || r === 7 || c === -1 || c === 7;
      const inBorder = r === 0 || r === 6 || c === 0 || c === 6;
      const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      modules[mr][mc] = !inOuter && (inBorder || inInner);
    }
  }
}

function placeAlignmentPattern(modules: (boolean | null)[][], row: number, col: number): void {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      modules[row + r][col + c] = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
    }
  }
}

function reserveFormatBits(modules: (boolean | null)[][], size: number): void {
  // Horizontal
  for (let i = 0; i < 8; i++) {
    if (modules[8][i] === null) {
      modules[8][i] = false;
    }
    if (modules[8][size - 1 - i] === null) {
      modules[8][size - 1 - i] = false;
    }
  }
  // Vertical
  for (let i = 0; i < 8; i++) {
    if (modules[i][8] === null) {
      modules[i][8] = false;
    }
    if (modules[size - 1 - i][8] === null) {
      modules[size - 1 - i][8] = false;
    }
  }
  // Dark module
  modules[size - 8][8] = true;
  // The column 8, row 8 intersection
  if (modules[8][8] === null) {
    modules[8][8] = false;
  }
}

function reserveVersionBits(modules: (boolean | null)[][], size: number, version: number): void {
  if (version < 7) {
    return;
  }
  for (let i = 0; i < 18; i++) {
    const r = Math.floor(i / 3);
    const c = size - 11 + (i % 3);
    if (modules[r][c] === null) {
      modules[r][c] = false;
    }
    if (modules[c][r] === null) {
      modules[c][r] = false;
    }
  }
}

function placeTimingPatterns(modules: (boolean | null)[][], size: number): void {
  for (let i = 8; i < size - 8; i++) {
    if (modules[6][i] === null) {
      modules[6][i] = i % 2 === 0;
    }
    if (modules[i][6] === null) {
      modules[i][6] = i % 2 === 0;
    }
  }
}

// ── Data encoding (byte mode) ────────────────────────────────────────────────

function encodeData(text: string, version: number): Uint8Array {
  const info = VERSION_TABLE[version - 1];
  const totalBlocks = info[2] + info[4];
  const ecPerBlock = info[1];
  const totalData = info[2] * info[3] + info[4] * info[5];

  // Encode to byte mode
  const textBytes = new TextEncoder().encode(text);
  const bits = new BitBuffer();
  bits.put(0b0100, 4); // Byte mode indicator
  bits.put(textBytes.length, version >= 10 ? 16 : 8); // Character count
  for (const b of textBytes) {
    bits.put(b, 8);
  }
  // Terminator
  const termLen = Math.min(4, totalData * 8 - bits.length);
  bits.put(0, termLen);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.put(0, 1);
  }
  // Pad bytes
  const dataBytes = new Uint8Array(totalData);
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | (bits.getBit(i + b) ? 1 : 0);
    }
    dataBytes[i / 8] = byte;
  }
  for (let i = Math.ceil(bits.length / 8); i < totalData; i++) {
    dataBytes[i] = i % 2 === Math.ceil(bits.length / 8) % 2 ? 0xec : 0x11;
  }

  // Split into blocks and compute EC
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;

  for (let g = 0; g < 2; g++) {
    const count = g === 0 ? info[2] : info[4];
    const blockDataLen = g === 0 ? info[3] : info[5];
    for (let b = 0; b < count; b++) {
      const block = dataBytes.slice(offset, offset + blockDataLen);
      offset += blockDataLen;
      dataBlocks.push(block);
      ecBlocks.push(rsEncode(block, ecPerBlock));
    }
  }

  // Interleave data
  const result: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      if (i < dataBlocks[b].length) {
        result.push(dataBlocks[b][i]);
      }
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      result.push(ecBlocks[b][i]);
    }
  }

  return new Uint8Array(result);
}

// ── Data placement ───────────────────────────────────────────────────────────

function placeData(modules: (boolean | null)[][], size: number, data: Uint8Array): void {
  let bitIndex = 0;
  const totalBits = data.length * 8;
  let col = size - 1;

  while (col > 0) {
    if (col === 6) {
      col--;
    } // Skip timing pattern column
    for (let row = 0; row < size; row++) {
      for (let c = 0; c < 2; c++) {
        const curCol = col - c;
        const isUpward = ((size - 1 - col) >> 1) & 1;
        const curRow = isUpward ? size - 1 - row : row;
        if (modules[curRow][curCol] !== null) {
          continue;
        }
        if (bitIndex < totalBits) {
          modules[curRow][curCol] = ((data[bitIndex >> 3] >>> (7 - (bitIndex & 7))) & 1) === 1;
          bitIndex++;
        } else {
          modules[curRow][curCol] = false;
        }
      }
    }
    col -= 2;
  }
}

// ── Masking ──────────────────────────────────────────────────────────────────

type MaskFn = (row: number, col: number) => boolean;

const MASK_FUNCTIONS: MaskFn[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(
  modules: (boolean | null)[][],
  reserved: boolean[][],
  size: number,
  maskIndex: number,
): void {
  const fn = MASK_FUNCTIONS[maskIndex];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && fn(r, c)) {
        modules[r][c] = !modules[r][c];
      }
    }
  }
}

// ── Format & version info ────────────────────────────────────────────────────

// Format info for EC level L (01) with each mask pattern
const FORMAT_BITS = [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976];

function placeFormatInfo(modules: (boolean | null)[][], size: number, maskIndex: number): void {
  const bits = FORMAT_BITS[maskIndex];
  // Around top-left finder
  const positions1 = [
    [0, 8],
    [1, 8],
    [2, 8],
    [3, 8],
    [4, 8],
    [5, 8],
    [7, 8],
    [8, 8],
    [8, 7],
    [8, 5],
    [8, 4],
    [8, 3],
    [8, 2],
    [8, 1],
    [8, 0],
  ];
  for (let i = 0; i < 15; i++) {
    modules[positions1[i][0]][positions1[i][1]] = ((bits >>> (14 - i)) & 1) === 1;
  }
  // Around top-right and bottom-left finders
  const positions2: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    positions2.push([8, size - 1 - i]);
  }
  for (let i = 0; i < 7; i++) {
    positions2.push([size - 7 + i, 8]);
  }
  for (let i = 0; i < 15; i++) {
    modules[positions2[i][0]][positions2[i][1]] = ((bits >>> (14 - i)) & 1) === 1;
  }
}

// Version info bits for versions 7-40
const VERSION_INFO: number[] = [
  0x07c94, 0x085bc, 0x09a99, 0x0a4d3, 0x0bbf6, 0x0c762, 0x0d847, 0x0e60d, 0x0f928, 0x10b78, 0x1145d,
  0x12a17, 0x13532, 0x149a6, 0x15683, 0x168c9, 0x177ec, 0x18ec4, 0x191e1, 0x1afab, 0x1b08e, 0x1cc1a,
  0x1d33f, 0x1ed75, 0x1f250, 0x209d5, 0x216f0, 0x228ba, 0x2379f, 0x24b0b, 0x2542e, 0x26a64, 0x27541,
  0x28c69,
];

function placeVersionInfo(modules: (boolean | null)[][], size: number, version: number): void {
  if (version < 7) {
    return;
  }
  const bits = VERSION_INFO[version - 7];
  for (let i = 0; i < 18; i++) {
    const bit = ((bits >>> i) & 1) === 1;
    const r = Math.floor(i / 3);
    const c = size - 11 + (i % 3);
    modules[r][c] = bit;
    modules[c][r] = bit;
  }
}

// ── Penalty scoring ──────────────────────────────────────────────────────────

function computePenalty(modules: (boolean | null)[][], size: number): number {
  let penalty = 0;

  // Rule 1: runs of same color (horizontal & vertical)
  for (let r = 0; r < size; r++) {
    let runH = 1,
      runV = 1;
    for (let c = 1; c < size; c++) {
      if (modules[r][c] === modules[r][c - 1]) {
        runH++;
      } else {
        if (runH >= 5) {
          penalty += runH - 2;
        }
        runH = 1;
      }
      if (modules[c][r] === modules[c - 1][r]) {
        runV++;
      } else {
        if (runV >= 5) {
          penalty += runV - 2;
        }
        runV = 1;
      }
    }
    if (runH >= 5) {
      penalty += runH - 2;
    }
    if (runV >= 5) {
      penalty += runV - 2;
    }
  }

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // Rule 4: proportion of dark modules
  let dark = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) {
        dark++;
      }
    }
  }
  const pct = (dark * 100) / (size * size);
  penalty += Math.floor(Math.abs(pct - 50) / 5) * 10;

  return penalty;
}

// ── Main QR generation ───────────────────────────────────────────────────────

function generateQr(text: string): boolean[][] {
  const textBytes = new TextEncoder().encode(text);
  const dataLen = textBytes.length;

  // Find smallest version that fits
  let version = 0;
  for (let v = 1; v <= 40; v++) {
    const info = VERSION_TABLE[v - 1];
    const capacity = info[2] * info[3] + info[4] * info[5];
    const overhead = 4 + (v >= 10 ? 16 : 8); // mode + count bits
    const available = capacity * 8 - overhead;
    if (dataLen * 8 <= available) {
      version = v;
      break;
    }
  }
  if (version === 0) {
    throw new Error("Data too long for QR code");
  }

  const { modules, size } = createMatrix(version);

  // Place function patterns
  placeFinderPattern(modules, size, 0, 0);
  placeFinderPattern(modules, size, 0, size - 7);
  placeFinderPattern(modules, size, size - 7, 0);
  placeTimingPatterns(modules, size);

  // Alignment patterns
  const alignPos = ALIGNMENT_POSITIONS[version - 1];
  for (const r of alignPos) {
    for (const c of alignPos) {
      // Skip if overlapping finder patterns
      if (r <= 8 && c <= 8) {
        continue;
      }
      if (r <= 8 && c >= size - 8) {
        continue;
      }
      if (r >= size - 8 && c <= 8) {
        continue;
      }
      placeAlignmentPattern(modules, r, c);
    }
  }

  reserveFormatBits(modules, size);
  reserveVersionBits(modules, size, version);

  // Record reserved positions
  const reserved: boolean[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (__, c) => modules[r][c] !== null),
  );

  // Encode and place data
  const encoded = encodeData(text, version);
  placeData(modules, size, encoded);

  // Try all masks, pick best
  let bestMask = 0;
  let bestPenalty = Infinity;

  for (let m = 0; m < 8; m++) {
    // Clone matrix
    const clone = modules.map((row) => [...row]);
    applyMask(clone, reserved, size, m);
    placeFormatInfo(clone, size, m);
    placeVersionInfo(clone, size, version);
    const p = computePenalty(clone, size);
    if (p < bestPenalty) {
      bestPenalty = p;
      bestMask = m;
    }
  }

  applyMask(modules, reserved, size, bestMask);
  placeFormatInfo(modules, size, bestMask);
  placeVersionInfo(modules, size, version);

  return modules.map((row) => row.map((v) => v === true));
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Renders QR code data to a canvas or img element.
 * If `data` is a data-URL (starts with "data:"), returns an <img>.
 * Otherwise encodes the string as a QR code and draws it on a <canvas>.
 */
export function renderQrToCanvas(data: string, size = 280): HTMLCanvasElement | HTMLImageElement {
  // If data URL, return an img element
  if (data.startsWith("data:")) {
    const img = document.createElement("img");
    img.src = data;
    img.style.maxWidth = `${size}px`;
    img.style.maxHeight = `${size}px`;
    img.style.imageRendering = "pixelated";
    return img;
  }

  const matrix = generateQr(data);
  const moduleCount = matrix.length;
  const quiet = 4; // quiet zone modules
  const totalModules = moduleCount + quiet * 2;
  const scale = Math.max(1, Math.floor(size / totalModules));
  const canvasSize = totalModules * scale;

  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  canvas.style.imageRendering = "pixelated";

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = "#000000";

  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (matrix[r][c]) {
        ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
  }

  return canvas;
}
