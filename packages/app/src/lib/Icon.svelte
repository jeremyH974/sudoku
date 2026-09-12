<script lang="ts">
  import { ICONS } from './icons.js';
  import type { IconName } from './icons.js';

  /* Les tracés, et la raison de ce composant, sont dans `icons.ts`. */
  interface Props {
    name: IconName;
  }

  const { name }: Props = $props();
</script>

<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  {#each ICONS[name] as part (part.d)}
    <path
      d={part.d}
      class:fill={part.paint === 'fill'}
      class:soft={part.paint === 'soft'}
      class:thin={part.paint === 'thin'}
    />
  {/each}
</svg>

<style>
  .icon {
    flex: none;
    width: 1em;
    height: 1em;
    vertical-align: -0.125em;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .fill {
    fill: currentColor;
  }

  /* Une teinte, et non un contour : ces surfaces-là ne sont pas cerclées. */
  .soft {
    fill: currentColor;
    fill-opacity: 0.35;
    stroke: none;
  }

  .thin {
    stroke-width: 1.4;
  }
</style>
