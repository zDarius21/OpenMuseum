import type { Artwork } from '../artworks/artworksData';
import { frameWidthFor, horizontalExtent } from '../artworks/createArtwork';

/** Un'opera con il suo posto nella sala. */
export interface PlacedArtwork {
  artwork: Artwork;
  wall: 'est' | 'ovest';
  /** Spostamento dal centro della parete in metri: positivo verso destra guardando la parete. */
  position: number;
  /** Altezza da terra del centro del quadro. */
  centerHeight: number;
}

export interface RoomLayout {
  /** Profondità della sala, da sud a nord. */
  depth: number;
  placed: PlacedArtwork[];
}

export interface LayoutOptions {
  minDepth: number;
  minGap: number;
  height: number;
  defaultCenterHeight: number;
  minBottom: number;
}

/** Spazio da lasciare sotto il soffitto per il faretto. */
const MIN_TOP_CLEARANCE = 0.5;
/** Il bordo inferiore della cornice deve comunque stare sopra il battiscopa. */
const MIN_BOTTOM = 0.3;

/**
 * Dispone le opere sulle due pareti lunghe, alternandole in ordine di data: camminando verso nord
 * si incontrano una dopo l'altra, a sinistra (ovest) e a destra (est). La sala si allunga quanto serve.
 * Le opere troppo alte per la sala vengono saltate con un avviso in console.
 */
export function layoutRoom(artworks: readonly Artwork[], options: LayoutOptions): RoomLayout {
  const walls = { ovest: [] as Artwork[], est: [] as Artwork[] };
  const used = { ovest: 0, est: 0 };
  const heights = new Map<Artwork, number>();

  for (const artwork of artworks) {
    const centerHeight = centerHeightFor(artwork, options);
    if (centerHeight === null) {
      console.warn(`Opera "${artwork.id}" non appesa: è troppo alta per sale di ${options.height} m`);
      continue;
    }
    heights.set(artwork, centerHeight);
    // Sulla parete meno occupata: così le opere si alternano e le pareti hanno lunghezze simili.
    const wall = used.ovest <= used.est ? 'ovest' : 'est';
    walls[wall].push(artwork);
    used[wall] += footprint(artwork) + options.minGap;
  }

  const needed = (list: readonly Artwork[]) => list.reduce((sum, artwork) => sum + footprint(artwork), 0) + (list.length + 1) * options.minGap;
  const depth = Math.max(options.minDepth, needed(walls.ovest), needed(walls.est));

  const placed: PlacedArtwork[] = [];
  for (const wall of ['ovest', 'est'] as const) {
    // Guardando la parete ovest la destra è il nord, guardando la est è il sud: perché su entrambe le pareti
    // le opere vadano da sud a nord in ordine di data, sulla est si dispongono da destra a sinistra.
    const list = wall === 'ovest' ? walls.ovest : [...walls.est].reverse();
    const free = depth - list.reduce((sum, artwork) => sum + footprint(artwork), 0);
    const gap = free / (list.length + 1);
    let x = -depth / 2 + gap;
    for (const artwork of list) {
      const extent = horizontalExtent(artwork);
      placed.push({ artwork, wall, position: x + extent.left, centerHeight: heights.get(artwork)! });
      x += footprint(artwork) + gap;
    }
  }
  return { depth, placed };
}

/** Ingombro sulla parete: cornice e targhetta. */
function footprint(artwork: Artwork): number {
  const extent = horizontalExtent(artwork);
  return extent.left + extent.right;
}

/**
 * All'altezza standard, oppure più in alto se la cornice arriverebbe troppo vicina a terra. I quadri molto alti
 * si abbassano quanto serve per stare sotto il faretto, fino a sfiorare il battiscopa; null se non entrano.
 */
function centerHeightFor(artwork: Artwork, options: LayoutOptions): number | null {
  const halfOuterHeight = artwork.height / 2 + frameWidthFor(artwork);
  const preferred = Math.max(options.defaultCenterHeight, options.minBottom + halfOuterHeight);
  const highest = options.height - MIN_TOP_CLEARANCE - halfOuterHeight;
  const center = Math.min(preferred, highest);
  return center - halfOuterHeight < MIN_BOTTOM ? null : center;
}
