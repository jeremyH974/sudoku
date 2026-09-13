import { castOf } from '../cast.js';
import { deduce } from '../deduce/index.js';
import { solveExact } from '../exact/index.js';
import { loadDecor } from '../scene/decors.js';
import { buildScene } from '../scene/scene.js';
import { REGISTRY_VERSION } from '../deduce/types.js';
import type { Clue, Direction } from '../clues/types.js';
import type { PropId } from '../scene/types.js';
import type { CaseFile } from '../types.js';

/**
 * Le code imprimé d'une affaire.
 *
 * ─── Ce qu'il porte, et ce qu'il refuse de porter ───────────────────────────
 *
 * Trois choses seulement : le décor, la victime, les indices. Tout le reste
 * d'un `CaseFile` — la solution, le coupable, la technique la plus dure, le
 * nombre d'étapes — se **recalcule** à la lecture, et c'est la même doctrine que
 * pour une grille de sudoku : « un cahier imprimé n'a ainsi qu'une chose à
 * porter, et reste lisible même si le moteur évolue ».
 *
 * La graine, en particulier, n'y est pas. `CLAUDE.md` l'a déjà tranché pour le
 * sudoku et la raison vaut mot pour mot ici : `composeCase` boucle sur des
 * tentatives et branche sur `deduce`, donc un changement du registre de
 * déduction change l'affaire qu'une graine produit. Ce qui doit être identique
 * pour tout le monde et pour toujours porte donc **l'affaire elle-même**.
 *
 * ─── Pourquoi ce module a ses propres tables ────────────────────────────────
 *
 * Les familles d'indices, les meubles et les points cardinaux sont numérotés
 * ici, dans des tables **figées**, au lieu d'être indexés dans `PROP_ORDER` ou
 * dans l'ordre de l'union `Clue`. C'est délibéré : réordonner `PROP_ORDER` est
 * un remaniement sans conséquence partout ailleurs, et changerait en silence la
 * lecture de tous les codes déjà imprimés. Une table locale rend ce couplage
 * visible — on ne peut la toucher que volontairement.
 *
 * ⚠ **Ce à quoi ce format engage.** Un décor est une donnée : déplacer un meuble
 * du manoir ne casse pas ce codec, mais change ce que veut dire un code déjà
 * distribué, puisque l'affaire se rejoue contre le décor tel qu'il est
 * *aujourd'hui*. Les quatre décors livrés sont donc figés au même titre que les
 * valeurs du PRNG. Un décor nouveau s'ajoute librement ; un décor publié ne se
 * retouche plus.
 *
 * ─── Pas de somme de contrôle, et c'est mesuré ──────────────────────────────
 *
 * L'usage voudrait un caractère de contrôle façon base32 de Crockford pour
 * repérer un lien tronqué. Il n'y en a pas, parce qu'il y a mieux et que c'est
 * gratuit : une affaire décodée doit avoir **exactement une solution**. Un code
 * abîmé donne presque toujours un jeu d'indices qui en a zéro ou plusieurs, et
 * le contrôle porte alors sur le sens plutôt que sur les octets.
 * `encode.test.ts` le mesure en abîmant des milliers de codes au hasard.
 */

/** Version du format. Un code plus récent n'est pas lisible par un code ancien. */
export const CASE_ENCODING_VERSION = 1;

/** Alphabet base64url, le même que celui des grilles : sûr dans une adresse. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const DECODE_TABLE: ReadonlyMap<string, number> = (() => {
  const table = new Map<string, number>();
  for (let index = 0; index < ALPHABET.length; index++) table.set(ALPHABET[index], index);
  return table;
})();

/**
 * Les familles d'indices, numérotées **une fois pour toutes**.
 *
 * L'ordre de cette table est celui du format, pas celui du code. Une famille
 * nouvelle s'ajoute **à la fin** ; aucune ne se retire ni ne se déplace.
 */
const KINDS = [
  'on-prop',
  'next-to-prop',
  'in-zone',
  'in-band',
  'direction',
  'offset',
  'same-zone',
  'alone',
  'alone-with',
  'victim',
] as const;

/** Les meubles, numérotés ici et non dans `PROP_ORDER` — voir l'en-tête. */
const PROPS: readonly PropId[] = ['chair', 'table', 'rug', 'plant', 'shelf', 'lamp'];

/** Les points cardinaux, numérotés ici pour la même raison. */
const DIRECTIONS: readonly Direction[] = ['north', 'south', 'east', 'west'];

/**
 * Les largeurs de champ, fixes et volontairement un peu larges.
 *
 * Un index de suspect tient sur 3 bits pour les six suspects d'aujourd'hui ;
 * on en écrit 4. Le plan d'incrément 11 garde ouverte la porte des plateaux
 * 16×16, et surtout : faire dépendre la largeur du décor obligerait à lire le
 * décor pour relire l'affaire, donc à figer **aussi** la taille de chaque
 * décor. Un bit par champ est le prix de ne pas créer ce couplage.
 */
const WHO_BITS = 4;
const ZONE_BITS = 4;
const BAND_BITS = 4;
const PROP_BITS = 3;
const DIRECTION_BITS = 2;
const DISTANCE_BITS = 4;
const KIND_BITS = 4;
const COUNT_BITS = 5;
const NAME_BITS = 5;

export class CaseDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaseDecodeError';
  }
}

/** Écriture bit à bit, du poids fort vers le poids faible. */
class BitWriter {
  readonly #bytes: number[] = [];
  #current = 0;
  #filled = 0;

  write(value: number, width: number): void {
    for (let bit = width - 1; bit >= 0; bit--) {
      this.#current = (this.#current << 1) | ((value >> bit) & 1);
      this.#filled++;
      if (this.#filled === 8) {
        this.#bytes.push(this.#current);
        this.#current = 0;
        this.#filled = 0;
      }
    }
  }

  /** Les octets, le dernier complété par des zéros. */
  bytes(): Uint8Array {
    const out = [...this.#bytes];
    if (this.#filled > 0) out.push(this.#current << (8 - this.#filled));
    return Uint8Array.from(out);
  }
}

/** Lecture bit à bit. Lever plutôt que rendre zéro : un code court est un code faux. */
class BitReader {
  readonly #bytes: Uint8Array;
  #position = 0;

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
  }

  read(width: number): number {
    let value = 0;
    for (let step = 0; step < width; step++) {
      const index = this.#position >> 3;
      if (index >= this.#bytes.length) throw new CaseDecodeError('code tronqué');
      value = (value << 1) | ((this.#bytes[index] >> (7 - (this.#position & 7))) & 1);
      this.#position++;
    }
    return value;
  }

  /** Combien de bits restent à lire. Sert à refuser une queue significative. */
  remaining(): number {
    return this.#bytes.length * 8 - this.#position;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const c = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const group = (a << 16) | (b << 8) | c;
    const available = Math.min(3, bytes.length - index);
    const characters = available === 1 ? 2 : available === 2 ? 3 : 4;
    for (let slot = 0; slot < characters; slot++) {
      out += ALPHABET[(group >> (18 - slot * 6)) & 0x3f];
    }
  }
  return out;
}

function fromBase64Url(text: string): Uint8Array {
  const values: number[] = [];
  for (const character of text) {
    const value = DECODE_TABLE.get(character);
    if (value === undefined) throw new CaseDecodeError(`caractère inattendu : « ${character} »`);
    values.push(value);
  }

  const bytes: number[] = [];
  for (let index = 0; index < values.length; index += 4) {
    const slice = values.slice(index, index + 4);
    let group = 0;
    for (let slot = 0; slot < 4; slot++) group = (group << 6) | (slice[slot] ?? 0);
    const produced = slice.length === 2 ? 1 : slice.length === 3 ? 2 : slice.length === 4 ? 3 : 0;
    if (produced === 0) throw new CaseDecodeError('longueur de code impossible');
    for (let slot = 0; slot < produced; slot++) bytes.push((group >> (16 - slot * 8)) & 0xff);
  }
  return Uint8Array.from(bytes);
}

/** Écrit un indice, famille puis charge utile. */
function writeClue(writer: BitWriter, clue: Clue): void {
  const kind = KINDS.indexOf(clue.kind);
  if (kind < 0) throw new Error(`famille d'indice absente de la table du format : ${clue.kind}`);
  writer.write(kind, KIND_BITS);
  writer.write(clue.who, WHO_BITS);

  switch (clue.kind) {
    case 'on-prop':
    case 'next-to-prop': {
      const prop = PROPS.indexOf(clue.prop);
      if (prop < 0) throw new Error(`meuble absent de la table du format : ${clue.prop}`);
      writer.write(prop, PROP_BITS);
      writer.write(clue.not ? 1 : 0, 1);
      return;
    }
    case 'in-zone':
      writer.write(clue.zone, ZONE_BITS);
      writer.write(clue.not ? 1 : 0, 1);
      return;
    case 'in-band':
      writer.write(clue.axis === 'row' ? 0 : 1, 1);
      writer.write(clue.index, BAND_BITS);
      return;
    case 'direction':
      writer.write(clue.other, WHO_BITS);
      writer.write(DIRECTIONS.indexOf(clue.direction), DIRECTION_BITS);
      return;
    case 'offset':
      writer.write(clue.other, WHO_BITS);
      writer.write(DIRECTIONS.indexOf(clue.direction), DIRECTION_BITS);
      writer.write(clue.distance, DISTANCE_BITS);
      return;
    case 'same-zone':
      writer.write(clue.other, WHO_BITS);
      writer.write(clue.not ? 1 : 0, 1);
      return;
    case 'alone-with':
      writer.write(clue.other, WHO_BITS);
      return;
    case 'alone':
    case 'victim':
      return;
  }
}

/**
 * Relit un indice. Toute valeur hors table lève : il n'y a pas de défaut
 * raisonnable pour un code qu'on vient de déclarer faux.
 *
 * Les lectures de table passent par `.at()` et non par l'indice : un index venu
 * d'un texte étranger n'est pas un index valide, et le type doit le dire. Écrit
 * `TABLE[i]`, TypeScript promet un élément qui n'existe pas, et le contrôle qui
 * suit devient « inutile » aux yeux du lint — alors qu'il est le seul rempart.
 */
function readClue(reader: BitReader): Clue {
  const kindIndex = reader.read(KIND_BITS);
  const kind = KINDS.at(kindIndex);
  if (kind === undefined) throw new CaseDecodeError(`famille d'indice inconnue : ${String(kindIndex)}`);
  const who = reader.read(WHO_BITS);

  switch (kind) {
    case 'on-prop':
    case 'next-to-prop': {
      const prop = PROPS.at(reader.read(PROP_BITS));
      if (prop === undefined) throw new CaseDecodeError('meuble inconnu');
      return { kind, who, prop, not: reader.read(1) === 1 };
    }
    case 'in-zone':
      return { kind, who, zone: reader.read(ZONE_BITS), not: reader.read(1) === 1 };
    case 'in-band':
      return {
        kind,
        who,
        axis: reader.read(1) === 0 ? 'row' : 'column',
        index: reader.read(BAND_BITS),
      };
    case 'direction': {
      const other = reader.read(WHO_BITS);
      const direction = DIRECTIONS.at(reader.read(DIRECTION_BITS));
      if (direction === undefined) throw new CaseDecodeError('direction inconnue');
      return { kind, who, other, direction };
    }
    case 'offset': {
      const other = reader.read(WHO_BITS);
      const direction = DIRECTIONS.at(reader.read(DIRECTION_BITS));
      if (direction === undefined) throw new CaseDecodeError('direction inconnue');
      return { kind, who, other, direction, distance: reader.read(DISTANCE_BITS) };
    }
    case 'same-zone':
      return { kind, who, other: reader.read(WHO_BITS), not: reader.read(1) === 1 };
    case 'alone-with':
      return { kind, who, other: reader.read(WHO_BITS) };
    case 'alone':
      return { kind, who };
    case 'victim':
      return { kind, who };
  }
}

/**
 * Le code d'une affaire : un texte court, sûr dans une adresse et sur du papier.
 *
 * Déterministe — la même affaire rend toujours le même code, ce dont dépendent
 * autant le partage que l'identité d'une partie dans l'historique.
 */
export function encodeCase(file: CaseFile): string {
  const writer = new BitWriter();
  writer.write(CASE_ENCODING_VERSION, 8);

  if (file.decorId.length >= 1 << NAME_BITS) throw new Error('identifiant de décor trop long');
  writer.write(file.decorId.length, NAME_BITS);
  for (const character of file.decorId) {
    const code = character.codePointAt(0) ?? 0;
    if (code > 0x7f) throw new Error(`identifiant de décor hors ASCII : « ${file.decorId} »`);
    writer.write(code, 7);
  }

  writer.write(file.victim, WHO_BITS);
  if (file.clues.length >= 1 << COUNT_BITS) throw new Error('trop d’indices pour ce format');
  writer.write(file.clues.length, COUNT_BITS);
  for (const clue of file.clues) writeClue(writer, clue);

  return toBase64Url(writer.bytes());
}

/**
 * Relit un code, et **reconstruit l'affaire entière**.
 *
 * Le décor est rechargé, la solution recherchée, le coupable déduit de la
 * solution, la difficulté remesurée par le registre en vigueur. Un code dont
 * l'affaire n'aurait pas exactement une solution est refusé : à ce stade, c'est
 * la seule question qui compte, et elle vaut somme de contrôle.
 */
export function decodeCase(text: string): CaseFile {
  const reader = new BitReader(fromBase64Url(text));

  const version = reader.read(8);
  if (version !== CASE_ENCODING_VERSION) {
    throw new CaseDecodeError(`version de code inconnue : ${String(version)}`);
  }

  const nameLength = reader.read(NAME_BITS);
  let decorId = '';
  for (let index = 0; index < nameLength; index++) decorId += String.fromCharCode(reader.read(7));

  let scene;
  try {
    scene = buildScene(loadDecor(decorId));
  } catch {
    throw new CaseDecodeError(`décor inconnu : « ${decorId} »`);
  }

  const suspects = castOf(scene.size);
  const victim = reader.read(WHO_BITS);
  if (victim >= suspects.length) throw new CaseDecodeError('victime hors de la distribution');

  const count = reader.read(COUNT_BITS);
  const clues: Clue[] = [];
  for (let index = 0; index < count; index++) clues.push(readClue(reader));

  /*
    La queue doit être du remplissage, et rien d'autre. Sans ce contrôle, un code
    rallongé se lirait comme le code d'origine — et deux textes différents
    désigneraient la même affaire, ce qui casserait l'identité d'une partie dans
    l'historique bien avant de casser une déduction.
  */
  if (reader.remaining() >= 8) throw new CaseDecodeError('code plus long que son contenu');

  const puzzle = { scene, suspects, victim, clues };
  const solutions = solveExact(puzzle, 2);
  if (solutions.length !== 1) {
    throw new CaseDecodeError(
      solutions.length === 0 ? 'affaire sans solution' : 'affaire à plusieurs solutions',
    );
  }
  const solution = solutions[0];

  /*
    Le coupable est une conséquence, jamais une donnée : c'est la seconde
    personne de la pièce de la victime. L'indice « seule avec le meurtrier »
    garantit qu'il y en a exactement une.
  */
  const victimZone = scene.zoneOf[solution[victim]];
  const others = solution
    .map((cell, who) => ({ cell, who }))
    .filter(({ cell, who }) => who !== victim && scene.zoneOf[cell] === victimZone);
  if (others.length !== 1) throw new CaseDecodeError('la pièce de la victime ne désigne personne');

  const path = deduce(puzzle);
  if (!path.solved || path.hardest === null) {
    throw new CaseDecodeError('affaire que le registre ne sait pas déduire');
  }

  return {
    decorId,
    // La graine ne voyage pas : ce qui revient est l'affaire, pas sa provenance.
    seed: '',
    clues,
    victim,
    solution,
    murderer: others[0].who,
    registryVersion: REGISTRY_VERSION,
    hardest: path.hardest,
    stepCount: path.steps.length,
  };
}

/** Comme `decodeCase`, mais rend `null` au lieu de lever. */
export function tryDecodeCase(text: string): CaseFile | null {
  try {
    return decodeCase(text);
  } catch {
    return null;
  }
}
