import * as THREE from 'three';
import { language, onLanguageChange, type Language } from '../i18n/language';
import { t } from '../i18n/strings';
import { HEADPHONES_PATH } from '../ui/icons';
import { createTextureCanvas } from '../utils/textureCanvas';

/** Misure del pulsante dell'audioguida, in metri: sta sopra la targhetta, centrato, e la supera un poco ai lati. */
export const AUDIO_BUTTON_WIDTH = 0.48;
export const AUDIO_BUTTON_HEIGHT = 0.15;
/** Durata in secondi di un'onda del bordo che pulsa. */
const PULSE_PERIOD = 2.2;
/** Fin dove si allarga il bordo che pulsa, in metri oltre il pulsante. */
const PULSE_MARGIN = 0.06;
const PULSE_THICKNESS = 0.006;
const GOLD = '#e0bd6e';
const DARK = '#2b2724';

const buttonGeometry = new THREE.PlaneGeometry(AUDIO_BUTTON_WIDTH, AUDIO_BUTTON_HEIGHT);
const pulseGeometry = new THREE.ShapeGeometry(pillOutline(AUDIO_BUTTON_WIDTH, AUDIO_BUTTON_HEIGHT, PULSE_THICKNESS), 12);
// Non illuminati: il pulsante resta brillante e si nota anche dall'altra parte della sala.
const textures = new Map<Language, THREE.CanvasTexture>();
const buttonMaterial = new THREE.MeshBasicMaterial({ map: currentTexture(), transparent: true });
const pulseMaterial = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, depthWrite: false });
const pulses = new Set<THREE.Object3D>();
// Forme e materiali sono gli stessi per tutti i pulsanti: non vanno liberati quando un quadro viene smontato.
for (const resource of [buttonGeometry, pulseGeometry, buttonMaterial, pulseMaterial]) resource.userData.shared = true;

// La scritta cambia con la lingua: tutti i pulsanti usano lo stesso materiale.
onLanguageChange(() => {
  buttonMaterial.map = currentTexture();
  buttonMaterial.needsUpdate = true;
});

/**
 * Pulsante dorato «Audioguida», con le cuffie, sopra la targhetta dei quadri che hanno una visita narrata: cliccandolo
 * parte la spiegazione. Un bordo pulsa intorno per farlo notare. L'origine è al centro del pulsante, sulla parete.
 */
export function createTourBadge(): THREE.Group {
  const badge = new THREE.Group();
  badge.name = 'badge';

  const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
  button.name = 'badge';
  button.position.z = 0.004;

  const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
  pulse.position.z = 0.003;
  pulses.add(pulse);

  badge.add(button, pulse);
  return badge;
}

/** Smette di animare il bordo di un quadro smontato (gli altri oggetti vengono ignorati). */
export function releaseTourBadge(object: THREE.Object3D): void {
  pulses.delete(object);
}

/** Da chiamare a ogni frame con il tempo in secondi: tutti i bordi pulsano insieme, allargandosi della stessa misura su ogni lato. */
export function animateTourBadges(time: number): void {
  const phase = (time % PULSE_PERIOD) / PULSE_PERIOD;
  const margin = phase * PULSE_MARGIN;
  pulseMaterial.opacity = 0.75 * (1 - phase) ** 2;
  for (const pulse of pulses) pulse.scale.set(1 + (2 * margin) / AUDIO_BUTTON_WIDTH, 1 + (2 * margin) / AUDIO_BUTTON_HEIGHT, 1);
}

/** Il contorno del pulsante, spesso `thickness`: una pillola con un buco della stessa forma. */
function pillOutline(width: number, height: number, thickness: number): THREE.Shape {
  const outer = pillShape(width, height);
  outer.holes.push(pillShape(width - 2 * thickness, height - 2 * thickness));
  return outer;
}

function pillShape(width: number, height: number): THREE.Shape {
  const r = height / 2;
  const x = width / 2 - r;
  const shape = new THREE.Shape();
  shape.moveTo(-x, -r);
  shape.lineTo(x, -r);
  shape.absarc(x, 0, r, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-x, r);
  shape.absarc(-x, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  return shape;
}

/** La faccia del pulsante nella lingua scelta: cuffie in un cerchio scuro, la scritta e il triangolo del «play». */
function currentTexture(): THREE.CanvasTexture {
  const lang = language();
  let texture = textures.get(lang);
  if (texture) return texture;

  const scale = 1600;
  const width = Math.round(AUDIO_BUTTON_WIDTH * scale);
  const height = Math.round(AUDIO_BUTTON_HEIGHT * scale);
  const ctx = createTextureCanvas(width, height);
  const r = height / 2;

  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, r);
  ctx.fill();

  // Le cuffie, nel cerchio scuro a sinistra.
  const iconRadius = r - 22;
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.arc(r, r, iconRadius, 0, Math.PI * 2);
  ctx.fill();
  const iconSize = iconRadius * 1.2;
  ctx.save();
  ctx.translate(r - iconSize / 2, r - iconSize / 2 + 2);
  ctx.scale(iconSize / 24, iconSize / 24);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(HEADPHONES_PATH));
  ctx.restore();

  // A destra la scritta seguita dal triangolo del «play», più grandi possibile nello spazio che resta.
  const left = r + iconRadius + 22;
  const right = width - r * 0.55;
  const label = t().artwork.audioGuide.toUpperCase();
  const fontOf = (size: number) => `700 ${size}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  /** Larghezza di scritta, spazio e triangolo con il carattere di `size` pixel. */
  const extent = (size: number) => {
    ctx.font = fontOf(size);
    return ctx.measureText(label).width + size * 0.9;
  };
  let size = 84;
  while (extent(size) > right - left && size > 40) size -= 2;
  const start = left + (right - left - extent(size)) / 2;
  ctx.font = fontOf(size);
  ctx.fillStyle = DARK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, start, r + 4);
  const tipX = start + extent(size);
  const half = size * 0.3;
  ctx.font = fontOf(size);
  ctx.beginPath();
  ctx.moveTo(tipX, r);
  ctx.lineTo(tipX - half * 1.7, r - half);
  ctx.lineTo(tipX - half * 1.7, r + half);
  ctx.closePath();
  ctx.fill();

  texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  textures.set(lang, texture);
  return texture;
}
