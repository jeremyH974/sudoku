/**
 * Quand appliquer une nouvelle version : à l'ouverture, jamais sous les doigts.
 *
 * ─── Pourquoi ce module existe ──────────────────────────────────────────────
 *
 * Jusqu'ici, une nouvelle version attendait qu'on clique « Actualiser » sur une
 * bannière. C'était la règle du projet — ne jamais recharger la page sous les
 * doigts de quelqu'un en train de résoudre une grille — appliquée trop
 * largement : à la mise en ligne, une correction d'impression publiée et
 * vérifiée n'atteignait pas celui qui l'avait demandée, parce que la bannière
 * était passée inaperçue. Un rechargement ordinaire n'y change rien : le
 * service worker en place continue de servir l'ancienne version.
 *
 * La règle garde son sens ; on la resserre sur ce qu'elle protège, **une
 * partie qu'on est en train de jouer**. Tant que la page vient de s'ouvrir et
 * que personne n'y a touché, basculer sur la nouvelle version ne coûte qu'un
 * rechargement éclair. Dès le premier geste, on revient à la bannière.
 *
 * ─── Le garde-fou ───────────────────────────────────────────────────────────
 *
 * Une bascule recharge la page. Si, pour une raison qu'on ne voit pas, la page
 * rechargée annonçait encore une version en attente, elle rebasculerait, et
 * ainsi de suite. On note donc l'heure de la bascule pour l'onglet — le
 * stockage de session survit au rechargement, pas à la fermeture — et on ne
 * rebascule pas avant une minute. Sans stockage, pas de garde-fou possible :
 * on revient à la bannière plutôt que de risquer une boucle.
 */

export type UpdateDecision = 'apply' | 'offer';

type SessionStore = Pick<Storage, 'getItem' | 'setItem'>;

/** Les gestes qui font d'une page « ouverte » une page « en usage ». */
const INTERACTIONS = ['pointerdown', 'keydown', 'wheel'] as const;

const APPLIED_AT_KEY = 'sudoku.update-applied-at';

/** En deçà, une seconde bascule serait une boucle, pas une mise à jour. */
export const LOOP_GUARD_MS = 60_000;

export interface UpdatePolicyOptions {
  /** Là où l'on écoute les gestes : la fenêtre, sauf dans les tests. */
  readonly target?: EventTarget;
  /** Le stockage de session, ou `null` s'il est inaccessible. */
  readonly storage?: SessionStore | null;
  readonly now?: () => number;
}

export interface UpdatePolicy {
  /** Une nouvelle version attend : l'appliquer tout de suite, ou la proposer ? */
  decide(): UpdateDecision;
}

function sessionStoreOrNull(): SessionStore | null {
  try {
    return window.sessionStorage;
  } catch {
    // Navigation privée stricte : le seul fait d'y accéder lève.
    return null;
  }
}

export function createUpdatePolicy(options: UpdatePolicyOptions = {}): UpdatePolicy {
  const target = options.target ?? window;
  const storage = options.storage === undefined ? sessionStoreOrNull() : options.storage;
  const now = options.now ?? (() => Date.now());

  let touched = false;
  const markTouched = (): void => {
    touched = true;
  };
  for (const type of INTERACTIONS) {
    target.addEventListener(type, markTouched, { capture: true, once: true, passive: true });
  }

  return {
    decide(): UpdateDecision {
      if (touched || storage === null) return 'offer';
      try {
        const last = Number(storage.getItem(APPLIED_AT_KEY));
        if (last > 0 && now() - last < LOOP_GUARD_MS) return 'offer';
        storage.setItem(APPLIED_AT_KEY, String(now()));
        return 'apply';
      } catch {
        // Le stockage refuse l'écriture : sans garde-fou, pas de bascule.
        return 'offer';
      }
    },
  };
}
