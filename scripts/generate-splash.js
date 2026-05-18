// Regenerates assets/splash-icon.png — the BluCal launch image.
// Renders the logo (concentric dashed rings) above the "BluCal" wordmark,
// centered on the dark app background. Mirrors components/LogoMark.tsx and
// components/BluCalWordmark.tsx so the splash matches the in-app branding.
//
// Run: node scripts/generate-splash.js
const path = require('path');
const sharp = require('sharp');

// iPhone-portrait canvas; app.json renders this with resizeMode "cover".
const W = 1284;
const H = 2778;

// Dark app background + wordmark colors (lib/theme.ts `dark` palette).
const BG = '#18191D';
const BLU = '#4F95DC';
const CAL = '#F2F3F5';

const LOGO_SIZE = 360; // px; LogoMark viewBox is 0 0 80 80
const LOGO_SCALE = LOGO_SIZE / 80;
const GAP = 96; // vertical space between logo and wordmark
const FONT_SIZE = 168;

const blockHeight = LOGO_SIZE + GAP + FONT_SIZE;
const logoX = (W - LOGO_SIZE) / 2;
const logoY = Math.round((H - blockHeight) / 2);
const textBaseline = logoY + LOGO_SIZE + GAP + Math.round(FONT_SIZE * 0.74);

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <g transform="translate(${logoX} ${logoY}) scale(${LOGO_SCALE})">
    <circle cx="40" cy="40" r="32" fill="none" stroke="${BLU}" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="167 34" stroke-dashoffset="25"/>
    <circle cx="40" cy="40" r="21" fill="none" stroke="${BLU}" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="110 22" stroke-dashoffset="17" stroke-opacity="0.65"/>
    <circle cx="40" cy="40" r="10" fill="none" stroke="${BLU}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="52 10" stroke-dashoffset="8" stroke-opacity="0.35"/>
    <circle cx="40" cy="40" r="3.5" fill="${BLU}"/>
  </g>
  <text x="${W / 2}" y="${textBaseline}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${FONT_SIZE}" font-weight="800" letter-spacing="-2">
    <tspan fill="${BLU}">Blu</tspan><tspan fill="${CAL}">Cal</tspan>
  </text>
</svg>`;

const outPath = path.join(__dirname, '..', 'assets', 'splash-icon.png');

sharp(Buffer.from(svg))
  .png()
  .toFile(outPath)
  .then((info) => {
    console.log(`Wrote ${outPath} (${info.width}x${info.height})`);
  })
  .catch((err) => {
    console.error('Splash generation failed:', err);
    process.exit(1);
  });
