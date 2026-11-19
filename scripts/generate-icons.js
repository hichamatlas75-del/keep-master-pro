import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsDir = path.resolve(__dirname, '..', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Write the SVG icon first
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFB300" />
      <stop offset="100%" stop-color="#F57C00" />
    </linearGradient>
    <linearGradient id="noteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#FFF9C4" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Background rounded squircle -->
  <rect x="32" y="32" width="448" height="448" rx="108" fill="url(#bgGrad)" filter="url(#shadow)" />

  <!-- Notepad Sheet -->
  <rect x="120" y="110" width="272" height="310" rx="28" fill="url(#noteGrad)" />

  <!-- Folded corner / top badge -->
  <path d="M 120 160 L 392 160" stroke="#FFE082" stroke-width="4" stroke-linecap="round" />

  <!-- Keep Master Lightbulb / Crown Emblem -->
  <!-- Bulb contour -->
  <path d="M 256 180 C 220 180 190 208 190 244 C 190 268 204 288 224 300 L 224 330 C 224 336 228 340 234 340 L 278 340 C 284 340 288 336 288 330 L 288 300 C 308 288 322 268 322 244 C 322 208 292 180 256 180 Z" fill="#F57C00" />

  <!-- Bulb glow inner -->
  <circle cx="256" cy="244" r="32" fill="#FFEB3B" opacity="0.9" />

  <!-- Filament / Spark -->
  <path d="M 246 234 L 256 220 L 266 234 L 256 248 Z" fill="#E65100" />

  <!-- Bulb base screw lines -->
  <rect x="232" y="348" width="48" height="8" rx="4" fill="#FFA000" />
  <rect x="238" y="360" width="36" height="6" rx="3" fill="#FF8F00" />

  <!-- Checklist lines on bottom -->
  <rect x="160" y="386" width="36" height="8" rx="4" fill="#FFA000" />
  <rect x="210" y="386" width="140" height="8" rx="4" fill="#FFE082" />
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'favicon.svg'), svgContent, 'utf-8');

// Function to generate a basic valid uncompressed PNG file using node:zlib
function createSolidPng(width, height, r, g, b, a = 255) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Scanlines: width * 4 bytes + 1 filter byte per line
  const rawScanlines = Buffer.alloc(height * (width * 4 + 1));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawScanlines.writeUInt8(0, offset++); // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      // Draw a pleasant warm amber gradient with rounded border
      const cx = x - width / 2;
      const cy = y - height / 2;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const maxR = width * 0.46;

      let pr = r;
      let pg = g;
      let pb = b;
      let pa = a;

      if (dist > maxR) {
        pa = 0; // Transparent outside
      } else {
        // Gradient shading
        const ratio = y / height;
        pr = Math.min(255, Math.floor(r - ratio * 20));
        pg = Math.min(255, Math.floor(g - ratio * 40));
        pb = Math.min(255, Math.floor(b));

        // Light center highlight
        if (Math.abs(cx) < width * 0.25 && Math.abs(cy) < height * 0.3) {
          pr = 255;
          pg = 250;
          pb = 220;
        }
      }

      rawScanlines.writeUInt8(pr, offset++);
      rawScanlines.writeUInt8(pg, offset++);
      rawScanlines.writeUInt8(pb, offset++);
      rawScanlines.writeUInt8(pa, offset++);
    }
  }

  const compressedData = zlib.deflateSync(rawScanlines);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(8 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

// Standard CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate 192x192 & 512x512 icons
const icon192 = createSolidPng(192, 192, 255, 179, 0);
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), icon192);

const icon512 = createSolidPng(512, 512, 255, 179, 0);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), icon512);

// Maskable icons (no transparent corners, solid amber background)
const maskable192 = createSolidPng(192, 192, 255, 179, 0);
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-192.png'), maskable192);

const maskable512 = createSolidPng(512, 512, 255, 179, 0);
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), maskable512);

console.log('[KEEP MASTER PRO] Icônes PWA générées avec succès dans icons/');
