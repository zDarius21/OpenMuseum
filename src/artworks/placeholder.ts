import * as THREE from 'three';
import { hashString, seededRandom } from '../utils/random';
import { createTextureCanvas } from '../utils/textureCanvas';
import type { Artwork } from './artworksData';

const LONG_SIDE = 512;

/** Tavolozze dei paesaggi simbolici: cielo (alto, orizzonte), astro, colline dalla più lontana alla più vicina. */
const PALETTES = [
  { sky: ['#f3c99a', '#e58f6f'], sun: '#fff1d6', hills: ['#b06a4a', '#7e4430', '#4b281c'] },
  { sky: ['#9fc3e2', '#e6eef2'], sun: '#fffbe8', hills: ['#86a36f', '#5b7a4c', '#36502f'] },
  { sky: ['#1c2a52', '#4b5f8f'], sun: '#f2eed0', hills: ['#34466f', '#222f4d', '#131b30'] },
  { sky: ['#e9dcbc', '#cdb98b'], sun: '#fff7e4', hills: ['#a3905f', '#7b6a42', '#4d432a'] },
  { sky: ['#d9b8c8', '#f2d9c4'], sun: '#fff4ea', hills: ['#9b7590', '#6e5068', '#433041'] },
];

/**
 * Immagine simbolica per le opere senza immagine (o con un'immagine che non si carica):
 * un paesaggio stilizzato con le proporzioni dell'opera, diverso per ogni id.
 */
export function createPlaceholderTexture(artwork: Artwork, maxAnisotropy: number): THREE.CanvasTexture {
  const aspect = artwork.width / artwork.height;
  const width = aspect >= 1 ? LONG_SIDE : Math.round(LONG_SIDE * aspect);
  const height = aspect >= 1 ? Math.round(LONG_SIDE / aspect) : LONG_SIDE;

  const ctx = createTextureCanvas(width, height);

  const random = seededRandom(hashString(artwork.id));
  const palette = PALETTES[Math.floor(random() * PALETTES.length)];

  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.7);
  sky.addColorStop(0, palette.sky[0]);
  sky.addColorStop(1, palette.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const radius = Math.min(width, height) * (0.07 + random() * 0.05);
  ctx.fillStyle = palette.sun;
  ctx.beginPath();
  ctx.arc(width * (0.2 + random() * 0.6), height * (0.18 + random() * 0.2), radius, 0, Math.PI * 2);
  ctx.fill();

  palette.hills.forEach((color, layer) => {
    const base = height * (0.55 + layer * 0.13);
    const amplitude = height * (0.05 + random() * 0.06);
    const [f1, f2] = [1 + random() * 2, 3 + random() * 3];
    const [p1, p2] = [random() * Math.PI * 2, random() * Math.PI * 2];

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 4) {
      const t = (x / width) * Math.PI;
      ctx.lineTo(x, base - amplitude * (0.65 * Math.sin(t * f1 + p1) + 0.35 * Math.sin(t * f2 + p2)));
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}
