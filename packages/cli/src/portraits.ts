import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CAST } from '@sudoku/engine/investigation';
import { FACES, type Face } from '../../app/src/lib/investigation/portrait.js';

/**
 * La fabrique des seize portraits.
 *
 * ─── Pourquoi cette fabrique existe, et pourquoi elle est dans le dépôt ─────
 *
 * Un portrait engendré est un actif qu'on ne sait plus refaire si la recette
 * n'est pas écrite. Ce fichier **est** la recette : la charte de série, les
 * seize spécifications, les réglages d'encodage. Relancer le tout coûte quelques
 * minutes et quelques dizaines de centimes ; le refaire de mémoire coûterait une
 * journée et ne rendrait pas la même chose.
 *
 * ─── Pourquoi l'API d'OpenAI en direct, et pas un revendeur ────────────────
 *
 * La première bibliothèque est passée par un agrégateur, et la lecture de ses
 * conditions a tranché contre lui — sur trois points, tous écrits :
 *
 *   · ses conditions générales définissent la « sortie » comme **de l'audio ou
 *     du texte**. L'image n'entre pas dans la définition, donc la clause qui
 *     laisse ses droits à l'utilisateur porte sur un terme qui l'exclut ; et les
 *     conditions dédiées à l'image ne contiennent **aucune** clause de
 *     propriété ;
 *   · elles **excluent expressément** toute indemnisation en propriété
 *     intellectuelle pour ce service ;
 *   · et l'indemnisation du fournisseur du modèle ne se transmet pas : son
 *     contrat-cadre ferme la porte — « no intended third-party beneficiaries ».
 *
 * L'accès direct donne les trois : cession écrite de la sortie, usage commercial
 * sans palier, indemnisation, et pas d'entraînement par défaut.
 *
 * ─── Ce que la génération ne décide pas ────────────────────────────────────
 *
 * Les cinq axes viennent de `FACES`, les noms de `CAST`, les couleurs des jetons
 * d'`app.css`. Rien n'est retapé ici : une teinte recopiée de travers donnerait
 * un portrait qui contredit la table sans que rien ne le signale, et c'est le
 * seul endroit du pipeline où une faute serait invisible.
 *
 * ─── Usage ─────────────────────────────────────────────────────────────────
 *
 * Sous PowerShell — il n'y a **pas** de préfixe de variable en ligne, la forme
 * `VAR=valeur commande` est du bash et n'existe pas ici :
 *
 *     $env:OPENAI_API_KEY = "…"
 *     pnpm portraits                 # les seize
 *     pnpm portraits L M             # seulement Léa et Maël
 *
 * Sous bash ou zsh :
 *
 *     OPENAI_API_KEY=… pnpm portraits
 *
 * La clef est lue dans l'environnement et n'est jamais écrite nulle part.
 */

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '../../..');
const PUBLIC = join(RACINE, 'packages/app/public/portraits');
const MASTERS = join(RACINE, 'packages/app/public/portraits/masters');

/**
 * Le côté du fichier livré, et c'est un calcul, pas un arrondi.
 *
 * La carte fait 3,5 rem, soit 56 px à la racine par défaut. Le réglage
 * « très grand » porte cette racine à 125 %, donc 70 px. À densité 3, il faut
 * 210 px. 224 les couvre et garde un peu de marge.
 */
const COTE = 224;

/** La charte de série : ce qui est identique pour les seize, mot pour mot. */
const CHARTE = `Flat vector illustration, NOT painted, NOT airbrushed. A single bust portrait of one person, centred, on a plain flat cream background (#faf6f0) filling the whole square. No border, no frame, no panel, no vignette, no text.

RENDERING, more important than anything else:
Every surface is one uniform fill of one solid colour. Shadows are SEPARATE SOLID SHAPES with hard crisp edges — never blurred, never blended, never faded. Exactly two values per surface: the base colour, and one shadow colour. No gradient anywhere. No soft shading. No texture. No glow. At most 10 distinct flat colours in the whole image.

SHADOWS — all three, as hard-edged solid shapes: one under the jaw falling onto the neck; one down the right side of the face and neck; one on the right side of the garment. One light source, upper left, so every shadow sits on the lower-right of its form.

Ink outline in warm dark charcoal (#2b2a27), clean and even, noticeably heavier on the outer silhouette than on interior detail.

FRAMING, exact: head and shoulders, facing the viewer straight on, cropped at mid-chest by the bottom edge. The head fills about half the square's height. The eyes sit on a horizontal line at 45% of the square's height from the top. Generous cream margin on the left and right of the shoulders.

Eyes: almond shaped, raised outer corner, thickened upper lid line, a teal-grey iris (#5a8a90) clearly distinct from a much darker pupil, one small solid highlight at the upper left of each iris.

Calm neutral expression, mouth closed.

The person:
`;

/** La coiffure, dite comme un illustrateur la demanderait. */
const COIFFURES: Record<Face['hair'], string> = {
  court: 'short cropped hair',
  carre: 'a BLUNT chin-length bob — straight hair cut in one level line at the jaw, with a straight fringe, not layered and never reaching the shoulders',
  long: 'long straight hair falling well past the shoulders',
  queue: 'a long ponytail falling over one shoulder',
  boucle: 'voluminous curly hair',
  chignon: 'hair gathered in a bun',
  'mi-long': 'shoulder-length hair',
  couettes: 'two low bunches falling from the temples',
};

const PEAUX = ['very light skin', 'light tan skin', 'warm mid-brown skin', 'deep dark brown skin'];
const CHEVEUX = ['near-black hair', 'dark brown hair', 'golden blonde hair', 'silver grey hair'];
const HAUTS = ['a deep teal top', 'a slate blue top', 'a clay-rose top', 'a warm sand top'];

/** Les couleurs viennent des jetons, jamais d'une valeur recopiée ici. */
const CSS = readFileSync(join(RACINE, 'packages/app/src/app.css'), 'utf8');
function jeton(nom: string): string {
  const trouve = new RegExp(`^\\s*--${nom}:\\s*(#[0-9a-f]{6});`, 'm').exec(CSS);
  if (trouve === null) throw new Error(`Jeton introuvable dans app.css : --${nom}`);
  return trouve[1];
}

function specification(face: Face, index: number): string {
  const personne = CAST[index];
  const qui = personne.gender === 'f' ? 'Woman' : 'Man';
  return [
    `${qui}, ${COIFFURES[face.hair]}`,
    `${PEAUX[face.skin - 1]} (${jeton(`skin-${String(face.skin)}`)})`,
    `${CHEVEUX[face.hairTone - 1]} (${jeton(`hair-${String(face.hairTone)}`)})`,
    face.glasses ? 'round dark-rimmed glasses' : 'no glasses',
    `${HAUTS[face.garment - 1]} (${jeton(`garment-${String(face.garment)}`)})`,
  ].join(', ');
}

async function engendre(prompt: string, clef: string): Promise<Buffer> {
  const reponse = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clef}` },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
      quality: 'high',
      n: 1,
    }),
  });
  if (!reponse.ok) {
    throw new Error(`L'API a répondu ${String(reponse.status)} : ${await reponse.text()}`);
  }
  const corps = (await reponse.json()) as { data: { b64_json?: string }[] };
  const b64 = corps.data[0]?.b64_json;
  if (b64 === undefined) throw new Error("L'API n'a rendu aucune image.");
  return Buffer.from(b64, 'base64');
}

/**
 * L'encodage, et les trois mesures qui l'ont fixé.
 *
 * Pesé sur les seize vrais fichiers, pas estimé : AVIF q75 en 4:4:4 donne
 * 83,2 ko, WebP q80 en donne 71,5, soit 154,8 ko pour les trente-deux.
 *
 *   · le **4:4:4** ne coûte que 4,5 % de plus que le 4:2:0 par défaut, et il
 *     évite que la chrominance bave sur les contours d'encre. C'est là qu'un
 *     aplat se distingue nettement d'une photo ;
 *   · le **sans perte a été essayé et écarté** — 658 ko, huit fois le compte.
 *     « Un aplat compresse bien sans perte » est faux ici : l'anticrénelage des
 *     contours le ruine ;
 *   · le master de 1024 est **gardé**, pour pouvoir réencoder sans repayer une
 *     génération.
 */
async function encode(png: Buffer, lettre: string): Promise<void> {
  const bas = lettre.toLowerCase();
  writeFileSync(join(MASTERS, `${bas}.png`), png);
  const carre = sharp(png).resize(COTE, COTE, { kernel: 'lanczos3' });
  await carre.clone().avif({ quality: 75, chromaSubsampling: '4:4:4' }).toFile(join(PUBLIC, `${bas}.avif`));
  await carre.clone().webp({ quality: 80, effort: 6 }).toFile(join(PUBLIC, `${bas}.webp`));
}

async function main(): Promise<void> {
  const clef = process.env.OPENAI_API_KEY;
  if (clef === undefined || clef === '') {
    /*
      Le message dit la syntaxe de **la** machine, pas celle d'une autre.

      Il ne donnait que la forme bash `VAR=valeur commande`, qui n'existe pas
      sous PowerShell : l'utilisateur a reçu « le terme OPENAI_API_KEY= n'est
      pas reconnu » et a pu croire à un défaut du script. Un message d'aide qui
      se trompe de plateforme est pire que pas de message.
    */
    const windows = process.platform === 'win32';
    console.error(
      [
        'OPENAI_API_KEY manque.',
        'La clef est lue dans l’environnement, jamais écrite ni conservée.',
        '',
        ...(windows
          ? ['PowerShell :', '  $env:OPENAI_API_KEY = "…"', '  pnpm portraits']
          : ['bash / zsh :', '  OPENAI_API_KEY=… pnpm portraits']),
      ].join('\n'),
    );
    process.exit(1);
  }

  const demandes = process.argv.slice(2).map((a) => a.toUpperCase());
  const cibles = CAST.slice(0, FACES.length)
    .map((personne, index) => ({ personne, face: FACES[index], index }))
    .filter(({ personne }) => demandes.length === 0 || demandes.includes(personne.letter));

  if (cibles.length === 0) {
    console.error(`Aucune lettre reconnue parmi : ${demandes.join(', ')}`);
    process.exit(1);
  }

  mkdirSync(PUBLIC, { recursive: true });
  mkdirSync(MASTERS, { recursive: true });

  for (const { personne, face, index } of cibles) {
    const prompt = CHARTE + specification(face, index);
    process.stdout.write(`${personne.letter} — ${personne.name.padEnd(9)} `);
    const debut = Date.now();
    await encode(await engendre(prompt, clef), personne.letter);
    console.log(`${((Date.now() - debut) / 1000).toFixed(1)} s`);
  }

  console.log(
    `\n${String(cibles.length)} portraits écrits dans packages/app/public/portraits.\n` +
      'À relire axe par axe contre la table avant de livrer : la fidélité mesurée\n' +
      'sur la première bibliothèque était de 67 sur 68, pas de 68 sur 68.',
  );
}

await main();
