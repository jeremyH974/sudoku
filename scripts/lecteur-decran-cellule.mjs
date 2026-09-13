/**
 * La seule question qui reste : **les flèches sur une case focalisée**.
 *
 * Les deux premiers relevés ont focalisé le *conteneur* de la grille, où les
 * flèches ne produisent rien — ce qui ne dit rien du cas qui compte. Ici on
 * tabule jusqu'à ce que NVDA prononce « ligne N, colonne N », preuve qu'une
 * **case** a le focus, et seulement alors on essaie les flèches.
 *
 * Deux issues, et elles n'ont pas les mêmes conséquences pour le projet :
 *
 * - les flèches font annoncer une **autre** case → le plateau est utilisable, et
 *   l'argument mécanique de `CLAUDE.md` tient là où il compte ;
 * - elles lisent des caractères, ou rien → NVDA les garde, et le plateau n'est
 *   pas parcourable au clavier par un utilisateur de NVDA sans bascule manuelle.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nvda } from '@guidepup/guidepup';

const URL_SUDOKU =
  'https://jeremyh974.github.io/sudoku/sudoku/#g=AdIU2wEX0AG3UZYAdDYhRUiTEUVyYjQnWGOXhzE';

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const releve = [];
/** Une case focalisée se reconnaît à ce que NVDA prononce notre nom accessible. */
const EST_UNE_CASE = /ligne \d+,? colonne \d+/i;

async function dire(numero, geste, action, delai = 420) {
  await nvda.clearSpokenPhraseLog();
  await action();
  await attendre(delai);
  const entendu = await nvda.spokenPhraseLog();
  releve.push({ numero, geste, entendu });
  console.log(`[${numero}] ${geste}`);
  for (const p of entendu) console.log(`      « ${p} »`);
  if (entendu.length === 0) console.log('      (rien)');
  return entendu;
}

async function titreCourant() {
  await nvda.clearSpokenPhraseLog();
  await nvda.press('Insert+t');
  await attendre(700);
  return (await nvda.spokenPhraseLog()).join(' / ');
}

async function main() {
  const profil = mkdtempSync(join(tmpdir(), 'chrome-cellule-'));
  spawn(
    'cmd',
    ['/c', 'start', 'chrome', `--user-data-dir=${profil}`, '--no-first-run',
      '--no-default-browser-check', '--new-window', URL_SUDOKU],
    { detached: true, stdio: 'ignore' },
  ).unref();
  await attendre(8000);

  console.log('Démarrage de NVDA (muet)…');
  await nvda.start({
    settings: {
      speech: { synth: 'silence' },
      vision: { NVDAHighlighter: { enabled: false, highlightFocus: false, highlightNavigator: false, highlightBrowseMode: false } },
      general: { playStartAndExitSounds: false },
      speechViewer: { showSpeechViewerAtStartup: false },
    },
  });
  await attendre(3000);

  try {
    console.log('\n──────────────────────────────────────────────');
    console.log('  CLIQUE SUR LA FENÊTRE CHROME « Sudoku ».');
    console.log('──────────────────────────────────────────────\n');
    let ok = false;
    for (let i = 0; i < 90 && !ok; i++) {
      const t = await titreCourant();
      ok = /sudoku/i.test(t);
      if (ok) console.log(`  → « ${t} »`);
      else await attendre(1200);
    }
    if (!ok) throw new Error('Chrome n’a jamais eu le focus.');

    await nvda.press('F5');
    await attendre(5000);
    if (!/sudoku/i.test(await titreCourant())) throw new Error('Focus perdu au rechargement.');
    console.log('\n→ Ne touche plus à rien.\n');

    /*
      Tabuler jusqu'à entendre une case. Si l'on entend le pavé de chiffres,
      c'est qu'on vient de la dépasser : on revient d'un cran.
    */
    let surUneCase = false;
    for (let i = 1; i <= 20 && !surUneCase; i++) {
      const dit = await dire(`tab.${i}`, `Tab n°${i}`, () => nvda.press('Tab'), 300);
      if (dit.some((p) => /discord|edge|coinglass|claude|powershell/i.test(p))) {
        throw new Error('Le focus a quitté la page.');
      }
      if (dit.some((p) => EST_UNE_CASE.test(p))) { surUneCase = true; break; }
      if (dit.some((p) => /Placer le 1\b|Saisie des chiffres/i.test(p))) {
        const retour = await dire('retour', 'Maj+Tab (on avait dépassé)', () => nvda.press('Shift+Tab'));
        surUneCase = retour.some((p) => EST_UNE_CASE.test(p));
        break;
      }
    }
    releve.push({ numero: 'bilan', geste: 'une case a le focus', entendu: [String(surUneCase)] });
    if (!surUneCase) throw new Error('Aucune case n’a pu être focalisée — rien à mesurer.');

    console.log('\n── Les flèches, sur une case focalisée ──');
    await dire('C1', '→ flèche droite', () => nvda.press('ArrowRight'));
    await dire('C2', '→ flèche droite (encore)', () => nvda.press('ArrowRight'));
    await dire('C3', '↓ flèche bas', () => nvda.press('ArrowDown'));

    console.log('\n── Puis en mode formulaire forcé, depuis la même case ──');
    await dire('D0', 'NVDA+Espace', () => nvda.press('Insert+Space'), 700);
    await dire('D1', '→ flèche droite', () => nvda.press('ArrowRight'));
    await dire('D2', '↓ flèche bas', () => nvda.press('ArrowDown'));
    await dire('D3', 'NVDA+Tab (quelle case ?)', () => nvda.press('Insert+Tab'));
    await dire('D4', 'saisir le chiffre 4', () => nvda.press('4'), 900);
  } catch (error) {
    console.error(`\nINTERROMPU : ${error?.message ?? error}`);
    releve.push({ numero: 'erreur', geste: 'interruption', entendu: [String(error?.message ?? error)] });
  } finally {
    console.log('\nArrêt de NVDA…');
    try {
      await nvda.stop();
    } catch {
      /* déjà arrêté */
    }
    writeFileSync(
      new URL('./cellule.json', import.meta.url),
      JSON.stringify({ url: URL_SUDOKU, quand: new Date().toISOString(), releve }, null, 2),
      'utf8',
    );
    console.log('Relevé écrit dans cellule.json');
  }
}

await main();
