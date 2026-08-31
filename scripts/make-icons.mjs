// Draws the app icons from scratch — a "W" on the site's ink colour — and writes
// them as PNGs. No image tooling needed beyond node's zlib.
// Run: node scripts/make-icons.mjs   (only when the mark changes; icons are committed)
import { deflateSync } from "node:zlib";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const INK = [0x16, 0x18, 0x1d]; // --fg / dark --bg from assets/decks.css
const PAPER = [0xfb, 0xfb, 0xfa]; // light --bg

// The mark: a W as one stroked polyline, in a unit box centred on the origin.
const W = [
  [-0.50, -0.42],
  [-0.26, 0.42],
  [0.00, -0.12],
  [0.26, 0.42],
  [0.50, -0.42],
];
const STROKE = 0.155; // of the mark's width, round caps and joins

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Distance from p to segment ab.
function distSegment(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const t = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy), 0, 1);
  return Math.hypot(wx - t * vx, wy - t * vy);
}

// Signed distance to a rounded rect centred at the origin, half-size h, radius r.
function distRoundedRect(px, py, h, r) {
  const qx = Math.abs(px) - h + r;
  const qy = Math.abs(py) - h + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// Signed distance turns into pixel coverage: a one-pixel-wide ramp across the edge.
const coverage = (d) => clamp(0.5 - d, 0, 1);

// size: pixels. radius: corner rounding as a fraction of size (0 = full bleed
// square, for maskable and iOS icons). mark: the W's width as a fraction of size.
function draw({ size, radius, mark }) {
  const px = Buffer.alloc(size * size * 4);
  const half = size / 2;
  const strokeHalf = (STROKE * mark * size) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Pixel centre, in pixels from the icon's centre.
      const cx = x + 0.5 - half;
      const cy = y + 0.5 - half;

      const bg = radius
        ? coverage(distRoundedRect(cx, cy, half, radius * size))
        : 1;

      let d = Infinity;
      for (let i = 0; i < W.length - 1; i++) {
        const a = [W[i][0] * mark * size, W[i][1] * mark * size];
        const b = [W[i + 1][0] * mark * size, W[i + 1][1] * mark * size];
        d = Math.min(d, distSegment(cx, cy, a, b));
      }
      const fg = coverage(d - strokeHalf) * bg;

      const o = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) px[o + c] = Math.round(INK[c] + (PAPER[c] - INK[c]) * fg);
      px[o + 3] = Math.round(bg * 255);
    }
  }
  return px;
}

const CRC = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = ~0;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  // Every scanline gets filter byte 0 — the images are tiny and flat.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// A maskable icon is cropped to a circle 80% of its width on some launchers, so
// its mark stays well inside that; the others can breathe.
const ICONS = [
  { file: "icon-192.png", size: 192, radius: 0.22, mark: 0.62 },
  { file: "icon-512.png", size: 512, radius: 0.22, mark: 0.62 },
  { file: "icon-maskable-512.png", size: 512, radius: 0, mark: 0.46 },
  { file: "apple-touch-icon-180.png", size: 180, radius: 0, mark: 0.58 },
];

const dir = path.join(process.cwd(), "assets/icons");
await mkdir(dir, { recursive: true });
for (const icon of ICONS) {
  await writeFile(path.join(dir, icon.file), png(icon.size, draw(icon)));
  console.log(`wrote assets/icons/${icon.file}`);
}

// The same mark as SVG, for the browser tab.
const pts = W.map(([x, y]) => `${(x * 0.62 * 512 + 256).toFixed(1)} ${(y * 0.62 * 512 + 256).toFixed(1)}`);
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
await writeFile(
  path.join(dir, "icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Wortschatz">
  <rect width="512" height="512" rx="${(0.22 * 512).toFixed(0)}" fill="${hex(INK)}"/>
  <polyline points="${pts.join(" ")}" fill="none" stroke="${hex(PAPER)}"
    stroke-width="${(STROKE * 0.62 * 512).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`
);
console.log("wrote assets/icons/icon.svg");
