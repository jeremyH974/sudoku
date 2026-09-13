/**
 * Produire un cahier, pièce à pièce, avec un arrêt qui répond.
 *
 * ─── Pourquoi cette boucle sort des deux studios ────────────────────────────
 *
 * Les deux cahiers — grilles de sudoku, dossiers d'enquête — enchaînaient la
 * même boucle, écrite deux fois : compter, appeler le moteur, ramasser ce qui
 * revient, relire un drapeau d'arrêt, tenir la progression. Dupliquée, elle
 * n'était testée nulle part : le studio de l'enquête n'avait pas de test, celui
 * du sudoku n'en avait aucun non plus, et pour une raison mécanique — un
 * composant qui appelle le moteur ne se monte pas sans Web Worker.
 *
 * Extraite, elle se vérifie sans navigateur, sans worker et sans moteur : sa
 * fabrique est un paramètre. C'est le même mouvement que `plan.ts` à l'incrément
 * 18, où la géométrie des murs est sortie de la vue pour que l'écran et le
 * papier la partagent.
 *
 * ─── Ce que cette fonction décide, et qui n'est pas évident ──────────────────
 *
 * **Ce qui a été produit avant l'échec est rendu.** Une exception au milieu du
 * cahier ne jette pas les pièces déjà faites : elles remontent avec le message
 * de l'échec, et l'appelant montre les deux. Le studio de l'enquête ne le
 * faisait pas — il gardait silencieusement l'aperçu précédent — et c'est le
 * défaut que cette extraction corrige des deux côtés à la fois.
 *
 * **Un arrêt demandé pendant un échec se lit comme un arrêt.** Si la fabrique
 * lève au moment même où l'on demande l'arrêt, on rapporte l'arrêt et non
 * l'échec : l'utilisateur a demandé que cela s'arrête, et cela s'est arrêté. La
 * course est invraisemblable ; la trancher dans ce sens évite un message
 * d'erreur pour une action volontaire.
 */

export interface BatchOptions<T> {
  /** Nombre de pièces demandé. */
  readonly count: number;
  /** Produit la pièce d'indice donné, ou `null` si la fabrique n'a rien rendu. */
  readonly make: (index: number) => Promise<T | null>;
  /**
   * Relu **avant chaque pièce** : vrai si l'on a demandé l'arrêt.
   *
   * Un prédicat plutôt qu'un signal, parce que le seul moyen d'arrêter un
   * travailleur au milieu d'un calcul synchrone est de le tuer — voir
   * `engineClient.ts`. Le prédicat dit *ce que l'utilisateur veut* ; la façon de
   * l'obtenir vite appartient au client du moteur.
   */
  readonly stopped: () => boolean;
  /** Appelé après chaque tentative terminée, avec leur nombre. */
  readonly onAttempt: (attempted: number) => void;
}

export interface BatchResult<T> {
  /** Ce qui a été produit — y compris quand la boucle s'est arrêtée ou a échoué. */
  readonly items: readonly T[];
  /** Tentatives terminées. Inférieur à `count` si l'on a arrêté ou échoué. */
  readonly attempted: number;
  /** Vrai si la boucle a été écourtée par une demande d'arrêt. */
  readonly stopped: boolean;
  /** Message de l'exception qui a interrompu la boucle, ou `null`. */
  readonly failure: string | null;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function runBatch<T>(options: BatchOptions<T>): Promise<BatchResult<T>> {
  const items: T[] = [];
  let attempted = 0;
  let stopped = false;

  try {
    for (let index = 0; index < options.count; index++) {
      if (options.stopped()) {
        stopped = true;
        break;
      }
      const item = await options.make(index);
      attempted = index + 1;
      options.onAttempt(attempted);
      if (item !== null) items.push(item);
    }
  } catch (error) {
    /*
      Tuer le travailleur fait **rejeter** la requête en vol : un arrêt arrive
      donc ici, pas au tour de boucle suivant. C'est ce que `stopped()` tranche.
    */
    if (options.stopped()) return { items, attempted, stopped: true, failure: null };
    return { items, attempted, stopped: false, failure: messageOf(error) };
  }

  return { items, attempted, stopped, failure: null };
}
