/**
 * Le jour civil, et rien d'autre.
 *
 * Ce module est délibérément minuscule et sans dépendance : **c'est le seul
 * endroit de l'application autorisé à manipuler des dates.** Tout le reste —
 * séries, calendrier, corpus quotidien — travaille sur des chaînes
 * `AAAA-MM-JJ`, pour lesquelles l'ordre alphabétique est l'ordre chronologique.
 * Trier, comparer et chercher deviennent gratuits et sans piège.
 *
 * ─── Local, jamais UTC ──────────────────────────────────────────────────────
 *
 * `toISOString().slice(0, 10)` est le raccourci qui traîne dans tous les projets,
 * et il est faux : il rend la date **UTC**. À 23 h à Paris en été, UTC est encore
 * la veille — le joueur verrait « défi du 9 » pendant que son téléphone affiche
 * le 10. Il n'y a ni serveur ni classement mondial ici : « aujourd'hui » est
 * celui de l'appareil, et c'est le seul qui ait un sens.
 *
 * ─── Jamais d'arithmétique en millisecondes ─────────────────────────────────
 *
 * Ajouter ou retirer 86 400 000 millisecondes pour changer de jour est faux deux
 * fois par an : un jour de changement d'heure en compte 23 ou 25. En
 * Europe/Paris, le 29 mars 2026 dure 23 heures — « la veille du 30 mars »
 * calculée en millisecondes retombe sur le 29 mars à 23 h, donc sur le jour
 * civil 29 au lieu du 30. Une série se casserait alors en silence, deux fois par
 * an, pour tout un continent.
 *
 * On passe donc par le constructeur `Date(année, mois, jour)`, qui normalise
 * correctement les débordements de mois et d'année, **à midi** — l'heure qui ne
 * tombe jamais dans le trou de 2 h à 3 h ni dans l'heure jouée deux fois.
 */

/** Un jour civil local, au format `AAAA-MM-JJ`. */
export type DayKey = string;

const PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/** Le jour civil local d'un instant donné. */
export function localDayKey(at: Date = new Date()): DayKey {
  return `${pad(at.getFullYear(), 4)}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/**
 * `true` si la chaîne est un jour civil réel.
 *
 * Le format seul ne suffit pas : `2026-02-31` le respecte. On reconstruit donc
 * la date et on vérifie qu'elle désigne bien le jour demandé — le constructeur
 * normalise silencieusement le 31 février en 3 mars, ce qui trahit l'imposteur.
 */
export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string' || !PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  return localDayKey(atNoon(year, month, day)) === value;
}

/** Midi, l'heure qui survit aux changements d'heure. */
function atNoon(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function shift(key: DayKey, days: number): DayKey {
  const [year, month, day] = key.split('-').map(Number) as [number, number, number];
  return localDayKey(atNoon(year, month, day + days));
}

/** Le jour précédent. Traverse correctement mois, années et changements d'heure. */
export const previousDay = (key: DayKey): DayKey => shift(key, -1);

/** Le jour suivant. */
export const nextDay = (key: DayKey): DayKey => shift(key, 1);

/** Le jour de la semaine, 0 pour lundi — l'ordre français, pas celui de `getDay`. */
export function weekdayOf(key: DayKey): number {
  const [year, month, day] = key.split('-').map(Number) as [number, number, number];
  return (atNoon(year, month, day).getDay() + 6) % 7;
}

/** Nombre de jours du mois d'un jour donné. */
export function daysInMonth(key: DayKey): number {
  const [year, month] = key.split('-').map(Number) as [number, number, number];
  // Le jour 0 du mois suivant est le dernier du mois courant.
  return new Date(year, month, 0, 12, 0, 0, 0).getDate();
}

/** Le premier jour du mois d'un jour donné. */
export function startOfMonth(key: DayKey): DayKey {
  return `${key.slice(0, 7)}-01`;
}
