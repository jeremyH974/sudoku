/**
 * Où mène une adresse arrivée sur l'accueil.
 *
 * ─── La règle qui sauve les cahiers déjà imprimés ───────────────────────────
 *
 * Chaque cahier imprimé porte des QR codes qui encodent l'adresse d'où le
 * studio a été ouvert, suivie du code de la grille : `…/sudoku/#g=…`. Or cette
 * adresse est devenue celle de **l'accueil**, qui ne sait pas jouer une grille.
 * Sans renvoi, tous les cahiers déjà sortis de l'imprimante cessent de
 * fonctionner — et rien à l'écran ne dirait pourquoi.
 *
 * Le même renvoi couvre le déménagement vers un nom de domaine : GitHub
 * redirige l'ancienne adresse en conservant le chemin, et le navigateur
 * rattache le fragment.
 *
 * C'est une fonction pure parce que c'est ainsi qu'elle se teste : un test qui
 * devrait piloter `window.location` ne vérifierait plus la règle mais le
 * navigateur.
 */

/** La section qui sait jouer une grille encodée. */
const SUDOKU = 'sudoku/';

/**
 * L'adresse vers laquelle renvoyer, ou `null` s'il n'y a rien à renvoyer.
 *
 * Seul `#g=` est reconnu : c'est le seul fragment que le produit émette. Un
 * fragment inconnu reste sur l'accueil plutôt que d'être deviné.
 */
export function forwardedFrom(hash: string, baseUrl: string): string | null {
  if (!/^#g=.+/.test(hash)) return null;
  return `${baseUrl}${SUDOKU}${hash}`;
}
