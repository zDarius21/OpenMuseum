import * as THREE from 'three';
import type { Wall } from '../scene/Room';
import type { Artwork } from './artworksData';
import { createLabel, LABEL_CENTER_HEIGHT, LABEL_GAP, LABEL_HEIGHT, LABEL_WIDTH } from './label';
import { BADGE_RADIUS, createTourBadge } from './tourBadge';

/** Elementi condivisi da tutti i quadri. */
export interface ArtworkContext {
  frameMaterial: THREE.Material;
  maxAnisotropy: number;
  ceilingHeight: number;
  /** Quanta luce arriva sul quadro: la potenza del faretto si adatta da sola alla distanza. */
  spotStrength: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);

const FRAME_DEPTH = 0.05;
/** Quanto la cornice copre i bordi della tela. */
const REBATE = 0.01;
/** Distanza della tela dal muro, rientrata rispetto al fronte della cornice. */
export const CANVAS_OFFSET = 0.02;
/** Spazio tra la targhetta e il bollino della visita guidata. */
const BADGE_GAP = 0.04;

/** Inclinazione del faretto dalla verticale: a 30° la luce non riflette verso chi guarda. */
const SPOT_TILT = THREE.MathUtils.degToRad(30);
const SPOT_COLOR = 0xfff1e0;
/** Distanza della lente del faretto dal soffitto. */
const SPOT_HANG = 0.25;
const SPOT_PENUMBRA = 0.45;

const trackBodyGeometry = new THREE.CylinderGeometry(0.06, 0.045, 0.16, 20);
const trackLensGeometry = new THREE.CircleGeometry(0.055, 20);
const trackStemGeometry = new THREE.CylinderGeometry(0.008, 0.008, 1, 8);
const trackBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.5, metalness: 0.3 });
const trackLensMaterial = new THREE.MeshBasicMaterial({ color: 0xfff4e2 });

/** Larghezza della cornice: cresce con le dimensioni del quadro. */
export function frameWidthFor(artwork: Pick<Artwork, 'width' | 'height'>): number {
  return 0.05 + 0.04 * Math.max(artwork.width, artwork.height);
}

/** Quanto occupa l'opera sulla parete a sinistra e a destra del suo centro, targhetta compresa. */
export function horizontalExtent(artwork: Pick<Artwork, 'width' | 'height'>): { left: number; right: number } {
  const halfOuterWidth = artwork.width / 2 + frameWidthFor(artwork);
  return { left: halfOuterWidth, right: halfOuterWidth + LABEL_GAP + LABEL_WIDTH };
}

/**
 * Crea un quadro appeso: tela, cornice, targhetta e faretto dedicato.
 * L'origine del gruppo è il centro del quadro sulla superficie del muro, con l'asse Z rivolto verso la sala.
 */
export function createArtwork(
  artwork: Artwork,
  texture: THREE.Texture,
  wall: Wall,
  centerHeight: number,
  context: ArtworkContext,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `artwork:${artwork.id}`;
  group.userData.artwork = artwork;
  group.position.copy(wall.center).addScaledVector(wall.right, artwork.position).setY(centerHeight);
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(wall.right, UP, wall.normal));

  const canvas = new THREE.Mesh(
    new THREE.PlaneGeometry(artwork.width, artwork.height),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 }),
  );
  canvas.name = 'canvas';
  canvas.position.z = CANVAS_OFFSET;
  group.add(canvas);

  const frameWidth = frameWidthFor(artwork);
  const frame = new THREE.Mesh(createFrameGeometry(artwork.width, artwork.height, frameWidth), context.frameMaterial);
  frame.name = 'frame';
  group.add(frame);

  // Targhetta a destra della cornice, alla stessa altezza da terra per tutte le opere.
  const label = createLabel(artwork, context.maxAnisotropy);
  label.position.set(artwork.width / 2 + frameWidth + LABEL_GAP + LABEL_WIDTH / 2, LABEL_CENTER_HEIGHT - centerHeight, 0);
  group.add(label);

  // Sopra la targhetta, allineato a sinistra, il bollino delle opere con visita guidata.
  if (artwork.tour?.length) {
    const badge = createTourBadge();
    badge.position.set(
      artwork.width / 2 + frameWidth + LABEL_GAP + BADGE_RADIUS,
      LABEL_CENTER_HEIGHT + LABEL_HEIGHT / 2 + BADGE_GAP + BADGE_RADIUS - centerHeight,
      0,
    );
    group.add(badge);
  }

  addSpotlight(group, artwork, centerHeight, context);
  return group;
}

/** Cornice a sezione smussata: un rettangolo con un foro, estruso verso la sala. */
function createFrameGeometry(width: number, height: number, frameWidth: number): THREE.BufferGeometry {
  // La smussatura allarga il bordo esterno e restringe il foro: le misure la compensano.
  const bevel = Math.min(0.012, frameWidth * 0.25);
  const outerW = width / 2 + frameWidth - bevel;
  const outerH = height / 2 + frameWidth - bevel;
  const innerW = width / 2 - REBATE + bevel;
  const innerH = height / 2 - REBATE + bevel;

  const shape = new THREE.Shape()
    .moveTo(-outerW, -outerH)
    .lineTo(outerW, -outerH)
    .lineTo(outerW, outerH)
    .lineTo(-outerW, outerH)
    .closePath();
  shape.holes.push(
    new THREE.Path().moveTo(-innerW, -innerH).lineTo(-innerW, innerH).lineTo(innerW, innerH).lineTo(innerW, -innerH).closePath(),
  );

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: FRAME_DEPTH - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
  });
  // Il retro della cornice appoggia sul muro (z = 0).
  return geometry.translate(0, 0, bevel);
}

/** Faretto su stelo appeso al soffitto, inclinato verso il quadro, con il cono dimensionato sulla cornice. */
function addSpotlight(group: THREE.Group, artwork: Artwork, centerHeight: number, lighting: ArtworkContext): void {
  const frameWidth = frameWidthFor(artwork);
  const ceilingY = lighting.ceilingHeight - centerHeight;
  const lensY = ceilingY - SPOT_HANG;
  const lens = new THREE.Vector3(0, lensY, lensY * Math.tan(SPOT_TILT));
  const target = new THREE.Vector3(0, 0, CANVAS_OFFSET);
  const direction = target.clone().sub(lens).normalize();
  const distance = lens.distanceTo(target);

  // Sul muro il cono si allunga in verticale (circa il doppio, con la luce a 60° dalla parete):
  // basta coprire la larghezza e metà dell'altezza della cornice.
  const coverage = Math.max(artwork.width / 2 + frameWidth, (artwork.height / 2 + frameWidth) / 2) * 1.2;
  const spot = new THREE.SpotLight(
    SPOT_COLOR,
    lighting.spotStrength * distance * distance,
    0,
    Math.atan(coverage / distance),
    SPOT_PENUMBRA,
    2,
  );
  spot.position.copy(lens);
  spot.target.position.copy(target);
  group.add(spot, spot.target);

  const body = new THREE.Mesh(trackBodyGeometry, trackBodyMaterial);
  body.position.copy(lens).addScaledVector(direction, -0.08);
  body.quaternion.setFromUnitVectors(UP, direction);

  const lensMesh = new THREE.Mesh(trackLensGeometry, trackLensMaterial);
  lensMesh.position.copy(lens).addScaledVector(direction, 0.002);
  lensMesh.quaternion.setFromUnitVectors(FORWARD, direction);

  const back = lens.clone().addScaledVector(direction, -0.16);
  const stem = new THREE.Mesh(trackStemGeometry, trackBodyMaterial);
  stem.scale.y = ceilingY - back.y;
  stem.position.set(back.x, (ceilingY + back.y) / 2, back.z);

  group.add(body, lensMesh, stem);
}
