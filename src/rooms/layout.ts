import type { Artwork } from '../artworks/artworksData';
import { frameWidthFor, horizontalExtent } from '../artworks/createArtwork';
import { CLOCKWISE, runsAlongX, WALL_AXES, type WallId } from '../scene/Room';

/** Un'opera con il suo posto nella sala. */
export interface PlacedArtwork {
  artwork: Artwork;
  wall: WallId;
  /** Spostamento dal centro della parete in metri: positivo verso destra guardando la parete. */
  position: number;
  /** Altezza da terra del centro del quadro. */
  centerHeight: number;
}

export interface RoomLayout {
  /** Larghezza della sala, da ovest a est. */
  width: number;
  /** Profondità della sala, da sud a nord. */
  depth: number;
  /** Le pareti con le opere, davanti alle quali corrono le transenne. */
  artWalls: WallId[];
  placed: PlacedArtwork[];
}

export interface LayoutOptions {
  /** Lato minimo delle sale. */
  minSize: number;
  minGap: number;
  height: number;
  defaultCenterHeight: number;
  minBottom: number;
}

/**
 * Da dove si entra e da dove si esce. La prima sala non ha la porta d'ingresso, ma il visitatore parte comunque
 * da `entrance`; l'ultima non ha l'uscita.
 */
export interface RoomPassage {
  entrance: WallId;
  exit?: WallId;
}

/** Le opere di una sala divise tra le pareti, prima di sapere quanto sarà grande la sala. */
export interface WallPlan {
  passage: RoomPassage;
  /** Le opere di ogni parete libera, in ordine di data. */
  walls: Map<WallId, Artwork[]>;
  heights: Map<Artwork, number>;
  /** Le misure minime perché le opere ci stiano. */
  width: number;
  depth: number;
}

/** Spazio da lasciare sotto il soffitto per il faretto. */
const MIN_TOP_CLEARANCE = 0.5;
/** Il bordo inferiore della cornice deve comunque stare sopra il battiscopa. */
const MIN_BOTTOM = 0.3;

/**
 * Divide le opere (in ordine di data) tra le pareti senza porte. Restituisce anche le misure che la sala deve avere
 * almeno. Le opere troppo alte per la sala vengono saltate con un avviso in console.
 */
export function planWalls(artworks: readonly Artwork[], passage: RoomPassage, options: LayoutOptions): WallPlan {
  // In senso orario a partire dall'ingresso: a parità di spazio un'opera va a sinistra di chi entra.
  const start = CLOCKWISE.indexOf(passage.entrance);
  const free = [1, 2, 3].map((step) => CLOCKWISE[(start + step) % CLOCKWISE.length]).filter((wall) => wall !== passage.exit);
  const walls = new Map(free.map((wall) => [wall, [] as Artwork[]]));
  const used = new Map(free.map((wall) => [wall, 0]));
  const heights = new Map<Artwork, number>();

  const hung = artworks.filter((artwork) => {
    const centerHeight = centerHeightFor(artwork, options);
    if (centerHeight === null) console.warn(`Opera "${artwork.id}" non appesa: è troppo alta per sale di ${options.height} m`);
    else heights.set(artwork, centerHeight);
    return centerHeight !== null;
  });
  // Prima le opere più larghe, ognuna sulla parete meno occupata: le pareti vengono lunghe uguali e la sala resta
  // quadrata più spesso. Poi su ogni parete si rimettono in ordine di data.
  for (const artwork of [...hung].sort((a, b) => footprint(b) - footprint(a))) {
    const wall = free.reduce((best, wall) => (used.get(wall)! < used.get(best)! ? wall : best));
    walls.get(wall)!.push(artwork);
    used.set(wall, used.get(wall)! + footprint(artwork) + options.minGap);
  }
  for (const list of walls.values()) list.sort((a, b) => hung.indexOf(a) - hung.indexOf(b));

  const needed = (list: readonly Artwork[]) => list.reduce((sum, artwork) => sum + footprint(artwork), 0) + (list.length + 1) * options.minGap;
  let width = options.minSize;
  let depth = options.minSize;
  for (const [wall, list] of walls) {
    if (runsAlongX(wall)) width = Math.max(width, needed(list));
    else depth = Math.max(depth, needed(list));
  }
  return { passage, walls, heights, width, depth };
}

/**
 * Appende le opere alle pareti di una sala di misure date, che possono essere più grandi del minimo se le altre
 * sale della stessa fila o colonna sono più grandi: su ogni parete gli spazi tra le opere sono uguali, e le date
 * crescono nel verso in cui si cammina.
 */
export function placeArtworks(plan: WallPlan, width: number, depth: number): RoomLayout {
  const placed: PlacedArtwork[] = [];
  for (const [wall, list] of plan.walls) {
    const length = runsAlongX(wall) ? width : depth;
    // Le posizioni vanno da sinistra a destra guardando la parete: se le date crescono verso sinistra, si rovescia.
    const ordered = dateDirection(wall, plan.passage) > 0 ? list : [...list].reverse();
    const free = length - ordered.reduce((sum, artwork) => sum + footprint(artwork), 0);
    const gap = free / (ordered.length + 1);
    let x = -length / 2 + gap;
    for (const artwork of ordered) {
      const extent = horizontalExtent(artwork);
      placed.push({ artwork, wall, position: x + extent.left, centerHeight: plan.heights.get(artwork)! });
      x += footprint(artwork) + gap;
    }
  }
  return { width, depth, artWalls: [...plan.walls.keys()], placed };
}

/**
 * 1 se lungo la parete le date crescono verso destra per chi la guarda, -1 se verso sinistra. Sulle pareti di lato
 * all'ingresso crescono allontanandosi dall'ingresso; su quella di fronte, andando verso l'uscita, o da sinistra a
 * destra se l'uscita non c'è.
 */
function dateDirection(wall: WallId, { entrance, exit }: RoomPassage): number {
  const right = WALL_AXES[wall].right;
  const inward = right.dot(WALL_AXES[entrance].normal);
  if (inward !== 0) return Math.sign(inward);
  return exit ? Math.sign(-right.dot(WALL_AXES[exit].normal)) || 1 : 1;
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
