import { language, type Language } from '../i18n/language';

/** Una tappa della visita guidata: un dettaglio del quadro su cui la camera si avvicina. */
export interface TourStop {
  /** Centro del dettaglio sull'immagine, da 0 a 1 partendo dall'angolo in alto a sinistra. */
  x: number;
  y: number;
  /** 1 = quadro intero; 2 = due volte più vicino, e così via. */
  zoom: number;
  /** Raggio dell'area evidenziata, in frazione del lato più lungo del quadro. Se manca si ricava dallo zoom. */
  radius?: number;
  /** Testo del sottotitolo in ogni lingua, letto anche ad alta voce. */
  text: Record<Language, string>;
}

/** I testi di un'opera in una lingua. */
export interface ArtworkTexts {
  title: string;
  author?: string;
  /** Museo o luogo in cui è conservata l'opera. */
  location?: string;
  /** Breve presentazione dell'opera, mostrata nella scheda. */
  description?: string;
}

/** Un'opera come arriva da Sanity. */
export interface Artwork {
  id: string;
  /** I testi in ogni lingua del sito: quelli non ancora tradotti restano in italiano. Si leggono con textsOf. */
  texts: Record<Language, ArtworkTexts>;
  /** La corrente: l'id di una di quelle in src/data/movements.ts. */
  movement: string;
  /** Come su Sanity, in italiano: «1599 circa». Si mostra con formatYear. */
  year?: string | number;
  /** Indirizzo dell'immagine. Se manca si usa un'immagine simbolica. */
  image?: string;
  /** Miniatura per il menu iniziale, ritagliata al centro. */
  thumb?: string;
  /** Dimensioni reali della tela in metri, cornice esclusa. */
  width: number;
  height: number;
  /** Pagina da cui proviene l'immagine, per esempio su Wikimedia Commons. */
  source?: string;
  /** Tappe della visita guidata, nell'ordine in cui vengono presentate. */
  tour?: TourStop[];
}

/** I testi dell'opera nella lingua scelta. */
export function textsOf(artwork: Artwork): ArtworkTexts {
  return artwork.texts[language()];
}

/** Il progetto Sanity da cui leggere le opere. */
export interface ArtworkSource {
  projectId: string;
  dataset: string;
  apiVersion: string;
  /** Lato più lungo, in pixel, delle immagini da scaricare. */
  maxImageSize: number;
  /** Misure, in pixel, delle miniature del menu iniziale. */
  thumbnail: { width: number; height: number };
}

/**
 * Carica le opere pubblicate su Sanity. Le opere con errori vengono saltate con un avviso in console,
 * così un errore di battitura non blocca tutto il museo.
 */
export async function loadArtworks(source: ArtworkSource, movements: readonly string[]): Promise<Artwork[]> {
  const response = await fetch(queryUrl(source));
  if (!response.ok) throw new Error(`Sanity: risposta HTTP ${response.status}`);
  const data = withoutNulls(((await response.json()) as { result?: unknown }).result);
  if (!Array.isArray(data)) throw new Error('Sanity: la risposta non contiene una lista di opere');

  const artworks: Artwork[] = [];
  const ids = new Set<string>();
  data.forEach((entry: unknown, index) => {
    const problem = findProblem(entry, ids, movements);
    if (problem) {
      const id = (entry as { id?: unknown } | null)?.id;
      console.warn(`Sanity, opera n. ${index + 1}${typeof id === 'string' ? ` ("${id}")` : ''} ignorata: ${problem}`);
      return;
    }
    const artwork = withTexts(entry as SanityArtwork);
    ids.add(artwork.id);
    artworks.push(artwork);
  });
  return artworks;
}

/** Interroga l'API di Sanity chiedendo le opere già nella forma di Artwork. */
function queryUrl({ projectId, dataset, apiVersion, maxImageSize, thumbnail }: ArtworkSource): string {
  // fit=max riduce solo le immagini più grandi di maxImageSize, senza mai ingrandirle; le miniature invece
  // sono ritagliate al centro. auto=format le converte in WebP o AVIF se il browser li supporta.
  const imageParams = `?fit=max&w=${maxImageSize}&h=${maxImageSize}&auto=format`;
  const thumbParams = `?fit=crop&w=${thumbnail.width}&h=${thumbnail.height}&auto=format`;
  const query = `*[_type == "artwork"] | order(title) {
    "id": slug.current, title, titleEn, author, authorEn, movement, year, location, locationEn, description, descriptionEn,
    "image": image.asset->url + "${imageParams}",
    "thumb": image.asset->url + "${thumbParams}",
    width, height, source,
    "tour": tour[] { x, y, zoom, radius, text, textEn }
  }`;
  // apicdn risponde da una cache vicina al visitatore, che Sanity aggiorna quando si pubblica dallo Studio.
  return `https://${projectId}.apicdn.sanity.io/v${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(query)}`;
}

/** Un'opera come la restituisce la query: i testi in inglese sono campi a parte, con il suffisso En. */
type SanityArtwork = Omit<Artwork, 'texts' | 'tour'> &
  ArtworkTexts & {
    titleEn?: string;
    authorEn?: string;
    locationEn?: string;
    descriptionEn?: string;
    tour?: unknown;
  };

/** Raccoglie i testi per lingua, e tiene solo le tappe valide della visita guidata. */
function withTexts(entry: SanityArtwork): Artwork {
  const { title, titleEn, author, authorEn, location, locationEn, description, descriptionEn, tour, ...rest } = entry;
  const artwork: Artwork = {
    ...rest,
    texts: {
      it: { title, author, location, description },
      en: {
        title: orItalian(titleEn, title)!,
        author: orItalian(authorEn, author),
        location: orItalian(locationEn, location),
        description: orItalian(descriptionEn, description),
      },
    },
  };
  if (tour !== undefined) artwork.tour = validTourStops(artwork.id, tour);
  return artwork;
}

/** Sanity restituisce null per i campi lasciati vuoti: qui diventano campi assenti. */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, field]) => field !== null)
      .map(([key, field]) => [key, withoutNulls(field)]),
  );
}

function findProblem(entry: unknown, usedIds: ReadonlySet<string>, movements: readonly string[]): string | null {
  if (typeof entry !== 'object' || entry === null) return 'non è un oggetto';
  const fields = entry as Record<string, unknown>;

  if (!isText(fields.id)) return 'manca "id"';
  if (usedIds.has(fields.id)) return `l'id "${fields.id}" è già usato da un'altra opera`;
  if (!isText(fields.title)) return 'manca "title"';
  if (!isPositive(fields.width) || !isPositive(fields.height)) return '"width" e "height" devono essere numeri positivi (metri)';
  if (!isText(fields.movement)) return 'manca "movement", la corrente';
  if (!movements.includes(fields.movement)) return `la corrente "${fields.movement}" non è tra quelle di src/data/movements.ts`;
  for (const key of ['titleEn', 'author', 'authorEn', 'location', 'locationEn', 'description', 'descriptionEn', 'image', 'thumb', 'source']) {
    if (fields[key] !== undefined && typeof fields[key] !== 'string') return `"${key}" deve essere un testo`;
  }
  if (fields.year !== undefined && !isText(fields.year) && typeof fields.year !== 'number') return '"year" deve essere un testo o un numero';
  return null;
}

/** Tiene solo le tappe valide: una tappa sbagliata non cancella il resto della visita. Il testo inglese che manca resta in italiano. */
function validTourStops(id: string, stops: unknown): TourStop[] {
  if (!Array.isArray(stops)) {
    console.warn(`Sanity, "${id}": "tour" deve essere una lista di tappe, visita ignorata`);
    return [];
  }
  return stops.flatMap((stop: unknown, index) => {
    const problem = findStopProblem(stop);
    if (problem) {
      console.warn(`Sanity, "${id}", tappa n. ${index + 1} ignorata: ${problem}`);
      return [];
    }
    const { text, textEn, ...rest } = stop as Omit<TourStop, 'text'> & { text: string; textEn?: string };
    return [{ ...rest, text: { it: text, en: orItalian(textEn, text)! } }];
  });
}

/** Il testo inglese, o quello italiano se la traduzione manca o è vuota. */
function orItalian(english: string | undefined, italian: string | undefined): string | undefined {
  return isText(english) ? english : italian;
}

function findStopProblem(stop: unknown): string | null {
  if (typeof stop !== 'object' || stop === null) return 'non è un oggetto';
  const fields = stop as Record<string, unknown>;
  const isFraction = (value: unknown) => typeof value === 'number' && value >= 0 && value <= 1;
  if (!isFraction(fields.x) || !isFraction(fields.y)) return '"x" e "y" devono essere numeri tra 0 e 1';
  if (typeof fields.zoom !== 'number' || fields.zoom < 1) return '"zoom" deve essere un numero da 1 in su';
  if (fields.radius !== undefined && !isPositive(fields.radius)) return '"radius" deve essere un numero positivo';
  if (!isText(fields.text)) return 'manca "text"';
  if (fields.textEn !== undefined && typeof fields.textEn !== 'string') return '"textEn" deve essere un testo';
  return null;
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && value > 0;
}
