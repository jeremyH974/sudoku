/**
 * La question qui décide de tout.
 *
 * Le premier relevé a établi que le focus arrive bien sur la case (9ᵉ arrêt de
 * tabulation, mesuré dans le DOM) et que NVDA n'annonce que « principale
 * région » : ni le rôle, ni les dimensions, ni le nom de la case.
 *
 * Reste à savoir **de qui cela manque**. Deux scénarios, et ils n'ont pas les
 * mêmes conséquences :
 *
 * - NVDA est resté en **mode navigation**, où il garde les flèches pour son
 *   curseur virtuel. Le plateau serait alors utilisable une fois le mode
 *   formulaire forcé (`NVDA+Espace`) — pénible, mais praticable.
 * - Ou il n'annonce rien même en mode formulaire, et le plateau est
 *   inutilisable au clavier avec NVDA + Chrome.
 *
 * On mesure les deux, dans l'ordre, sur la même case.
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

async function dire(numero, geste, action, delai = 400) {
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
  const profil = mkdtempSync(join(tmpdir(), 'chrome-modes-'));
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
      if (!ok) {
        if (i % 6 === 0) console.log(`  …focus ailleurs : « ${t} »`);
        await attendre(1200);
      } else console.log(`  → « ${t} »`);
    }
    if (!ok) throw new Error('Chrome n’a jamais eu le focus.');

    await nvda.press('F5');
    await attendre(5000);
    if (!/sudoku/i.test(await titreCourant())) throw new Error('Focus perdu au rechargement.');
    console.log('\n→ Ne touche plus à rien.\n');

    // Huit tabulations : mesuré, la case est le 9ᵉ arrêt du DOM et le curseur
    // virtuel démarre après le lien d'évitement.
    for (let i = 1; i <= 8; i++) {
      const dit = await dire(`tab.${i}`, `Tab n°${i}`, () => nvda.press('Tab'), 260);
      if (dit.some((p) => /discord|edge|coinglass|claude|powershell/i.test(p))) {
        throw new Error('Le focus a quitté la page.');
      }
    }

    console.log('\n── Mode navigation (celui où NVDA arrive) ──');
    await dire('A1', 'NVDA+Tab : où est le focus ?', () => nvda.press('Insert+Tab'));
    await dire('A2', '→ flèche droite', () => nvda.press('ArrowRight'));
    await dire('A3', '↓ flèche bas', () => nvda.press('ArrowDown'));

    console.log('\n── Mode formulaire, forcé (NVDA+Espace) ──');
    await dire('B0', 'NVDA+Espace', () => nvda.press('Insert+Space'), 700);
    await dire('B1', 'NVDA+Tab : où est le focus ?', () => nvda.press('Insert+Tab'));
    await dire('B2', '→ flèche droite', () => nvda.press('ArrowRight'));
    await dire('B3', '↓ flèche bas', () => nvda.press('ArrowDown'));
    await dire('B4', 'saisir le chiffre 4', () => nvda.press('4'), 900);
    await dire('B5', 'Tab (sortir du plateau)', () => nvda.press('Tab'));
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
      new URL('./modes.json', import.meta.url),
      JSON.stringify({ url: URL_SUDOKU, quand: new Date().toISOString(), releve }, null, 2),
      'utf8',
    );
    console.log('Relevé écrit dans modes.json');
  }
}

await main();
