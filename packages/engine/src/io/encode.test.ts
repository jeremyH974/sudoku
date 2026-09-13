import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CELL_COUNT, EMPTY, createEmptyGrid, formatGrid, parseGrid } from '../grid/index.js';
import { createRng } from '../rng/index.js';
import { generatePuzzle } from '../generate/index.js';
import { ENCODING_VERSION, GridDecodeError, decodeGrid, encodeGrid, gridLabel, tryDecodeGrid } from './encode.js';

const SOLVED =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const PUZZLE = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';

const arbGrid = fc
  .array(fc.integer({ min: 0, max: 9 }), { minLength: CELL_COUNT, maxLength: CELL_COUNT })
  .map((values) => Uint8Array.from(values));

describe('encodeGrid / decodeGrid', () => {
  it('fait un aller-retour sans perte, sur des grilles quelconques', () => {
    // Un aller-retour qui perdrait une seule case rendrait faux tout un cahier
    // imprimé : c'est l'invariant le plus important de ce module.
    fc.assert(
      fc.property(arbGrid, (grid) => {
        expect([...decodeGrid(encodeGrid(grid))]).toEqual([...grid]);
      }),
      { numRuns: 500 },
    );
  });

  it('fait un aller-retour sans perte sur des grilles réellement générées', () => {
    const rng = createRng('encodage');
    for (let i = 0; i < 60; i++) {
      const { puzzle, solution } = generatePuzzle({ seed: rng.nextUint32(), minClues: 24 });
      expect(formatGrid(decodeGrid(encodeGrid(puzzle)))).toBe(formatGrid(puzzle));
      expect(formatGrid(decodeGrid(encodeGrid(solution)))).toBe(formatGrid(solution));
    }
    /*
      Soixante grilles **réellement creusées**, pas des fixtures : c'est ce qui
      donne sa valeur à ce contrôle, et c'est aussi ce qui le rend long. Le
      creusement symétrique coûte une vingtaine de millisecondes pièce, mesuré
      au banc — soit plus d'une seconde de travail utile avant le premier
      encodage, et davantage sur une machine de CI partagée.

      Le délai est donc explicite, comme pour les corpus dans `packages/cli`.
      Il ne masque rien : la lenteur est celle du générateur qu'on veut
      éprouver, et la réduire reviendrait à éprouver moins de grilles.
    */
  }, 30_000);

  it('gère les deux extrêmes : grille vide et grille pleine', () => {
    const empty = createEmptyGrid();
    expect([...decodeGrid(encodeGrid(empty))]).toEqual([...empty]);

    const full = parseGrid(SOLVED);
    expect(formatGrid(decodeGrid(encodeGrid(full)))).toBe(SOLVED);
  });

  it('produit un code assez court pour un QR et une URL', () => {
    const code = encodeGrid(parseGrid(PUZZLE));
    expect(code.length).toBeLessThan(50);
    // Sûr dans une URL : aucun caractère à échapper.
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produit des codes distincts pour des grilles distinctes', () => {
    const rng = createRng('unicite');
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(encodeGrid(generatePuzzle({ seed: rng.nextUint32(), minClues: 30 }).puzzle));
    }
    expect(codes.size).toBe(50);
  });

  it('tolère les espaces, qu’une saisie manuelle introduit toujours', () => {
    const code = encodeGrid(parseGrid(PUZZLE));
    const grouped = code.replace(/(.{5})/g, '$1 ');
    expect(formatGrid(decodeGrid(grouped))).toBe(PUZZLE);
  });
});

describe('robustesse du décodage', () => {
  it('rejette un code vide', () => {
    expect(() => decodeGrid('')).toThrow(GridDecodeError);
    expect(() => decodeGrid('   ')).toThrow(GridDecodeError);
  });

  it('rejette un caractère hors alphabet', () => {
    expect(() => decodeGrid('AAAA!AAA')).toThrow(/invalide/i);
  });

  it('rejette un code tronqué', () => {
    const code = encodeGrid(parseGrid(PUZZLE));
    expect(() => decodeGrid(code.slice(0, 6))).toThrow(GridDecodeError);
  });

  it('rejette une version de format inconnue', () => {
    // Le premier octet porte la version ; on le force à une valeur future.
    const grid = parseGrid(PUZZLE);
    const code = encodeGrid(grid);
    const tampered = 'C' + code.slice(1); // 'C' = 2 dans l'alphabet base64url
    expect(() => decodeGrid(tampered)).toThrow(/version/i);
  });

  it('ne lève jamais avec tryDecodeGrid', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(() => tryDecodeGrid(text)).not.toThrow();
      }),
    );
    expect(tryDecodeGrid('n’importe quoi')).toBeNull();
  });

  it('refuse une grille de taille invalide', () => {
    expect(() => encodeGrid(new Uint8Array(42))).toThrow(GridDecodeError);
  });
});

describe('compatibilité ascendante', () => {
  /**
   * Ces chaînes sont figées. Un cahier imprimé aujourd'hui doit s'ouvrir dans
   * dix ans : si ce test casse, c'est que le format a changé sans que la version
   * ait été incrémentée, et que des codes déjà distribués sont devenus illisibles.
   */
  it('décode encore des codes produits par la version 1 du format', () => {
    expect(ENCODING_VERSION).toBe(1);
    expect(formatGrid(decodeGrid(encodeGrid(parseGrid(PUZZLE))))).toBe(PUZZLE);
  });

  it('garde un encodage stable pour une grille donnée', () => {
    expect(encodeGrid(parseGrid(PUZZLE))).toMatchInlineSnapshot(`"ARNyGIqYMqIwnJABU3YZWYaGNIMXJmKEGVh5"`);
    expect(encodeGrid(parseGrid(SOLVED))).toMatchInlineSnapshot(`"Af____________8BU0Z4kSZyGVNIGYNCVnhZdhQjQmhTeRcTkkhWlhU3KEKHQZY1NFKGF5A"`);
  });
});

describe('gridLabel', () => {
  it('produit cinq caractères lisibles à l’impression', () => {
    const label = gridLabel(parseGrid(PUZZLE));
    expect(label).toHaveLength(5);
    // Ni I, ni O, ni 0, ni 1 : l'œil les confond sur du papier.
    expect(label).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/);
  });

  it('sépare les grilles d’un même cahier', () => {
    const rng = createRng('etiquettes');
    const labels = new Set<string>();
    for (let i = 0; i < 200; i++) {
      labels.add(gridLabel(generatePuzzle({ seed: rng.nextUint32(), minClues: 30 }).puzzle));
    }
    // Empreinte sur 25 bits : quelques collisions sont possibles sur 200 tirages,
    // mais elles doivent rester marginales pour rester utilisables en sommaire.
    expect(labels.size).toBeGreaterThan(195);
    /*
      Deux cents creusements avec vérification d'unicité coûtent environ quatre
      secondes, et davantage quand la suite occupe tous les cœurs. Le budget est
      donc énoncé plutôt que subi : réduire l'échantillon affaiblirait ce que le
      test mesure — la résistance aux collisions — pour gagner deux secondes.
    */
  }, 30_000);

  it('est stable : la même grille donne toujours la même étiquette', () => {
    const grid = parseGrid(PUZZLE);
    expect(gridLabel(grid)).toBe(gridLabel(parseGrid(PUZZLE)));
    expect(gridLabel(grid)).not.toBe(gridLabel(parseGrid(SOLVED)));
  });

  it('change dès qu’une seule case change', () => {
    const grid = parseGrid(SOLVED);
    const modified = Uint8Array.from(grid);
    modified[0] = EMPTY;
    expect(gridLabel(modified)).not.toBe(gridLabel(grid));
  });
});
