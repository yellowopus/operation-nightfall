import { cpSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
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

/**
 * Copies one declared asset directory into the dossier output. Throws a
 * descriptive error when the declared source directory is missing.
 */
function copyAsset(source: string, target: string): void {
  const sourcePath = resolve(sourceDir, source);
  try {
    statSync(sourcePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Cannot copy "${source}": the source directory is missing: ${sourcePath}`, { cause: error });
    }
    throw error;
  }

  cpSync(sourcePath, resolve(outputDir, target), { recursive: true });
}

mkdirSync(outputDir, { recursive: true });

for (const [source, target] of assets) {
  copyAsset(source, target);
}

writeFileSync(resolve(outputDir, 'dossier.json'), buildDossier(outputDir, dossierCaps));
