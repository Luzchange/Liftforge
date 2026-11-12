const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Colors
const LIME = '#CCFF00';
const DARK_BG = '#0D1113';

// Clean SVG of a figure lifting a barbell overhead (high contrast, bold, minimalist)
// ViewBox 0 0 512 512, centered around (256, 256)
function getFigureSvg(fgColor = LIME, bgColor = null) {
  const bgRect = bgColor ? `<rect width="512" height="512" fill="${bgColor}" rx="64"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    ${bgRect}
    <!-- Barbell Bar -->
    <rect x="56" y="96" width="400" height="18" rx="9" fill="${fgColor}"/>
    
    <!-- Outer Plates -->
    <rect x="42" y="52" width="24" height="106" rx="6" fill="${fgColor}"/>
    <rect x="72" y="66" width="20" height="78" rx="5" fill="${fgColor}"/>
    
    <rect x="446" y="52" width="24" height="106" rx="6" fill="${fgColor}"/>
    <rect x="420" y="66" width="20" height="78" rx="5" fill="${fgColor}"/>
    
    <!-- Inner Collars -->
    <rect x="96" y="91" width="10" height="28" rx="3" fill="${fgColor}"/>
    <rect x="406" y="91" width="10" height="28" rx="3" fill="${fgColor}"/>

    <!-- Head -->
    <circle cx="256" cy="180" r="32" fill="${fgColor}"/>

    <!-- Arms locked overhead in V-grip -->
    <path d="M 170 114 L 224 230 L 256 250 L 288 230 L 342 114" 
          fill="none" stroke="${fgColor}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Torso / Core -->
    <path d="M 230 250 L 282 250 L 274 340 L 238 340 Z" fill="${fgColor}"/>

    <!-- Belt accent cutout (if on dark bg) -->
    <rect x="236" y="318" width="40" height="8" rx="3" fill="${bgColor || '#0D1113'}"/>

    <!-- Powerful Legs in Athletic Stance -->
    <!-- Left Leg -->
    <path d="M 242 338 L 204 430 L 160 456" 
          fill="none" stroke="${fgColor}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Right Leg -->
    <path d="M 270 338 L 308 430 L 352 456" 
          fill="none" stroke="${fgColor}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Floor Platform / Ground Line -->
    <rect x="130" y="470" width="252" height="14" rx="7" fill="${fgColor}"/>
  </svg>`;
}

// Adaptive foreground (transparent background, padded inside 432x432 canvas)
function getAdaptiveFgSvg(fgColor = LIME) {
  // Safe zone is center 66%: scale 0.65 inside 432x432
  // Scaled 512x512 * 0.55 = 281.6 centered at (216, 216) -> translate (75, 75)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 432 432" width="432" height="432">
    <g transform="translate(75, 75) scale(0.55)">
      <!-- Barbell Bar -->
      <rect x="56" y="96" width="400" height="20" rx="10" fill="${fgColor}"/>
      <rect x="42" y="52" width="24" height="106" rx="6" fill="${fgColor}"/>
      <rect x="72" y="66" width="20" height="78" rx="5" fill="${fgColor}"/>
      <rect x="446" y="52" width="24" height="106" rx="6" fill="${fgColor}"/>
      <rect x="420" y="66" width="20" height="78" rx="5" fill="${fgColor}"/>
      <rect x="96" y="91" width="10" height="28" rx="3" fill="${fgColor}"/>
      <rect x="406" y="91" width="10" height="28" rx="3" fill="${fgColor}"/>
      <circle cx="256" cy="180" r="32" fill="${fgColor}"/>
      <path d="M 170 114 L 224 230 L 256 250 L 288 230 L 342 114" 
            fill="none" stroke="${fgColor}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 230 250 L 282 250 L 274 340 L 238 340 Z" fill="${fgColor}"/>
      <rect x="236" y="318" width="40" height="8" rx="3" fill="${DARK_BG}"/>
      <path d="M 242 338 L 204 430 L 160 456" 
            fill="none" stroke="${fgColor}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 270 338 L 308 430 L 352 456" 
            fill="none" stroke="${fgColor}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="130" y="470" width="252" height="14" rx="7" fill="${fgColor}"/>
    </g>
  </svg>`;
}

async function generateAll() {
  const fullIconSvg = Buffer.from(getFigureSvg(LIME, DARK_BG));
  const monoIconSvg = Buffer.from(getFigureSvg('#FFFFFF', DARK_BG));
  const adaptiveFgSvg = Buffer.from(getAdaptiveFgSvg(LIME));
  const adaptiveFgMonoSvg = Buffer.from(getAdaptiveFgSvg('#FFFFFF'));

  // 1. PWA & Web Icons
  console.log('Generating PWA & Web icons...');
  await sharp(fullIconSvg).resize(512, 512).png().toFile('public/icon-512.png');
  await sharp(fullIconSvg).resize(192, 192).png().toFile('public/icon-192.png');
  await sharp(fullIconSvg).resize(64, 64).png().toFile('public/favicon.ico');
  fs.writeFileSync('public/icon.svg', getFigureSvg(LIME, DARK_BG));

  // 2. Android Mipmap densities
  const densities = [
    { folder: 'mipmap-mdpi', launcher: 48, fg: 108 },
    { folder: 'mipmap-hdpi', launcher: 72, fg: 162 },
    { folder: 'mipmap-xhdpi', launcher: 96, fg: 216 },
    { folder: 'mipmap-xxhdpi', launcher: 144, fg: 324 },
    { folder: 'mipmap-xxxhdpi', launcher: 192, fg: 432 },
  ];

  for (const d of densities) {
    const dir = path.join('android/app/src/main/res', d.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // ic_launcher.png (legacy non-adaptive square with bg)
    await sharp(fullIconSvg).resize(d.launcher, d.launcher).png().toFile(path.join(dir, 'ic_launcher.png'));

    // ic_launcher_round.png (legacy round)
    const roundMask = Buffer.from(`<svg width="${d.launcher}" height="${d.launcher}"><circle cx="${d.launcher/2}" cy="${d.launcher/2}" r="${d.launcher/2}" fill="#fff"/></svg>`);
    const roundPng = await sharp(fullIconSvg)
      .resize(d.launcher, d.launcher)
      .composite([{ input: roundMask, blend: 'dest-in' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png
    await sharp(adaptiveFgSvg).resize(d.fg, d.fg).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
  }

  // 3. Android Splash Screens
  console.log('Generating splash screens...');
  const splashes = [
    { folder: 'drawable', w: 480, h: 320 },
    { folder: 'drawable-land-mdpi', w: 480, h: 320 },
    { folder: 'drawable-land-hdpi', w: 800, h: 480 },
    { folder: 'drawable-land-xhdpi', w: 1280, h: 720 },
    { folder: 'drawable-land-xxhdpi', w: 1600, h: 960 },
    { folder: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
    { folder: 'drawable-port-mdpi', w: 320, h: 480 },
    { folder: 'drawable-port-hdpi', w: 480, h: 800 },
    { folder: 'drawable-port-xhdpi', w: 720, h: 1280 },
    { folder: 'drawable-port-xxhdpi', w: 960, h: 1600 },
    { folder: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
  ];

  for (const s of splashes) {
    const dir = path.join('android/app/src/main/res', s.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Generate centered logo on dark background
    const logoSize = Math.min(s.w, s.h) * 0.4;
    const logoBuffer = await sharp(fullIconSvg).resize(Math.round(logoSize), Math.round(logoSize)).png().toBuffer();

    await sharp({
      create: {
        width: s.w,
        height: s.h,
        channels: 4,
        background: { r: 13, g: 17, b: 19, alpha: 1 } // #0D1113
      }
    })
    .composite([{
      input: logoBuffer,
      gravity: 'center'
    }])
    .png()
    .toFile(path.join(dir, 'splash.png'));
  }

  console.log('All branding assets successfully created!');
}

generateAll().catch(console.error);
