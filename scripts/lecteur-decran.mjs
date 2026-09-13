/**
 * Le protocole de `docs/lecteur-decran.md`, exécuté.
 *
 * NVDA démarre MUET : la capture se branche sur `pre_speechQueued`, donc en
 * amont du synthétiseur, et `synth = silence` ne l'empêche pas.
 *
 * ─── Quatre leçons payées comptant ──────────────────────────────────────────
 *
 * 1. **Les frappes vont à la fenêtre qui a le focus.** La première exécution en
 *    a envoyé trois dans Discord avant que quiconque s'en aperçoive. D'où un
 *    contrôle qui refuse de mesurer plutôt que de produire un relevé faux.
 * 2. **Sonder le premier plan depuis PowerShell ouvre une console qui passe
 *    elle-même devant** : l'instrument mesurait son interférence. `NVDA+T` est
 *    une commande du lecteur, elle n'atteint pas l'application, et elle voit
 *    exactement ce qui recevra les frappes.
 * 3. **Windows interdit à un processus d'arrière-plan de mettre une fenêtre
 *    devant** — `AppActivate` rend `True` et ne change rien. On attend un clic.
 * 4. **Un clic place le point de départ du clavier là où il tombe**, donc le
 *    nombre de tabulations avant le plateau dépendait de l'endroit cliqué. On
 *    recharge la page (`F5`) juste avant de compter : le focus revient au début
 *    du document, et le parcours redevient reproductible.
 *
 * Et aucun redémarrage automatique : si le focus s'échappe, on s'arrête et on
 * écrit ce qu'on a. Retaper en boucle n'apprend rien et dérange tout le monde.
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

async function dire(numero, geste, action, delai = 300) {
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

/** Le titre de la fenêtre au premier plan, demandé à NVDA lui-même. */
async function titreCourant() {
  await nvda.clearSpokenPhraseLog();
  await nvda.press('Insert+t');
  await attendre(700);
  return (await nvda.spokenPhraseLog()).join(' / ');
}

async function attendreLaPage(secondes) {
  for (let i = 0; i < secondes; i++) {
    const titre = await titreCourant();
    if (/sudoku/i.test(titre)) {
      console.log(`  → « ${titre} »`);
      return true;
    }
    if (i % 6 === 0) console.log(`  …focus ailleurs : « ${titre} » — clique sur Chrome « Sudoku »`);
    await attendre(1200);
  }
  return false;
}

async function main() {
  const profil = mkdtempSync(join(tmpdir(), 'chrome-proto-'));
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
      vision: {
        NVDAHighlighter: {
          enabled: false,
          highlightFocus: false,
          highlightNavigator: false,
          highlightBrowseMode: false,
        },
      },
      general: { playStartAndExitSounds: false },
      speechViewer: { showSpeechViewerAtStartup: false },
    },
  });
  await attendre(3000);

  try {
    console.log('\n──────────────────────────────────────────────');
    console.log('  CLIQUE SUR LA FENÊTRE CHROME « Sudoku ».');
    console.log('──────────────────────────────────────────────\n');
    if (!(await attendreLaPage(90))) throw new Error('Chrome n’a jamais eu le focus.');

    // Point de départ déterministe : après un rechargement, le clavier repart du
    // début du document, quel que soit l'endroit où le clic est tombé.
    console.log('\nRechargement pour repartir du début du document…');
    await nvda.press('F5');
    await attendre(5000);
    const apres = await titreCourant();
    if (!/sudoku/i.test(apres)) throw new Error(`Focus perdu au rechargement : « ${apres} »`);
    console.log(`  → « ${apres} »\n→ Ne touche plus à rien.\n`);

    /*
      1 & 7 — entrer dans le plateau, en COMPTANT les tabulations. Le protocole
      demande « un seul arrêt de tabulation a été consommé, pas trente-six » : on
      ne le suppose pas, on le compte.
    */
    const ETRANGER = /discord|edge|coinglass|chrome$|claude|powershell|discussion|salon/i;
    let tabs = 0;
    let dansLePlateau = false;
    for (; tabs < 34 && !dansLePlateau; ) {
      tabs++;
      const dit = await dire(`1.${tabs}`, `Tab n°${tabs}`, () => nvda.press('Tab'));
      dansLePlateau = dit.some((p) => /ligne \d+,? colonne \d+/i.test(p));
      if (dit.some((p) => ETRANGER.test(p))) {
        throw new Error(`Le focus a quitté la page au Tab n°${String(tabs)} — arrêt, pas de relance.`);
      }
    }
    console.log(`\n→ ${String(tabs)} tabulation(s). Dans le plateau : ${String(dansLePlateau)}\n`);
    releve.push({
      numero: 'bilan-tab',
      geste: 'tabulations consommées avant le plateau',
      entendu: [String(tabs), `entré: ${String(dansLePlateau)}`],
    });

    if (dansLePlateau) {
      await dire('3.1', '→ flèche droite', () => nvda.press('ArrowRight'));
      await dire('3.2', '↓ flèche bas', () => nvda.press('ArrowDown'));
      await dire('3.3', '← flèche gauche', () => nvda.press('ArrowLeft'));
      await dire('4', 'NVDA+Tab (relire la case focalisée)', () => nvda.press('Insert+Tab'));
      await dire('5', 'saisir le chiffre 4', () => nvda.press('4'), 900);
      await dire('7', 'Tab (sortir du plateau)', () => nvda.press('Tab'));
      await dire('8', 'NVDA+Espace (forcer le mode navigation)', () => nvda.press('Insert+Space'));
      await dire('8.1', '↓ après la bascule', () => nvda.press('ArrowDown'));
    }
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
    // Toujours écrire : un relevé partiel vaut mieux qu'aucune trace.
    writeFileSync(
      new URL('./releve.json', import.meta.url),
      JSON.stringify({ url: URL_SUDOKU, quand: new Date().toISOString(), releve }, null, 2),
      'utf8',
    );
    console.log('Relevé écrit dans releve.json');
  }
}

await main();
