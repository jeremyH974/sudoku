<script lang="ts">
  import { openCase, renderClue } from '@sudoku/engine/investigation';
  import type { CaseFile, Suspect } from '@sudoku/engine/investigation';
  import PrintableScene from './PrintableScene.svelte';
  import QrCode from './QrCode.svelte';
  import { effectiveMargins } from './presets.js';
  import type { PrintFormat } from './presets.js';

  interface Props {
    file: CaseFile;
    /** Le code de l'affaire : il ouvre la même affaire à l'écran. */
    code: string;
    kind: 'dossier' | 'solution';
    format: PrintFormat;
    pageNumber: number;
    /** Base du lien de reprise, jusqu'au « # » exclu. */
    baseUrl: string;
  }

  const { file, code, kind, format, pageNumber, baseUrl }: Props = $props();

  const puzzle = $derived(openCase(file));
  const margins = $derived(effectiveMargins(format, pageNumber));
  const padding = $derived(
    `${String(margins.top)}mm ${String(margins.right)}mm ${String(margins.bottom)}mm ${String(margins.left)}mm`,
  );

  /** Le code en groupes de cinq : illisible d'un bloc, saisissable ainsi. */
  const grouped = (text: string): string => text.replace(/(.{5})/g, '$1 ').trim();

  /** Les indices, groupés par la personne qui les dit — c'est ainsi qu'on les lit. */
  const testimonies = $derived(
    puzzle.suspects.map((suspect) => ({
      suspect,
      lines: file.clues
        .filter((clue) => clue.who === suspect.index)
        .map((clue) => renderClue(clue, puzzle.scene, puzzle.suspects)),
    })),
  );

  /** Qui est posé où, pour le corrigé seulement. */
  const placed = $derived.by((): Record<number, Suspect | undefined> => {
    if (kind !== 'solution') return {};
    const map: Record<number, Suspect | undefined> = {};
    file.solution.forEach((cell, who) => {
      map[cell] = puzzle.suspects[who];
    });
    return map;
  });

  const victim = $derived(puzzle.suspects[file.victim]);
  const murderer = $derived(puzzle.suspects[file.murderer]);

  /** La pièce du crime, avec son article — « l'Office » n'a pas d'espace. */
  const crimeScene = $derived.by((): string => {
    const zone = puzzle.scene.zones[puzzle.scene.zoneOf[file.solution[file.victim]]];
    return zone.article === "l'" ? `l'${zone.name}` : `${zone.article} ${zone.name}`;
  });
</script>

<section class="sheet" style={`padding: ${padding};`}>
  {#if kind === 'dossier'}
    <header class="masthead">
      <h2>Enquête — {puzzle.scene.title}</h2>
      <p class="brief">
        {puzzle.suspects.length} personnes, une par rangée et une par colonne. Écrivez l’initiale de
        chacune dans sa case. « À côté de » veut dire voisin direct <em>et dans la même pièce</em> :
        les murs arrêtent le regard.
      </p>
    </header>

    <!--
      Les témoignages d'abord, le plan ensuite : c'est l'ordre dans lequel on
      résout. Ils tiennent en deux colonnes pour ne pas repousser le plan en bas
      de page — un plan qu'on remplit au crayon doit être large, pas tassé.
    -->
    <h3>Les témoignages</h3>
    <ul class="clues">
      {#each testimonies as entry (entry.suspect.index)}
        {#each entry.lines as line, index (index)}
          <li><b>{entry.suspect.letter}</b> — {line}</li>
        {/each}
      {/each}
    </ul>

    <p class="question">
      <b>{victim.name}</b> est la victime. Qui était seul avec {victim.gender === 'f'
        ? 'elle'
        : 'lui'} ?
    </p>

    <div class="plan-side">
      <PrintableScene scene={puzzle.scene} millimetres={108} />
      <p class="legend">
        {#each puzzle.suspects as suspect (suspect.index)}<span class="who"
            ><b>{suspect.letter}</b> {suspect.name}</span
          >{/each}
      </p>
    </div>

    <footer class="reprise">
      <QrCode value={`${baseUrl}#a=${code}`} sizeMm={22} label="Jouer cette affaire à l’écran" />
      <div class="code-block">
        <p class="hint">Scannez pour jouer cette affaire à l’écran, ou saisissez :</p>
        <p class="code">{grouped(code)}</p>
      </div>
    </footer>
  {:else}
    <h2 class="solution-title">Corrigé — {puzzle.scene.title}</h2>
    <!--
      Le corrigé est sur sa propre feuille, la dernière, exactement comme les
      cahiers de sudoku : on imprime l'ensemble et on détache. L'intercaler le
      rendrait visible par transparence et impossible à retirer.
    -->
    <div class="solution-body">
      <PrintableScene scene={puzzle.scene} millimetres={92} {placed} />
      <p class="verdict">
        Le meurtrier est <b>{murderer.name}</b> ({murderer.letter}), seul avec
        <b>{victim.name}</b> ({victim.letter}) dans
        {crimeScene}.
      </p>
      <p class="code">{grouped(code)}</p>
    </div>
  {/if}

  {#if format.showPageNumbers}
    <p class="folio">{pageNumber}</p>
  {/if}
</section>

<style>
  /*
    ⚠ Fichier de papier : exempté des règles de jetons dans `appStyles.test.ts`.
    Tout y est en millimètres, sans thème, et le noir y est un vrai noir — un
    `var(--text)` imprimerait du gris clair.
  */
  .sheet {
    position: relative;
    box-sizing: border-box;
    /*
      La taille du papier vient du conteneur, comme pour les feuilles de sudoku :
      A4 et US Letter n'ont ni la même largeur ni la même hauteur, et une feuille
      qui la fixerait en dur sortirait fausse sur l'un des deux.
    */
    width: var(--sheet-width);
    height: var(--sheet-height);
    /* Rien ne doit déborder d'une feuille sur la suivante. */
    overflow: hidden;
    background: #ffffff;
    color: #1a1a1a;
    font-family: var(--font-paper);
  }

  h2 {
    margin: 0 0 2mm;
    font-size: 6mm;
    font-weight: 700;
  }

  .brief {
    margin: 0 0 5mm;
    max-width: 160mm;
    font-size: 3.7mm;
    line-height: 1.45;
    color: #333333;
  }

  /*
    108 mm, soit des cases de 18 mm — largement de quoi écrire une initiale à la
    main. Ce n'est pas la plus grande taille possible : la place est **réservée**
    pour le cas le plus chargé que la fabrique puisse produire, douze
    témoignages, soit trois lignes de plus que l'affaire mesurée. Dimensionner
    sur le cas moyen ferait déborder une affaire sur dix dans la marge, et
    `overflow: hidden` la couperait en silence.
  */
  .plan-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 5mm;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1mm 5mm;
    margin: 3mm 0 0;
    width: 108mm;
    font-size: 3.2mm;
  }

  .who b {
    font-size: 3.6mm;
  }

  h3 {
    margin: 0 0 2mm;
    font-size: 4.2mm;
    font-weight: 700;
  }

  .clues {
    /*
      Deux colonnes : neuf témoignages sur une seule repousseraient le plan
      d'une trentaine de millimètres, qu'il vaut mieux donner au plan.
    */
    columns: 2;
    column-gap: 8mm;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .clues li {
    margin-bottom: 2.2mm;
    /*
      Un témoignage coupé entre deux pages serait illisible, et le dossier tient
      de toute façon sur une feuille — la règle est là pour le jour où une
      affaire plus longue arriverait.
    */
    break-inside: avoid;
    page-break-inside: avoid;
    /*
      3,9 mm, soit environ 11 points.

      ⚠ Ce dossier **n'est pas** un document en gros caractères, et il ne
      prétend pas l'être. Les guides « clear print » du RNIB et du CNIB
      recommandent l'équivalent de 14 points, que cette mise en page ne tient
      pas — neuf témoignages, un plan de 130 mm et un code sur une seule feuille
      ne le permettent pas. Le chemin accessible est l'écran, dont tout le texte
      suit le réglage de taille ; le papier est un tirage de confort.

      Aucun texte de la famille WCAG ne vise le papier : WCAG2ICT, republié le
      11 décembre 2025, borne explicitement sa portée au contenu présenté par un
      agent utilisateur. Le seuil de contraste, lui, est le même des deux côtés —
      4,5:1 — et le noir sur blanc du papier le dépasse largement.
    */
    font-size: 3.9mm;
    line-height: 1.4;
  }

  .question {
    margin: 5mm 0 0;
    padding-top: 3mm;
    border-top: 0.4mm solid #1a1a1a;
    font-size: 3.8mm;
  }

  .reprise {
    display: flex;
    gap: 5mm;
    align-items: center;
    margin-top: 6mm;
    padding-top: 3mm;
    border-top: 0.3mm solid #999999;
  }

  .hint {
    margin: 0 0 1mm;
    font-size: 3mm;
    color: #444444;
  }

  .code {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 3.4mm;
    letter-spacing: 0.3mm;
  }

  .solution-title {
    margin-bottom: 5mm;
  }

  .solution-body {
    display: flex;
    flex-direction: column;
    gap: 4mm;
    align-items: flex-start;
  }

  .verdict {
    margin: 0;
    font-size: 4mm;
  }

  .folio {
    position: absolute;
    right: 12mm;
    bottom: 8mm;
    margin: 0;
    font-size: 3mm;
    color: #666666;
  }
</style>
