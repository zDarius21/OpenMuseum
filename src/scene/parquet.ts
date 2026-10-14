import * as THREE from 'three';
import { seededRandom } from '../utils/random';
import { createTextureCanvas } from '../utils/textureCanvas';

/** Lato in metri della porzione di pavimento coperta da una ripetizione della texture. */
export const PARQUET_TILE_SIZE = 2;

const SIZE = 1024;
const COLUMNS = 10;
const GAP = 2;

/**
 * Disegna una texture di parquet a doghe sfalsate che si ripete senza giunture visibili.
 * Le doghe corrono lungo l'asse verticale dell'immagine, cioè lungo la profondità della sala.
 */
export function createParquetTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const ctx = createTextureCanvas(SIZE, SIZE);

  const random = seededRandom(7);
  const plankWidth = SIZE / COLUMNS;

  // Il fondo scuro resta visibile come fuga tra le doghe.
  ctx.fillStyle = '#2b1a0e';
  ctx.fillRect(0, 0, SIZE, SIZE);

  for (let column = 0; column < COLUMNS; column++) {
    const lengths: number[] = [];
    let total = 0;
    while (total < SIZE) {
      const length = SIZE * (0.5 + random() * 0.45);
      lengths.push(length);
      total += length;
    }
    // L'ultima doga chiude esattamente la colonna; se resterebbe troppo corta si unisce alla precedente.
    lengths[lengths.length - 1] -= total - SIZE;
    if (lengths.length > 1 && lengths[lengths.length - 1] < SIZE * 0.15) {
      lengths[lengths.length - 2] += lengths.pop()!;
    }

    let y = random() * SIZE;
    for (const length of lengths) {
      const seed = Math.floor(random() * 2 ** 31);
      // Disegnata due volte: la parte che esce dal bordo inferiore rientra da quello superiore.
      drawPlank(ctx, seed, column * plankWidth, y, plankWidth, length);
      drawPlank(ctx, seed, column * plankWidth, y - SIZE, plankWidth, length);
      y += length;
    }
  }

  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  // Tiene nitido il pavimento anche guardandolo di sbieco.
  texture.anisotropy = maxAnisotropy;
  return texture;
}

function drawPlank(ctx: CanvasRenderingContext2D, seed: number, x: number, y: number, width: number, height: number): void {
  const random = seededRandom(seed);
  const hue = 27 + random() * 5;
  const saturation = 30 + random() * 8;
  const lightness = 45 + random() * 7;

  const left = x + GAP / 2;
  const top = y + GAP / 2;
  const w = width - GAP;
  const h = height - GAP;

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, w, h);
  ctx.clip();

  const gradient = ctx.createLinearGradient(0, top, 0, top + h);
  gradient.addColorStop(0, `hsl(${hue} ${saturation}% ${lightness + 2}%)`);
  gradient.addColorStop(1, `hsl(${hue} ${saturation}% ${lightness - 2}%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(left, top, w, h);

  // Venature: linee sottili e leggermente ondulate lungo la doga.
  const veins = 10 + Math.floor(random() * 10);
  for (let i = 0; i < veins; i++) {
    const veinX = left + random() * w;
    const amplitude = 1 + random() * 4;
    const frequency = 0.004 + random() * 0.012;
    const phase = random() * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(veinX + Math.sin(phase) * amplitude, top);
    for (let t = 8; t <= h; t += 8) {
      ctx.lineTo(veinX + Math.sin(t * frequency + phase) * amplitude, top + t);
    }
    ctx.strokeStyle = `hsl(${hue} ${saturation}% ${lightness - 14 - random() * 8}% / ${0.2 + random() * 0.35})`;
    ctx.lineWidth = 0.6 + random() * 1.6;
    ctx.stroke();
  }

  ctx.restore();
}
