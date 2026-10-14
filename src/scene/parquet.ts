import * as THREE from 'three';
import { seededRandom } from '../utils/random';
import { createTextureCanvas } from '../utils/textureCanvas';

/** Lato in metri della porzione di pavimento coperta da una ripetizione della texture: quattro file di doghe da 36 cm. */
export const PARQUET_TILE_SIZE = 1.44;

const SIZE = 1024;
const COLUMNS = 4;
/** Doghe per fila in una ripetizione: la doga è lunga sei volte la sua larghezza. */
const PLANKS_PER_COLUMN = 12;
const GAP = 2.5;

/**
 * Disegna una texture di parquet a spina ungherese che si ripete senza giunture visibili: file di doghe inclinate
 * a 45°, alternate, con le teste tagliate in dritto lungo la fila, che si incontrano a punta.
 * Le file corrono lungo l'asse verticale dell'immagine, cioè lungo la profondità della sala.
 */
export function createParquetTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const ctx = createTextureCanvas(SIZE, SIZE);
  const random = seededRandom(11);
  const columnWidth = SIZE / COLUMNS;
  const plankStep = SIZE / PLANKS_PER_COLUMN;

  // Il fondo scuro resta visibile come fuga tra le doghe.
  ctx.fillStyle = '#3a2c1f';
  ctx.fillRect(0, 0, SIZE, SIZE);

  for (let column = 0; column < COLUMNS; column++) {
    const slope = column % 2 === 0 ? 1 : -1;
    const left = column * columnWidth;
    // Nelle file che scendono le doghe partono più in alto, così le punte delle due file coincidono.
    const start = slope > 0 ? 0 : columnWidth;
    for (let plank = 0; plank < PLANKS_PER_COLUMN; plank++) {
      const seed = Math.floor(random() * 2 ** 31);
      const top = start + plank * plankStep;
      // Disegnata tre volte: le parti che escono da un bordo rientrano dall'altro.
      for (const shift of [-SIZE, 0, SIZE]) drawPlank(ctx, seed, left, top + shift, columnWidth, plankStep, slope);
    }
  }

  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  // Tiene nitido il pavimento anche guardandolo di sbieco.
  texture.anisotropy = maxAnisotropy;
  return texture;
}

/** Una doga: un parallelogramma con i lati lunghi inclinati di `slope` (1 o -1) e le teste verticali. */
function drawPlank(ctx: CanvasRenderingContext2D, seed: number, left: number, top: number, width: number, step: number, slope: number): void {
  const random = seededRandom(seed);
  const hue = 29 + random() * 6;
  const saturation = 30 + random() * 8;
  const lightness = 39 + random() * 8;

  // La fuga: i lati lunghi rientrano in verticale di GAP/2 · √2, le teste di GAP/2.
  const inset = (GAP / 2) * Math.SQRT2;
  const x0 = left + GAP / 2;
  const x1 = left + width - GAP / 2;
  const edge = (x: number, offset: number) => top + offset + slope * (x - left);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, edge(x0, inset));
  ctx.lineTo(x1, edge(x1, inset));
  ctx.lineTo(x1, edge(x1, step - inset));
  ctx.lineTo(x0, edge(x0, step - inset));
  ctx.closePath();
  ctx.clip();

  // Più chiara a una testa che all'altra, come una doga vera sotto la luce radente.
  const gradient = ctx.createLinearGradient(x0, edge(x0, 0), x1, edge(x1, 0));
  gradient.addColorStop(0, `hsl(${hue} ${saturation}% ${lightness + 3}%)`);
  gradient.addColorStop(1, `hsl(${hue} ${saturation}% ${lightness - 3}%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(left, Math.min(edge(left, 0), edge(left + width, 0)) - 1, width, width + step + 2);

  // Venature: linee sottili e leggermente ondulate lungo la doga.
  const veins = 6 + Math.floor(random() * 7);
  for (let i = 0; i < veins; i++) {
    const offset = random() * step;
    const amplitude = 0.5 + random() * 2;
    const frequency = 0.02 + random() * 0.05;
    const phase = random() * Math.PI * 2;
    ctx.beginPath();
    for (let x = left; x <= left + width; x += 6) {
      const y = edge(x, offset) + Math.sin(x * frequency + phase) * amplitude;
      if (x === left) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `hsl(${hue} ${saturation + 6}% ${lightness - 12 - random() * 8}% / ${0.15 + random() * 0.3})`;
    ctx.lineWidth = 0.6 + random() * 1.4;
    ctx.stroke();
  }

  ctx.restore();
}
