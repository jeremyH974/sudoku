/**
 * Les aides visuelles pendant la partie, chacune désactivable.
 *
 * ─── Pourquoi ce réglage existe ─────────────────────────────────────────────
 *
 * Le premier regard extérieur, à la mise en ligne, a buté dessus : poser un
 * « 1 » faisait s'allumer d'autres « 1 », et un chiffre imprimé passait en
 * orange — on croyait que l'application écrivait dans la grille. Elle ne fait
 * que surligner ; mais une aide qu'on ne peut pas éteindre est une aide
 * imposée, et les concurrents les proposent toutes en interrupteurs.
 *
 * ─── Ce qu'une aide change, et ce qu'elle ne change pas ─────────────────────
 *
 * Elles ne touchent que l'affichage. La partie calcule toujours ses conflits —
 * c'est ce qui décide qu'une grille est terminée — et compte toujours ses
 * erreurs — c'est ce que retiennent les statistiques. Éteindre une aide ne
 * fausse donc aucun chiffre de l'onglet Progression. Un indice, lui, reste une
 * demande explicite : il signale un conflit même quand le surlignage est éteint.
 *
 * Le modèle est celui de `textSize.svelte.ts` : tout accès au stockage sous
 * `try`, et l'état par défaut — tout activé, le comportement historique — n'est
 * pas écrit. Seule une préférence qui s'en écarte l'est.
 */

export type AssistId = 'sameValue' | 'peers' | 'conflicts' | 'mistakes';

export interface AssistOption {
  readonly id: AssistId;
  readonly label: string;
}

export const ASSIST_OPTIONS: readonly AssistOption[] = [
  { id: 'sameValue', label: 'Surligner les chiffres identiques' },
  { id: 'peers', label: 'Surligner la ligne, la colonne et le bloc' },
  { id: 'conflicts', label: 'Signaler les conflits' },
  { id: 'mistakes', label: 'Compter les erreurs de saisie' },
];

type AssistState = Record<AssistId, boolean>;

const STORAGE_KEY = 'sudoku.assists';

const ALL_ON: AssistState = { sameValue: true, peers: true, conflicts: true, mistakes: true };

function readStored(): AssistState {
  const state = { ...ALL_ON };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return state;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return state;
    const stored = parsed as Partial<Record<string, unknown>>;
    for (const { id } of ASSIST_OPTIONS) {
      // Seul un booléen compte. Une valeur abîmée retombe sur « activée » : une
      // préférence illisible ne doit jamais éteindre une aide en silence.
      const value = stored[id];
      if (typeof value === 'boolean') state[id] = value;
    }
  } catch {
    // Stockage indisponible ou illisible : les aides restent activées.
  }
  return state;
}

function persist(state: AssistState): void {
  try {
    if (ASSIST_OPTIONS.every(({ id }) => state[id])) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Le choix ne survivra pas au rechargement ; la session reste correcte.
  }
}

class AssistsStore {
  sameValue = $state(true);
  peers = $state(true);
  conflicts = $state(true);
  mistakes = $state(true);

  constructor() {
    const stored = readStored();
    this.sameValue = stored.sameValue;
    this.peers = stored.peers;
    this.conflicts = stored.conflicts;
    this.mistakes = stored.mistakes;
  }

  /** Nombre d'aides activées : le résumé que montre le panneau replié. */
  get enabledCount(): number {
    return ASSIST_OPTIONS.filter(({ id }) => this[id]).length;
  }

  set(id: AssistId, enabled: boolean): void {
    this[id] = enabled;
    persist({
      sameValue: this.sameValue,
      peers: this.peers,
      conflicts: this.conflicts,
      mistakes: this.mistakes,
    });
  }
}

export const assists = new AssistsStore();
