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
}

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
  },
  {
    id: 'manierismo',
    name: { it: 'Manierismo', en: 'Mannerism' },
    artists: { it: 'Artisti del Manierismo', en: 'Mannerist artists' },
    color: '#cddbe8',
  },
  {
    id: 'barocco',
    name: { it: 'Barocco', en: 'Baroque' },
    artists: { it: 'Artisti del Barocco', en: 'Baroque artists' },
    color: '#ddd3ea',
  },
  {
    id: 'caravaggismo',
    name: { it: 'Caravaggismo', en: 'Caravaggism' },
    artists: { it: 'Artisti del Caravaggismo', en: 'Caravaggesque artists' },
    color: '#f1d3cf',
  },
  {
    id: 'rococo',
    name: { it: 'Rococò', en: 'Rococo' },
    artists: { it: 'Artisti del Rococò', en: 'Rococo artists' },
    color: '#f5d8bf',
  },
  {
    id: 'neoclassicismo',
    name: { it: 'Neoclassicismo', en: 'Neoclassicism' },
    artists: { it: 'Artisti del Neoclassicismo', en: 'Neoclassical artists' },
    color: '#e6e2d6',
  },
  {
    id: 'romanticismo',
    name: { it: 'Romanticismo', en: 'Romanticism' },
    artists: { it: 'Artisti del Romanticismo', en: 'Romantic artists' },
    color: '#cde6df',
  },
  {
    id: 'impressionismo',
    name: { it: 'Impressionismo', en: 'Impressionism' },
    artists: { it: "Artisti dell'Impressionismo", en: 'Impressionist artists' },
    color: '#f2e3b8',
  },
];

/** Il nome della corrente nella lingua scelta. */
export function movementName(movement: Movement): string {
  return movement.name[language()];
}
