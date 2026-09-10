/**
 * Énumération paresseuse des combinaisons de `size` éléments.
 *
 * Les sous-ensembles nus et cachés en ont besoin, et sur des tailles minuscules :
 * au plus 9 cellules ou 9 chiffres par unité, donc 126 combinaisons dans le pire
 * cas (4 parmi 9). Une implémentation directe suffit largement ; c'est le nombre
 * d'unités parcourues, pas la combinatoire, qui domine le coût.
 *
 * Le tableau produit est réutilisé d'une itération à l'autre — ne pas le
 * conserver au-delà du tour de boucle sans le copier.
 */
export function* combinations<T>(items: readonly T[], size: number): Generator<readonly T[]> {
  if (size <= 0 || size > items.length) return;

  const indexes = new Array<number>(size);
  const buffer = new Array<T>(size);

  for (let i = 0; i < size; i++) indexes[i] = i;

  for (;;) {
    for (let i = 0; i < size; i++) buffer[i] = items[indexes[i]]!;
    yield buffer;

    // Recule jusqu'à la position qui peut encore avancer.
    let position = size - 1;
    while (position >= 0 && indexes[position] === items.length - size + position) position--;
    if (position < 0) return;

    indexes[position]++;
    for (let i = position + 1; i < size; i++) indexes[i] = indexes[i - 1] + 1;
  }
}
