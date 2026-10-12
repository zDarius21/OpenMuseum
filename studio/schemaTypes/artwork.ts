import { defineArrayMember, defineField, defineType } from 'sanity';

/** Le pareti della sala: i valori devono restare uguali a WALL_IDS in src/scene/Room.ts. */
const WALLS = [
  { title: 'Nord', value: 'nord' },
  { title: 'Sud', value: 'sud' },
  { title: 'Est', value: 'est' },
  { title: 'Ovest', value: 'ovest' },
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
    { name: 'layout', title: 'Allestimento nella sala' },
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
    defineField({ name: 'author', title: 'Autore', type: 'string', fieldset: 'card' }),
    defineField({ name: 'year', title: 'Anno', description: 'Per esempio "1599 circa" o "1594-1595".', type: 'string', fieldset: 'card' }),
    defineField({ name: 'location', title: 'Dove è conservata', type: 'string', fieldset: 'card' }),
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
      name: 'width',
      title: 'Larghezza (m)',
      description: 'Dimensioni reali della tela, cornice esclusa.',
      type: 'number',
      fieldset: 'layout',
      validation: (rule) => rule.required().positive(),
    }),
    defineField({ name: 'height', title: 'Altezza (m)', type: 'number', fieldset: 'layout', validation: (rule) => rule.required().positive() }),
    defineField({
      name: 'wall',
      title: 'Parete',
      type: 'string',
      fieldset: 'layout',
      options: { list: WALLS, layout: 'radio', direction: 'horizontal' },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'position',
      title: 'Posizione sulla parete (m)',
      description: 'Spostamento dal centro della parete: positivo verso destra guardando la parete.',
      type: 'number',
      fieldset: 'layout',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'centerHeight',
      title: 'Altezza del centro da terra (m)',
      description: "Se manca si usa l'altezza standard del museo.",
      type: 'number',
      fieldset: 'layout',
      validation: (rule) => rule.positive(),
    }),
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
