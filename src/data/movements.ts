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
 * Le correnti nell'ordine in cui sono nate, che è anche l'ordine delle sale. A pari data viene prima quella che
 * finisce prima: il Caravaggismo, che si esaurisce entro la metà del Seicento, precede il Barocco.
 * I cerchi hanno tutti la stessa luminosità pastello, e la tinta di ognuno è girata dell'angolo aureo
 * (137,5° in OKLCH) rispetto alla corrente prima: così due correnti vicine non si somigliano mai.
 * Le pareti seguono il giro beige, grigio, verde chiaro.
 * Lo Studio ha lo stesso elenco in studio/schemaTypes/artwork.ts: una corrente nuova va aggiunta in tutti e due.
 */
export const MOVEMENTS: readonly Movement[] = [
  {
    id: 'gotico',
    name: { it: 'Gotico', en: 'Gothic' },
    artists: { it: 'Artisti del Gotico', en: 'Gothic artists' },
    color: '#eed8ac',
    wall: WALL_COLORS.beige,
  },
  {
    id: 'rinascimento',
    name: { it: 'Rinascimento', en: 'Renaissance' },
    artists: { it: 'Artisti del Rinascimento', en: 'Renaissance artists' },
    color: '#aee5f9',
    wall: WALL_COLORS.grigio,
  },
  {
    id: 'primitivi-fiamminghi',
    name: { it: 'Primitivi fiamminghi', en: 'Early Netherlandish' },
    artists: { it: 'Primitivi fiamminghi', en: 'Early Netherlandish painters' },
    color: '#ffcad9',
    wall: WALL_COLORS.verdeChiaro,
  },
  {
    id: 'rinascimento-nordico',
    name: { it: 'Rinascimento nordico', en: 'Northern Renaissance' },
    artists: { it: 'Artisti del Rinascimento nordico', en: 'Northern Renaissance artists' },
    color: '#c8e5bd',
    wall: WALL_COLORS.beige,
  },
  {
    id: 'manierismo',
    name: { it: 'Manierismo', en: 'Mannerism' },
    artists: { it: 'Artisti del Manierismo', en: 'Mannerist artists' },
    color: '#d0d9fe',
    wall: WALL_COLORS.grigio,
  },
  {
    id: 'caravaggismo',
    name: { it: 'Caravaggismo', en: 'Caravaggism' },
    artists: { it: 'Artisti del Caravaggismo', en: 'Caravaggesque artists' },
    color: '#fdd0b5',
    wall: WALL_COLORS.verdeChiaro,
  },
  {
    id: 'barocco',
    name: { it: 'Barocco', en: 'Baroque' },
    artists: { it: 'Artisti del Barocco', en: 'Baroque artists' },
    color: '#ace9e4',
    wall: WALL_COLORS.beige,
  },
  {
    id: 'rococo',
    name: { it: 'Rococò', en: 'Rococo' },
    artists: { it: 'Artisti del Rococò', en: 'Rococo artists' },
    color: '#f2cdf0',
    wall: WALL_COLORS.grigio,
  },
  {
    id: 'neoclassicismo',
    name: { it: 'Neoclassicismo', en: 'Neoclassicism' },
    artists: { it: 'Artisti del Neoclassicismo', en: 'Neoclassical artists' },
    color: '#e0deaf',
    wall: WALL_COLORS.verdeChiaro,
  },
  {
    id: 'romanticismo',
    name: { it: 'Romanticismo', en: 'Romanticism' },
    artists: { it: 'Artisti del Romanticismo', en: 'Romantic artists' },
    color: '#bae0ff',
    wall: WALL_COLORS.beige,
  },
  {
    id: 'realismo',
    name: { it: 'Realismo', en: 'Realism' },
    artists: { it: 'Artisti del Realismo', en: 'Realist artists' },
    color: '#fecdcb',
    wall: WALL_COLORS.grigio,
  },
  {
    id: 'preraffaelliti',
    name: { it: 'Preraffaelliti', en: 'Pre-Raphaelites' },
    artists: { it: 'Pittori preraffaelliti', en: 'Pre-Raphaelite painters' },
    color: '#bae8cb',
    wall: WALL_COLORS.verdeChiaro,
  },
  {
    id: 'macchiaioli',
    name: { it: 'Macchiaioli', en: 'Macchiaioli' },
    artists: { it: 'Pittori macchiaioli', en: 'Macchiaioli painters' },
    color: '#ddd4fe',
    wall: WALL_COLORS.beige,
  },
  {
    id: 'impressionismo',
    name: { it: 'Impressionismo', en: 'Impressionism' },
    artists: { it: "Artisti dell'Impressionismo", en: 'Impressionist artists' },
    color: '#f5d5ae',
    wall: WALL_COLORS.grigio,
  },
  {
    id: 'simbolismo',
    name: { it: 'Simbolismo', en: 'Symbolism' },
    artists: { it: 'Artisti del Simbolismo', en: 'Symbolist artists' },
    color: '#abe7f2',
    wall: WALL_COLORS.verdeChiaro,
  },
  {
    id: 'postimpressionismo',
    name: { it: 'Postimpressionismo', en: 'Post-Impressionism' },
    artists: { it: 'Artisti del Postimpressionismo', en: 'Post-Impressionist artists' },
    color: '#fbcbe2',
    wall: WALL_COLORS.beige,
  },
  {
    id: 'divisionismo',
    name: { it: 'Divisionismo', en: 'Divisionism' },
    artists: { it: 'Pittori divisionisti', en: 'Divisionist painters' },
    color: '#d1e3b6',
    wall: WALL_COLORS.grigio,
  },
  {
    id: 'secessione',
    name: { it: 'Secessione viennese', en: 'Vienna Secession' },
    artists: { it: 'Artisti della Secessione viennese', en: 'Vienna Secession artists' },
    color: '#c9dbfe',
    wall: WALL_COLORS.verdeChiaro,
  },
  {
    id: 'fauvismo',
    name: { it: 'Fauvismo', en: 'Fauvism' },
    artists: { it: 'Artisti del Fauvismo', en: 'Fauvist artists' },
    color: '#ffcebd',
    wall: WALL_COLORS.beige,
  },
  {
    id: 'espressionismo',
    name: { it: 'Espressionismo', en: 'Expressionism' },
    artists: { it: "Artisti dell'Espressionismo", en: 'Expressionist artists' },
    color: '#afe9da',
    wall: WALL_COLORS.grigio,
  },
  {
    id: 'cubismo',
    name: { it: 'Cubismo', en: 'Cubism' },
    artists: { it: 'Artisti del Cubismo', en: 'Cubist artists' },
    color: '#ebcff7',
    wall: WALL_COLORS.verdeChiaro,
  },
  {
    id: 'futurismo',
    name: { it: 'Futurismo', en: 'Futurism' },
    artists: { it: 'Artisti del Futurismo', en: 'Futurist artists' },
    color: '#e9daad',
    wall: WALL_COLORS.beige,
  },
  {
    id: 'astrattismo',
    name: { it: 'Astrattismo', en: 'Abstract art' },
    artists: { it: "Artisti dell'Astrattismo", en: 'Abstract artists' },
    color: '#b1e3fc',
    wall: WALL_COLORS.grigio,
  },
];

/** Il nome della corrente nella lingua scelta. */
export function movementName(movement: Movement): string {
  return movement.name[language()];
}
