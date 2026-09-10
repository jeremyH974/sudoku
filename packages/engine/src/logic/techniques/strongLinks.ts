import {
  COL_OF,
  PEERS,
  ROW_OF,
  SIZE,
  UNITS,
  arePeers,
  formatCell,
  maskOf,
} from '../../grid/index.js';
import type { Digit } from '../../grid/index.js';
import { cellsPhrase, unitName } from '../explain.js';
import { defineTechnique } from '../technique.js';
import type { Elimination, LogicStateView, Step, TechniqueId } from '../types.js';

/**
 * La famille des deux liens forts : Skyscraper (4,0), Cerf-volant (4,1) et
 * Turbot Fish (4,2).
 *
 * ─── Le raisonnement, identique aux trois ───────────────────────────────────
 *
 * Un **lien fort** est une maison où un chiffre n'a plus que deux places : l'une
 * des deux est nécessairement la bonne. Prenons deux liens forts sur le même
 * chiffre, `{pied₁, toit₁}` et `{pied₂, toit₂}`, et supposons que les deux pieds
 * **se voient** — ils ne peuvent donc pas porter le chiffre tous les deux.
 *
 * L'un des deux pieds est donc faux. Si c'est le premier, son lien force
 * `toit₁` ; si c'est le second, il force `toit₂`. Dans tous les cas **au moins
 * un des deux toits porte le chiffre**, et le chiffre devient impossible partout
 * où l'on voit les deux toits à la fois.
 *
 * ─── Ce qui distingue les trois noms ────────────────────────────────────────
 *
 * Uniquement la géométrie des deux maisons, et Sudoku Explainer les note
 * différemment selon celle-ci :
 *
 *   - **Skyscraper** (4,0) — deux maisons parallèles (deux lignes, ou deux
 *     colonnes), dont les pieds partagent la même perpendiculaire.
 *   - **Cerf-volant** (4,1) — une ligne et une colonne, dont les pieds tombent
 *     dans la même boîte. Cette géométrie n'a pas besoin d'être vérifiée : elle
 *     est la seule possible (voir `classify`).
 *   - **Turbot Fish** (4,2) — au moins une boîte parmi les deux maisons. Cette
 *     famille absorbe le motif dit « rectangle vide », qui n'a pas d'existence
 *     propre dans l'oracle.
 *
 * Le motif se ramenant à un X-Wing est écarté : il vaut 3,2, donc moins cher, et
 * le laisser passer ici surévaluerait une grille.
 */

interface Variant {
  readonly id: TechniqueId;
  readonly label: string;
  readonly difficulty: number;
}

const SKYSCRAPER: Variant = { id: 'skyscraper', label: 'Skyscraper', difficulty: 4.0 };
const KITE: Variant = { id: 'two-string-kite', label: 'Cerf-volant', difficulty: 4.1 };
const TURBOT: Variant = { id: 'turbot-fish', label: 'Turbot Fish', difficulty: 4.2 };

/** Un lien fort : une maison où le chiffre n'a plus que ces deux places. */
interface StrongLink {
  readonly unit: number;
  readonly cells: readonly [number, number];
}

/**
 * Détermine le nom du motif, ou `null` s'il faut l'écarter.
 *
 * Deux constatations simplifient beaucoup ce classement, et méritent d'être
 * écrites ici plutôt que redémontrées à chaque lecture :
 *
 *   - **Ligne + colonne** : les deux pieds ne peuvent se voir que par la boîte.
 *     S'ils partageaient la ligne, le pied de la colonne serait une case de
 *     cette ligne portant le chiffre, donc l'un des deux bouts du lien de ligne
 *     — c'est-à-dire une case déjà prise dans le motif. Idem par symétrie pour
 *     la colonne. La condition « même boîte » du cerf-volant est donc acquise.
 *   - **Boîte + ligne** : le même argument montre que les pieds se voient
 *     forcément par une ligne, jamais par la boîte.
 *
 * Il ne reste donc à filtrer explicitement que le cas des maisons parallèles.
 */
function classify(first: StrongLink, second: StrongLink, geometry: Geometry): Variant | null {
  const kindA = UNITS[first.unit].kind;
  const kindB = UNITS[second.unit].kind;

  if (kindA === 'box' || kindB === 'box') return TURBOT;
  if (kindA !== kindB) return KITE;

  // Deux maisons parallèles. Le Skyscraper exige que les pieds partagent la
  // perpendiculaire — s'ils se voient par la boîte, le motif porte un autre nom
  // et une autre note, et nous préférons ne rien annoncer.
  const across = kindA === 'row' ? COL_OF : ROW_OF;
  if (across[geometry.footA] !== across[geometry.footB]) return null;
  // Les deux toits sur la même perpendiculaire : c'est un X-Wing, noté 3,2.
  if (across[geometry.roofA] === across[geometry.roofB]) return null;
  return SKYSCRAPER;
}

interface Geometry {
  readonly footA: number;
  readonly roofA: number;
  readonly footB: number;
  readonly roofB: number;
}

/** « sont sur la même ligne », « sont dans la même colonne », « partagent la même boîte ». */
function linkPhrase(a: number, b: number): string {
  if (ROW_OF[a] === ROW_OF[b]) return 'sont sur la même ligne';
  if (COL_OF[a] === COL_OF[b]) return 'sont dans la même colonne';
  return 'partagent la même boîte';
}

/** Les liens forts du chiffre : les maisons où il n'a plus que deux places. */
function strongLinksOf(state: LogicStateView, digit: Digit): StrongLink[] {
  const links: StrongLink[] = [];
  for (let unit = 0; unit < UNITS.length; unit++) {
    const places = state.placesFor(unit, digit);
    if (places.length === 2) links.push({ unit, cells: [places[0], places[1]] });
  }
  return links;
}

/**
 * Énumère les motifs d'une variante donnée.
 *
 * Le classement est fait **avant** de chercher les éliminations : celles-ci
 * coûtent un balayage des cases vues, inutile si le motif ne relève pas de la
 * variante demandée. Les trois entrées du registre partagent donc la même
 * énumération sans payer trois fois le prix fort.
 */
function* strongLinkSteps(state: LogicStateView, wanted: Variant): Generator<Step> {
  for (let digit = 1 as Digit; digit <= SIZE; digit++) {
    const links = strongLinksOf(state, digit);
    const mask = maskOf(digit);

    for (let i = 0; i < links.length; i++) {
      for (let j = i + 1; j < links.length; j++) {
        const first = links[i];
        const second = links[j];

        for (let a = 0; a < 2; a++) {
          const footA = first.cells[a];
          const roofA = first.cells[1 - a];
          for (let b = 0; b < 2; b++) {
            const footB = second.cells[b];
            const roofB = second.cells[1 - b];

            // Les quatre cases doivent être distinctes : deux maisons peuvent se
            // chevaucher, et un motif qui se replie sur lui-même ne prouve rien.
            if (footA === footB || footA === roofB || roofA === footB || roofA === roofB) continue;
            // Le lien faible entre les pieds : sans lui, rien ne se déduit.
            if (!arePeers(footA, footB)) continue;

            const geometry: Geometry = { footA, roofA, footB, roofB };
            const variant = classify(first, second, geometry);
            if (variant === null || variant.id !== wanted.id) continue;

            const eliminations: Elimination[] = [];
            for (const cell of PEERS[roofA]) {
              if (cell === footA || cell === footB || cell === roofB) continue;
              if ((state.candidatesAt(cell) & mask) === 0) continue;
              if (arePeers(cell, roofB)) eliminations.push({ cell, digit });
            }
            if (eliminations.length === 0) continue;

            yield {
              technique: variant.id,
              label: variant.label,
              difficulty: variant.difficulty,
              units: [first.unit, second.unit],
              highlights: [footA, roofA, footB, roofB].map((cell) => ({ cell, digits: mask })),
              placements: [],
              eliminations,
              explanation:
                `Le ${String(digit)} n'a que deux places dans ${unitName(first.unit)} et deux ` +
                `dans ${unitName(second.unit)}. Comme ${formatCell(footA)} et ` +
                `${formatCell(footB)} ${linkPhrase(footA, footB)}, elles ne peuvent pas le porter ` +
                `toutes les deux : ${formatCell(roofA)} ou ${formatCell(roofB)} le porte donc ` +
                `forcément. Le ${String(digit)} est impossible dans ` +
                `${cellsPhrase(eliminations.map((e) => e.cell))}.`,
            };
          }
        }
      }
    }
  }
}

export const skyscraper = defineTechnique('skyscraper', (state) =>
  strongLinkSteps(state, SKYSCRAPER),
);

export const twoStringKite = defineTechnique('two-string-kite', (state) =>
  strongLinkSteps(state, KITE),
);

export const turbotFish = defineTechnique('turbot-fish', (state) => strongLinkSteps(state, TURBOT));

