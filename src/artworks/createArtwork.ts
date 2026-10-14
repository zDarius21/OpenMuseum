import * as THREE from 'three';
import { createMoldingGeometry, type ProfilePoint } from '../scene/molding';
import { SPOT_TRACK_DISTANCE, type Wall } from '../scene/Room';
import type { Artwork } from './artworksData';
import { createLabel, LABEL_CENTER_HEIGHT, LABEL_GAP, LABEL_HEIGHT, LABEL_WIDTH } from './label';
import { AUDIO_BUTTON_HEIGHT, AUDIO_BUTTON_WIDTH, createTourBadge, releaseTourBadge } from './tourBadge';

/** Elementi condivisi da tutti i quadri. */
export interface ArtworkContext {
  frameMaterial: THREE.Material;
  maxAnisotropy: number;
  ceilingHeight: number;
  /** Quanta luce arriva sul quadro: la potenza del faretto si adatta da sola alla distanza. */
  spotStrength: number;
}

/** Il faretto di un quadro, nelle coordinate del quadro: lo accende LightPool quando si entra nella sala. */
export interface ArtworkSpot {
  position: THREE.Vector3;
  target: THREE.Vector3;
  angle: number;
  intensity: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);

/** Quanto sporge dal muro la cornice: di più per le cornici larghe dei quadri grandi. */
const MIN_FRAME_DEPTH = 0.05;
const FRAME_DEPTH_RATIO = 0.45;
/** Quanto la cornice copre i bordi della tela. */
const REBATE = 0.01;
/** Distanza della tela dal muro, rientrata rispetto al fronte della cornice. */
export const CANVAS_OFFSET = 0.02;
/** Spazio tra la targhetta e il pulsante dell'audioguida. */
const BADGE_GAP = 0.04;

/** Lunghezza dello stelo che regge il faretto sotto il binario: con il binario a 1,55 m dal muro il faretto è inclinato
 * di circa 30° dalla verticale, abbastanza perché la luce non rifletta verso chi guarda. */
const SPOT_STEM = 0.1;
/** Distanza tra l'attacco del faretto allo stelo e la lente. */
const SPOT_BODY_LENGTH = 0.16;
/** Altezza del binario dei faretti, sotto il soffitto. */
const TRACK_HEIGHT = 0.045;

/**
 * Profilo di una cornice dorata, in sezione, dalla tela verso il muro: un tondino sul filo della tela, una gola concava
 * che sale verso il bordo esterno arrotondato. L'offset, tranne il primo punto, e l'altezza sono in frazioni
 * della larghezza e della profondità della cornice. Le parti in ombra (gola, filo della tela) sono più scure.
 */
const FRAME_PROFILE: readonly [offset: number, height: number, shade: number][] = [
  [0.02, 0.62, 0.75],
  [0.06, 0.72, 1],
  [0.1, 0.66, 0.85],
  [0.16, 0.58, 0.62],
  [0.28, 0.63, 0.66],
  [0.42, 0.76, 0.82],
  [0.56, 0.9, 0.95],
  [0.68, 0.98, 1],
  [0.78, 1, 1],
  [0.88, 0.94, 0.96],
  [0.95, 0.8, 0.9],
  [0.99, 0.6, 0.82],
  [1, 0.45, 0.75],
  [1, 0, 0.6],
];

/** Colore della tela finché la sua immagine non è arrivata. */
const LOADING_COLOR = 0x2a2622;

const trackBodyGeometry = markShared(new THREE.CylinderGeometry(0.06, 0.045, 0.16, 20));
const trackLensGeometry = markShared(new THREE.CircleGeometry(0.055, 20));
const trackStemGeometry = markShared(new THREE.CylinderGeometry(0.008, 0.008, 1, 8));
const trackBodyMaterial = markShared(new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.5, metalness: 0.3 }));
const trackLensMaterial = markShared(new THREE.MeshBasicMaterial({ color: 0xfff4e2 }));

/** Segna geometrie e materiali usati da più quadri: disposeArtwork non li libera. */
export function markShared<T extends THREE.BufferGeometry | THREE.Material>(resource: T): T {
  resource.userData.shared = true;
  return resource;
}

/** Larghezza della cornice: cresce con le dimensioni del quadro. */
export function frameWidthFor(artwork: Pick<Artwork, 'width' | 'height'>): number {
  return 0.05 + 0.04 * Math.max(artwork.width, artwork.height);
}

/** Quanto occupa l'opera sulla parete a sinistra e a destra del suo centro, targhetta (e pulsante dell'audioguida) compresa. */
export function horizontalExtent(artwork: Pick<Artwork, 'width' | 'height' | 'tour'>): { left: number; right: number } {
  const halfOuterWidth = artwork.width / 2 + frameWidthFor(artwork);
  // Il pulsante, più largo della targhetta, la supera di poco a destra.
  const overhang = artwork.tour?.length ? Math.max(0, (AUDIO_BUTTON_WIDTH - LABEL_WIDTH) / 2) : 0;
  return { left: halfOuterWidth, right: halfOuterWidth + LABEL_GAP + LABEL_WIDTH + overhang };
}

/**
 * Crea un quadro appeso: tela, cornice, targhetta e la lampada del faretto. La tela resta di un colore scuro
 * finché non le si dà l'immagine con setArtworkTexture; la luce del faretto la accende LightPool.
 * L'origine del gruppo è il centro del quadro sulla superficie del muro, con l'asse Z rivolto verso la sala.
 */
export function createArtwork(
  artwork: Artwork,
  wall: Wall,
  position: number,
  centerHeight: number,
  context: ArtworkContext,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `artwork:${artwork.id}`;
  group.userData.artwork = artwork;
  // Prima delle sale: i quadri coprono la parete, che dove c'è un quadro non va colorata.
  group.renderOrder = -1;
  group.position.copy(wall.center).addScaledVector(wall.right, position).setY(centerHeight);
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(wall.right, UP, wall.normal));

  const canvas = new THREE.Mesh(
    new THREE.PlaneGeometry(artwork.width, artwork.height),
    new THREE.MeshStandardMaterial({ color: LOADING_COLOR, roughness: 0.85 }),
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

  // Sopra la targhetta, centrato su di lei, il pulsante dell'audioguida delle opere con visita narrata.
  if (artwork.tour?.length) {
    const badge = createTourBadge();
    badge.position.set(
      label.position.x,
      LABEL_CENTER_HEIGHT + LABEL_HEIGHT / 2 + BADGE_GAP + AUDIO_BUTTON_HEIGHT / 2 - centerHeight,
      0,
    );
    group.add(badge);
  }

  addSpotlight(group, artwork, centerHeight, context);
  return group;
}

/** Mette l'immagine sulla tela, al posto del colore scuro del caricamento. */
export function setArtworkTexture(group: THREE.Object3D, texture: THREE.Texture): void {
  const canvas = group.getObjectByName('canvas') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined;
  if (!canvas) return;
  canvas.material.map?.dispose();
  canvas.material.map = texture;
  canvas.material.color.set(0xffffff);
  canvas.material.needsUpdate = true;
}

/** Toglie l'immagine dalla tela, che torna scura, e ne libera la memoria. */
export function clearArtworkTexture(group: THREE.Object3D): void {
  const canvas = group.getObjectByName('canvas') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined;
  if (!canvas?.material.map) return;
  canvas.material.map.dispose();
  canvas.material.map = null;
  canvas.material.color.set(LOADING_COLOR);
  canvas.material.needsUpdate = true;
}

/** Il faretto del quadro, salvato da createArtwork. */
export function spotOf(group: THREE.Object3D): ArtworkSpot {
  return group.userData.spot as ArtworkSpot;
}

/** Libera la memoria della scheda grafica di un quadro smontato, tranne le risorse condivise con gli altri. */
export function disposeArtwork(group: THREE.Object3D): void {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    releaseTourBadge(object);
    if (!object.geometry.userData.shared) object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.userData.shared) continue;
      (material as THREE.MeshStandardMaterial).map?.dispose();
      material.dispose();
    }
  });
}

/** Cornice modanata intorno alla tela, che appoggia sul muro (z = 0) e copre di poco i bordi della tela. */
function createFrameGeometry(width: number, height: number, frameWidth: number): THREE.BufferGeometry {
  const depth = Math.max(MIN_FRAME_DEPTH, frameWidth * FRAME_DEPTH_RATIO);
  const profile: ProfilePoint[] = [
    // Il filo interno, appena davanti alla tela.
    { offset: -REBATE, height: CANVAS_OFFSET + 0.003, shade: 0.55 },
    ...FRAME_PROFILE.map(([offset, height, shade]) => ({ offset: offset * frameWidth, height: height * depth, shade })),
  ];
  return createMoldingGeometry(width / 2, height / 2, profile);
}

/**
 * Faretto appeso con un corto stelo al binario sul soffitto, puntato sul centro del quadro, con il cono di luce
 * dimensionato sulla cornice. Il binario sta alla stessa distanza dal muro per tutti i quadri: cambia l'inclinazione.
 */
function addSpotlight(group: THREE.Group, artwork: Artwork, centerHeight: number, lighting: ArtworkContext): void {
  const frameWidth = frameWidthFor(artwork);
  const trackY = lighting.ceilingHeight - TRACK_HEIGHT - centerHeight;
  const pivot = new THREE.Vector3(0, trackY - SPOT_STEM, SPOT_TRACK_DISTANCE);
  const target = new THREE.Vector3(0, 0, CANVAS_OFFSET);
  const direction = target.clone().sub(pivot).normalize();
  const lens = pivot.clone().addScaledVector(direction, SPOT_BODY_LENGTH);
  const distance = lens.distanceTo(target);

  // Sul muro il cono si allunga in verticale (circa il doppio, con la luce a 60° dalla parete):
  // basta coprire la larghezza e metà dell'altezza della cornice.
  const coverage = Math.max(artwork.width / 2 + frameWidth, (artwork.height / 2 + frameWidth) / 2) * 1.2;
  const spot: ArtworkSpot = { position: lens, target, angle: Math.atan(coverage / distance), intensity: lighting.spotStrength * distance * distance };
  group.userData.spot = spot;

  const body = new THREE.Mesh(trackBodyGeometry, trackBodyMaterial);
  body.position.copy(lens).addScaledVector(direction, -SPOT_BODY_LENGTH / 2);
  body.quaternion.setFromUnitVectors(UP, direction);

  const lensMesh = new THREE.Mesh(trackLensGeometry, trackLensMaterial);
  lensMesh.position.copy(lens).addScaledVector(direction, 0.002);
  lensMesh.quaternion.setFromUnitVectors(FORWARD, direction);

  const stem = new THREE.Mesh(trackStemGeometry, trackBodyMaterial);
  stem.scale.y = SPOT_STEM;
  stem.position.set(pivot.x, pivot.y + SPOT_STEM / 2, pivot.z);

  group.add(body, lensMesh, stem);
}
