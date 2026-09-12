<script lang="ts">
  import Icon from './Icon.svelte';
  import { THEME_OPTIONS, theme } from './theme.svelte.js';
  import { TEXT_SIZE_OPTIONS, textSize } from './textSize.svelte.js';

  /*
    Les deux réglages qui valent pour **tout le site** : le thème et la taille du
    texte. Ils vivent ici parce qu'une section nouvelle ne doit pas avoir à les
    réinventer, et parce qu'ils sont déjà partagés par le stockage.

    Le panneau de l'écran Sudoku garde les siens pour l'instant : il y ajoute les
    aides du plateau, qui ne veulent rien dire ailleurs. Les deux se rejoindront
    à l'incrément 13, quand tout le site changera d'habillage — les fusionner
    aujourd'hui reviendrait à retoucher un écran qui marche pour le retoucher
    encore dans deux semaines.
  */
  const SIZE_ID = 'reglage-taille';
  const THEME_ID = 'reglage-theme';
</script>

<div class="settings">
  <div class="preference">
    <span class="preference-label" id={SIZE_ID}>Taille du texte</span>
    <div class="group" role="group" aria-labelledby={SIZE_ID}>
      {#each TEXT_SIZE_OPTIONS as option, index (option.id)}
        <button
          type="button"
          class="option"
          class:active={textSize.size === option.id}
          aria-pressed={textSize.size === option.id}
          onclick={() => textSize.set(option.id)}
        >
          <!--
            La taille du glyphe **est** le libellé : c'est le seul réglage qu'on
            comprend sans le lire. D'où une taille en ligne, que la discipline
            des jetons laisse passer parce qu'elle ne lit que les blocs `style`.
          -->
          <span aria-hidden="true" style={`font-size: ${String(0.8 + index * 0.25)}rem`}>
            {option.short}
          </span>
          <span class="sr-only">{option.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="preference">
    <span class="preference-label" id={THEME_ID}>Thème</span>
    <div class="group" role="group" aria-labelledby={THEME_ID}>
      {#each THEME_OPTIONS as option (option.id)}
        <button
          type="button"
          class="option"
          class:active={theme.preference === option.id}
          aria-pressed={theme.preference === option.id}
          onclick={() => theme.set(option.id)}
        >
          <Icon name={option.icon} />
          <span>{option.label}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .settings {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
  }

  .preference {
    display: grid;
    gap: var(--space-2);
  }

  .preference-label {
    color: var(--text-muted);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .group {
    display: flex;
    gap: var(--space-2);
  }

  .option {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: var(--tap);
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  /* L'état actif se dit par un liseré **et** par `aria-pressed`, jamais par la
     seule couleur. */
  .option.active {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 2px var(--accent);
  }

  @media (hover: hover) {
    .option:hover {
      background: var(--surface-hover);
    }
  }

  .option:active {
    background: var(--surface-pressed);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
