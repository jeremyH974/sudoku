import { flushSync, mount, unmount } from 'svelte';
import type { Component } from 'svelte';

/**
 * Monter un composant Svelte dans un DOM simulé, sans bibliothèque tierce.
 *
 * `mount`, `unmount` et `flushSync` sont l'API publique de Svelte 5 : une
 * enveloppe de vingt lignes que nous maîtrisons vaut mieux qu'une dépendance de
 * plus à suivre à chaque version majeure de Vitest. Si le pilotage des effets
 * devenait pénible, `@testing-library/svelte` reste ajoutable sans rien
 * réécrire ici.
 *
 * Le conteneur est **attaché au document** : axe refuse d'analyser un nœud
 * détaché, et plusieurs règles ARIA n'ont de sens que dans un document complet.
 */
export interface Rendered {
  readonly container: HTMLElement;
  /** Force le traitement des effets en attente après une interaction. */
  flush(): void;
  destroy(): void;
}

export function render<Props extends Record<string, unknown>>(
  component: Component<Props>,
  props: Props,
): Rendered {
  const container = document.createElement('div');
  document.body.append(container);

  const instance = mount(component, { target: container, props });
  flushSync();

  return {
    container,
    flush(): void {
      flushSync();
    },
    destroy(): void {
      void unmount(instance);
      container.remove();
    },
  };
}

/** Vide le document entre deux tests : axe compte les identifiants en double. */
export function resetDocument(): void {
  document.body.replaceChildren();
}
