import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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

/**
 * Les trois entrées du site.
 *
 * Écrites ici plutôt que découvertes en parcourant le disque : une entrée
 * ajoutée sans passer par ce test ne serait vérifiée par rien, et une entrée
 * supprimée doit casser ici plutôt que de disparaître en silence. La liste est
 * le contrat, comme celle du papier dans `appStyles.test.ts`.
 */
const ENTRIES = ['index.html', 'sudoku/index.html', 'enquete/index.html'];

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

  it('a les trois entrées du site', () => {
    for (const entry of ENTRIES) expect(existsSync(join(APP, entry)), entry).toBe(true);
  });

  it('ne cite dans aucune entrée un fichier qui n’existe pas', () => {
    for (const entry of ENTRIES) {
      const html = withoutComments(readFileSync(join(APP, entry), 'utf8'));
      const paths = [...html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)].map((match) => match[1]);
      // Le script d'entrée, l'icône et l'icône Apple : sans eux, la recherche ne
      // regarde pas au bon endroit.
      expect(paths.length, entry).toBeGreaterThanOrEqual(3);

      const missing = paths.filter(
        (path) => !existsSync(join(APP, 'public', path)) && !existsSync(join(APP, path)),
      );
      expect(missing, entry).toEqual([]);
    }
  });

  it('déclare ses entrées à la construction', () => {
    // Vite ne construit que ce qu'on lui nomme : une entrée absente d'ici
    // existerait en développement et manquerait en ligne, sans avertissement.
    for (const entry of ENTRIES) expect(viteConfig, entry).toContain(`entry('${entry}')`);
  });

  it('applique le thème avant le premier rendu, dans les trois entrées', () => {
    /*
      Le bloc qui lit `localStorage` avant la première peinture est recopié à
      l'identique dans chaque entrée, et doit l'être : un fichier séparé serait
      une requête de plus avant le premier pixel, et le flash qu'il évite est
      exactement ce qu'on paierait.

      Trois copies, c'est trois occasions de diverger — d'où ce test, qui compare
      le **code** et laisse les commentaires différer.
    */
    const scripts = ENTRIES.map((entry) => {
      const html = readFileSync(join(APP, entry), 'utf8');
      const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
      return withoutComments(script).replace(/\s+/g, ' ').trim();
    });
    expect(scripts[0]).toContain('data-theme');
    expect(scripts[0]).toContain('data-text-size');
    for (const script of scripts) expect(script).toBe(scripts[0]);
  });

  it('sert l’image de partage depuis l’adresse publique', () => {
    // C'est la seule adresse absolue du produit, et elle ne peut pas être
    // relative : les robots des réseaux sociaux ne la résolvent pas tous. D'où
    // le même garde-fou que pour la base — sans quoi elle dériverait en
    // silence, l'aperçu tombant sur un 404 que rien dans l'application ne
    // montre.
    const readme = readFileSync(README, 'utf8');
    const address = /https:\/\/[\w-]+\.github\.io\/[^\s)`>*]*/.exec(readme)?.[0];
    expect(address, 'le README doit donner l’adresse publique').toBeDefined();

    for (const entry of ENTRIES) {
      const html = withoutComments(readFileSync(join(APP, entry), 'utf8'));
      const image = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
      expect(image, `${entry} doit déclarer une og:image`).toBeDefined();
      expect(image!.startsWith(address!), `${image!} hors de ${address!}`).toBe(true);

      const file = image!.slice(address!.length);
      expect(existsSync(join(APP, 'public', file)), file).toBe(true);
    }
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

  it('ne va chercher aucune police chez un tiers', () => {
    /*
      La règle que la manuscrite a fait bouger, et sa nouvelle forme.

      `plan.md` disait « aucune webfont », et sa raison était le poids. Une
      manuscrite en vaut la peine — aucune pile système n'en contient — mais
      **jamais** au prix d'une requête vers un tiers : ce serait renoncer à
      « aucune requête réseau après le chargement », et faire connaître chaque
      visiteur à quelqu'un d'autre.

      La fonte est donc servie par nous. Ce test interdit le retour en arrière
      le plus tentant : une ligne d'import Google Fonts collée « juste pour
      essayer ».
    */
    const THIRD_PARTY = /fonts\.(?:googleapis|gstatic|bunny|cdnfonts)\.com|use\.typekit|typekit\.net/;
    const suspects = [
      ...ENTRIES.map((entry) => ({ file: entry, code: readFileSync(join(APP, entry), 'utf8') })),
      ...sources,
      { file: 'src/app.css', code: readFileSync(join(APP_SRC, 'app.css'), 'utf8') },
    ];
    const offenders = suspects.filter(({ code }) => THIRD_PARTY.test(code)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it('sert la manuscrite depuis ses propres fichiers, licence comprise', () => {
    // L'OFL impose de distribuer sa licence avec la fonte. Ce n'est pas une
    // politesse : c'est la condition qui rend l'usage légal, et le projet tient
    // déjà ce genre de compte pour ses dépendances.
    const css = readFileSync(join(APP_SRC, 'app.css'), 'utf8');
    const src = /@font-face[\s\S]*?url\('([^']+)'\)/.exec(css)?.[1];
    expect(src, 'app.css doit déclarer une @font-face').toBeDefined();
    expect(existsSync(join(APP, 'public', src!)), src!).toBe(true);

    const licence = join(APP, 'public', 'fonts', 'OFL.txt');
    expect(existsSync(licence), 'la licence OFL doit accompagner la fonte').toBe(true);
    expect(readFileSync(licence, 'utf8')).toContain('SIL Open Font License');
  });

  it('ne sert aucun fichier qu’une première visite ne peut porter', () => {
    /*
      Ce que `public/` contient, le service worker le précache — et une visite
      le paie d'un coup.

      Le défaut que ce test ferme a été livré : les seize **masters** des
      portraits, 1024 px et 230 ko chacun, vivaient sous `public/portraits/`.
      Le glob de précache prend `avif` depuis la bibliothèque des visages, donc
      il les a pris aussi : `dist` pesait 4,5 Mo dont 3,7 de fichiers que
      personne n'affiche jamais. Rien ne le signalait, et c'est le propre de ce
      défaut — un cache hors ligne qui grossit ne casse rien, il ralentit
      seulement la première visite de tout le monde.

      Le plafond porte sur **chaque fichier**, pas sur le total, parce que c'est
      la forme que prend la faute : on dépose un fichier source dans le dossier
      servi. Le plus gros fichier légitime est le corpus du défi du jour, pesé à
      66,7 ko ; 96 ko lui laissent de quoi grandir de moitié et arrêtent un
      master par un facteur de deux.
    */
    const PLAFOND = 96_000;
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else files.push(full);
      }
    };
    walk(join(APP, 'public'));
    expect(files.length, 'public/ doit contenir des fichiers').toBeGreaterThan(10);

    const heavy = files
      .filter((file) => statSync(file).size > PLAFOND)
      // L'image d'aperçu des liens partagés est la seule exclue du précache, et
      // `globIgnores` le dit déjà dans `vite.config.ts`. Elle pèse 47,7 ko, donc
      // passe de toute façon sous le plafond : la note est là pour le jour où
      // elle grossira.
      .filter((file) => !file.endsWith('og-image.png'))
      .map((file) => `${relative(APP, file)} : ${String(Math.round(statSync(file).size / 1000))} ko`);
    expect(heavy).toEqual([]);
  });

  it('garde les négatifs des portraits hors du dossier servi', () => {
    // Le pendant du test précédent, nommé plutôt que mesuré : les masters sont
    // des **entrées** de la fabrique, pas des fichiers du site. Un `git mv` en
    // sens inverse remettrait 3,7 Mo dans le cache de chaque visiteur, et le
    // plafond par fichier le dirait — mais ce test-ci dit *pourquoi*.
    expect(existsSync(join(APP, 'public', 'portraits', 'masters'))).toBe(false);

    const masters = resolve(import.meta.dirname, '../../../assets/portraits/masters');
    expect(existsSync(masters), 'les masters doivent rester dans le dépôt').toBe(true);
    expect(readdirSync(masters).filter((name) => name.endsWith('.avif'))).toHaveLength(16);
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
