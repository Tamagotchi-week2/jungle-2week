// public/sprites 전체를 스캔해 프리로드 매니페스트를 생성한다.
// dev/build 전에 자동 실행된다 (package.json predev/prebuild).
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SPRITES_DIR = join(process.cwd(), 'public', 'sprites');
const OUT_DIR = join(process.cwd(), 'src', 'generated');
const OUT_FILE = join(OUT_DIR, 'spriteManifest.ts');

function walk(dir) {
  const paths = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      paths.push(...walk(full));
    } else if (/\.(png|jpg|jpeg|webp|gif)$/i.test(entry)) {
      const rel = relative(join(process.cwd(), 'public'), full).split('\\').join('/');
      paths.push(`/${rel}`);
    }
  }
  return paths;
}

const assets = walk(SPRITES_DIR).sort();

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  OUT_FILE,
  `// 자동 생성 — scripts/generate-sprite-manifest.mjs 로 재생성된다. 직접 수정하지 말 것.\n` +
    `export const SPRITE_ASSETS: string[] = ${JSON.stringify(assets, null, 2)};\n`,
);

console.log(`sprite manifest: ${assets.length}개 이미지 (${OUT_FILE})`);
