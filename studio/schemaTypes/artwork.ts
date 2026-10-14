import { defineArrayMember, defineField, defineType } from 'sanity';

/** Le pareti della vecchia sala unica, per il campo nascosto "wall". */
const WALLS = [
  { title: 'Nord', value: 'nord' },
  { title: 'Sud', value: 'sud' },
  { title: 'Est', value: 'est' },
  { title: 'Ovest', value: 'ovest' },
];

/**
 * Le correnti, nell'ordine in cui si sono succedute: nel menu iniziale sono le tappe del percorso.
 * Il museo ha lo stesso elenco, con i colori, in src/data/movements.ts: una corrente nuova va aggiunta in tutti e due.
 */
const MOVEMENTS = [
  { title: 'Rinascimento', value: 'rinascimento' },
  { title: 'Manierismo', value: 'manierismo' },
  { title: 'Barocco', value: 'barocco' },
  { title: 'Caravaggismo', value: 'caravaggismo' },
  { title: 'Rococò', value: 'rococo' },
  { title: 'Neoclassicismo', value: 'neoclassicismo' },
  { title: 'Romanticismo', value: 'romanticismo' },
  { title: 'Impressionismo', value: 'impressionismo' },
];

/** Un dettaglio del quadro su cui la camera si avvicina durante la visita guidata. */
const tourStop = defineArrayMember({
  name: 'tourStop',
  title: 'Tappa',
  type: 'object',
  fields: [
    defineField({
      name: 'text',
      title: 'Testo',
      description: 'Sottotitolo della tappa, letto anche ad alta voce.',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'textEn',
      title: 'Testo in inglese',
      description: 'Lo stesso testo per chi visita il sito in inglese. Se manca si usa quello italiano.',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'x',
      title: 'Centro x',
      description: "Da 0 (bordo sinistro dell'immagine) a 1 (bordo destro).",
      type: 'number',
      validation: (rule) => rule.required().min(0).max(1),
    }),
    defineField({
      name: 'y',
      title: 'Centro y',
      description: "Da 0 (bordo in alto dell'immagine) a 1 (bordo in basso).",
      type: 'number',
      validation: (rule) => rule.required().min(0).max(1),
    }),
    defineField({
      name: 'zoom',
      title: 'Zoom',
      description: '1 = quadro intero; 2 = due volte più vicino, e così via.',
      type: 'number',
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'radius',
      title: 'Raggio evidenziato',
      description: "In frazione del lato più lungo del quadro. Se manca si ricava dallo zoom.",
      type: 'number',
      validation: (rule) => rule.positive(),
    }),
  ],
  preview: {
    select: { text: 'text', x: 'x', y: 'y', zoom: 'zoom' },
    prepare: ({ text, x, y, zoom }) => ({ title: text, subtitle: `x ${x} · y ${y} · zoom ${zoom}` }),
  },
});

/** Un'opera esposta nel museo. */
export const artwork = defineType({
  name: 'artwork',
  title: 'Opera',
  type: 'document',
  fieldsets: [
    { name: 'card', title: "Scheda dell'opera" },
    {
      name: 'english',
      title: 'In inglese',
      description: "I testi della scheda per chi visita il sito in inglese. Quelli lasciati vuoti restano in italiano.",
      options: { collapsible: true, collapsed: true },
    },
    { name: 'layout', title: 'Misure' },
  ],
  fields: [
    defineField({ name: 'title', title: 'Titolo', type: 'string', fieldset: 'card', validation: (rule) => rule.required() }),
    defineField({
      name: 'slug',
      title: 'Identificativo',
      description: "Nome breve e unico dell'opera: si genera dal titolo.",
      type: 'slug',
      fieldset: 'card',
      options: { source: 'title' },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'author',
      title: 'Autore',
      description: 'Nel menu iniziale gli artisti di ogni corrente si possono scegliere uno per uno: scrivi il nome sempre allo stesso modo.',
      type: 'string',
      fieldset: 'card',
    }),
    defineField({
      name: 'movement',
      title: 'Corrente',
      description: 'La tappa del percorso in cui compare: le opere della stessa corrente stanno nelle stesse sale.',
      type: 'string',
      fieldset: 'card',
      options: { list: MOVEMENTS },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'year',
      title: 'Anno',
      description: 'Per esempio "1599 circa" o "1594-1595". Il primo anno serve a ordinare le opere nelle sale.',
      type: 'string',
      fieldset: 'card',
    }),
    defineField({ name: 'location', title: 'Dove è conservata', description: 'Per esempio "Galleria Borghese, Roma".', type: 'string', fieldset: 'card' }),
    defineField({
      name: 'description',
      title: 'Descrizione',
      description: "Due o tre frasi sull'opera, mostrate nella scheda che si apre guardando il quadro.",
      type: 'text',
      rows: 4,
      fieldset: 'card',
    }),
    defineField({
      name: 'image',
      title: 'Immagine',
      description: "Se manca, il museo mostra un'immagine simbolica.",
      type: 'image',
      fieldset: 'card',
    }),
    defineField({
      name: 'source',
      title: "Fonte dell'immagine",
      description: 'Pagina da cui proviene, per esempio su Wikimedia Commons.',
      type: 'url',
      fieldset: 'card',
    }),
    defineField({
      name: 'titleEn',
      title: 'Titolo',
      description: "Il titolo con cui l'opera è nota in inglese, per esempio «The Calling of Saint Matthew».",
      type: 'string',
      fieldset: 'english',
    }),
    defineField({
      name: 'authorEn',
      title: 'Autore',
      description: 'Solo se in inglese il nome è diverso, per esempio "Titian" per Tiziano.',
      type: 'string',
      fieldset: 'english',
    }),
    defineField({ name: 'locationEn', title: 'Dove è conservata', description: 'Per esempio "Borghese Gallery, Rome".', type: 'string', fieldset: 'english' }),
    defineField({ name: 'descriptionEn', title: 'Descrizione', type: 'text', rows: 4, fieldset: 'english' }),
    defineField({
      name: 'width',
      title: 'Larghezza (m)',
      description: 'Dimensioni reali della tela, cornice esclusa.',
      type: 'number',
      fieldset: 'layout',
      validation: (rule) => rule.required().positive(),
    }),
    defineField({ name: 'height', title: 'Altezza (m)', type: 'number', fieldset: 'layout', validation: (rule) => rule.required().positive() }),
    // Non più usati: le sale si generano dai filtri e le opere si dispongono da sole. Restano nascosti
    // per non perdere i valori già inseriti con la sala unica.
    defineField({
      name: 'wall',
      title: 'Parete',
      type: 'string',
      fieldset: 'layout',
      options: { list: WALLS, layout: 'radio', direction: 'horizontal' },
      hidden: true,
    }),
    defineField({ name: 'position', title: 'Posizione sulla parete (m)', type: 'number', fieldset: 'layout', hidden: true }),
    defineField({ name: 'centerHeight', title: 'Altezza del centro da terra (m)', type: 'number', fieldset: 'layout', hidden: true }),
    defineField({
      name: 'tour',
      title: 'Visita guidata',
      description: "Tappe nell'ordine in cui vengono presentate. Senza tappe il quadro non ha visita guidata.",
      type: 'array',
      of: [tourStop],
    }),
  ],
  preview: {
    select: { title: 'title', author: 'author', year: 'year', media: 'image' },
    prepare: ({ title, author, year, media }) => ({ title, subtitle: [author, year].filter(Boolean).join(', '), media }),
  },
});
