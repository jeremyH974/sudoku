import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Le contraste des jetons de texte, calculé — et non constaté à l'œil.
 *
 * ─── Pourquoi ce test n'existait pas, et pourquoi il aurait dû ──────────────
 *
 * `CLAUDE.md` et le README répètent depuis l'incrément 6 que le contraste « se
 * mesure à la main », parce qu'un DOM simulé ne calcule aucune couleur
 * effective : axe y voit les rôles et les noms, jamais une couleur rendue. La
 * conclusion qu'on en tirait était fausse. Ce qui échappe à jsdom, c'est
 * **quelle** couleur se retrouve sur **quel** fond dans la page rendue. Le
 * contraste d'une paire de jetons, lui, est de l'arithmétique pure, et se
 * vérifie sans navigateur.
 *
 * Le prix de ne pas l'avoir fait, mesuré dans un vrai Chromium sur le site
 * **publié** à l'incrément 21 :
 *
 * - `--text-faint` valait `#8a8983` et ne tenait 4,5:1 sur **aucun** des quatre
 *   fonds de la palette claire — 3,27 / 3,51 / 3,10 / 3,19 —, ni sur deux des
 *   quatre en sombre. Dix-sept endroits citaient ce jeton ;
 * - `--accent`, employé comme couleur de texte par six vues, tombait à 3,50 sur
 *   une carte survolée en sombre.
 *
 * Les deux sont corrigés, et tenus ici.
 *
 * ─── Ce que ce test ne remplace pas ─────────────────────────────────────────
 *
 * Il vérifie que **la palette est saine**, pas que la page l'emploie bien. Un
 * texte posé sur un fond qui n'est pas dans la liste ci-dessous, un dégradé, une
 * transparence empilée : rien de tout cela n'est visible d'ici. La mesure dans
 * un vrai navigateur reste due — et elle a d'ailleurs relevé, à l'incrément 21,
 * que `target-size` passe partout sur les cinq onglets et les deux thèmes.
 */

const APP_CSS = resolve(import.meta.dirname, '../../app/src/app.css');
const source = readFileSync(APP_CSS, 'utf8');

/** Le seuil du projet : WCAG 2.2 AA pour du texte normal. */
const MINIMUM = 4.5;

/**
 * Les trois palettes du fichier, telles que `app.css` les déclare.
 *
 * Le thème a **trois** états et seulement deux palettes : « système » n'écrit
 * aucun attribut et hérite donc du bloc `@media`. C'est pourquoi la palette
 * sombre est déclarée deux fois — une fois pour la préférence du navigateur, une
 * fois pour le choix explicite — et pourquoi ce test exige qu'elles soient
 * identiques. Deux sources de vérité finissent toujours par se contredire.
 */
const PALETTES = [
  { nom: 'claire', debut: ':root {' },
  { nom: 'sombre (préférence du navigateur)', debut: ":root:not([data-theme='light']) {" },
  { nom: 'sombre (choix explicite)', debut: ":root[data-theme='dark'] {" },
] as const;

/** Les jetons lus dans le bloc qui commence à `debut`, commentaires ôtés. */
function paletteOf(debut: string): Map<string, string> {
  const start = source.indexOf(debut);
  if (start < 0) throw new Error(`Bloc introuvable dans app.css : ${debut}`);

  // Le bloc court jusqu'à son accolade fermante, en tenant compte des blocs
  // imbriqués — le sombre du `@media` en contient un.
  let depth = 0;
  let end = start;
  for (let i = start + debut.length - 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const body = source.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, ' ');
  const tokens = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,8})\s*;/gi)) {
    tokens.set(name, value.toLowerCase());
  }
  return tokens;
}

/** Luminance relative, WCAG 2.x §relative-luminance. */
function luminance(hex: string): number {
  const raw = hex.slice(1);
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw.slice(0, 6);
  const channels = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

/**
 * Les niveaux de texte, et les fonds sur lesquels ils peuvent atterrir.
 *
 * Deux entrées méritent leur justification, parce que les deux ont été oubliées
 * une fois chacune et ont livré un défaut :
 *
 * **`--surface-hover` est un fond.** Un texte survolé reste du texte, et c'est le
 * cas qu'on oublie. Une première correction de `--text-faint` calée sur les trois
 * autres fonds laissait encore 4,48 en clair et 3,93 en sombre — c'est ce test,
 * à sa toute première exécution, qui l'a dit.
 *
 * **`--accent` est un texte.** Son nom dit « accent », mais six vues l'emploient
 * comme couleur de texte, dont les deux accroches de l'accueil. En sombre il
 * tombait à 3,50 sur une carte survolée. Un jeton est soumis aux règles de
 * l'usage qu'on en fait, pas de son nom.
 *
 * `--note-accent` n'y est **pas**, et c'est délibéré : il ne sert que de bordure.
 * Une bordure relève de WCAG 1.4.11 (3:1 pour un composant), pas du texte, et lui
 * imposer 4,5:1 serait s'inventer une règle.
 */
const TEXTES = ['--text', '--text-muted', '--text-faint', '--accent'];
const FONDS = ['--bg', '--surface', '--surface-sunken', '--surface-hover'];

describe('le contraste de la palette', () => {
  it('lit bien les trois palettes du fichier', () => {
    for (const { nom, debut } of PALETTES) {
      const palette = paletteOf(debut);
      // Sans cette vérification, un bloc renommé rendrait le test vert en ne
      // mesurant plus rien — la façon canonique de perdre un garde-fou.
      expect(palette.size, nom).toBeGreaterThan(10);
      for (const token of [...TEXTES, ...FONDS]) {
        expect(palette.has(token), `${nom} : ${token} manquant`).toBe(true);
      }
    }
  });

  it('tient 4,5:1 pour chaque niveau de texte, sur chaque fond', () => {
    const fautes: string[] = [];
    for (const { nom, debut } of PALETTES) {
      const palette = paletteOf(debut);
      for (const texte of TEXTES) {
        for (const fond of FONDS) {
          const avant = palette.get(texte);
          const arriere = palette.get(fond);
          if (avant === undefined || arriere === undefined) continue;
          const ratio = contrast(avant, arriere);
          if (ratio < MINIMUM) {
            fautes.push(
              `${nom} : ${texte} (${avant}) sur ${fond} (${arriere}) = ${ratio.toFixed(2)}:1`,
            );
          }
        }
      }
    }
    expect(fautes, `Contraste sous ${String(MINIMUM)}:1 :\n  ${fautes.join('\n  ')}`).toEqual([]);
  });

  it('garde le texte d’accent lisible sur l’accent', () => {
    /*
      Le bouton principal de chaque écran est fait de ces deux jetons-là. Ils ne
      figurent pas dans la boucle ci-dessus parce que l'accent n'est pas un fond
      de page : c'est une paire, et elle se vérifie comme telle.
    */
    for (const { nom, debut } of PALETTES) {
      const palette = paletteOf(debut);
      const texte = palette.get('--accent-text');
      const fond = palette.get('--accent');
      if (texte === undefined || fond === undefined) continue;
      const ratio = contrast(texte, fond);
      expect(ratio, `${nom} : --accent-text sur --accent = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        MINIMUM,
      );
    }
  });

  it('déclare exactement la même palette sombre des deux côtés', () => {
    /*
      « Système » n'écrit aucun attribut et hérite du bloc `@media` ; « sombre »
      écrit l'attribut et prend l'autre. Les deux doivent dire la même chose,
      sans quoi choisir explicitement le sombre changerait discrètement les
      couleurs par rapport au sombre hérité.
    */
    const [, media, explicite] = PALETTES;
    const gauche = paletteOf(media.debut);
    const droite = paletteOf(explicite.debut);
    expect([...droite.keys()].sort()).toEqual([...gauche.keys()].sort());
    for (const [token, value] of gauche) {
      expect(droite.get(token), `${token} diffère entre les deux palettes sombres`).toBe(value);
    }
  });

  it('calcule le contraste comme WCAG le définit', () => {
    // Les deux bornes de l'échelle, et un repère publié : noir sur blanc vaut
    // 21:1, une couleur sur elle-même 1:1, et #767676 sur blanc exactement 4,54.
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#abcdef', '#abcdef')).toBeCloseTo(1, 5);
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });
});
