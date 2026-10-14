import type { Artwork } from '../artworks/artworksData';
import type { Movement } from '../data/movements';

/** Una sala da costruire: titolo e opere in ordine di data. */
export interface RoomPlan {
  title: string;
  subtitle?: string;
  artworks: Artwork[];
}

/** Quello che serve al menu per una corrente: le sue opere in ordine di data e i suoi artisti, dal più presente. */
export interface MovementFacet {
  movement: Movement;
  artworks: Artwork[];
  artists: { name: string; count: number }[];
}

/** L'artista delle opere senza autore. */
const UNKNOWN_ARTIST = 'Autore ignoto';
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Il primo anno che compare nella data, per esempio 1599 per «1599-1600» o «1599 circa». */
export function yearOf(artwork: Artwork): number | null {
  if (typeof artwork.year === 'number') return artwork.year;
  const match = artwork.year?.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

export function artistOf(artwork: Artwork): string {
  return artwork.author?.trim() || UNKNOWN_ARTIST;
}

/** Le correnti nel loro ordine, ognuna con le sue opere e i suoi artisti; anche quelle ancora senza opere. */
export function movementFacets(artworks: readonly Artwork[], movements: readonly Movement[]): MovementFacet[] {
  return movements.map((movement) => {
    const works = sortByYear(artworks.filter((artwork) => artwork.movement === movement.id));
    const counts = new Map<string, number>();
    for (const artwork of works) counts.set(artistOf(artwork), (counts.get(artistOf(artwork)) ?? 0) + 1);
    return {
      movement,
      artworks: works,
      // Prima gli artisti con più opere, poi in ordine alfabetico.
      artists: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'it')),
    };
  });
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
    chunks.forEach((chunk, index) =>
      rooms.push({ title: chunks.length > 1 ? `${movement.name} ${ROMAN[index] ?? index + 1}` : movement.name, artworks: chunk }),
    );
  }
  return rooms;
}

function sortByYear(artworks: readonly Artwork[]): Artwork[] {
  // Le opere senza data vanno in fondo; a parità di anno decide il titolo, così l'ordine non cambia tra una visita e l'altra.
  return [...artworks].sort((a, b) => (yearOf(a) ?? Infinity) - (yearOf(b) ?? Infinity) || a.title.localeCompare(b.title, 'it'));
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
