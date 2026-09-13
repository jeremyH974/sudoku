<script lang="ts">
  import type { Suspect } from '@sudoku/engine/investigation';

  interface Props {
    suspect: Suspect;
  }

  const { suspect }: Props = $props();
  const stem = $derived(`${import.meta.env.BASE_URL}portraits/${suspect.letter.toLowerCase()}`);

  /*
    ─── Pourquoi ce portrait n'est plus dessiné en SVG ────────────────────────

    Il l'a été, en vingt-six tracés écrits à la main, et c'était le bon choix
    tant que le dessin restait plat et géométrique. La mesure a dit où ça
    s'arrête : vingt-six tracés, c'est **exactement** le compte d'avataaars
    (28), plafond relevé du genre « avatar plat ». Une illustration vectorielle
    réellement détaillée pèse 84,5 ko — vingt fois le budget admis pour un SVG
    en ligne — et sur un dessin rendu l'avantage du vectoriel s'inverse : un cas
    mesuré donne 68 fois plus lourd qu'un JPG.

    Aucun produit connu ne livre seize illustrations à ce niveau en SVG en
    ligne. Ceux qui en livrent seize restent plats **exprès**.

    Le vectoriel n'a pas perdu partout pour autant : le **plan** de la scène
    reste dessiné, parce que l'aplat géométrique est précisément là où il gagne.

    ─── Les mesures qui ont fixé le fichier ───────────────────────────────────

      · **224 px de côté**, calculé et non arrondi au jugé. La carte fait
        3,5 rem ; le réglage « très grand » porte la racine à 125 %, donc 70 px ;
        à densité 3 il faut 210 px. 224 les couvre et garde un peu de marge.
      · **AVIF q75 en 4:4:4**, WebP q80 en repli — pesé sur les seize vrais
        fichiers : 83,2 ko et 71,5 ko, soit 154,8 ko pour les trente-deux.
      · Le **4:4:4 ne coûte que 4,5 %** de plus que le 4:2:0 par défaut, et il
        évite le bavement de chrominance sur les contours d'encre. C'est là
        qu'un aplat se distingue nettement d'une photo.
      · Le **sans perte a été essayé et écarté** : 658 ko, huit fois le compte.
        « Un aplat compresse bien sans perte » est faux ici — l'anticrénelage
        des contours le ruine.

    ─── Deux fichiers par personne, jamais une feuille de sprite ──────────────

    Le service worker versionne chaque URL précachée séparément. Retoucher un
    seul portrait dans une feuille commune ferait retélécharger l'ensemble chez
    chaque visiteur, à chaque déploiement, sans que rien ne le signale.

    ─── Et pourquoi l'image est vide pour un lecteur d'écran ──────────────────

    `alt=""` suffit à la retirer de l'arbre d'accessibilité — le nom du suspect
    est écrit juste à côté, et sa lettre est sur le plateau. On n'y ajoute
    **pas** `aria-hidden` : le W3C déconseille de cumuler les deux techniques
    sur le même élément.
  */
</script>

<picture>
  <source srcset="{stem}.avif" type="image/avif" />
  <img class="portrait" src="{stem}.webp" alt="" width="224" height="224" decoding="async" />
</picture>

<style>
  /*
    Les dimensions intrinsèques sont sur l'attribut, la taille d'affichage ici :
    c'est l'attribut qui réserve la boîte et empêche le saut de mise en page
    avant que l'image n'arrive.
  */
  .portrait {
    display: block;
    width: 100%;
    height: 100%;
    /*
      Le liseré et l'ombre dure que la plaque SVG portait dans son propre
      dessin. En matriciel ils passent au CSS, sinon la vignette flotte : c'est
      la grammaire que tout le site tient — 2 px d'encre, ombre décalée sans
      flou — et une image posée sans elle se lit comme une pièce rapportée.
    */
    border: 2px solid var(--ink);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-hard);
  }
</style>
