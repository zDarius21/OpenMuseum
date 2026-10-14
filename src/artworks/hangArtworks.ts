import * as THREE from 'three';
import type { PlacedArtwork } from '../rooms/layout';
import type { Room } from '../scene/Room';
import type { Artwork } from './artworksData';
import { createArtwork, markShared } from './createArtwork';
import { fetchImage } from './imageCache';
import { createPlaceholderTexture } from './placeholder';

export interface HangOptions {
  maxAnisotropy: number;
  /** Riflessi per l'oro delle cornici. */
  reflections: THREE.Texture;
  spotStrength: number;
}

const FRAME_COLOR = 0xc29a4c;
/** Lo stesso oro per tutte le cornici. */
let frameMaterial: THREE.Material | null = null;

/**
 * Appende le opere di una sala ai posti calcolati da layoutRoom. Le tele restano scure finché non
 * arrivano le immagini, che si scaricano a parte con loadArtworkTexture.
 */
export function hangArtworks(placed: readonly PlacedArtwork[], room: Room, options: HangOptions): THREE.Group {
  frameMaterial ??= markShared(
    new THREE.MeshStandardMaterial({ color: FRAME_COLOR, metalness: 1, roughness: 0.32, envMap: options.reflections, vertexColors: true }),
  );
  const context = { frameMaterial, maxAnisotropy: options.maxAnisotropy, ceilingHeight: room.height, spotStrength: options.spotStrength };
  const group = new THREE.Group();
  group.name = 'artworks';
  for (const { artwork, wall, position, centerHeight } of placed) {
    group.add(createArtwork(artwork, room.walls[wall], position, centerHeight, context));
  }
  return group;
}

/**
 * L'immagine di un'opera, dalla cache di imageCache (che spesso l'ha già scaricata mentre si sceglieva il percorso);
 * se manca o non si carica, un'immagine simbolica.
 */
export async function loadArtworkTexture(artwork: Artwork, maxAnisotropy: number): Promise<THREE.Texture> {
  if (!artwork.image) return createPlaceholderTexture(artwork, maxAnisotropy);
  try {
    // Le ImageBitmap si decodificano fuori dal thread principale. Con TextureLoader la decodifica avveniva durante
    // il passaggio alla scheda grafica e fermava il museo per decine di millisecondi a quadro, appena entrati in una sala.
    // Le opzioni sono quelle di THREE.ImageBitmapLoader.
    const bitmap = await createImageBitmap(await fetchImage(artwork.image), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const texture = new THREE.Texture(bitmap);
    // Una volta sulla scheda grafica l'immagine decodificata non serve più: chiuderla libera subito la memoria.
    const close = () => bitmap.close();
    texture.onUpdate = close;
    texture.addEventListener('dispose', close);
    // Le ImageBitmap arrivano sulla scheda grafica senza essere capovolte (flipY non vale): la tela le legge al contrario.
    texture.flipY = false;
    texture.repeat.y = -1;
    texture.offset.y = 1;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;
    texture.needsUpdate = true;
    return texture;
  } catch {
    console.warn(`Immagine di "${artwork.id}" non caricata (${artwork.image}): uso un'immagine simbolica`);
    return createPlaceholderTexture(artwork, maxAnisotropy);
  }
}
