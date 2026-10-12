import { WALL_IDS, type WallId } from '../scene/Room';

/** Una tappa della visita guidata: un dettaglio del quadro su cui la camera si avvicina. */
export interface TourStop {
  /** Centro del dettaglio sull'immagine, da 0 a 1 partendo dall'angolo in alto a sinistra. */
  x: number;
  y: number;
  /** 1 = quadro intero; 2 = due volte più vicino, e così via. */
  zoom: number;
  /** Raggio dell'area evidenziata, in frazione del lato più lungo del quadro. Se manca si ricava dallo zoom. */
  radius?: number;
  /** Testo del sottotitolo, letto anche ad alta voce. */
  text: string;
}

/** Un'opera come arriva da Sanity. */
export interface Artwork {
  id: string;
  title: string;
  author?: string;
  year?: string | number;
  /** Museo o luogo in cui è conservata l'opera. */
  location?: string;
  /** Indirizzo dell'immagine. Se manca si usa un'immagine simbolica. */
  image?: string;
  /** Dimensioni reali della tela in metri, cornice esclusa. */
  width: number;
  height: number;
  wall: WallId;
  /** Spostamento dal centro della parete in metri: positivo verso destra guardando la parete. */
  position: number;
  /** Altezza da terra del centro del quadro, in metri. */
  centerHeight?: number;
  /** Pagina da cui proviene l'immagine, per esempio su Wikimedia Commons. */
  source?: string;
  /** Tappe della visita guidata, nell'ordine in cui vengono presentate. */
  tour?: TourStop[];
}

/** Il progetto Sanity da cui leggere le opere. */
export interface ArtworkSource {
  projectId: string;
  dataset: string;
  apiVersion: string;
  /** Lato più lungo, in pixel, delle immagini da scaricare. */
  maxImageSize: number;
}

/**
 * Carica le opere pubblicate su Sanity. Le opere con errori vengono saltate con un avviso in console,
 * così un errore di battitura non blocca tutto il museo.
 */
export async function loadArtworks(source: ArtworkSource): Promise<Artwork[]> {
  const response = await fetch(queryUrl(source));
  if (!response.ok) throw new Error(`Sanity: risposta HTTP ${response.status}`);
  const data = withoutNulls(((await response.json()) as { result?: unknown }).result);
  if (!Array.isArray(data)) throw new Error('Sanity: la risposta non contiene una lista di opere');

  const artworks: Artwork[] = [];
  const ids = new Set<string>();
  data.forEach((entry: unknown, index) => {
    const problem = findProblem(entry, ids);
    if (problem) {
      const id = (entry as { id?: unknown } | null)?.id;
      console.warn(`Sanity, opera n. ${index + 1}${typeof id === 'string' ? ` ("${id}")` : ''} ignorata: ${problem}`);
      return;
    }
    const artwork = entry as Artwork;
    if (artwork.tour !== undefined) artwork.tour = validTourStops(artwork);
    ids.add(artwork.id);
    artworks.push(artwork);
  });
  return artworks;
}

/** Interroga l'API di Sanity chiedendo le opere già nella forma di Artwork. */
function queryUrl({ projectId, dataset, apiVersion, maxImageSize }: ArtworkSource): string {
  // fit=max riduce solo le immagini più grandi di maxImageSize, senza mai ingrandirle;
  // auto=format le converte in WebP o AVIF se il browser li supporta.
  const imageParams = `?fit=max&w=${maxImageSize}&h=${maxImageSize}&auto=format`;
  const query = `*[_type == "artwork"] | order(wall, position) {
    "id": slug.current, title, author, year, location,
    "image": image.asset->url + "${imageParams}",
    width, height, wall, position, centerHeight, source,
    "tour": tour[] { x, y, zoom, radius, text }
  }`;
  // apicdn risponde da una cache vicina al visitatore, che Sanity aggiorna quando si pubblica dallo Studio.
  return `https://${projectId}.apicdn.sanity.io/v${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(query)}`;
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

function findProblem(entry: unknown, usedIds: ReadonlySet<string>): string | null {
  if (typeof entry !== 'object' || entry === null) return 'non è un oggetto';
  const fields = entry as Record<string, unknown>;

  if (!isText(fields.id)) return 'manca "id"';
  if (usedIds.has(fields.id)) return `l'id "${fields.id}" è già usato da un'altra opera`;
  if (!isText(fields.title)) return 'manca "title"';
  if (!WALL_IDS.includes(fields.wall as WallId)) return `"wall" deve essere uno tra: ${WALL_IDS.join(', ')}`;
  if (typeof fields.position !== 'number') return '"position" deve essere un numero (metri dal centro della parete)';
  if (!isPositive(fields.width) || !isPositive(fields.height)) return '"width" e "height" devono essere numeri positivi (metri)';
  if (fields.centerHeight !== undefined && !isPositive(fields.centerHeight)) return '"centerHeight" deve essere un numero positivo (metri)';
  for (const key of ['author', 'location', 'image', 'source']) {
    if (fields[key] !== undefined && typeof fields[key] !== 'string') return `"${key}" deve essere un testo`;
  }
  if (fields.year !== undefined && !isText(fields.year) && typeof fields.year !== 'number') return '"year" deve essere un testo o un numero';
  return null;
}

/** Tiene solo le tappe valide: una tappa sbagliata non cancella il resto della visita. */
function validTourStops(artwork: Artwork): TourStop[] {
  const stops: unknown = artwork.tour;
  if (!Array.isArray(stops)) {
    console.warn(`Sanity, "${artwork.id}": "tour" deve essere una lista di tappe, visita ignorata`);
    return [];
  }
  return stops.filter((stop: unknown, index): stop is TourStop => {
    const problem = findStopProblem(stop);
    if (problem) console.warn(`Sanity, "${artwork.id}", tappa n. ${index + 1} ignorata: ${problem}`);
    return problem === null;
  });
}

function findStopProblem(stop: unknown): string | null {
  if (typeof stop !== 'object' || stop === null) return 'non è un oggetto';
  const fields = stop as Record<string, unknown>;
  const isFraction = (value: unknown) => typeof value === 'number' && value >= 0 && value <= 1;
  if (!isFraction(fields.x) || !isFraction(fields.y)) return '"x" e "y" devono essere numeri tra 0 e 1';
  if (typeof fields.zoom !== 'number' || fields.zoom < 1) return '"zoom" deve essere un numero da 1 in su';
  if (fields.radius !== undefined && !isPositive(fields.radius)) return '"radius" deve essere un numero positivo';
  if (!isText(fields.text)) return 'manca "text"';
  return null;
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && value > 0;
}
