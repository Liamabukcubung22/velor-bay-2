// Velor Bay — dossier driver. Copies game/ and screenshots/ next to this
// file into the output directory, then writes /output/dossier.json with the
// kit's buildDossier and the bounty scorer's caps.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The output directory defaults to /output. Run it twice and the dossier
// bytes must come out identical.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });

for (const name of ['game', 'screenshots']) {
  const src = join(here, name);
  if (!existsSync(src)) throw new Error(`missing ${name}/ next to main.ts`);
  cpSync(src, join(outDir, name), { recursive: true });
}

const dossier = buildDossier(outDir, caps);
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`wrote ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
