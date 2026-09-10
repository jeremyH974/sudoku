import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Aucune unité de fenêtre dans les styles de l'application.
 *
 * ─── Pourquoi ce test vit ici et non dans `packages/app` ────────────────────
 *
 * Il lit des fichiers, donc il lui faut `node:fs`. Or `packages/app` déclare
 * `types: ["vite/client", …]` à dessein : y ajouter `"node"` rendrait les
 * globals de Node visibles depuis le code de l'application, et le garde-fou
 * qu'on installe ici en détruirait un autre. `packages/cli` a déjà `node` dans
 * ses types et lit déjà le corpus depuis le disque.
 *
 * ─── Pourquoi cette règle ───────────────────────────────────────────────────
 *
 * `vw` mesure contre la fenêtre. Tout ce qui est mesuré contre la fenêtre cesse
 * d'obéir au réglage de taille du texte, qui repose entièrement sur `rem` — et
 * c'est exactement ce qui rendait ce réglage inopérant sur téléphone avant
 * l'incrément 8. Les mêmes `vw` avaient aussi produit un débordement horizontal
 * de deux pixels sous 400 px, parce qu'une largeur comparée à la fenêtre ignore
 * le remplissage du conteneur.
 *
 * La bonne mesure est `cqi` (une fraction du conteneur) ou `rem`. Si une unité
 * de fenêtre redevient nécessaire un jour, ce test doit être modifié
 * **délibérément**, avec la raison écrite — pas contourné.
 */

const APP_SRC = resolve(import.meta.dirname, '../../app/src');
const STYLE_EXTENSIONS = new Set(['.svelte', '.css']);

/** Interdit `10vw`, `2.5vh`, `100dvh`… sans confondre avec un mot qui finit par « vw ». */
const VIEWPORT_UNIT = /(?<![\w-])\d*\.?\d+(vw|vh|vmin|vmax|dvh|dvw|svh|svw|lvh|lvw)(?![\w-])/g;

function styleFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...styleFiles(full));
    else if (STYLE_EXTENSIONS.has(extname(entry.name))) found.push(full);
  }
  return found;
}

/** Les commentaires expliquent souvent la règle : ils ne doivent pas la violer. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
}

describe('styles de l’application', () => {
  it('ne mesure jamais contre la fenêtre', () => {
    const offenders: string[] = [];

    for (const file of styleFiles(APP_SRC)) {
      const matches = withoutComments(readFileSync(file, 'utf8')).match(VIEWPORT_UNIT);
      if (matches !== null) {
        offenders.push(`${relative(APP_SRC, file)} : ${[...new Set(matches)].join(', ')}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('trouve bien des fichiers à inspecter', () => {
    // Sans cela, un chemin devenu faux rendrait le test ci-dessus vert et muet.
    expect(styleFiles(APP_SRC).length).toBeGreaterThan(8);
  });
});
