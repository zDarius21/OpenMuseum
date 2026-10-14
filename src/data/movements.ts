import { language, type Language } from '../i18n/language';

/** Una corrente artistica: nel menu iniziale è una tappa del percorso, nel museo una o più sale. */
export interface Movement {
  /** Il valore salvato nel campo «Corrente» delle opere su Sanity. */
  id: string;
  name: Record<Language, string>;
  /** Gli artisti della corrente, per l'elenco sotto le tappe: «Artisti del Barocco», «Baroque artists». */
  artists: Record<Language, string>;
  /** Colore pastello del cerchio nel menu e dello sfondo delle miniature. */
  color: string;
  /** Colore delle pareti delle sue sale, uno di WALL_COLORS. */
  wall: string;
}

/**
 * I colori delle pareti: solo grigio, verde chiaro e beige, toni spenti che non tolgono la scena ai quadri.
 * Due correnti di fila hanno colori diversi, così passando una porta si capisce che si cambia corrente.
 */
export const WALL_COLORS = { grigio: '#b1afa9', verdeChiaro: '#b6c1a7', beige: '#d0c4ac' } as const;

/**
 * Le correnti nell'ordine in cui si sono succedute, che è anche l'ordine delle sale.
 * Lo Studio ha lo stesso elenco in studio/schemaTypes/artwork.ts: una corrente nuova va aggiunta in tutti e due.
 */
export const MOVEMENTS: readonly Movement[] = [
  {
    id: 'rinascimento',
    name: { it: 'Rinascimento', en: 'Renaissance' },
    artists: { it: 'Artisti del Rinascimento', en: 'Renaissance artists' },
    color: '#cfe0cc',
    wall: WALL_COLORS.verdeChiaro,
  },
  {
    id: 'manierismo',
    name: { it: 'Manierismo', en: 'Mannerism' },
    artists: { it: 'Artisti del Manierismo', en: 'Mannerist artists' },
    color: '#cddbe8',
    wall: WALL_COLORS.grigio,
  },
  {
    id: 'barocco',
    name: { it: 'Barocco', en: 'Baroque' },
    artists: { it: 'Artisti del Barocco', en: 'Baroque artists' },
    color: '#ddd3ea',
    wall: WALL_COLORS.beige,
  },
  {
    id: 'caravaggismo',
    name: { it: 'Caravaggismo', en: 'Caravaggism' },
    artists: { it: 'Artisti del Caravaggismo', en: 'Caravaggesque artists' },
    color: '#f1d3cf',
    wall: WALL_COLORS.grigio,
  },
  {
    id: 'rococo',
    name: { it: 'Rococò', en: 'Rococo' },
    artists: { it: 'Artisti del Rococò', en: 'Rococo artists' },
    color: '#f5d8bf',
    wall: WALL_COLORS.verdeChiaro,
  },
  {
    id: 'neoclassicismo',
    name: { it: 'Neoclassicismo', en: 'Neoclassicism' },
    artists: { it: 'Artisti del Neoclassicismo', en: 'Neoclassical artists' },
    color: '#e6e2d6',
    wall: WALL_COLORS.beige,
  },
  {
    id: 'romanticismo',
    name: { it: 'Romanticismo', en: 'Romanticism' },
    artists: { it: 'Artisti del Romanticismo', en: 'Romantic artists' },
    color: '#cde6df',
    wall: WALL_COLORS.grigio,
  },
  {
    id: 'impressionismo',
    name: { it: 'Impressionismo', en: 'Impressionism' },
    artists: { it: "Artisti dell'Impressionismo", en: 'Impressionist artists' },
    color: '#f2e3b8',
    wall: WALL_COLORS.beige,
  },
];

/** Il nome della corrente nella lingua scelta. */
export function movementName(movement: Movement): string {
  return movement.name[language()];
}
