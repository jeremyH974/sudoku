import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    // Pas de `customElement` ici, et c'est deliberé : compiler en Custom
    // Element place chaque composant dans un shadow root, or les references
    // ARIA (aria-labelledby, aria-describedby, label for) ne traversent pas la
    // frontiere du shadow DOM. Ce serait en conflit direct avec l'accessibilite
    // de la grille. L'encapsulation pour embarquer le jeu dans un site tiers se
    // fera le moment venu, par UN SEUL element racine, pas composant par composant.
  },
};
