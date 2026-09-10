import axe from 'axe-core';

/**
 * Passe un fragment de page au crible d'axe et échoue en français.
 *
 * ─── Ce que cette vérification couvre, et ce qu'elle ne couvre pas ──────────
 *
 * Un DOM simulé ne calcule **aucune mise en page** : pas de position, pas de
 * taille, pas de couleur effective. axe y voit donc les rôles, les noms
 * accessibles, l'ordre des titres, les repères, les libellés de formulaire et la
 * validité ARIA — et **ne voit ni le contraste, ni la taille des cibles
 * tactiles**, qui sont pourtant deux exigences écrites du projet.
 *
 * Ces deux-là se mesurent à la main, et les mesures sont consignées dans le
 * README. Une exécution verte ici ne vaut pas mesure : c'est exactement le
 * traitement déjà réservé à l'impression, « manuel et assumé ».
 *
 * `vitest-axe` aurait fourni un `toHaveNoViolations` tout fait. Quinze lignes
 * évitent une dépendance de plus, et permettent au message d'échec d'être dans
 * la langue du projet.
 */
export async function expectNoViolations(
  container: Element,
  options: axe.RunOptions = {},
): Promise<void> {
  const results = await axe.run(container, options);
  if (results.violations.length === 0) return;

  const details = results.violations
    .map((violation) => {
      const nodes = violation.nodes.map((node) => `      ${node.html}`).join('\n');
      return `  • ${violation.id} — ${violation.help}\n${nodes}`;
    })
    .join('\n');

  throw new Error(
    `axe relève ${String(results.violations.length)} manquement(s) à l’accessibilité :\n${details}`,
  );
}

/**
 * Restreint l'analyse aux règles qui ont un sens sans mise en page.
 *
 * Utile quand on veut cibler une famille précise — la structure des titres et
 * des repères, par exemple — sans faire dépendre le test de l'ensemble du
 * catalogue d'axe, qui grossit d'une version à l'autre.
 */
export const only = (...rules: string[]): axe.RunOptions => ({
  runOnly: { type: 'rule', values: rules },
});
