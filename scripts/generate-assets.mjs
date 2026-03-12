import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const assetsDir = join(root, 'assets');

const iconSvg = readFileSync(join(assetsDir, 'icon.svg'));
const splashSvg = readFileSync(join(assetsDir, 'splash.svg'));

const tasks = [
  {
    name: 'icon.png (1024x1024)',
    input: iconSvg,
    output: join(assetsDir, 'icon.png'),
    width: 1024,
    height: 1024,
  },
  {
    name: 'adaptive-icon.png (1024x1024)',
    input: iconSvg,
    output: join(assetsDir, 'adaptive-icon.png'),
    width: 1024,
    height: 1024,
  },
  {
    name: 'android-icon-foreground.png (1024x1024)',
    input: iconSvg,
    output: join(assetsDir, 'android-icon-foreground.png'),
    width: 1024,
    height: 1024,
  },
  {
    name: 'android-icon-background.png (1024x1024)',
    // Solid navy background for adaptive icon background layer
    svgString: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#0A0F1E"/></svg>`,
    output: join(assetsDir, 'android-icon-background.png'),
    width: 1024,
    height: 1024,
  },
  {
    name: 'android-icon-monochrome.png (1024x1024)',
    // White shield on transparent for monochrome adaptive icon
    svgString: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      <path d="M512 220 L700 300 L700 490 C700 600 620 690 512 740 C404 690 324 600 324 490 L324 300 Z" fill="white"/>
      <text x="512" y="560" font-family="Georgia,serif" font-size="280" font-weight="900" text-anchor="middle" dominant-baseline="middle" fill="#0A0F1E" letter-spacing="-8">B</text>
    </svg>`,
    output: join(assetsDir, 'android-icon-monochrome.png'),
    width: 1024,
    height: 1024,
  },
  {
    name: 'favicon.png (48x48)',
    input: iconSvg,
    output: join(assetsDir, 'favicon.png'),
    width: 48,
    height: 48,
  },
  {
    name: 'splash-icon.png (288x288) — icon only for expo splash',
    input: iconSvg,
    output: join(assetsDir, 'splash-icon.png'),
    width: 288,
    height: 288,
  },
  {
    name: 'splash.png (1284x2778)',
    input: splashSvg,
    output: join(assetsDir, 'splash.png'),
    width: 1284,
    height: 2778,
  },
];

for (const task of tasks) {
  const svgBuffer = task.svgString
    ? Buffer.from(task.svgString)
    : task.input;

  await sharp(svgBuffer)
    .resize(task.width, task.height)
    .png()
    .toFile(task.output);

  console.log(`✅ ${task.name}`);
}

console.log('\n🎉 All assets generated successfully!');
