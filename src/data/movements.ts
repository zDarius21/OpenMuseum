/** Una corrente artistica: nel menu iniziale è una tappa del percorso, nel museo una o più sale. */
export interface Movement {
  /** Il valore salvato nel campo «Corrente» delle opere su Sanity. */
  id: string;
  name: string;
  /** Il nome con la preposizione, per «Artisti del Barocco», «Artisti dell'Impressionismo». */
  ofName: string;
  /** Colore pastello del cerchio nel menu e dello sfondo delle miniature. */
  color: string;
}

/**
 * Le correnti nell'ordine in cui si sono succedute, che è anche l'ordine delle sale.
 * Lo Studio ha lo stesso elenco in studio/schemaTypes/artwork.ts: una corrente nuova va aggiunta in tutti e due.
 */
export const MOVEMENTS: readonly Movement[] = [
  { id: 'rinascimento', name: 'Rinascimento', ofName: 'del Rinascimento', color: '#cfe0cc' },
  { id: 'manierismo', name: 'Manierismo', ofName: 'del Manierismo', color: '#cddbe8' },
  { id: 'barocco', name: 'Barocco', ofName: 'del Barocco', color: '#ddd3ea' },
  { id: 'caravaggismo', name: 'Caravaggismo', ofName: 'del Caravaggismo', color: '#f1d3cf' },
  { id: 'rococo', name: 'Rococò', ofName: 'del Rococò', color: '#f5d8bf' },
  { id: 'neoclassicismo', name: 'Neoclassicismo', ofName: 'del Neoclassicismo', color: '#e6e2d6' },
  { id: 'romanticismo', name: 'Romanticismo', ofName: 'del Romanticismo', color: '#cde6df' },
  { id: 'impressionismo', name: 'Impressionismo', ofName: "dell'Impressionismo", color: '#f2e3b8' },
];
