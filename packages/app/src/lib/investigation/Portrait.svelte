<script lang="ts">
  import type { Suspect } from '@sudoku/engine/investigation';
  import {
    BROWS,
    BUST,
    BUST_SHADE,
    COLLAR,
    EYES,
    FACE,
    FACE_SHADE,
    GLASSES,
    HAIR,
    MOUTH,
    NECK,
    NECK_SHADE,
    NOSE,
    PLATE,
    faceOf,
    garmentToken,
    hairToken,
    skinToken,
  } from './portrait.js';
  import type { EyePart } from './portrait.js';

  interface Props {
    suspect: Suspect;
  }

  const { suspect }: Props = $props();
  const face = $derived(faceOf(suspect));
  const hair = $derived(HAIR[face.hair]);

  /** Chaque rôle du regard cite son jeton, et jamais une couleur. */
  function eyeToken(role: EyePart['role']): string {
    if (role === 'sclera') return 'var(--eye-sclera)';
    if (role === 'iris') return 'var(--eye-iris)';
    if (role === 'light') return 'var(--portrait-light)';
    return 'var(--portrait-shade)';
  }

  /*
    ─── L'ordre de dessin est celui d'un cel peint ────────────────────────────

    La masse de cheveux passe **sous** le visage et donne la silhouette ; le
    vêtement et son ombre viennent dessus ; le cou puis l'encolure ; le visage ;
    les traits ; la frange par-dessus le visage ; et le reflet des cheveux en
    dernier, parce qu'il court sur la frange.

    Une seule source de lumière, en haut à gauche, et les trois ombres la
    suivent : celle de la frange sur le front, celle du buste à droite, le reflet
    de l'œil à gauche de l'iris. C'est ce qui distingue un dessin d'un assemblage
    de formes — les incohérences d'éclairage se voient sans qu'on sache les
    nommer.

    ─── Pourquoi ce dessin est masqué aux lecteurs d'écran ────────────────────

    Le nom du suspect est écrit juste à côté, et sa lettre est sur le plateau.
    Le portrait est donc **décoratif** au sens strict : lui inventer un texte de
    remplacement ferait entendre deux fois la même chose. C'est la règle déjà
    tenue par le mobilier de la scène.

    ─── Et pourquoi il y a un contour, alors que le mobilier n'en a pas ───────

    Parce que c'est la grammaire du dessin japonais : la ligne d'encre vient
    avant la couleur. Et parce que la mesure l'impose — aucun ton de peau ni de
    cheveux ne contraste avec le fond d'une carte (une peau claire tombe à
    1,35:1 sur blanc). C'est l'encre qui sépare.

    **Aucune encre ne suit le thème**, et c'est le résultat d'un essai raté.
    Quand la plaque était sombre, il fallait une encre claire pour séparer les
    masses — et ce liseré clair cernait aussi le visage, le cou et le buste, à
    contre-jour d'une lumière posée en haut à gauche. La plaque est restée
    claire, et tout le dessin avec elle : sourcils, bouche, paupières, pupilles
    et les quatre lavis d'ombre citent `--portrait-shade`, qui ne change jamais.

    Le contour n'est pas d'épaisseur uniforme pour autant, et c'est le seul
    levier que le SVG laisse : **la silhouette extérieure est plus appuyée que les détails
    intérieurs** (1,7 contre 1,2). Le trait effilé, lui, n'existe pas — proposé
    en 2002, écarté de SVG2, toujours un brouillon non implémenté. Seule la
    **ligne de paupière** s'effile, parce qu'elle est dessinée en forme pleine :
    c'est là que ça valait le détour de la construire à la main.
  */
</script>

<svg class="portrait" viewBox="0 0 48 48" aria-hidden="true">
  <path class="plate" d={PLATE} />

  <!-- La silhouette : ce qu'on lit de loin, et le seul aplat de couleur franche. -->
  <g class="silhouette">
    <path d={hair.back} fill={hairToken(face.hairTone)} />
    <path d={BUST} fill={garmentToken(face.garment)} />
  </g>
  <path d={BUST_SHADE} fill="var(--portrait-shade)" fill-opacity="0.15" />

  <g class="inked">
    <path d={NECK} fill={skinToken(face.skin)} />
  </g>
  <path d={NECK_SHADE} fill="var(--portrait-shade)" fill-opacity="0.18" />
  <path d={COLLAR} fill="var(--portrait-shade)" fill-opacity="0.22" />

  <g class="inked">
    <path d={FACE} fill={skinToken(face.skin)} />
  </g>

  <!-- L'ombre du cel : une encre translucide, qui marche sur n'importe quelle
       peau sans demander un jeton par teinte. -->
  <path d={FACE_SHADE} fill="var(--portrait-shade)" fill-opacity="0.13" />

  {#each EYES as part, index (index)}
    <path d={part.d} fill={eyeToken(part.role)} />
  {/each}

  {#each BROWS as brow (brow)}
    <path d={brow} fill="var(--portrait-shade)" />
  {/each}
  <path d={NOSE} fill="var(--portrait-shade)" fill-opacity="0.4" />
  <path d={MOUTH} fill="var(--portrait-shade)" />

  <path class="stroked" d={hair.front} fill={hairToken(face.hairTone)} />
  <path d={hair.shine} fill="var(--portrait-light)" fill-opacity="0.28" />

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
    stroke: var(--portrait-shade);
    stroke-width: 2;
  }

  /* Le contour extérieur : celui qui porte la silhouette, donc le plus appuyé. */
  .silhouette path {
    stroke: var(--portrait-shade);
    stroke-width: 1.7;
    stroke-linejoin: round;
  }

  /* Les masses intérieures : plus légères, pour que la silhouette reste devant. */
  .inked path,
  .stroked {
    stroke: var(--portrait-shade);
    stroke-width: 1.2;
    stroke-linejoin: round;
  }

  .glasses {
    fill: none;
    stroke: var(--portrait-shade);
    stroke-width: 1.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
</style>
