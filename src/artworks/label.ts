import * as THREE from 'three';
import type { Artwork } from './artworksData';

/** Larghezza della targhetta in metri: più grande di quelle vere, per essere leggibile dallo schermo. */
export const LABEL_WIDTH = 0.4;
/** Distanza tra la cornice e la targhetta. */
export const LABEL_GAP = 0.12;
/** Altezza da terra del centro della targhetta, uguale per tutte le opere come nei musei. */
export const LABEL_CENTER_HEIGHT = 1.4;
const LABEL_DEPTH = 0.008;

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
export const LABEL_HEIGHT = (LABEL_WIDTH * CANVAS_HEIGHT) / CANVAS_WIDTH;
const PADDING = 40;
// Targhetta scura con testo chiaro: sulla parete avorio si legge anche da dietro le transenne.
const BACKGROUND = '#2b2724';
const TEXT_COLOR = '#f4efe6';
const MUTED_COLOR = '#b8ad9f';
const ACCENT_COLOR = '#e0bd6e';
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const edgeMaterial = new THREE.MeshStandardMaterial({ color: BACKGROUND, roughness: 0.9 });

/**
 * Targhetta con autore, titolo e anno dell'opera: una lastrina appoggiata al muro.
 * L'origine è al centro del retro, quindi va posizionata direttamente sulla superficie della parete.
 */
export function createLabel(artwork: Artwork, maxAnisotropy: number): THREE.Mesh {
  const texture = new THREE.CanvasTexture(drawLabel(artwork));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  const front = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
  // Ordine delle facce di BoxGeometry: +x, -x, +y, -y, +z (fronte), -z.
  const label = new THREE.Mesh(new THREE.BoxGeometry(LABEL_WIDTH, LABEL_HEIGHT, LABEL_DEPTH).translate(0, 0, LABEL_DEPTH / 2), [
    edgeMaterial,
    edgeMaterial,
    edgeMaterial,
    edgeMaterial,
    front,
    edgeMaterial,
  ]);
  label.name = 'label';
  return label;
}

function drawLabel(artwork: Artwork): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D non disponibile');

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const maxWidth = CANVAS_WIDTH - 2 * PADDING;
  const author = artwork.author?.toUpperCase();
  const year = artwork.year === undefined ? undefined : String(artwork.year);

  // Il titolo va su due righe al massimo: se non basta, il carattere si rimpicciolisce.
  let titleSize = 64;
  let titleLines = wrap(ctx, artwork.title, `italic ${titleSize}px ${SERIF}`, maxWidth);
  while (titleLines.length > 2 && titleSize > 44) {
    titleSize -= 2;
    titleLines = wrap(ctx, artwork.title, `italic ${titleSize}px ${SERIF}`, maxWidth);
  }

  // Ogni riga può avere tratti di colore diverso (l'anno e l'indicazione della visita guidata).
  type Segment = { text: string; color: string };
  const lines: { segments: Segment[]; font: string; height: number; spaceBefore: number }[] = [];
  if (author) lines.push({ segments: [{ text: author, color: TEXT_COLOR }], font: `600 50px ${SANS}`, height: 58, spaceBefore: 0 });
  titleLines.forEach((text, index) =>
    lines.push({
      segments: [{ text, color: TEXT_COLOR }],
      font: `italic ${titleSize}px ${SERIF}`,
      height: titleSize * 1.15,
      spaceBefore: index === 0 && author ? 14 : 0,
    }),
  );
  const footer: Segment[] = [];
  if (year) footer.push({ text: year, color: MUTED_COLOR });
  if (artwork.tour?.length) footer.push({ text: `${year ? '  ·  ' : ''}▶ Visita guidata`, color: ACCENT_COLOR });
  if (footer.length) lines.push({ segments: footer, font: `42px ${SANS}`, height: 48, spaceBefore: 14 });

  // Blocco di testo centrato in verticale, allineato a sinistra.
  const blockHeight = lines.reduce((sum, line) => sum + line.spaceBefore + line.height, 0);
  let y = (CANVAS_HEIGHT - blockHeight) / 2;
  ctx.textBaseline = 'top';
  for (const line of lines) {
    y += line.spaceBefore;
    ctx.font = line.font;
    let x = PADDING;
    for (const segment of line.segments) {
      ctx.fillStyle = segment.color;
      ctx.fillText(segment.text, x, y, maxWidth - (x - PADDING));
      x += ctx.measureText(segment.text).width;
    }
    y += line.height;
  }
  return canvas;
}

/** Divide il testo in righe che stanno in `maxWidth` con il font indicato. */
function wrap(ctx: CanvasRenderingContext2D, text: string, font: string, maxWidth: number): string[] {
  ctx.font = font;
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}
