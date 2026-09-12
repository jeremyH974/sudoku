<script lang="ts">
  import type { Suspect } from '@sudoku/engine/investigation';
  import {
    BROWS,
    BUST,
    EYES,
    FACE,
    FACE_SHADE,
    GLASSES,
    HAIR,
    MOUTH,
    NECK,
    PLATE,
    faceOf,
    hairToken,
    skinToken,
  } from './portrait.js';

  interface Props {
    suspect: Suspect;
  }

  const { suspect }: Props = $props();
  const face = $derived(faceOf(suspect));
  const hair = $derived(HAIR[face.hair]);

  /*
    ─── Pourquoi ce dessin est masqué aux lecteurs d'écran ────────────────────

    Le nom du suspect est écrit juste à côté, et sa lettre est sur le plateau.
    Le portrait est donc **décoratif** au sens strict : lui inventer un texte de
    remplacement ferait entendre deux fois la même chose. C'est la règle déjà
    tenue par le mobilier de la scène.

    ─── Et pourquoi il y a un contour, alors que le mobilier n'en a pas ───────

    Parce que c'est la grammaire du manga : la ligne d'encre vient avant la
    couleur. Et parce que la mesure l'impose — aucun ton de peau ni de cheveux
    ne contraste avec le fond d'une carte (une peau claire tombe à 1,35:1 sur
    blanc). C'est l'encre qui sépare, ici comme pour le mobilier ; seule la
    forme qu'elle prend change.

    Le contour est d'épaisseur **uniforme**, et ce n'est pas un choix : le SVG
    ne sait pas faire un trait effilé. Proposé en 2002, écarté de SVG2, le
    module est encore un brouillon non implémenté. Une ligne expressive
    demanderait de dessiner l'encre en aplats fermés — c'est un travail d'un
    autre ordre, réservé le jour où un contour « héros » se justifiera.
  */
</script>

<svg class="portrait" viewBox="0 0 48 48" aria-hidden="true">
  <path class="plate" d={PLATE} />

  <g class="inked">
    <path d={BUST} fill="var(--mat-fabric)" />
    <path d={NECK} fill={skinToken(face.skin)} />
    <path d={hair.back} fill={hairToken(face.hairTone)} />
    <path d={FACE} fill={skinToken(face.skin)} />
  </g>

  <!-- L'ombre du cel : une encre translucide, qui marche sur n'importe quelle
       peau sans demander un jeton par teinte. -->
  <path d={FACE_SHADE} fill="var(--ink)" fill-opacity="0.14" />

  {#each EYES as eye (eye)}
    <path d={eye} fill="var(--ink)" />
  {/each}
  {#each BROWS as brow (brow)}
    <path d={brow} fill="var(--ink)" />
  {/each}
  <path d={MOUTH} fill="var(--ink)" />

  <path class="stroked" d={hair.front} fill={hairToken(face.hairTone)} />

  {#if face.glasses}
    <path class="glasses" d={GLASSES} />
  {/if}
</svg>

<style>
  .portrait {
    display: block;
    width: 100%;
    height: 100%;
  }

  .plate {
    fill: var(--portrait-plate);
    stroke: var(--ink);
    stroke-width: 2;
  }

  /* Le trait d'encre, uniforme, qui referme chaque forme. */
  .inked path,
  .stroked {
    stroke: var(--ink);
    stroke-width: 1.4;
    stroke-linejoin: round;
  }

  .glasses {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.6;
    stroke-linejoin: round;
  }
</style>
