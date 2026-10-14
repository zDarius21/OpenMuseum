/**
 * Canvas 2D su cui disegnare una texture. Resta in memoria invece che sulla scheda grafica (willReadFrequently):
 * da un canvas accelerato Chrome impiega decine di millisecondi a copiare l'immagine in una texture WebGL,
 * e le targhette e i cartelli di una sala appena costruita fermavano il museo per qualche frame.
 */
export function createTextureCanvas(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D non disponibile');
  return ctx;
}
