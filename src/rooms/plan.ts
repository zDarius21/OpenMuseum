import { textsOf, type Artwork } from '../artworks/artworksData';
import { movementName, type Movement } from '../data/movements';
import { locale } from '../i18n/language';
import { t } from '../i18n/strings';

/** Una sala da costruire: la sua corrente e le opere in ordine di data. */
export interface RoomPlan {
  movement: Movement;
  /** Quale parte della corrente, da 0, se le sue opere sono divise in più sale. */
  part?: number;
  artworks: Artwork[];
}

/** Quello che serve al menu per una corrente: le sue opere in ordine di data. */
export interface MovementFacet {
  movement: Movement;
  artworks: Artwork[];
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Il primo anno che compare nella data, per esempio 1599 per «1599-1600» o «1599 circa». */
export function yearOf(artwork: Artwork): number | null {
  if (typeof artwork.year === 'number') return artwork.year;
  const match = artwork.year?.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

/** L'artista nella lingua scelta: «Tiziano» in italiano, «Titian» in inglese. */
export function artistOf(artwork: Artwork): string {
  return textsOf(artwork).author?.trim() || t().artwork.unknownArtist;
}

/** Il titolo della sala nella lingua scelta: il nome della corrente, con un numero romano se ha più sale. */
export function roomTitle({ movement, part }: Pick<RoomPlan, 'movement' | 'part'>): string {
  const name = movementName(movement);
  return part === undefined ? name : `${name} ${ROMAN[part] ?? part + 1}`;
}

/** Le correnti nel loro ordine, ognuna con le sue opere; anche quelle ancora senza opere. */
export function movementFacets(artworks: readonly Artwork[], movements: readonly Movement[]): MovementFacet[] {
  return movements.map((movement) => ({ movement, artworks: sortByYear(artworks.filter((artwork) => artwork.movement === movement.id)) }));
}

/** Gli artisti delle opere, nella lingua scelta: prima quelli con più opere, poi in ordine alfabetico. */
export function artistsOf(artworks: readonly Artwork[]): string[] {
  const counts = new Map<string, number>();
  for (const artwork of artworks) counts.set(artistOf(artwork), (counts.get(artistOf(artwork)) ?? 0) + 1);
  return [...counts].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b, locale())).map(([name]) => name);
}

/**
 * Le sale del percorso, dalle opere scelte nel menu iniziale (`route`, per id): una sala per corrente, nell'ordine
 * in cui si sono succedute. Una corrente con più di `perRoom` opere scelte si divide in più sale, il più possibile
 * uguali, in ordine di data.
 */
export function planRooms(artworks: readonly Artwork[], route: ReadonlySet<string>, movements: readonly Movement[], perRoom: number): RoomPlan[] {
  const rooms: RoomPlan[] = [];
  for (const movement of movements) {
    const chunks = chunkEvenly(sortByYear(artworks.filter((artwork) => artwork.movement === movement.id && route.has(artwork.id))), perRoom);
    chunks.forEach((chunk, index) => rooms.push({ movement, part: chunks.length > 1 ? index : undefined, artworks: chunk }));
  }
  return rooms;
}

function sortByYear(artworks: readonly Artwork[]): Artwork[] {
  // Le opere senza data vanno in fondo; a parità di anno decide il titolo italiano, così l'ordine non cambia
  // tra una visita e l'altra, né cambiando lingua.
  return [...artworks].sort((a, b) => (yearOf(a) ?? Infinity) - (yearOf(b) ?? Infinity) || a.texts.it.title.localeCompare(b.texts.it.title, 'it'));
}

/** Divide in gruppi di al massimo `size`, il più possibile uguali: 13 opere da 6 diventano 5 + 4 + 4, non 6 + 6 + 1. */
function chunkEvenly<T>(items: readonly T[], size: number): T[][] {
  if (items.length === 0) return [];
  const count = Math.ceil(items.length / size);
  const base = Math.floor(items.length / count);
  const extra = items.length % count;
  const chunks: T[][] = [];
  let start = 0;
  for (let index = 0; index < count; index++) {
    const length = base + (index < extra ? 1 : 0);
    chunks.push(items.slice(start, start + length));
    start += length;
  }
  return chunks;
}
