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

  Les tests qui ont besoin d'un DOM — monter un composant et le soumettre à axe,
  ou vérifier qu'un réglage pose bien son attribut sur la racine — portent le
  suffixe `.a11y.test.ts` ou `.dom.test.ts`, de sorte que le nom du fichier dise
  dans quel monde il vit tout en restant à côté de ce qu'il vérifie.

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
          // exclusion, ces tests tourneraient deux fois, dont une sans DOM.
          exclude: ['packages/app/src/**/*.{a11y,dom}.test.ts'],
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
          name: 'dom',
          environment: 'jsdom',
          include: ['packages/app/src/**/*.{a11y,dom}.test.ts'],
          /*
            Vingt secondes, et c'est une propriété de **l'environnement**, pas un
            pansement sur un test lent.

            Ce projet-ci paie deux choses qu'aucun test du moteur ne paie : le
            démarrage d'un jsdom par fichier, et la compilation Svelte de tout ce
            que le fichier importe. Vitest chiffre lui-même la seconde à 40 à
            84 secondes par passe, refaite à chaque exécution — et la variation
            est telle que le premier test d'un fichier, s'il déclenche un import
            dynamique à froid, dépasse les cinq secondes du défaut une passe sur
            deux. Mesuré : `textSize.dom.test.ts` et `theme.dom.test.ts` tombent
            ensemble, toujours sur leur premier test, jamais sur une assertion.

            ⚠ À ne pas confondre avec le délai supprimé à l'incrément 17. Celui-là
            masquait un **générateur lent**, et la vraie correction a été de le
            rendre rapide. Ici rien du produit n'est lent : composer une affaire
            tient en 19 ms au médian. C'est l'outillage qui coûte, et un délai
            calé sur l'outillage est le bon endroit pour le dire.

            Si ce nombre devait remonter, ce serait le signe qu'un fichier
            importe trop — et c'est cela qu'il faudrait corriger, pas le délai.
          */
          testTimeout: 20_000,
        },
      },
    ],
  },
});
