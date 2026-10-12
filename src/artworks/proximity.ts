import type * as THREE from 'three';
import { frameWidthFor } from './createArtwork';
import { artworkOf } from './pickArtwork';

/** Quanto ci si può spostare di lato oltre la cornice restando "davanti" al quadro. */
const SIDE_MARGIN = 0.5;

/**
 * True se `position` sta davanti al quadro, a non più di `reach` metri dal muro:
 * la condizione per aprirne la scheda, la visita guidata o la vista ravvicinata.
 */
export function isNearArtwork(group: THREE.Object3D, position: THREE.Vector3, reach: number): boolean {
  const artwork = artworkOf(group);
  // Nelle coordinate del quadro: x lungo la parete, z distanza dal muro verso la sala.
  const local = group.worldToLocal(position.clone());
  const halfWidth = artwork.width / 2 + frameWidthFor(artwork) + SIDE_MARGIN;
  return local.z <= reach && Math.abs(local.x) <= halfWidth;
}
