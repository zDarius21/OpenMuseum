import * as THREE from 'three';
import type { Room, WallId } from '../scene/Room';
import type { Artwork } from './artworksData';
import { createArtwork, frameWidthFor, horizontalExtent } from './createArtwork';
import { createPlaceholderTexture } from './placeholder';

export interface HangOptions {
  maxAnisotropy: number;
  /** Riflessi per l'oro delle cornici. */
  reflections: THREE.Texture;
  /** Altezza del centro dei quadri che non la indicano nel JSON. */
  defaultCenterHeight: number;
  spotStrength: number;
  /** Chiamata a ogni immagine caricata, per mostrare l'avanzamento. */
  onProgress?: (loaded: number, total: number) => void;
}

const FRAME_COLOR = 0xb08a3e;
/** Spazio minimo tra due cornici, e tra una cornice e l'angolo della sala. */
const MIN_GAP = 0.1;
/** Il bordo inferiore della cornice deve stare sopra il battiscopa. */
const MIN_BOTTOM = 0.3;
/** Spazio da lasciare sotto il soffitto per il faretto. */
const MIN_TOP_CLEARANCE = 0.5;

interface Interval {
  from: number;
  to: number;
  id: string;
}

const textureLoader = new THREE.TextureLoader();

/**
 * Appende le opere alle pareti della sala. Le opere che non entrano nella parete o si sovrappongono
 * a un'altra vengono saltate con un avviso in console.
 */
export async function hangArtworks(artworks: readonly Artwork[], room: Room, options: HangOptions): Promise<THREE.Group> {
  const occupied = new Map<WallId, Interval[]>();
  const hangable = artworks.filter((artwork) => {
    const problem = findPlacementProblem(artwork, room, occupied, options.defaultCenterHeight);
    if (problem) console.warn(`Opera "${artwork.id}" non appesa: ${problem}`);
    return problem === null;
  });

  let loaded = 0;
  options.onProgress?.(loaded, hangable.length);
  const textures = await Promise.all(
    hangable.map(async (artwork) => {
      const texture = await loadTexture(artwork, options.maxAnisotropy);
      options.onProgress?.(++loaded, hangable.length);
      return texture;
    }),
  );

  const group = new THREE.Group();
  group.name = 'artworks';
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: FRAME_COLOR,
    metalness: 1,
    roughness: 0.35,
    envMap: options.reflections,
  });
  const context = { frameMaterial, maxAnisotropy: options.maxAnisotropy, ceilingHeight: room.height, spotStrength: options.spotStrength };
  hangable.forEach((artwork, index) => {
    const centerHeight = artwork.centerHeight ?? options.defaultCenterHeight;
    group.add(createArtwork(artwork, textures[index], room.walls[artwork.wall], centerHeight, context));
  });
  return group;
}

/** Controlla che l'opera, targhetta compresa, entri nella sua parete senza toccare le altre; se va bene ne registra lo spazio occupato. */
function findPlacementProblem(artwork: Artwork, room: Room, occupied: Map<WallId, Interval[]>, defaultCenterHeight: number): string | null {
  const frameWidth = frameWidthFor(artwork);
  const extent = horizontalExtent(artwork);
  const halfOuterHeight = artwork.height / 2 + frameWidth;
  const centerHeight = artwork.centerHeight ?? defaultCenterHeight;
  const wallHalfLength = room.walls[artwork.wall].length / 2;

  const interval = { from: artwork.position - extent.left, to: artwork.position + extent.right, id: artwork.id };
  if (interval.from < -wallHalfLength + MIN_GAP || interval.to > wallHalfLength - MIN_GAP) {
    return `con cornice e targhetta esce dalla parete "${artwork.wall}" (lunga ${room.walls[artwork.wall].length} m)`;
  }
  if (centerHeight - halfOuterHeight < MIN_BOTTOM) return 'troppo in basso: alza "centerHeight"';
  if (centerHeight + halfOuterHeight > room.height - MIN_TOP_CLEARANCE) return 'troppo in alto: abbassa "centerHeight" o riduci le dimensioni';

  const others = occupied.get(artwork.wall) ?? [];
  const overlap = others.find((other) => interval.from < other.to + MIN_GAP && interval.to > other.from - MIN_GAP);
  if (overlap) return `si sovrappone a "${overlap.id}" sulla parete "${artwork.wall}"`;

  occupied.set(artwork.wall, [...others, interval]);
  return null;
}

async function loadTexture(artwork: Artwork, maxAnisotropy: number): Promise<THREE.Texture> {
  if (!artwork.image) return createPlaceholderTexture(artwork, maxAnisotropy);
  try {
    const texture = await textureLoader.loadAsync(artwork.image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;
    return texture;
  } catch {
    console.warn(`Immagine di "${artwork.id}" non caricata (${artwork.image}): uso un'immagine simbolica`);
    return createPlaceholderTexture(artwork, maxAnisotropy);
  }
}
