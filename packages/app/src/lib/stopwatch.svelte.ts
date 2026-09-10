/**
 * Chronomètre d'une partie.
 *
 * ─── Accumuler des segments, jamais soustraire deux instants ────────────────
 *
 * La forme naïve garde l'instant de départ et calcule `maintenant − départ`.
 * Elle a un défaut fatal ici : une partie se reprend le lendemain. La sauvegarde
 * porterait un horodatage vieux de quatorze heures, et le joueur découvrirait
 * une partie de quatorze heures.
 *
 * On accumule donc des **segments** : chaque passage au premier plan ouvre un
 * segment, chaque passage en arrière-plan le referme et ajoute sa durée à un
 * total. **Seul ce total est persisté.** L'instant d'ouverture du segment en
 * cours ne l'est jamais — il n'a de sens que dans la session qui l'a produit.
 * La reprise du lendemain fonctionne alors par construction, sans code dédié.
 *
 * ─── `performance.now()` et non `Date.now()` ────────────────────────────────
 *
 * L'horloge système peut reculer : changement d'heure, resynchronisation NTP,
 * réglage manuel. Un segment mesuré avec `Date.now()` peut donc être négatif.
 * `performance.now()` est monotone et immunisée contre tout cela.
 *
 * À ne pas confondre avec le choix inverse fait dans le moteur
 * (`generate/targeted.ts`), où la contrainte est de ne dépendre d'aucun global
 * d'environnement. Ici la contrainte est la monotonie. Deux contraintes
 * opposées, deux choix opposés : ce n'est pas une incohérence à « harmoniser ».
 *
 * Contrepartie assumée : `performance.now()` repart de zéro à chaque chargement
 * de document. C'est sans conséquence, précisément parce qu'on n'en persiste
 * jamais une valeur.
 *
 * ─── Ce qu'une pause ne sait pas rattraper ──────────────────────────────────
 *
 * L'onglet reste visible, et le joueur part déjeuner. Aucun événement du
 * navigateur ne le signale. Plutôt que d'inventer une durée, on **constate que
 * la mesure n'est plus fiable** : au-delà d'un segment de 30 minutes ou d'un
 * total de 2 heures, `trustworthy` tombe à `false` et la partie sera enregistrée
 * **sans durée**.
 *
 * C'est le même geste que celui du moteur envers la difficulté : une grille que
 * le registre ne sait pas résoudre ne reçoit *aucun* niveau, plutôt qu'un niveau
 * approximatif. Une partie dont la durée n'est pas mesurable ne reçoit aucune
 * durée.
 */

/** Au-delà, le segment n'est plus du temps de jeu mais du temps d'absence. */
const MAX_SEGMENT_MS = 30 * 60_000;
/** Au-delà, la partie a manifestement été laissée ouverte. */
const MAX_TOTAL_MS = 2 * 60 * 60_000;

export class Stopwatch {
  /** Temps de jeu connu, en millisecondes. Rafraîchi par `sample()`. */
  elapsedMs = $state<number>(0);
  running = $state<boolean>(false);
  /**
   * `false` dès qu'un segment invraisemblable a été rencontré. La durée reste
   * affichée — le joueur voit ce que le chronomètre a compté — mais elle ne
   * sera pas enregistrée dans l'historique.
   */
  trustworthy = $state<boolean>(true);

  /** Total des segments refermés. `elapsedMs` en découle. */
  #closed = 0;
  /** Ouverture du segment en cours, sur l'horloge monotone. Jamais persisté. */
  #openedAt: number | null = null;
  readonly #now: () => number;

  /**
   * L'horloge est injectable : c'est ce qui rend les cas limites testables par
   * simple appel, sans manipuler l'heure du système sous les pieds de Vitest.
   */
  constructor(now: () => number = () => performance.now()) {
    this.#now = now;
  }

  /** Ouvre un segment. Sans effet si un segment est déjà ouvert. */
  start(): void {
    if (this.#openedAt !== null) return;
    this.#openedAt = this.#now();
    this.running = true;
  }

  /** Referme le segment en cours et fige le total. */
  pause(): void {
    this.#close();
    this.running = false;
  }

  /**
   * Rafraîchit `elapsedMs` sans interrompre le segment.
   *
   * Appelé par l'interface à intervalle régulier : c'est ce qui fait avancer
   * l'affichage. Le chronomètre ne possède pas de minuterie à lui — un module
   * qui installe un `setInterval` est un module qu'on ne peut pas tester sans
   * DOM, et qui fuit si personne ne l'arrête.
   */
  sample(): void {
    this.elapsedMs = this.#closed + this.#openSegment();
  }

  /** Repart de zéro, ou d'un total repris d'une sauvegarde. */
  reset(seedMs = 0): void {
    this.#closed = Math.max(0, Math.round(seedMs));
    this.#openedAt = null;
    this.running = false;
    this.trustworthy = this.#closed <= MAX_TOTAL_MS;
    this.elapsedMs = this.#closed;
  }

  /** Durée à enregistrer : `null` quand la mesure n'est pas fiable. */
  recordableMs(): number | null {
    return this.trustworthy ? this.elapsedMs : null;
  }

  #close(): void {
    const segment = this.#openSegment();
    this.#openedAt = null;
    this.#closed += segment;
    this.elapsedMs = this.#closed;
    if (this.#closed > MAX_TOTAL_MS) this.trustworthy = false;
  }

  /**
   * Durée du segment ouvert, bornée.
   *
   * Un delta négatif compte pour zéro : `performance.now()` ne recule pas, mais
   * une horloge injectée en test le peut, et l'invariant « une durée ne diminue
   * jamais » vaut mieux d'être tenu ici qu'espéré partout ailleurs.
   */
  #openSegment(): number {
    if (this.#openedAt === null) return 0;
    const delta = this.#now() - this.#openedAt;
    if (delta <= 0) return 0;
    if (delta > MAX_SEGMENT_MS) {
      this.trustworthy = false;
      return MAX_SEGMENT_MS;
    }
    return delta;
  }
}
