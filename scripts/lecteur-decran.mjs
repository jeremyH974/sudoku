/**
 * Le protocole de `docs/lecteur-decran.md`, exécuté contre un vrai NVDA.
 *
 * ─── Ce que ce script vérifie, et que rien d'autre ne peut vérifier ─────────
 *
 * Les tests `*.a11y.test.ts` voient l'arbre d'accessibilité : les rôles, les
 * noms, l'ordre des titres. Ils ne disent **rien** de ce qu'un lecteur d'écran
 * prononce. C'est l'écart que ce script mesure, et c'est là que les défauts se
 * cachent — l'incrément 21 a trouvé que NVDA annonce le plateau « tableau » et
 * n'entre jamais de lui-même en mode formulaire, deux choses qu'aucun test de
 * CI classique ne pouvait voir.
 *
 * ─── Comment il est piloté ──────────────────────────────────────────────────
 *
 *   BASE=http://localhost:4181/sudoku/  node scripts/lecteur-decran.mjs
 *
 * `BASE` désigne la racine du site (défaut : le site publié). `SANS_CLIC=1`
 * suppose que la fenêtre du navigateur est déjà au premier plan — c'est le cas
 * sur une machine d'intégration continue, où rien d'autre ne tourne — et fait
 * échouer tout de suite si elle ne l'est pas, au lieu d'attendre un humain.
 *
 * ⚠ NVDA ré-injecte les frappes dans la fenêtre qui a le focus, et Windows
 * interdit à un processus d'arrière-plan de faire passer une fenêtre devant :
 * `AppActivate` rend `True` et ne change rien. Sur un poste de travail il faut
 * donc **un clic humain**, et le script l'attend plutôt que de ruser.
 *
 * ─── Trois pièges de méthode, payés comptant à l'incrément 21 ───────────────
 *
 * 1. Les frappes vont à la fenêtre au premier plan : la première exécution en a
 *    envoyé trois dans une autre application. D'où le contrôle de focus, qui
 *    **refuse de mesurer** plutôt que de produire un relevé faux.
 * 2. Sonder cette fenêtre depuis PowerShell ouvre une console qui passe
 *    elle-même devant : l'instrument mesurait son interférence. C'est NVDA qui
 *    donne le titre, par `NVDA+T`, et lui ne déplace rien.
 * 3. Le nombre de tabulations avant le plateau n'est pas stable — le curseur
 *    virtuel démarre là où l'on a cliqué. On recharge (`F5`) pour repartir du
 *    début, et l'on **détecte** le plateau au lieu de compter à l'aveugle.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nvda } from '@guidepup/guidepup';

const BASE = process.env.BASE ?? 'https://jeremyh974.github.io/sudoku/';
/** Une grille figée par son code : le relevé doit être comparable d'une fois sur l'autre. */
const GRILLE = 'AdIU2wEX0AG3UZYAdDYhRUiTEUVyYjQnWGOXhzE';
const URL_PAGE = `${BASE.replace(/\/$/, '')}/sudoku/#g=${GRILLE}`;
const SANS_CLIC = process.env.SANS_CLIC === '1';

/** Une case focalisée se reconnaît à ce que NVDA prononce notre nom accessible. */
const EST_UNE_CASE = /ligne (\d+),? colonne (\d+)/i;
/** Le pavé de chiffres suit immédiatement le plateau : l'entendre, c'est l'avoir dépassé. */
const APRES_LE_PLATEAU = /Placer le 1\b|Saisie des chiffres/i;

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const releve = [];
const echecs = [];

async function dire(etape, geste, action, delai = 420) {
  await nvda.clearSpokenPhraseLog();
  await action();
  await attendre(delai);
  const entendu = await nvda.spokenPhraseLog();
  releve.push({ etape, geste, entendu });
  console.log(`[${etape}] ${geste}`);
  for (const p of entendu) console.log(`      « ${p} »`);
  if (entendu.length === 0) console.log('      (rien)');
  return entendu;
}

/** Une assertion nommée : elle dit ce qu'elle attendait et ce qu'elle a eu. */
function exiger(nom, condition, detail) {
  console.log(`  ${condition ? '✓' : '✗'} ${nom}`);
  if (!condition) echecs.push(`${nom} — ${detail}`);
  releve.push({ etape: 'assertion', geste: nom, entendu: [condition ? 'tenu' : `MANQUÉ : ${detail}`] });
}

/** Le titre de la fenêtre au premier plan, demandé à NVDA lui-même. */
async function titreCourant() {
  await nvda.clearSpokenPhraseLog();
  await nvda.press('Insert+t');
  await attendre(700);
  return (await nvda.spokenPhraseLog()).join(' / ');
}

async function main() {
  console.log(`Page mesurée : ${URL_PAGE}\n`);
  const profil = mkdtempSync(join(tmpdir(), 'chrome-lecteur-'));
  spawn(
    'cmd',
    ['/c', 'start', 'chrome', `--user-data-dir=${profil}`, '--no-first-run',
      '--no-default-browser-check', '--new-window', URL_PAGE],
    { detached: true, stdio: 'ignore' },
  ).unref();
  await attendre(9000);

  console.log('Démarrage de NVDA (muet)…');
  await nvda.start({
    settings: {
      // Muet, et cela n'empêche pas la capture : elle se branche sur
      // `pre_speechQueued`, en amont du synthétiseur.
      speech: { synth: 'silence' },
      // Ne rien peindre sur l'écran de quelqu'un.
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
    if (!SANS_CLIC) {
      console.log('\n──────────────────────────────────────────────');
      console.log('  CLIQUE SUR LA FENÊTRE CHROME « Sudoku ».');
      console.log('──────────────────────────────────────────────\n');
    }
    let auPoint = false;
    const essais = SANS_CLIC ? 15 : 90;
    for (let i = 0; i < essais && !auPoint; i++) {
      const titre = await titreCourant();
      auPoint = /sudoku/i.test(titre);
      if (auPoint) console.log(`  → « ${titre} »`);
      else {
        if (i % 6 === 0) console.log(`  …focus ailleurs : « ${titre} »`);
        await attendre(1200);
      }
    }
    if (!auPoint) throw new Error('La fenêtre du navigateur n’a jamais eu le focus.');

    // Point de départ déterministe : après un rechargement, le clavier repart du
    // début du document, quel que soit l'endroit où le clic est tombé.
    await nvda.press('F5');
    await attendre(5000);
    if (!/sudoku/i.test(await titreCourant())) throw new Error('Focus perdu au rechargement.');
    console.log('\n→ Ne touche plus à rien.\n');

    /* ── 1. Atteindre le plateau, en comptant ce qu'il coûte ──────────────── */
    console.log('── Tabulation jusqu’au plateau ──');
    let arretsAvant = 0;
    let arretsDuPlateau = 0;
    let atteint = false;
    for (let i = 1; i <= 24 && !atteint; i++) {
      const dit = await dire(`tab.${i}`, `Tab n°${i}`, () => nvda.press('Tab'), 300);
      if (dit.some((p) => /discord|slack|edge|powershell|explorateur/i.test(p))) {
        throw new Error(`Le focus a quitté la page au Tab n°${String(i)}.`);
      }
      if (dit.some((p) => APRES_LE_PLATEAU.test(p))) {
        // On vient de dépasser : le plateau était l'arrêt précédent.
        arretsDuPlateau = 1;
        atteint = true;
        await dire('retour', 'Maj+Tab (revenir sur le plateau)', () => nvda.press('Shift+Tab'));
        break;
      }
      arretsAvant = i;
    }
    console.log(`  (plateau atteint après ${String(arretsAvant)} arrêt(s) avant lui)`);
    exiger(
      'le plateau ne consomme qu’un arrêt de tabulation',
      atteint && arretsDuPlateau === 1,
      atteint
        ? `${String(arretsDuPlateau)} arrêt(s), après ${String(arretsAvant)} autres`
        : 'le pavé de chiffres n’a jamais été atteint',
    );

    /* ── 2. Le nom et les dimensions du plateau ───────────────────────────── */
    const surLePlateau = await dire('plateau', 'NVDA+Tab : que dit le plateau ?', () =>
      nvda.press('Insert+Tab'),
    );
    const textePlateau = surLePlateau.join(' ');
    exiger(
      'les dimensions du plateau sont annoncées',
      /9 lignes/i.test(textePlateau) && /9 colonnes/i.test(textePlateau),
      `entendu : « ${textePlateau} »`,
    );

    /* ── 3. Mode formulaire, puis une case, puis les flèches ──────────────── */
    console.log('\n── Mode formulaire, et le parcours aux flèches ──');
    await dire('mode', 'NVDA+Espace (bascule)', () => nvda.press('Insert+Space'), 700);

    let nomDeCase = '';
    for (let i = 1; i <= 4 && nomDeCase === ''; i++) {
      const dit = await dire(`case.${i}`, `Tab n°${i} (chercher une case)`, () => nvda.press('Tab'));
      const trouve = dit.find((p) => EST_UNE_CASE.test(p));
      if (trouve !== undefined) nomDeCase = trouve;
    }
    exiger(
      'une case prononce son nom accessible',
      EST_UNE_CASE.test(nomDeCase),
      nomDeCase === '' ? 'aucune case ne s’est nommée' : `entendu : « ${nomDeCase} »`,
    );

    if (nomDeCase !== '') {
      const depart = EST_UNE_CASE.exec(nomDeCase);
      const apres = await dire('fleche', '→ flèche droite depuis la case', () =>
        nvda.press('ArrowRight'),
      );
      const arrivee = EST_UNE_CASE.exec(apres.join(' '));
      /*
        L'assertion qui compte vraiment, et la seule que l'incrément 21 avait
        laissée ouverte : **une flèche fait-elle annoncer la case voisine ?** Le
        déplacement lui-même est vérifié côté application par les tests du
        plateau ; ce qui se vérifie ici est que le lecteur d'écran le **dit**.
      */
      exiger(
        'une flèche fait annoncer la case voisine',
        arrivee !== null && arrivee[2] !== depart?.[2],
        arrivee === null
          ? `aucune case annoncée — entendu : « ${apres.join(' / ')} »`
          : `toujours colonne ${String(arrivee[2])}`,
      );
    }
  } catch (error) {
    const message = String(error?.message ?? error);
    console.error(`\nINTERROMPU : ${message}`);
    echecs.push(`exécution interrompue — ${message}`);
    releve.push({ etape: 'erreur', geste: 'interruption', entendu: [message] });
  } finally {
    console.log('\nArrêt de NVDA…');
    try {
      await nvda.stop();
    } catch {
      /* déjà arrêté */
    }
    writeFileSync(
      new URL('../releve-lecteur-decran.json', import.meta.url),
      JSON.stringify({ url: URL_PAGE, quand: new Date().toISOString(), echecs, releve }, null, 2),
      'utf8',
    );
  }

  console.log('\n════════════════════════════════════');
  if (echecs.length === 0) {
    console.log('  Tout est tenu.');
  } else {
    console.log(`  ${String(echecs.length)} manquement(s) :`);
    for (const e of echecs) console.log(`   • ${e}`);
    process.exitCode = 1;
  }
}

await main();
