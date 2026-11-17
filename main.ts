// main.ts — the entrypoint for "Solmar Bay: Vice Run" (gta6-01).
// Runs on Node 22 with the standard library only. It copies this repository's
// game/ and screenshots/ into the output directory (or $MAKEFUN_OUTPUT_DIR
// outside the grader) and writes /output/dossier.json with the make.fun
// library's buildDossier, so the gate and the judge can read the entry.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight: refuse a broken handoff instead of writing an entry the gate
// would reject — the game must exist and the screenshots must be 3 or 4
// real renders, each within the gate's 256 KiB cap.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing — nothing to hand in');
}
const shots = readdirSync(join(here, 'screenshots')).filter((f) => !f.startsWith('.'));
if (shots.length < 3 || shots.length > 4) {
  throw new Error('screenshots/ must hold 3 or 4 images, found ' + shots.length);
}
for (const shot of shots) {
  const size = statSync(join(here, 'screenshots', shot)).size;
  if (size > 262144) throw new Error('screenshot ' + shot + ' is ' + size + ' bytes, over the 256 KiB cap');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps mirror the gate: at most 4 screenshots of 256 KiB each, game/ at
// most 993 files and 48 MiB in all, and no path under game/ over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log('Solmar Bay: Vice Run — wrote ' + out + '/dossier.json');
