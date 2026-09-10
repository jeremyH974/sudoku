import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/*
  Deux mondes, énoncés séparément.

  Les tests du moteur, de la logique de partie et des agrégats tournent en Node,
  **sans DOM**. Ce n'est pas un effet de bord de la configuration par défaut :
  c'est le garde-fou qui empêche `packages/engine` de dépendre du navigateur.
  D'où `environment: 'node'` écrit noir sur blanc — un `jsdom` posé un jour à la
  racine contaminerait sinon tout, silencieusement, exactement comme la perte de
  `types: []` avait rendu le garde-fou du moteur inopérant sans que rien ne casse.

  Les tests d'accessibilité, eux, ont besoin d'un DOM pour monter un composant et
  le soumettre à axe. Ils portent le suffixe `.a11y.test.ts`, de sorte que le nom
  du fichier dise dans quel monde il vit, tout en restant à côté du composant
  qu'il vérifie.

  Ce que ce second projet ne peut pas vérifier, et qui doit rester dit ici comme
  dans le README : aucun DOM simulé ne calcule de mise en page. axe y voit les
  rôles, les noms accessibles, l'ordre des titres et la validité ARIA ; il ne
  voit **ni le contraste ni la taille des cibles tactiles**. Ces deux règles se
  vérifient à la main, et une CI verte ne vaut pas mesure.
*/
export default defineConfig({
  // Le plugin Svelte sert a compiler les fichiers `*.svelte.ts` : la logique de
  // partie vit dans une classe a runes, et elle merite d'etre testee au meme
  // titre que le moteur.
  plugins: [svelte({ configFile: false })],
  test: {
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['packages/*/src/**/*.test.ts'],
          // `foo.a11y.test.ts` satisfait aussi `*.test.ts` : sans cette
          // exclusion, les tests d'accessibilité tourneraient deux fois, dont
          // une sans DOM.
          exclude: ['packages/app/src/**/*.a11y.test.ts'],
        },
      },
      {
        extends: true,
        resolve: {
          // Monter un composant Svelte exige la version navigateur du runtime ;
          // sans cette condition, l'import résout vers le rendu serveur, qui ne
          // produit pas de DOM vivant.
          conditions: ['browser'],
          alias: {
            // `virtual:pwa-register` est fabriqué par vite-plugin-pwa, absent
            // ici. Voir la doublure pour ce qu'elle ne prétend pas faire.
            'virtual:pwa-register': fileURLToPath(
              new URL('./packages/app/src/test/pwa-register-stub.ts', import.meta.url),
            ),
          },
        },
        test: {
          name: 'a11y',
          environment: 'jsdom',
          include: ['packages/app/src/**/*.a11y.test.ts'],
        },
      },
    ],
  },
});
