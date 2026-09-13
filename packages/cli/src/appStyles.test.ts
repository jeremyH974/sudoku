import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
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

/*
 * ─── La discipline des jetons ───────────────────────────────────────────────
 *
 * L'incrément 10 a compté dix rayons, vingt-deux tailles de texte et cinq
 * graisses — dont deux, 620 et 650, qui rendent au pixel près comme 600 et 700.
 * Aucune n'avait été choisie : elles s'étaient accumulées, fichier par fichier,
 * faute d'une échelle à laquelle se tenir. `app.css` porte désormais cette
 * échelle, et les règles ci-dessous empêchent d'en sortir.
 *
 * Elles ne lisent que les blocs `<style>` (voir `styleOf`), et n'épargnent que
 * le papier. Pendant la migration, une liste exemptait aussi les fichiers pas
 * encore repris ; chaque commit en retirait un, et elle a disparu avec le
 * dernier — un cliquet qui ne retient plus rien est du bruit.
 */

/**
 * Le papier : il vit en millimètres, n'a pas de thème, et son noir est un vrai
 * noir — un `var(--text)` y imprimerait du gris clair sous thème sombre. C'est
 * l'exception à la discipline des jetons, écrite dans le test plutôt que dans un
 * commentaire, parce qu'un commentaire se contourne et qu'une liste, non.
 */
const PAPER = [
  'print/PrintSheet.svelte',
  'print/PrintableGrid.svelte',
  'print/QrCode.svelte',
  'print/print.css',
  // Incrément 18 : le dossier d'enquête. `CaseDossier.svelte` n'y est **pas** —
  // c'est l'aperçu à l'écran qui entoure les feuilles, donc une vue ordinaire,
  // tenue aux jetons comme les autres.
  'print/CaseSheet.svelte',
  'print/PrintableScene.svelte',
];

/** Les graisses qu'une police système statique sait rendre ; les autres s'arrondissent. */
const WEIGHTS = new Set(['400', '500', '600', '700', 'normal', 'bold', 'inherit']);

/** Au-delà, le mouvement cesse de confirmer une action et commence à décorer. */
const LONGEST_MOTION_MS = 200;

interface Sheet {
  /** Chemin relatif à `packages/app/src`, à barres obliques quel que soit le système. */
  readonly path: string;
  /** Le CSS seul, sans commentaires. */
  readonly css: string;
}

/**
 * Le CSS d'un fichier : ses blocs `<style>` s'il est un composant.
 *
 * Les règles de jetons ne lisent que cela, et c'est délibéré. `App.svelte`
 * calcule trois tailles de police dans un attribut `style` — celles des trois
 * « A » du réglage de taille, où **la taille du glyphe est le libellé** : elles
 * doivent survivre. Le motif ancré en début de ligne écarte aussi le
 * `{@html '<style>…'}` de `PrintStudio.svelte`, qui n'est pas un bloc de style
 * du composant.
 *
 * La règle des unités de fenêtre, plus haut, lit toujours le fichier entier : un
 * `vw` dans un attribut `style` est tout aussi fautif.
 */
function styleOf(file: string, source: string): string {
  if (extname(file) === '.css') return source;
  return [...source.matchAll(/^<style[^>]*>([\s\S]*?)^<\/style>/gm)]
    .map((match) => match[1])
    .join('\n');
}

const sheets: Sheet[] = styleFiles(APP_SRC).map((file) => ({
  path: relative(APP_SRC, file).split(sep).join('/'),
  css: withoutComments(styleOf(file, readFileSync(file, 'utf8'))),
}));
const appCss = sheets.find((sheet) => sheet.path === 'app.css')?.css ?? '';

/** Tenu aux jetons : tout, sauf le fichier qui les déclare et le papier. */
const onTokens = (sheet: Sheet): boolean => sheet.path !== 'app.css' && !PAPER.includes(sheet.path);

/** Les valeurs d'une propriété, telles qu'écrites. */
function values(css: string, declaration: RegExp): string[] {
  return [...css.matchAll(declaration)].map((match) => match[1].trim());
}

const RADIUS = /(?<![\w-])border-radius\s*:\s*([^;{}]+)/g;
const FONT_SIZE = /(?<![\w-])font-size\s*:\s*([^;{}]+)/g;
const FONT_WEIGHT = /(?<![\w-])font-weight\s*:\s*([^;{}]+)/g;
const FONT_FAMILY = /(?<![\w-])font-family\s*:\s*([^;{}]+)/g;
const DURATION = /(?<![\w-])(?:transition|animation|--dur-[a-z]+)(?:-duration)?\s*:\s*([^;{}]+)/g;

interface Rule {
  readonly selector: string;
  /** Les préludes des at-rules qui l'englobent : `@media (hover: hover)`, … */
  readonly within: readonly string[];
}

/** Chaque sélecteur d'une feuille, avec les at-rules qui l'englobent. */
function rulesOf(css: string): Rule[] {
  const rules: Rule[] = [];
  const stack: string[] = [];
  let prelude = '';
  for (const char of css) {
    if (char === '{') {
      const head = prelude.trim();
      if (!head.startsWith('@')) {
        for (const selector of head.split(',')) {
          rules.push({ selector: selector.trim(), within: [...stack] });
        }
      }
      stack.push(head);
      prelude = '';
    } else if (char === '}') {
      stack.pop();
      prelude = '';
    } else if (char === ';') {
      prelude = '';
    } else {
      prelude += char;
    }
  }
  return rules;
}

interface Block {
  readonly selector: string;
  /** Les déclarations écrites **directement** dans ce bloc, sans les imbriqués. */
  readonly declarations: string;
}

/**
 * Chaque bloc d'une feuille, avec ses seules déclarations propres.
 *
 * `rulesOf` rend les sélecteurs ; il faut ici l'inverse — ce qui est écrit
 * **dans** un bloc —, pour vérifier que deux déclarations voisinent. Les blocs
 * imbriqués sont exclus : une graisse posée dans un `:hover` interne ne répond
 * pas de la police déclarée au-dessus.
 */
function blocksOf(css: string): Block[] {
  const done: Block[] = [];
  const open: { selector: string; declarations: string }[] = [];
  let prelude = '';

  for (const char of css) {
    if (char === '{') {
      open.push({ selector: prelude.trim(), declarations: '' });
      prelude = '';
    } else if (char === '}') {
      const block = open.pop();
      if (block !== undefined && !block.selector.startsWith('@')) {
        for (const selector of block.selector.split(',')) {
          done.push({ selector: selector.trim(), declarations: block.declarations });
        }
      }
      prelude = '';
    } else {
      prelude += char;
      // Le texte va au bloc courant, et **seulement** à lui : un `:hover`
      // imbriqué remplit le sien, jamais celui de son parent.
      const current = open[open.length - 1];
      if (current !== undefined) current.declarations += char;
    }
  }
  return done;
}

/** Le sélecteur sans ses états : `.action:hover:not(:disabled)` devient `.action`. */
const baseOf = (selector: string): string =>
  selector.replace(/:(?:hover|active|focus-visible|focus|disabled)|:not\([^)]*\)/g, '').trim();

describe('discipline des jetons', () => {
  it('reconnaît bien ce qu’elle inspecte', () => {
    // Sans ces bornes, une expression devenue fausse rendrait les règles
    // ci-dessous vertes et muettes. Elles portent sur tous les fichiers, papier
    // compris : c'est la mécanique qu'on éprouve, pas la discipline.
    expect(sheets.flatMap(({ css }) => values(css, RADIUS)).length).toBeGreaterThan(30);
    expect(sheets.flatMap(({ css }) => values(css, FONT_SIZE)).length).toBeGreaterThan(40);
    expect(
      sheets.some(({ css }) => rulesOf(css).some((rule) => rule.selector.includes(':hover'))),
    ).toBe(true);
    expect(appCss).toContain('--radius-md');
  });

  it('ne donne de rayon que par un jeton', () => {
    // Une valeur en `em` reste permise : elle suit la taille du texte qui
    // l'entoure, comme le tracé des marques de candidats à l'intérieur d'une case.
    const offenders = sheets.filter(onTokens).flatMap(({ path, css }) =>
      values(css, RADIUS)
        .filter(
          (value) =>
            !value.split(/\s+/).every((part) => /^(?:var\(--radius-[a-z]+\)|0|[\d.]+em)$/.test(part)),
        )
        .map((value) => `${path} : border-radius: ${value}`),
    );
    expect(offenders).toEqual([]);
  });

  it('ne donne de taille de texte en rem que par un jeton', () => {
    // Une seule exception, nommée : les chiffres de la grille, qui combinent
    // `cqi` et `--text-scale` sous un plafond en rem. C'est le levier qui fait
    // vivre « gros caractères » sur un téléphone.
    const offenders = sheets.filter(onTokens).flatMap(({ path, css }) =>
      values(css, FONT_SIZE)
        .filter((value) => /\d(?:\.\d+)?rem/.test(value) && !value.includes('cqi'))
        .map((value) => `${path} : font-size: ${value}`),
    );
    expect(offenders).toEqual([]);
  });

  it('ne connaît que des graisses qui existent partout', () => {
    // Mesuré au pixel à l'incrément 10 : faute d'une police variable, 620 rend
    // exactement comme 600 et 650 exactement comme 700. Les chiffres donnés du
    // plateau (650) avaient ainsi la graisse des candidats marqués (700), sans
    // que personne l'ait voulu.
    const offenders = sheets.flatMap(({ path, css }) =>
      values(css, FONT_WEIGHT)
        .filter((value) => !WEIGHTS.has(value))
        .map((value) => `${path} : font-weight: ${value}`),
    );
    expect(offenders).toEqual([]);
  });

  it('cite ses polices au lieu de recopier leurs piles', () => {
    /*
      Ce garde vient d'un défaut vivant, pas d'un principe.

      `--font-paper` et `--font-mono` étaient déclarés dans `app.css` comme « la
      voix du papier » et référencés nulle part : `PrintSheet.svelte` réécrivait
      les mêmes valeurs en dur. Le jeton était mort — le modifier ne changeait
      rien à ce qui sortait de l'imprimante — et rien ne le signalait.

      Le papier n'est **pas** exempté ici, contrairement aux couleurs et aux
      rayons : une pile de polices n'a pas de variante sombre, donc rien ne
      justifie qu'elle vive à part. Seul `app.css` écrit des noms de police, et
      c'est là que la règle `@font-face` les déclare.
    */
    const offenders = sheets
      .filter((sheet) => sheet.path !== 'app.css')
      .flatMap(({ path, css }) =>
        values(css, FONT_FAMILY)
          .filter((value) => !value.startsWith('var(--font-') && value !== 'inherit')
          .map((value) => `${path} : font-family: ${value}`),
      );
    expect(offenders).toEqual([]);
  });

  it('ne demande jamais à la manuscrite une graisse qu’elle n’a pas', () => {
    /*
      Patrick Hand ne livre **qu'un seul fichier, en 400**. Demander 700 ne rend
      pas une variante grasse : le navigateur en **fabrique** une, et le procédé
      a un nom — gras synthétique.

      Ce n'est pas une subtilité de typographe. Mesuré sur le titre « Enquête »,
      qui portait le défaut en production : le 700 dépose **41,5 % d'encre en
      plus** que le 400 pour la même fonte. Et — c'est le piège — **à chasse
      rigoureusement identique**, parce que Chromium cerne le contour au lieu
      d'élargir la lettre. Une vérification par la largeur du texte n'y voit
      donc rien du tout ; il a fallu compter les pixels sombres d'un rendu.

      Le défaut arrive tout seul : un `h1` vaut 700 par défaut. Toute règle qui
      cite `--font-hand` doit donc **écrire** sa graisse, et cette écriture est
      la seule trace visible du problème dans le code.

      `font-synthesis-weight: none` aurait été l'autre voie. Écrire 400 lui est
      préféré : la propriété corrige le symptôme là où la déclaration dit
      l'intention, et une graisse explicite se relit sans connaître la règle.
    */
    const offenders = sheets.flatMap(({ path, css }) =>
      blocksOf(css)
        .filter(({ declarations }) => /font-family\s*:\s*var\(--font-hand\)/.test(declarations))
        .filter(({ declarations }) => !/font-weight\s*:\s*400/.test(declarations))
        .map(({ selector }) => `${path} : ${selector} cite --font-hand sans écrire font-weight: 400`),
    );
    expect(offenders).toEqual([]);
  });

  it('n’écrit de couleur que dans le fichier des jetons', () => {
    // Une couleur écrite ailleurs n'a ni variante sombre ni audit de contraste.
    const offenders = sheets
      .filter(onTokens)
      .flatMap(({ path, css }) =>
        [...css.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g)].map(
          (match) => `${path} : ${match[0]}`,
        ),
      );
    expect(offenders).toEqual([]);
  });

  it('ne fait rien durer plus de 200 ms', () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const { path, css } of sheets) {
      for (const value of values(css, DURATION)) {
        for (const [literal, amount, unit] of value.matchAll(/(\d*\.?\d+)(ms|s)\b/g)) {
          seen++;
          const ms = unit === 's' ? Number(amount) * 1000 : Number(amount);
          if (ms > LONGEST_MOTION_MS) offenders.push(`${path} : ${literal}`);
        }
      }
    }
    // Les jetons de durée et le garde-fou du mouvement réduit, au moins.
    expect(seen).toBeGreaterThan(2);
    expect(offenders).toEqual([]);
  });

  it('ne survole qu’avec un pointeur qui survole', () => {
    // Au doigt, un navigateur mobile émule le survol au toucher — et le laisse
    // collé jusqu'au toucher suivant : la touche du pavé reste éclairée après
    // qu'on a posé le chiffre. Un survol n'a de sens que sous `(hover: hover)`.
    const offenders = sheets.flatMap(({ path, css }) =>
      rulesOf(css)
        .filter((rule) => rule.selector.includes(':hover'))
        .filter((rule) => !rule.within.some((at) => /@media[^{]*\(hover:\s*hover\)/.test(at)))
        .map((rule) => `${path} : ${rule.selector}`),
    );
    expect(offenders).toEqual([]);
  });

  it('donne un état pressé à tout ce qui se survole', () => {
    // Au doigt, `:active` est le seul état qui existe : un contrôle qui réagit
    // au survol mais pas à l'appui est muet sur la cible visée en premier. On ne
    // peut pas savoir d'un texte CSS ce qui est interactif — mais ce qui a un
    // survol l'est, et c'est lui qu'on apparie.
    const offenders = sheets.flatMap(({ path, css }) => {
      const rules = rulesOf(css);
      const pressed = new Set(
        rules
          .filter((rule) => rule.selector.includes(':active'))
          .map((rule) => baseOf(rule.selector)),
      );
      return rules
        .filter((rule) => rule.selector.includes(':hover') && !pressed.has(baseOf(rule.selector)))
        .map((rule) => `${path} : ${rule.selector}`);
    });
    expect(offenders).toEqual([]);
  });

  it('garde le garde-fou du mouvement réduit', () => {
    // Le bloc qui neutralise toute durée quand le système le demande : c'est lui
    // qui rend sûr le peu de mouvement que l'application s'autorise.
    expect(appCss).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it('garde la cible tactile à 44 px', () => {
    // Ceci ne prouve pas que les cibles font 44 px à l'écran : un DOM simulé ne
    // calcule aucune mise en page, `src/test/axe.ts` le dit. Cela attrape le
    // seul mode de défaillance qu'une relecture laisserait passer — un jeton
    // « rangé » à une valeur plus petite.
    expect(appCss).toMatch(/--tap:\s*2\.75rem;/);
  });

  it('fait charger les règles d’impression par qui pose une feuille', () => {
    /*
      Défaut vécu, et invisible à l'écran.

      L'application est construite en **trois paquets indépendants** — accueil,
      sudoku, enquête — pour qu'un joueur de sudoku ne télécharge jamais le
      moteur d'Enquête. La contrepartie : une feuille de style globale importée
      d'un seul côté n'existe pas de l'autre. `print.css` ne l'était que par
      `PrintStudio.svelte`, donc uniquement dans le paquet du sudoku, et le
      dossier d'enquête sortait de l'imprimante avec l'en-tête, les boutons et le
      plateau autour — sans un seul saut de page.

      L'aperçu, lui, était parfaitement juste : rien ne pouvait le signaler avant
      d'appuyer sur Imprimer. D'où cette règle, structurelle et non esthétique :
      **le composant qui pose une `.sheets` importe les règles qui la
      détachent.** Elle est volontairement naïve — elle ne suit pas le graphe
      d'imports — parce qu'un contrôle qu'on comprend d'un coup d'œil vaut mieux
      qu'un contrôle exact que personne ne relit.
    */
    const owners = styleFiles(APP_SRC)
      .filter((file) => extname(file) === '.svelte')
      .map((file) => ({ path: relative(APP_SRC, file).split(sep).join('/'), source: readFileSync(file, 'utf8') }))
      .filter((file) => /class="sheets"/.test(file.source));

    expect(owners.length, 'aucune feuille posée : le contrôle ne prouverait rien').toBeGreaterThan(0);
    const orphans = owners
      .filter((file) => !/import ['"]\.\/print\.css['"]/.test(file.source))
      .map((file) => file.path);
    expect(orphans).toEqual([]);
  });

  it('n’exempte que des fichiers qui existent', () => {
    // Un renommage élargirait sinon l'exemption en silence : le fichier renommé
    // échapperait à toutes les règles sans que rien ne le dise.
    const missing = PAPER.filter((path) => !existsSync(join(APP_SRC, path)));
    expect(missing).toEqual([]);
  });
});
