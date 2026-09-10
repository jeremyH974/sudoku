import { CELL_COUNT, EMPTY } from '../grid/index.js';
import type { Grid } from '../grid/index.js';

/**
 * Encodage compact d'une grille, pour le partage par lien et le QR code imprimé.
 *
 * ─── Ce que ce format porte, et pourquoi ────────────────────────────────────
 *
 * Il encode **la grille elle-même**, pas la graine qui l'a produite. La tentation
 * inverse est forte : une graine tient en huit caractères, une grille en
 * trente-cinq. Mais reproduire une grille depuis sa graine dépend du générateur,
 * donc de `RATING_VERSION`, donc de la moindre évolution du moteur. Un cahier
 * imprimé aujourd'hui doit s'ouvrir dans dix ans : il porte donc tout ce qu'il
 * faut, et ne dépend de rien.
 *
 * Format : un octet de version, puis 81 bits de présence (une case remplie ou
 * non), puis les valeurs des indices sur 4 bits chacune. Soit 26 octets pour une
 * grille de 27 indices, et 35 caractères une fois en base64url.
 *
 * Le base64url est écrit ici plutôt qu'emprunté : `btoa` et `Buffer` sont des
 * variables d'environnement, et le moteur n'a le droit d'en connaître aucune.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Version du format. Tout changement incompatible doit l'incrémenter. */
export const ENCODING_VERSION = 1;

/** Alphabet base64url : sûr dans une URL, sans caractère de remplissage. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Table inverse, construite par index plutôt que par découpage de chaîne :
 * l'alphabet est purement ASCII, et parcourir les unités de code évite d'avoir
 * à raisonner sur les caractères composés.
 */
const DECODE_TABLE: ReadonlyMap<string, number> = (() => {
  const table = new Map<string, number>();
  for (let i = 0; i < ALPHABET.length; i++) table.set(ALPHABET[i], i);
  return table;
})();

export class GridDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GridDecodeError';
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;

    out += ALPHABET[(triple >> 18) & 63];
    out += ALPHABET[(triple >> 12) & 63];
    // On n'émet que les caractères qui portent des bits réels : sans quoi il
    // faudrait un caractère de remplissage, inutile et laid dans une URL.
    if (i + 1 < bytes.length) out += ALPHABET[(triple >> 6) & 63];
    if (i + 2 < bytes.length) out += ALPHABET[triple & 63];
  }
  return out;
}

function fromBase64Url(text: string): Uint8Array {
  const values: number[] = [];
  for (const char of text) {
    const value = DECODE_TABLE.get(char);
    if (value === undefined) {
      throw new GridDecodeError(`Caractère invalide « ${char} » dans le code de grille.`);
    }
    values.push(value);
  }

  const bytes: number[] = [];
  for (let i = 0; i < values.length; i += 4) {
    const remaining = Math.min(4, values.length - i);
    if (remaining === 1) {
      throw new GridDecodeError('Code de grille tronqué.');
    }
    const chunk =
      (values[i] << 18) |
      (values[i + 1] << 12) |
      ((remaining > 2 ? values[i + 2] : 0) << 6) |
      (remaining > 3 ? values[i + 3] : 0);

    bytes.push((chunk >> 16) & 255);
    if (remaining > 2) bytes.push((chunk >> 8) & 255);
    if (remaining > 3) bytes.push(chunk & 255);
  }
  return Uint8Array.from(bytes);
}

/** Nombre d'octets occupés par le masque de présence des 81 cases. */
const MASK_BYTES = Math.ceil(CELL_COUNT / 8);

/** Transforme une grille en chaîne compacte, sûre dans une URL. */
export function encodeGrid(grid: Grid): string {
  if (grid.length !== CELL_COUNT) {
    throw new GridDecodeError(`Grille de ${String(grid.length)} cases au lieu de ${String(CELL_COUNT)}.`);
  }

  const filled: number[] = [];
  const mask = new Uint8Array(MASK_BYTES);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const value = grid[cell];
    if (value === EMPTY) continue;
    mask[cell >> 3] |= 1 << (cell & 7);
    filled.push(value);
  }

  const bytes = new Uint8Array(1 + MASK_BYTES + Math.ceil(filled.length / 2));
  bytes[0] = ENCODING_VERSION;
  bytes.set(mask, 1);

  // Deux indices par octet : les valeurs vont de 1 à 9, donc quatre bits
  // suffisent et l'octet n'est jamais gâché à moitié.
  for (let i = 0; i < filled.length; i++) {
    const target = 1 + MASK_BYTES + (i >> 1);
    bytes[target] |= i % 2 === 0 ? filled[i] << 4 : filled[i];
  }

  return toBase64Url(bytes);
}

/** Reconstruit une grille depuis sa chaîne. Lève si le code est invalide. */
export function decodeGrid(text: string): Grid {
  const cleaned = text.trim().replace(/\s+/g, '');
  if (cleaned.length === 0) throw new GridDecodeError('Code de grille vide.');

  const bytes = fromBase64Url(cleaned);
  if (bytes.length < 1 + MASK_BYTES) {
    throw new GridDecodeError('Code de grille trop court.');
  }

  const version = bytes[0];
  if (version !== ENCODING_VERSION) {
    throw new GridDecodeError(
      `Code produit par la version ${String(version)} du format, incompatible avec la ` +
        `version ${String(ENCODING_VERSION)} en cours.`,
    );
  }

  const positions: number[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if ((bytes[1 + (cell >> 3)] & (1 << (cell & 7))) !== 0) positions.push(cell);
  }

  const needed = 1 + MASK_BYTES + Math.ceil(positions.length / 2);
  if (bytes.length < needed) {
    throw new GridDecodeError(
      `Code incomplet : ${String(positions.length)} indices annoncés, valeurs manquantes.`,
    );
  }

  const grid = new Uint8Array(CELL_COUNT);
  positions.forEach((cell, i) => {
    const byte = bytes[1 + MASK_BYTES + (i >> 1)];
    const value = i % 2 === 0 ? byte >> 4 : byte & 15;
    if (value < 1 || value > 9) {
      throw new GridDecodeError(`Valeur ${String(value)} hors bornes dans le code de grille.`);
    }
    grid[cell] = value;
  });

  return grid;
}

/** Décode sans lever : `null` si le code est invalide. */
export function tryDecodeGrid(text: string): Grid | null {
  try {
    return decodeGrid(text);
  } catch {
    return null;
  }
}

/** Alphabet de l'étiquette : sans I, O, 0, 1, que l'œil confond à l'impression. */
const LABEL_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Étiquette courte et lisible, pour repérer une grille dans un sommaire de
 * cahier et sur son corrigé.
 *
 * Elle **ne reconstitue rien** : cinq caractères portent vingt-cinq bits, une
 * grille en demande près de deux cent soixante-dix. C'est une empreinte, pas un
 * code de reprise — et le nommer ainsi évite de laisser croire le contraire.
 */
export function gridLabel(grid: Grid): string {
  // FNV-1a, choisi pour sa brièveté et sa bonne dispersion sur des entrées
  // courtes ; aucune propriété cryptographique n'est requise ici.
  let hash = 0x811c9dc5;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    hash ^= grid[cell];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  let label = '';
  for (let i = 0; i < 5; i++) {
    label += LABEL_ALPHABET[hash & 31];
    hash >>>= 5;
  }
  return label;
}
