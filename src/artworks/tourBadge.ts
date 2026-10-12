import * as THREE from 'three';

/** Raggio del bollino, in metri. */
export const BADGE_RADIUS = 0.075;
/** Durata in secondi di un'onda dell'anello che pulsa. */
const PULSE_PERIOD = 2.2;
/** Fin dove si allarga l'anello, in multipli del raggio del bollino. */
const PULSE_SCALE = 2.2;
const GOLD = '#e0bd6e';
const DARK = '#2b2724';

const discGeometry = new THREE.CircleGeometry(BADGE_RADIUS, 40);
const ringGeometry = new THREE.RingGeometry(BADGE_RADIUS * 0.92, BADGE_RADIUS, 40);
// Non illuminati: il bollino resta brillante e si nota anche dall'altra parte della sala.
const discMaterial = new THREE.MeshBasicMaterial({ map: createBadgeTexture(), transparent: true });
const ringMaterial = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, depthWrite: false });
const rings = new Set<THREE.Mesh>();

/**
 * Bollino dorato con il simbolo ▶ che segnala i quadri con visita guidata, con un anello che pulsa intorno.
 * L'origine è al centro del bollino, sulla superficie della parete.
 */
export function createTourBadge(): THREE.Group {
  const badge = new THREE.Group();
  badge.name = 'badge';

  const disc = new THREE.Mesh(discGeometry, discMaterial);
  disc.name = 'badge';
  disc.position.z = 0.004;

  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.z = 0.003;
  rings.add(ring);

  badge.add(disc, ring);
  return badge;
}

/** Da chiamare a ogni frame con il tempo in secondi: tutti gli anelli pulsano insieme. */
export function animateTourBadges(time: number): void {
  const phase = (time % PULSE_PERIOD) / PULSE_PERIOD;
  const scale = 1 + phase * (PULSE_SCALE - 1);
  ringMaterial.opacity = 0.75 * (1 - phase) ** 2;
  for (const ring of rings) ring.scale.setScalar(scale);
}

function createBadgeTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D non disponibile');

  const center = size / 2;
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(center, center, center - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = DARK;
  ctx.beginPath();
  ctx.arc(center, center, center - 12, 0, Math.PI * 2);
  ctx.stroke();

  // Triangolo spostato un po' a destra: il suo baricentro, non il riquadro, sta al centro.
  const half = size * 0.2;
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.moveTo(center - half * 0.75, center - half);
  ctx.lineTo(center + half * 1.1, center);
  ctx.lineTo(center - half * 0.75, center + half);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
