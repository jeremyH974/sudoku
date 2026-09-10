import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Le module de mesure du chemin ne doit jamais devenir une dépendance de la
 * boucle chaude.
 *
 * ─── Ce que ce test protège, et pourquoi un commentaire ne suffirait pas ────
 *
 * `rate()` coûte 1,35 ms et la marche locale du générateur l'appelle jusqu'à
 * quatre cents fois par grille produite. Mesurer la tension coûte 1,4 ms de
 * plus — négligeable à la demande, catastrophique multiplié par quatre cents :
 * la génération d'un palier Expert passerait de deux secondes et demie à cinq.
 *
 * La règle est donc structurelle plutôt que consignée : **rien sous `logic/` ni
 * sous `generate/` ne peut importer `rating/`**. La dépendance ne va que dans
 * l'autre sens. Un commentaire se contourne de bonne foi ; un test, non.
 *
 * Il vit ici parce qu'il lit des fichiers : `packages/engine` compile avec
 * `types: []` — c'est son garde-fou principal — et `packages/cli` a déjà `node`
 * dans ses types.
 */

const ENGINE_SRC = resolve(import.meta.dirname, '../../engine/src');
const FORBIDDEN = /from\s+'[^']*\/rating\//;

function sources(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...sources(full));
    else if (extname(entry.name) === '.ts') found.push(full);
  }
  return found;
}

describe('frontières du moteur', () => {
  it('ne laisse pas la mesure du chemin entrer dans la boucle chaude', () => {
    const hot = [...sources(join(ENGINE_SRC, 'logic')), ...sources(join(ENGINE_SRC, 'generate'))];
    // Sans cette borne, un chemin devenu faux rendrait le test vert et muet.
    expect(hot.length).toBeGreaterThan(15);

    const offenders = hot.filter((file) => FORBIDDEN.test(readFileSync(file, 'utf8')));
    expect(offenders.map((file) => relative(ENGINE_SRC, file))).toEqual([]);
  });

  it('laisse la mesure dépendre du solveur, elle', () => {
    // La dépendance dans l'autre sens est normale : sans elle, `rating/`
    // devrait redéfinir le registre et l'état, et les deux divergeraient.
    const measured = sources(join(ENGINE_SRC, 'rating'))
      .filter((file) => !file.endsWith('.test.ts'))
      .map((file) => readFileSync(file, 'utf8'));
    expect(measured.some((source) => source.includes("from '../logic/"))).toBe(true);
  });
});
