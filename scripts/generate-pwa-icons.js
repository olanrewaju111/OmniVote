/**
 * Generate PWA raster icons from SVG logo.
 * Uses sharp (already a project dependency) for SVG→PNG conversion.
 * Run: node scripts/generate-pwa-icons.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SVG_PATH = path.join(__dirname, '../public/logo.svg');
const OUT_DIR = path.join(__dirname, '../public/icons');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function main() {
  if (!fs.existsSync(SVG_PATH)) {
    console.error('logo.svg not found at', SVG_PATH);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const size of SIZES) {
    const outPath = path.join(OUT_DIR, `icon-${size}x${size}.png`);
    await sharp(SVG_PATH)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`Generated ${size}x${size} → icons/icon-${size}x${size}.png`);
  }

  // Also generate an Apple touch icon (180x180)
  const applePath = path.join(OUT_DIR, 'apple-touch-icon.png');
  await sharp(SVG_PATH)
    .resize(180, 180)
    .png()
    .toFile(applePath);
  console.log('Generated 180x180 → icons/apple-touch-icon.png');

  // Generate favicon.ico (32x32 PNG)
  const faviconPath = path.join(__dirname, '../public/favicon.ico');
  await sharp(SVG_PATH)
    .resize(32, 32)
    .png()
    .toFile(faviconPath);
  console.log('Generated 32x32 → public/favicon.ico');

  console.log('Done!');
}

main().catch(console.error);
