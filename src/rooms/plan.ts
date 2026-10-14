import type { Artwork } from '../artworks/artworksData';

/** Come raggruppare le opere nelle sale. */
export type Grouping = 'period' | 'city';

/** Le scelte del menu iniziale. */
export interface VisitFilters {
  groupBy: Grouping;
  /** Anni compresi, estremi inclusi. Le opere senza data passano sempre. */
  fromYear: number;
  toYear: number;
  /** Città da includere. */
  cities: readonly string[];
  onlyTours: boolean;
  /** Numero massimo di opere per sala. */
  perRoom: number;
}

/** Una sala da costruire: titolo e opere in ordine di data. */
export interface RoomPlan {
  title: string;
  /** Per esempio le città riunite in «Altre città». */
  subtitle?: string;
  artworks: Artwork[];
}

/** Quello che serve al menu per proporre i filtri: gli anni e le città presenti nel catalogo. */
export interface CatalogFacets {
  minYear: number;
  maxYear: number;
  cities: { name: string; count: number }[];
  tours: number;
}

/** Città che si usano per le opere senza luogo. */
const UNKNOWN_CITY = 'Luogo sconosciuto';
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Il primo anno che compare nella data, per esempio 1599 per «1599-1600» o «1599 circa». */
export function yearOf(artwork: Artwork): number | null {
  if (typeof artwork.year === 'number') return artwork.year;
  const match = artwork.year?.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

/** La città è l'ultima parte del luogo: «Galleria Borghese, Roma» → «Roma». */
export function cityOf(artwork: Artwork): string {
  const parts = artwork.location?.split(',').map((part) => part.trim()).filter(Boolean);
  return parts?.at(-1) ?? UNKNOWN_CITY;
}

export function catalogFacets(artworks: readonly Artwork[]): CatalogFacets {
  const years = artworks.map(yearOf).filter((year): year is number => year !== null);
  const counts = new Map<string, number>();
  for (const artwork of artworks) counts.set(cityOf(artwork), (counts.get(cityOf(artwork)) ?? 0) + 1);
  return {
    minYear: years.length ? Math.min(...years) : 0,
    maxYear: years.length ? Math.max(...years) : 0,
    // Prima le città con più opere, poi in ordine alfabetico.
    cities: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'it')),
    tours: artworks.filter((artwork) => artwork.tour?.length).length,
  };
}

/** Le opere che passano i filtri, in ordine di data. */
export function filterArtworks(artworks: readonly Artwork[], filters: VisitFilters): Artwork[] {
  const cities = new Set(filters.cities);
  return sortByYear(
    artworks.filter((artwork) => {
      const year = yearOf(artwork);
      if (year !== null && (year < filters.fromYear || year > filters.toYear)) return false;
      if (!cities.has(cityOf(artwork))) return false;
      return !filters.onlyTours || Boolean(artwork.tour?.length);
    }),
  );
}

/** Divide le opere filtrate in sale con al massimo `perRoom` opere ciascuna. */
export function planRooms(artworks: readonly Artwork[], filters: VisitFilters, minCityRoom: number): RoomPlan[] {
  const sorted = sortByYear(artworks);
  if (filters.groupBy === 'period') {
    return chunkEvenly(sorted, filters.perRoom).map((group) => ({ title: yearRange(group), artworks: group }));
  }

  // Per città: le città nell'ordine in cui compaiono nella carriera dell'artista, quelle con poche opere tutte insieme alla fine.
  const byCity = new Map<string, Artwork[]>();
  for (const artwork of sorted) byCity.set(cityOf(artwork), [...(byCity.get(cityOf(artwork)) ?? []), artwork]);
  const rooms: RoomPlan[] = [];
  const others: Artwork[] = [];
  for (const [city, group] of byCity) {
    if (group.length < minCityRoom && byCity.size > 1) {
      others.push(...group);
      continue;
    }
    const chunks = chunkEvenly(group, filters.perRoom);
    chunks.forEach((chunk, index) => rooms.push({ title: chunks.length > 1 ? `${city} ${ROMAN[index] ?? index + 1}` : city, artworks: chunk }));
  }
  const otherChunks = packCities(others, filters.perRoom);
  otherChunks.forEach((chunk, index) =>
    rooms.push({
      title: otherChunks.length > 1 ? `Altre città ${ROMAN[index] ?? index + 1}` : 'Altre città',
      subtitle: [...new Set(chunk.map(cityOf))].join(', '),
      artworks: chunk,
    }),
  );
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

/**
 * Riempie le sale di «Altre città» tenendo ogni città intera: le città, in ordine alfabetico, entrano nella
 * sala finché non supera la misura media, poi si passa alla successiva (17 opere da 8 diventano 6 + 5 + 6,
 * non 8 + 8 + 1). Dentro la sala le opere sono in ordine di data.
 */
function packCities(artworks: readonly Artwork[], size: number): Artwork[][] {
  const byCity = new Map<string, Artwork[]>();
  for (const artwork of artworks) byCity.set(cityOf(artwork), [...(byCity.get(cityOf(artwork)) ?? []), artwork]);
  const target = Math.ceil(artworks.length / Math.ceil(artworks.length / size));
  const rooms: Artwork[][] = [];
  let current: Artwork[] = [];
  for (const city of [...byCity.keys()].sort((a, b) => a.localeCompare(b, 'it'))) {
    const group = byCity.get(city)!;
    if (current.length > 0 && current.length + group.length > target) {
      rooms.push(sortByYear(current));
      current = [];
    }
    current.push(...group);
  }
  if (current.length > 0) rooms.push(sortByYear(current));
  return rooms;
}

/** «1593 – 1597», oppure un anno solo; «Opere senza data» se nessuna ha una data. */
function yearRange(artworks: readonly Artwork[]): string {
  const years = artworks.map(yearOf).filter((year): year is number => year !== null);
  if (years.length === 0) return 'Opere senza data';
  const from = Math.min(...years);
  const to = Math.max(...years);
  return from === to ? String(from) : `${from} – ${to}`;
}
