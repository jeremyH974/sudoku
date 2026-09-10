import { formatCell, parseGrid, rate } from '@sudoku/engine';

/**
 * Diagnostic d'une grille : le chemin de résolution, étape par étape.
 *
 *   pnpm diagnose <grille en 81 caractères> [--top N]
 *
 * Sert à comprendre une divergence relevée par la calibration. Le rapport de
 * comparaison dit *qu'*un écart existe ; celui-ci montre *où* le score grimpe et
 * par quelle technique, ce qui est la seule façon de trancher entre un bug de
 * détection et un problème d'ordre.
 */

function main(): void {
  const argv = process.argv.slice(2);
  const puzzleText = argv.find((arg) => !arg.startsWith('--'));
  if (puzzleText === undefined) {
    console.error('Usage : pnpm diagnose <grille en 81 caractères> [--top N]');
    process.exit(1);
  }

  const topIndex = argv.indexOf('--top');
  const top = topIndex >= 0 ? Number.parseInt(argv[topIndex + 1] ?? '5', 10) : 5;

  const rating = rate(parseGrid(puzzleText));

  console.log(`\nGrille   ${puzzleText}`);
  console.log(
    `Verdict  ${rating.outcome} · score ${rating.score.toFixed(1)} · ` +
      `${rating.hardestLabel ?? '—'} · niveau ${rating.level ?? 'hors échelle'} · ` +
      `${String(rating.stepCount)} étapes\n`,
  );

  // Les étapes les plus difficiles d'abord : ce sont elles qui font le score, et
  // donc les seules qui expliquent un écart avec l'oracle.
  const ranked = rating.steps
    .map((step, position) => ({ step, position }))
    .sort((a, b) => b.step.difficulty - a.step.difficulty)
    .slice(0, top);

  console.log(`── Les ${String(ranked.length)} étapes les plus difficiles ──\n`);
  for (const { step, position } of ranked) {
    const targets = [
      ...step.placements.map((p) => `${formatCell(p.cell)}=${String(p.digit)}`),
      ...step.eliminations.slice(0, 4).map((e) => `−${String(e.digit)}@${formatCell(e.cell)}`),
    ];
    console.log(
      `  #${String(position + 1).padStart(3)}  ${step.difficulty.toFixed(1)}  ` +
        `${step.label.padEnd(26)} ${targets.join(' ')}`,
    );
    console.log(`        ${step.explanation}`);
  }

  console.log('\n── Décompte par technique ──\n');
  const counts = [...rating.techniqueCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [technique, count] of counts) {
    console.log(`  ${String(count).padStart(3)}×  ${technique}`);
  }
  console.log('');
}

main();
