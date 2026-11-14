import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-threejs.ts';

const sourceDir = import.meta.dirname;
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const assets: readonly [source: string, target: string][] = [
  ['game', 'game'],
  ['screenshots', 'screenshots'],
];

const dossierCaps = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  game_max_files: 993,
  game_max_bytes: 50_331_648,
} as const;

mkdirSync(outputDir, { recursive: true });

for (const [source, target] of assets) {
  cpSync(resolve(sourceDir, source), resolve(outputDir, target), { recursive: true });
}

writeFileSync(resolve(outputDir, 'dossier.json'), buildDossier(outputDir, dossierCaps));
