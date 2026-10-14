import * as THREE from 'three';
import type { Artwork } from './artworksData';

/** Parti di un quadro che rispondono al clic (non i faretti né l'evidenziazione). */
const PICKABLE = new Set(['canvas', 'frame', 'label', 'badge']);
const raycaster = new THREE.Raycaster();

/** La parte di un quadro colpita: `badge` è il pulsante dell'audioguida. */
export type ArtworkPart = 'canvas' | 'frame' | 'label' | 'badge';

/** Restituisce il gruppo del quadro sotto il punto indicato (coordinate normalizzate da -1 a 1), oppure null. */
export function pickArtwork(pointer: THREE.Vector2, camera: THREE.Camera, root: THREE.Object3D): THREE.Object3D | null {
  return pickArtworkPart(pointer, camera, root)?.group ?? null;
}

/** Come pickArtwork, ma dice anche quale parte del quadro è sotto il punto. */
export function pickArtworkPart(pointer: THREE.Vector2, camera: THREE.Camera, root: THREE.Object3D): { group: THREE.Object3D; part: ArtworkPart } | null {
  // La camera può essersi mossa dopo l'ultimo frame disegnato: il raggio deve partire dalla posizione attuale.
  camera.updateMatrixWorld();
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(root, true).find((intersection) => PICKABLE.has(intersection.object.name));
  let node: THREE.Object3D | null = hit?.object ?? null;
  while (node && !node.userData.artwork) node = node.parent;
  return hit && node ? { group: node, part: hit.object.name as ArtworkPart } : null;
}

/** Converte la posizione di un evento del puntatore in coordinate normalizzate della scena (da -1 a 1, y verso l'alto). */
export function pointerFromEvent(event: MouseEvent, element: HTMLElement): THREE.Vector2 {
  const rect = element.getBoundingClientRect();
  return new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
}

export function artworkOf(object: THREE.Object3D): Artwork {
  return object.userData.artwork as Artwork;
}
