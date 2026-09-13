import {
  deduce,
  encodeCase,
  holds,
  murdererOf,
  openCase,
  renderClue,
  type CaseFile,
  type Deduction,
  type Puzzle,
  type Step,
  type Suspect,
} from '@sudoku/engine/investigation';
import { engine } from '../engineClient.js';
import { Stopwatch } from '../stopwatch.svelte.js';
import { localDayKey } from '../day.js';
import type { DayKey } from '../day.js';
import type { CaseRecord } from './records.js';
import type { CaseSnapshot, RestoredCase } from './storage.js';

/**
 * L'outil actif sous le doigt.
 *
 * Trois gestes, et un seul actif à la fois : poser quelqu'un, noter une
 * hypothèse au crayon, barrer une case. La référence du genre superpose les
 * deux premiers sur la durée de l'appui — appui bref pour le crayon, appui long
 * pour poser —, ce qui est élégant et **invisible** : il faut un tutoriel pour
 * l'apprendre, et rien ne l'expose à un clavier ou à un lecteur d'écran. Trois
 * boutons nommés disent la même chose, et se laissent atteindre autrement qu'au
 * doigt.
 */
export type Tool = 'place' | 'note' | 'cross';

/**
 * Paliers de révélation d'un indice — les mêmes trois que le sudoku.
 *
 * Le reproche constant fait aux jeux du genre est que leur aide donne la
 * réponse sans rien enseigner. Ici elle est graduée : *où regarder*, puis *quel
 * raisonnement*, et seulement en dernier *le coup*.
 */
export type HintTier = 0 | 1 | 2 | 3;

/** Ce que la validation a conclu. */
export type Verdict =
  | { readonly kind: 'incomplete'; readonly missing: number }
  | { readonly kind: 'contradicted'; readonly clues: readonly number[] }
  | { readonly kind: 'solved'; readonly murderer: number };

const NO_ONE = -1;

export class CaseGame {
  file = $state<CaseFile | null>(null);
  /** La scène compilée. Nul tant qu'aucune affaire n'est chargée. */
  puzzle = $state<Puzzle | null>(null);
  composing = $state(false);
  /** Dit quand la fabrique n'a rien rendu, plutôt que de réessayer en silence. */
  failed = $state(false);

  /** Qui occupe chaque case, ou -1. */
  occupant = $state<number[]>([]);
  /** Hypothèses au crayon : un masque de suspects par case. */
  pencil = $state<number[]>([]);
  /** Cases barrées à la main. */
  crossed = $state<boolean[]>([]);

  suspect = $state(0);
  cursor = $state(0);
  tool = $state<Tool>('place');

  verdict = $state<Verdict | null>(null);
  hintTier = $state<HintTier>(0);
  announcement = $state('');

  #history: { occupant: number[]; pencil: number[]; crossed: boolean[] }[] = [];

  /**
   * Le chronomètre de la partie.
   *
   * Le même que celui du sudoku, et pour ses deux qualités : il accumule des
   * segments au lieu de soustraire deux instants — donc une partie reprise le
   * lendemain ne dure pas quatorze heures —, et il **refuse** de rendre une
   * durée dont il doute. Un onglet resté ouvert pendant le déjeuner donne
   * `null`, jamais une durée inventée.
   */
  readonly clock = new Stopwatch();

  /** Jour civil où la partie a commencé. C'est lui que la série compte. */
  startedOn: DayKey = localDayKey();

  /** Le jour dont c'est l'affaire, ou `null` pour une affaire libre. */
  daily = $state<DayKey | null>(null);

  /** Combien de fois le joueur a demandé à en savoir plus. Observable. */
  hintsShown = $state(0);

  /**
   * Appelé **une seule fois** quand l'affaire est résolue.
   *
   * Le verrou est ici et non chez l'appelant : rouvrir le même dossier ou
   * revalider deux fois ne doit pas compter deux parties.
   */
  onSolved: ((record: CaseRecord) => void) | null = null;
  #recorded = false;

  /** Le nombre de cases du plateau, ou 0 avant chargement. */
  get cellCount(): number {
    return this.puzzle?.scene.cellCount ?? 0;
  }

  get suspects(): readonly Suspect[] {
    return this.puzzle?.suspects ?? [];
  }

  /** La case d'un suspect, ou -1 s'il n'est pas posé. */
  cellOf(suspect: number): number {
    return this.occupant.indexOf(suspect);
  }

  get placedCount(): number {
    return this.occupant.filter((who) => who !== NO_ONE).length;
  }

  get complete(): boolean {
    return this.puzzle !== null && this.placedCount === this.puzzle.suspects.length;
  }

  get solved(): boolean {
    return this.verdict?.kind === 'solved';
  }

  /**
   * Les cases qu'un placement rend impossibles : la rangée et la colonne de
   * quelqu'un de déjà posé.
   *
   * Calculé, jamais stocké. La référence du genre y écrit de vraies croix, ce
   * qui oblige à les effacer quand on déplace quelqu'un — et à se tromper une
   * fois sur deux. Ici l'information suit le plateau parce qu'elle en découle.
   */
  blocked(cell: number): boolean {
    const scene = this.puzzle?.scene;
    if (scene === undefined || this.occupant[cell] !== NO_ONE) return false;
    const row = Math.floor(cell / scene.size);
    const column = cell % scene.size;
    for (let other = 0; other < this.occupant.length; other++) {
      if (this.occupant[other] === NO_ONE) continue;
      if (Math.floor(other / scene.size) === row || other % scene.size === column) return true;
    }
    return false;
  }

  /** Le texte français d'un indice, tel qu'il s'affiche sur une carte. */
  clueText(index: number): string {
    const puzzle = this.puzzle;
    const file = this.file;
    if (puzzle === null || file === null) return '';
    return renderClue(file.clues[index], puzzle.scene, puzzle.suspects);
  }

  /** Les indices portés par un suspect, par position dans l'affaire. */
  cluesOf(suspect: number): number[] {
    const file = this.file;
    if (file === null) return [];
    const found: number[] = [];
    file.clues.forEach((clue, index) => {
      if (clue.who === suspect) found.push(index);
    });
    return found;
  }

  async compose(seed: string): Promise<void> {
    this.composing = true;
    this.failed = false;
    try {
      const file = await engine.composeCase(seed);
      if (file === null) {
        this.failed = true;
        this.announcement = "Aucune affaire n'a pu être composée. Réessayez.";
        return;
      }
      this.load(file);
    } finally {
      this.composing = false;
    }
  }

  load(file: CaseFile): void {
    const puzzle = openCase(file);
    this.file = file;
    this.puzzle = puzzle;
    this.occupant = new Array<number>(puzzle.scene.cellCount).fill(NO_ONE);
    this.pencil = new Array<number>(puzzle.scene.cellCount).fill(0);
    this.crossed = new Array<boolean>(puzzle.scene.cellCount).fill(false);
    this.suspect = 0;
    this.cursor = 0;
    this.verdict = null;
    this.hintTier = 0;
    this.#history = [];
    this.hintsShown = 0;
    this.startedOn = localDayKey();
    this.daily = null;
    this.#recorded = false;
    this.clock.reset();
    this.clock.start();
    this.announcement = `${puzzle.scene.title} : ${String(puzzle.suspects.length)} suspects à placer.`;
  }

  /**
   * L'état rangeable de la partie.
   *
   * L'affaire y voyage sous forme de **code**, jamais de graine : une graine ne
   * reproduit pas la même affaire d'une version du registre à l'autre, et une
   * partie reprise sur une autre affaire serait pire qu'une partie perdue.
   *
   * `storage.ts` dit ce qui n'est délibérément pas rangé — l'historique
   * d'annulation, et une durée que rien ne mesure.
   */
  snapshot(): CaseSnapshot | null {
    const file = this.file;
    if (file === null) return null;
    return {
      code: encodeCase(file),
      occupant: [...this.occupant],
      pencil: [...this.pencil],
      crossed: [...this.crossed],
      suspect: this.suspect,
      cursor: this.cursor,
      tool: this.tool,
      hintTier: this.hintTier,
      elapsedMs: this.clock.currentMs(),
      startedOn: this.startedOn,
      daily: this.daily,
      hintsShown: this.hintsShown,
    };
  }

  /**
   * Reprend une partie rangée.
   *
   * On recharge l'affaire d'abord — ce qui dimensionne le plateau — puis on
   * repose ce que le joueur avait fait. `loadCase` a déjà vérifié que les trois
   * tableaux ont la taille de ce décor ; sans quoi la partie n'aurait pas été
   * rendue du tout.
   */
  restore(saved: RestoredCase): void {
    this.load(saved.file);
    this.occupant = [...saved.snapshot.occupant];
    this.pencil = [...saved.snapshot.pencil];
    this.crossed = [...saved.snapshot.crossed];
    this.suspect = saved.snapshot.suspect;
    this.cursor = saved.snapshot.cursor;
    this.tool = saved.snapshot.tool;
    this.hintTier = saved.snapshot.hintTier;
    this.hintsShown = saved.snapshot.hintsShown ?? 0;
    this.startedOn = saved.snapshot.startedOn ?? localDayKey();
    this.daily = saved.snapshot.daily ?? null;
    /*
      Le chronomètre repart du total rangé, jamais d'un horodatage : `elapsedMs`
      est une somme de segments, et l'instant d'ouverture du segment en cours
      n'a de sens que dans la session qui l'a produit.
    */
    this.clock.reset(saved.snapshot.elapsedMs ?? 0);
    this.clock.start();
    this.announcement = `Partie reprise — ${this.puzzle?.scene.title ?? 'affaire'}.`;
  }

  select(cell: number): void {
    this.cursor = cell;
  }

  /** Déplace le curseur, en restant sur le plateau. */
  move(rowStep: number, columnStep: number): void {
    const scene = this.puzzle?.scene;
    if (scene === undefined) return;
    const row = Math.min(scene.size - 1, Math.max(0, Math.floor(this.cursor / scene.size) + rowStep));
    const column = Math.min(scene.size - 1, Math.max(0, (this.cursor % scene.size) + columnStep));
    this.cursor = row * scene.size + column;
  }

  /** Le geste principal : appliquer l'outil actif à une case. */
  apply(cell: number): void {
    if (this.puzzle === null) return;
    this.cursor = cell;
    this.#remember();
    // Toute modification périme le verdict : laisser « résolu » à l'écran après
    // un déplacement serait un mensonge d'un seul geste.
    this.verdict = null;
    this.hintTier = 0;

    if (this.tool === 'cross') {
      this.crossed[cell] = !this.crossed[cell];
      return;
    }
    if (this.tool === 'note') {
      this.pencil[cell] ^= 1 << this.suspect;
      return;
    }

    const here = this.occupant[cell];
    if (here === this.suspect) {
      this.occupant[cell] = NO_ONE;
      this.announcement = `${this.#name(this.suspect)} ${this.#agreed(this.suspect, 'retiré')}.`;
      return;
    }
    // Quelqu'un ne peut être qu'à un endroit : le poser ailleurs l'y enlève.
    const previous = this.cellOf(this.suspect);
    if (previous !== -1) this.occupant[previous] = NO_ONE;
    this.occupant[cell] = this.suspect;
    this.announcement = `${this.#name(this.suspect)} ${this.#agreed(this.suspect, 'placé')}.`;
  }

  undo(): void {
    const previous = this.#history.pop();
    if (previous === undefined) return;
    this.occupant = previous.occupant;
    this.pencil = previous.pencil;
    this.crossed = previous.crossed;
    this.verdict = null;
    this.hintTier = 0;
  }

  get canUndo(): boolean {
    return this.#history.length > 0;
  }

  /**
   * La validation, faite **contre les indices** et non contre le corrigé.
   *
   * C'est la différence qui compte. Comparer au corrigé ne sait dire que
   * « trois erreurs », ce qui n'enseigne rien et laisse deviner la forme de la
   * solution. Relire les indices dit **lequel** est contredit — le joueur
   * retourne à une carte précise, et l'application n'a rien révélé qu'il ne
   * pouvait déduire.
   *
   * Et comme l'affaire n'admet qu'une solution, satisfaire tous les indices
   * **est** la résoudre : il n'y a pas de second chemin qui passerait ici par
   * accident.
   */
  check(): Verdict {
    const puzzle = this.puzzle;
    const file = this.file;
    if (puzzle === null || file === null) return { kind: 'incomplete', missing: 0 };

    if (!this.complete) {
      const missing = puzzle.suspects.length - this.placedCount;
      this.verdict = { kind: 'incomplete', missing };
      this.announcement = `Il reste ${String(missing)} personne${missing > 1 ? 's' : ''} à placer.`;
      return this.verdict;
    }

    const at = puzzle.suspects.map((suspect) => this.cellOf(suspect.index));
    const broken = file.clues.flatMap((clue, index) =>
      holds(clue, puzzle.scene, at) ? [] : [index],
    );

    if (broken.length > 0) {
      this.verdict = { kind: 'contradicted', clues: broken };
      this.announcement = `${String(broken.length)} indice${broken.length > 1 ? 's' : ''} contredit${broken.length > 1 ? 's' : ''}.`;
      return this.verdict;
    }

    const murderer = murdererOf(puzzle.scene, at, file.victim);
    this.verdict = { kind: 'solved', murderer };
    this.announcement = `Affaire résolue. Le meurtrier est ${this.#name(murderer)}.`;

    /*
      Le chronomètre s'arrête ici, et la partie n'est comptée qu'une fois. On
      valide volontiers deux fois de suite pour relire le verdict ; deux entrées
      d'historique pour une seule enquête fausseraient tout ce qui s'en déduit.
    */
    if (!this.#recorded) {
      this.#recorded = true;
      this.clock.pause();
      this.onSolved?.(this.toRecord());
    }
    return this.verdict;
  }

  /**
   * La partie terminée, sous la forme qui se range.
   *
   * `recordableMs()` rend `null` quand le chronomètre doute de lui-même — et
   * c'est ce `null` qui voyage, jamais une durée rattrapée au jugé. La règle est
   * celle du sudoku : une durée non mesurable n'est pas approximée.
   */
  toRecord(): CaseRecord {
    const file = this.file;
    if (file === null) throw new Error('aucune affaire à enregistrer');
    return {
      code: encodeCase(file),
      finishedAt: Date.now(),
      day: this.startedOn,
      daily: this.daily,
      durationMs: this.clock.recordableMs(),
      hintsShown: this.hintsShown,
      hardest: file.hardest,
      stepCount: file.stepCount,
      registryVersion: file.registryVersion,
    };
  }

  /**
   * La prochaine déduction possible **depuis l'état du joueur**.
   *
   * Elle n'est pas rangée avec l'affaire : elle se recalcule à chaque fois, à
   * partir de ce qui est posé sur le plan. C'est ce qui la rend incapable de se
   * désynchroniser — défaut structurel d'un jeu dont les aides sont rédigées une
   * par une, à côté de la grille.
   */
  get hint(): Step | null {
    const path = this.#path();
    return path === null || path.steps.length === 0 ? null : path.steps[0];
  }

  /**
   * Les placements du joueur rendent-ils l'affaire impossible ?
   *
   * Le dire vaut mieux que proposer une déduction dans un monde qui n'existe
   * pas. L'aide ne révèle pas pour autant **où** est la faute : la validation
   * s'en charge, en nommant l'indice contredit.
   */
  get stuck(): boolean {
    return this.#path()?.contradicted ?? false;
  }

  #path(): Deduction | null {
    const puzzle = this.puzzle;
    if (puzzle === null) return null;
    return deduce(
      puzzle,
      puzzle.suspects.map((suspect) => this.cellOf(suspect.index)),
    );
  }

  revealMore(): void {
    if (this.hintTier < 3) {
      this.hintTier = (this.hintTier + 1) as HintTier;
      // On compte ce que le joueur a **demandé**, pas ce qu'il a lu : c'est le
      // geste qui est observable, l'attention ne l'est pas.
      this.hintsShown++;
    }
  }

  hideHint(): void {
    this.hintTier = 0;
  }

  #remember(): void {
    this.#history.push({
      occupant: [...this.occupant],
      pencil: [...this.pencil],
      crossed: [...this.crossed],
    });
    // Une pile sans borne finit par peser plus que la partie elle-même.
    if (this.#history.length > 200) this.#history.shift();
  }

  #name(suspect: number): string {
    const person = this.puzzle?.suspects[suspect];
    return person === undefined ? '' : `${person.name} (${person.letter})`;
  }

  /**
   * L'accord du participe. « Adèle placé » se lit mal et s'entend plus mal
   * encore : l'annonce passe par une région vivante, donc par une voix de
   * synthèse. Le moteur accorde déjà ses indices ; l'interface doit suivre.
   */
  #agreed(suspect: number, word: string): string {
    return this.puzzle?.suspects[suspect].gender === 'f' ? `${word}e` : word;
  }
}
