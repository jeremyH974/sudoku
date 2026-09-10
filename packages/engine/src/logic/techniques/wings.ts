import {
  CELL_COUNT,
  PEERS,
  arePeers,
  countDigits,
  digitsOf,
  formatCell,
  maskOf,
} from '../../grid/index.js';
import type { Digit, DigitMask } from '../../grid/index.js';
import { cellsPhrase } from '../explain.js';
import { defineTechnique } from '../technique.js';
import type { Elimination, Step } from '../types.js';

/**
 * Les « wings » : XY-Wing (4,2) et XYZ-Wing (4,4).
 *
 * Le raisonnement est le même dans les deux cas, et repose sur une charnière
 * qui ne peut pas se dérober :
 *
 *   - une case **charnière** et deux **ailes** qu'elle voit toutes deux ;
 *   - les trois partagent un chiffre X, et la charnière relie les deux ailes ;
 *   - quelle que soit la valeur que prend la charnière, l'une au moins des
 *     ailes vaut X. Donc toute case voyant les deux ailes ne peut pas valoir X.
 *
 * La différence tient à la charnière. Dans le **XY-Wing** elle a deux candidats
 * et ne peut pas valoir X elle-même : il suffit qu'une case voie les deux ailes.
 * Dans le **XYZ-Wing** elle en a trois, X compris — elle pourrait donc valoir X,
 * et une case n'est éliminée que si elle voit **aussi la charnière**. D'où la
 * note plus élevée : une condition de plus à tenir.
 */

interface WingCandidate {
  readonly pivot: number;
  readonly wingA: number;
  readonly wingB: number;
  readonly digit: Digit;
}

/** Cases vues à la fois par toutes les cases données, elles exclues. */
function commonPeers(cells: readonly number[]): number[] {
  const [first, ...rest] = cells;
  return PEERS[first].filter(
    (candidate) => !cells.includes(candidate) && rest.every((cell) => arePeers(candidate, cell)),
  );
}

function buildStep(
  found: WingCandidate,
  eliminations: readonly Elimination[],
  technique: 'xy-wing' | 'xyz-wing',
  label: string,
  difficulty: number,
  pivotMask: DigitMask,
  maskA: DigitMask,
  maskB: DigitMask,
): Step {
  const seesPivot = technique === 'xyz-wing';
  return {
    technique,
    label,
    difficulty,
    units: [],
    highlights: [
      { cell: found.pivot, digits: pivotMask },
      { cell: found.wingA, digits: maskA },
      { cell: found.wingB, digits: maskB },
    ],
    placements: [],
    eliminations,
    explanation:
      `${formatCell(found.pivot)} sert de charnière entre ${formatCell(found.wingA)} et ` +
      `${formatCell(found.wingB)} : quelle que soit sa valeur, l'une de ces deux cases vaudra ` +
      `${String(found.digit)}. Le ${String(found.digit)} est donc impossible partout où l'on voit ` +
      (seesPivot ? 'ces trois cases' : 'ces deux cases') +
      ` — soit ${cellsPhrase(eliminations.map((e) => e.cell))}.`,
  };
}

/**
 * XY-Wing : charnière {A,B}, ailes {A,X} et {B,X}.
 *
 * La charnière vaut A ou B. Si elle vaut A, l'aile {A,X} est forcée à X ; si
 * elle vaut B, c'est l'autre. Dans les deux cas une aile vaut X.
 */
export const xyWing = defineTechnique('xy-wing', function* (state) {
  for (let pivot = 0; pivot < CELL_COUNT; pivot++) {
    const pivotMask = state.candidatesAt(pivot);
    if (countDigits(pivotMask) !== 2) continue;

    const [a, b] = digitsOf(pivotMask) as [Digit, Digit];
    const peers = PEERS[pivot];

    for (const wingA of peers) {
      const maskA = state.candidatesAt(wingA);
      // L'aile porte A et un tiers, jamais B : sinon elle dupliquerait la
      // charnière et le raisonnement s'effondrerait.
      if (countDigits(maskA) !== 2 || (maskA & maskOf(a)) === 0 || (maskA & maskOf(b)) !== 0) {
        continue;
      }
      const x = digitsOf(maskA & ~maskOf(a))[0];

      /*
        Pas de garde `wingB > wingA` ici, contrairement au XYZ-Wing.

        Les deux ailes n'y jouent pas le même rôle : la première porte A, la
        seconde porte B, et `digitsOf` rend toujours A avant B. Exiger un ordre
        d'index entre elles ferait manquer tous les motifs où la case {B,X} tombe
        avant la case {A,X} dans la grille — soit la moitié d'entre eux.
      */
      for (const wingB of peers) {
        const maskB = state.candidatesAt(wingB);
        if (maskB !== (maskOf(b) | maskOf(x))) continue;

        const targets = commonPeers([wingA, wingB]);
        const eliminations: Elimination[] = [];
        for (const cell of targets) {
          if ((state.candidatesAt(cell) & maskOf(x)) !== 0) eliminations.push({ cell, digit: x });
        }
        if (eliminations.length === 0) continue;

        yield buildStep(
          { pivot, wingA, wingB, digit: x },
          eliminations,
          'xy-wing',
          'XY-Wing',
          4.2,
          pivotMask,
          maskA,
          maskB,
        );
      }
    }
  }
});

/**
 * XYZ-Wing : charnière {A,B,X}, ailes {A,X} et {B,X}.
 *
 * La charnière peut valoir X elle-même. Une case n'est donc éliminée que si
 * elle voit **les trois** — c'est ce qui rend la technique plus rare, et plus
 * chère d'après le barème.
 */
export const xyzWing = defineTechnique('xyz-wing', function* (state) {
  for (let pivot = 0; pivot < CELL_COUNT; pivot++) {
    const pivotMask = state.candidatesAt(pivot);
    if (countDigits(pivotMask) !== 3) continue;

    const peers = PEERS[pivot];

    for (const wingA of peers) {
      const maskA = state.candidatesAt(wingA);
      if (countDigits(maskA) !== 2 || (maskA & pivotMask) !== maskA) continue;

      for (const wingB of peers) {
        if (wingB <= wingA) continue;
        const maskB = state.candidatesAt(wingB);
        if (countDigits(maskB) !== 2 || (maskB & pivotMask) !== maskB) continue;

        // Les deux ailes réunies doivent couvrir la charnière, et partager
        // exactement un chiffre : celui qu'on éliminera.
        if ((maskA | maskB) !== pivotMask) continue;
        const shared = maskA & maskB;
        if (countDigits(shared) !== 1) continue;
        const x = digitsOf(shared)[0];

        const targets = commonPeers([pivot, wingA, wingB]);
        const eliminations: Elimination[] = [];
        for (const cell of targets) {
          if ((state.candidatesAt(cell) & maskOf(x)) !== 0) eliminations.push({ cell, digit: x });
        }
        if (eliminations.length === 0) continue;

        yield buildStep(
          { pivot, wingA, wingB, digit: x },
          eliminations,
          'xyz-wing',
          'XYZ-Wing',
          4.4,
          pivotMask,
          maskA,
          maskB,
        );
      }
    }
  }
});
