import { WALL_IDS, type WallId } from '../scene/Room';

/** Un'opera come descritta in public/data/artworks.json. */
export interface Artwork {
  id: string;
  title: string;
  author?: string;
  year?: string | number;
  /** Museo o luogo in cui è conservata l'opera. */
  location?: string;
  /** Percorso dell'immagine, relativo alla cartella public. Se manca si usa un'immagine simbolica. */
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
}

/**
 * Carica le opere dal file JSON. Le voci con errori vengono saltate con un avviso in console,
 * così un errore di battitura non blocca tutto il museo.
 */
export async function loadArtworks(url: string): Promise<Artwork[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: risposta HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error(`${url}: il file deve contenere una lista di opere`);

  const artworks: Artwork[] = [];
  const ids = new Set<string>();
  data.forEach((entry: unknown, index) => {
    const problem = findProblem(entry, ids);
    if (problem) {
      const id = (entry as { id?: unknown } | null)?.id;
      console.warn(`artworks.json, opera n. ${index + 1}${typeof id === 'string' ? ` ("${id}")` : ''} ignorata: ${problem}`);
      return;
    }
    const artwork = entry as Artwork;
    ids.add(artwork.id);
    artworks.push(artwork);
  });
  return artworks;
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

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && value > 0;
}
