import type { PropId } from '@sudoku/engine/investigation';

/**
 * Le mobilier de la scène, dessiné.
 *
 * ─── Pourquoi ce n'est pas dans `icons.ts` ──────────────────────────────────
 *
 * `icons.ts` dit « huit icônes, aucune de plus », et la règle est bonne : une
 * icône d'interface remplace un glyphe qui existait, elle ne s'ajoute pas à un
 * bouton qui a déjà son libellé. Le mobilier n'est pas de l'interface — c'est le
 * **contenu** de la scène, le sujet même des indices. Il a donc son propre
 * vocabulaire, ici, et son propre budget.
 *
 * ─── Le dessin ne porte jamais seul ─────────────────────────────────────────
 *
 * Ces tracés sont **masqués aux lecteurs d'écran**. Ce que la case contient est
 * dit en toutes lettres dans son nom accessible — « Salon, chaise, tapis » — et
 * le dessin n'en est qu'un rappel visuel. C'est la même discipline que les
 * marques de candidats du sudoku : la couleur et la forme rappellent, le texte
 * porte.
 *
 * Même grille de 24 et même trait de 2 à bouts ronds que les icônes, pour que
 * la scène et l'interface aient la même main.
 */

export interface FurniturePart {
  readonly d: string;
  /** `soft` teinte la surface au lieu de la cercler ; `thin` allège le trait. */
  readonly paint?: 'soft' | 'thin';
}

/**
 * Les meubles, **vus de dessus**.
 *
 * La première version les dessinait de profil — une chaise avec un dossier, une
 * lampe avec son abat-jour. Vu à l'écran, c'était faux : le plateau est un
 * **plan**, et sur un plan on regarde une pièce d'en haut. La lampe de profil
 * se lisait comme une flèche, et la chaise comme une boîte.
 *
 * De dessus, chaque meuble prend une silhouette qui ne ressemble à aucune
 * autre : carré à barre (chaise), ovale (table), grand rectangle bordé (tapis),
 * bande divisée le long du mur (étagère), disque à feuillage (plante), anneau
 * (lampe). C'est la silhouette qui distingue, pas la teinte — le plan reste
 * lisible en noir et blanc.
 */
export const FURNITURE: Readonly<Record<PropId, readonly FurniturePart[]>> = {
  /* Chaise : l'assise, et la barre du dossier d'un côté. */
  chair: [
    { d: 'M7 9h10v9H7z', paint: 'soft' },
    { d: 'M6 6h12v3H6z', paint: 'soft' },
    { d: 'M7 9h10v9H7zM6 6h12v3H6z' },
  ],
  /* Table ronde : la seule forme ovale du plan. */
  table: [
    { d: 'M20 12a8 5 0 1 1-16 0 8 5 0 0 1 16 0z', paint: 'soft' },
    { d: 'M20 12a8 5 0 1 1-16 0 8 5 0 0 1 16 0z' },
  ],
  /* Tapis : un grand rectangle, et sa bordure tissée. */
  rug: [
    { d: 'M3 6h18v12H3z', paint: 'soft' },
    { d: 'M3 6h18v12H3z' },
    { d: 'M6 9h12v6H6z', paint: 'thin' },
  ],
  /* Étagère : une bande adossée au mur, compartimentée. */
  shelf: [
    { d: 'M3 4h18v6H3z', paint: 'soft' },
    { d: 'M3 4h18v6H3z' },
    { d: 'M9 4v6M15 4v6', paint: 'thin' },
  ],
  /*
    Plante : une rosette — le feuillage vu d'aplomb, et le pot au centre.
    Dessinée d'abord comme un pot surmonté de deux feuilles, elle se lisait
    comme un visage : deux oreilles au-dessus d'une tête ronde. Vue de dessus,
    une plante est un disque à nervures, et plus rien n'y ressemble.
  */
  plant: [
    { d: 'M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0z', paint: 'soft' },
    { d: 'M12 5v14M5 12h14M7.1 7.1l9.8 9.8M16.9 7.1L7.1 16.9', paint: 'thin' },
    { d: 'M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0z' },
  ],
  /* Lampe : un petit disque et son halo, en rayons détachés. */
  lamp: [
    { d: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', paint: 'soft' },
    { d: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z' },
    { d: 'M12 4v3M12 17v3M4 12h3M17 12h3', paint: 'thin' },
  ],
};

/**
 * Le nom français d'un meuble, au singulier.
 *
 * Il est **redit** ici bien que le moteur le connaisse, et c'est délibéré :
 * `PROPS` du moteur porte de quoi construire une phrase — genre, article,
 * « assis sur » — là où l'interface n'a besoin que d'une étiquette dans un nom
 * accessible. Importer la phrase pour n'en garder qu'un mot ferait dépendre
 * l'écran de détails de grammaire qui ne le concernent pas.
 */
export const FURNITURE_LABEL: Readonly<Record<PropId, string>> = {
  chair: 'chaise',
  table: 'table',
  rug: 'tapis',
  plant: 'plante',
  shelf: 'étagère',
  lamp: 'lampe',
};
