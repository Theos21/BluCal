const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

const appIconSvg = fs.readFileSync(path.join(assetsDir, 'icon.svg'));

const splashSvg = `<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#F4F4F6"/>
  <g transform="translate(40, 40) scale(2)">
    <circle cx="30" cy="30" r="16" stroke="#185FA5" stroke-width="3" stroke-linecap="round" stroke-dasharray="83 17" stroke-dashoffset="12"/>
    <circle cx="30" cy="30" r="10" stroke="#185FA5" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="55 11" stroke-dashoffset="8" opacity=".6"/>
    <circle cx="30" cy="30" r="2" fill="#185FA5"/>
  </g>
</svg>`;

const notificationSvg = `<svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(18, 18) scale(1)">
    <circle cx="30" cy="30" r="16" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-dasharray="83 17" stroke-dashoffset="12"/>
    <circle cx="30" cy="30" r="10" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="55 11" stroke-dashoffset="8" opacity=".6"/>
    <circle cx="30" cy="30" r="2" fill="#FFFFFF"/>
  </g>
</svg>`;

async function run() {
  const iconInfo = await sharp(appIconSvg)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));
  console.log('icon.png:', iconInfo);

  const splashInfo = await sharp(Buffer.from(splashSvg))
    .resize(200, 200)
    .png()
    .toFile(path.join(assetsDir, 'splash-icon.png'));
  console.log('splash-icon.png:', splashInfo);

  const notifInfo = await sharp(Buffer.from(notificationSvg))
    .resize(96, 96)
    .png()
    .toFile(path.join(assetsDir, 'notification-icon.png'));
  console.log('notification-icon.png:', notifInfo);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
