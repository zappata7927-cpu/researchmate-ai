// Generates brand icons for PWA and Android from an inline SVG.
// Brand: navy → teal gradient, white book + sparkle glyph.
// ResearchMate AI — designer: Seyed Mojtaba Kazemi
import sharp from "sharp";
import { mkdirSync } from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd());

function glyph(size) {
  // returns inner SVG markup scaled for `size` (512-based design space)
  return `
  <g transform="translate(${size * 0.5}, ${size * 0.53}) scale(${size / 512}) translate(-256, -256)">
    <!-- open book -->
    <path fill="#ffffff" d="M256 176c-30-22-68-34-112-34-14 0-26 1-38 4v196c12-3 24-4 38-4 44 0 82 12 112 34 30-22 68-34 112-34 14 0 26 1 38 4V146c-12-3-24-4-38-4-44 0-82 12-112 34z" opacity="0.96"/>
    <path fill="#0e2a47" d="M256 208c-24-15-52-24-86-26v132c34 2 62 11 86 26 24-15 52-24 86-26V182c-34 2-62 11-86 26z" opacity="0.14"/>
    <path fill="none" stroke="#0e2a47" stroke-width="10" stroke-linecap="round" d="M256 176v200" opacity="0.35"/>
    <!-- sparkle -->
    <path fill="#ffffff" d="M256 108l14 44 44 14-44 14-14 44-14-44-44-14 44-14z"/>
  </g>`;
}

function appIcon(size, { rounded = true } = {}) {
  const r = rounded ? size * 0.2 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0e2a47"/>
      <stop offset="1" stop-color="#0f766e"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>
  ${glyph(size)}
</svg>`;
}

const out = (...p) => path.join(ROOT, ...p);
mkdirSync(out("public/icons"), { recursive: true });
mkdirSync(out("android/app/src/main/res/mipmap-mdpi"), { recursive: true });

const jobs = [];
// PWA icons
jobs.push(["public/icons/icon-192.png", appIcon(192)]);
jobs.push(["public/icons/icon-512.png", appIcon(512)]);
jobs.push(["public/icons/maskable-512.png", appIcon(512, { rounded: false })]);
jobs.push(["public/icons/apple-touch-icon.png", appIcon(180)]);
// Android launcher icons (square legacy + round)
const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, s] of Object.entries(dens)) {
  jobs.push([`android/app/src/main/res/mipmap-${d}/ic_launcher.png`, appIcon(s)]);
  jobs.push([`android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`, appIcon(s, { rounded: false })]);
}

for (const [file, svg] of jobs) {
  mkdirSync(path.dirname(out(file)), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(out(file));
  console.log("wrote", file);
}
console.log("done");
