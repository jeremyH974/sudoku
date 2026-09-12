import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * L'application est servie sous un sous-chemin, et rien ne doit l'ignorer.
 *
 * ─── Ce que ce test protège ─────────────────────────────────────────────────
 *
 * L'application est publiée sur GitHub Pages sous `/sudoku/`, pas à la racine
 * d'un domaine. Vite réécrit tout seul ce qu'il construit — le script d'entrée,
 * les icônes d'`index.html`, `import.meta.env.BASE_URL`, le service worker —,
 * mais deux pannes lui échappent, et **aucune ne se voit** :
 *
 *   · un corpus chargé par un chemin écrit en dur. `loadDailyCorpus` rend `null`
 *     plutôt que de lever, à dessein : l'absence de corpus ne doit jamais
 *     empêcher de jouer. L'application marcherait donc, le calendrier serait
 *     vide et l'onglet Apprendre dirait ses grilles introuvables — sans une
 *     ligne dans la console ;
 *   · un chemin absolu d'`index.html` qui ne désigne aucun fichier. Vite ne
 *     réécrit une adresse que s'il trouve ce qu'elle désigne, et laisse sinon le
 *     chemin intact, sans avertissement : un 404 à la racine du domaine.
 *
 * Il vit ici, comme `appStyles.test.ts`, parce qu'il lit des fichiers.
 */

const APP = resolve(import.meta.dirname, '../../app');
const APP_SRC = join(APP, 'src');
const README = resolve(import.meta.dirname, '../../../README.md');

/** Ce que l'application charge ou référence à l'exécution — pas ses tests. */
function runtimeSources(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      // Les utilitaires de test ne partent pas en ligne : un bouchon qui simule
      // une adresse n'a pas à suivre la règle des adresses réelles.
      if (entry.name !== 'test') found.push(...runtimeSources(full));
    } else if (
      ['.ts', '.svelte'].includes(extname(entry.name)) &&
      !entry.name.endsWith('.test.ts')
    ) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Retire les commentaires, qui citent parfois un chemin pour expliquer la règle.
 * Le `//` d'une URL n'est pas un commentaire : il suit toujours un `:`.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/(?<!:)\/\/.*$/gm, ' ');
}

const sources = runtimeSources(APP_SRC).map((file) => ({
  file: relative(APP_SRC, file),
  code: withoutComments(readFileSync(file, 'utf8')),
}));
const viteConfig = withoutComments(readFileSync(join(APP, 'vite.config.ts'), 'utf8'));

describe('adresses de l’application sous son sous-chemin', () => {
  it('trouve bien des fichiers à inspecter', () => {
    // Sans cette borne, un chemin devenu faux rendrait les tests ci-dessous
    // verts et muets.
    expect(sources.length).toBeGreaterThan(15);
  });

  it('va chercher chaque ressource à travers BASE_URL', () => {
    const prefix = '$' + '{import.meta.env.BASE_URL}';
    const loaded: string[] = [];
    const offenders: string[] = [];

    for (const { file, code } of sources) {
      for (const [, quote, literal] of code.matchAll(/(['"`])([^'"`\n]*\.json)\1/g)) {
        if (quote === '`' && literal.startsWith(prefix)) loaded.push(literal.slice(prefix.length));
        else offenders.push(`${file} : ${quote}${literal}${quote}`);
      }
    }

    expect(offenders).toEqual([]);
    // Les deux corpus sont les seules ressources que l'application va chercher
    // elle-même. Les retrouver prouve que la recherche regarde au bon endroit.
    expect(loaded).toEqual(expect.arrayContaining(['daily/corpus.json', 'learn/corpus.json']));
  });

  it('n’écrit aucun chemin absolu en dur', () => {
    // Vite réécrit les adresses de `index.html` et des feuilles de style, jamais
    // une chaîne du code — ni une adresse d'un gabarit Svelte, compilé en
    // chaîne : `fetch('/daily/corpus.json')` partirait vers la racine du
    // domaine, où il n'y a rien.
    const ABSOLUTE = /(['"`])\/(?!\/)[^'"`\s)]*\.(?:json|png|svg|ico|webmanifest|css|js|woff2)\1/g;
    const offenders = sources.flatMap(({ file, code }) =>
      [...code.matchAll(ABSOLUTE)].map((match) => `${file} : ${match[0]}`),
    );
    expect(offenders).toEqual([]);
  });

  it('ne cite dans index.html que des fichiers qui existent', () => {
    const html = withoutComments(readFileSync(join(APP, 'index.html'), 'utf8'));
    const paths = [...html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)].map((match) => match[1]);
    // Le script d'entrée, l'icône et l'icône Apple : sans eux, la recherche ne
    // regarde pas au bon endroit.
    expect(paths.length).toBeGreaterThanOrEqual(3);

    const missing = paths.filter(
      (path) => !existsSync(join(APP, 'public', path)) && !existsSync(join(APP, path)),
    );
    expect(missing).toEqual([]);
  });

  it('sert l’image de partage depuis l’adresse publique', () => {
    // C'est la seule adresse absolue du produit, et elle ne peut pas être
    // relative : les robots des réseaux sociaux ne la résolvent pas tous. D'où
    // le même garde-fou que pour la base — sans quoi elle dériverait en
    // silence, l'aperçu tombant sur un 404 que rien dans l'application ne
    // montre.
    const html = withoutComments(readFileSync(join(APP, 'index.html'), 'utf8'));
    const image = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
    expect(image, 'index.html doit déclarer une og:image').toBeDefined();

    const readme = readFileSync(README, 'utf8');
    const address = /https:\/\/[\w-]+\.github\.io\/[^\s)`>*]*/.exec(readme)?.[0];
    expect(address, 'le README doit donner l’adresse publique').toBeDefined();
    expect(image!.startsWith(address!), `${image!} hors de ${address!}`).toBe(true);

    const file = image!.slice(address!.length);
    expect(existsSync(join(APP, 'public', file)), file).toBe(true);
  });

  it('garde relatives l’adresse de démarrage et la portée de l’application installée', () => {
    // Résolues contre l'adresse du manifeste, elles suivent le sous-chemin. Une
    // valeur absolue ouvrirait l'application installée à la racine du domaine :
    // une panne que seuls verraient ceux qui l'ont installée.
    const settings = {
      start_url: /\bstart_url:\s*'([^']*)'/.exec(viteConfig)?.[1],
      scope: /\bscope:\s*'([^']*)'/.exec(viteConfig)?.[1],
    };
    for (const [key, value] of Object.entries(settings)) {
      expect(value, key).toBeDefined();
      expect(value!.startsWith('/') || /^[a-z]+:/i.test(value!), `${key} : '${value!}'`).toBe(false);
    }
  });

  it('annonce dans le README l’adresse que la construction sert', () => {
    // Deux sources de vérité finissent toujours par se contredire : un dépôt
    // renommé laisserait la documentation juste et l'application morte.
    const base = /^\s*base:\s*'([^']+)',?$/m.exec(viteConfig)?.[1];
    expect(base, 'vite.config.ts doit déclarer une base').toBeDefined();

    const readme = readFileSync(README, 'utf8');
    const paths = [...readme.matchAll(/https:\/\/[\w-]+\.github\.io(\/[^\s)`>*]*)/g)].map(
      (match) => match[1],
    );
    expect(paths.length, 'le README doit donner l’adresse publique').toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.startsWith(base!) || `${path}/` === base, path).toBe(true);
    }
  });
});
