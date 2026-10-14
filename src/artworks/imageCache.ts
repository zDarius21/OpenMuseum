/**
 * Le immagini dei quadri, tenute in memoria come arrivano (compresse, non ancora decodificate). Mentre il visitatore
 * sceglie il percorso si scaricano già, nell'ordine delle sale: entrando nel museo, e poi passando da una sala
 * all'altra, spesso sono già arrivate e resta solo da decodificarle.
 */

/** Quante immagini scaricare in anticipo nello stesso momento: poche, così le prime arrivano presto. */
const PREFETCH_DOWNLOADS = 3;

/** Le immagini arrivate o in arrivo, per indirizzo. */
const downloads = new Map<string, Promise<Blob>>();
/** Le immagini ancora da scaricare in anticipo, nell'ordine in cui serviranno. */
let queue: string[] = [];
let prefetching = 0;

/**
 * Scarica in anticipo le immagini, nell'ordine dato, poche alla volta e con priorità bassa. Quelle che non sono più
 * nella lista si lasciano andare: i download già partiti finiscono, e rimettendole nel percorso le ha la cache del browser.
 */
export function prefetchImages(urls: readonly string[]): void {
  const wanted = new Set(urls);
  for (const url of downloads.keys()) if (!wanted.has(url)) downloads.delete(url);
  queue = urls.filter((url) => !downloads.has(url));
  startPrefetches();
}

/** L'immagine già scaricata o in arrivo; se non c'è, si scarica subito. */
export function fetchImage(url: string): Promise<Blob> {
  return downloads.get(url) ?? download(url, 'auto');
}

function startPrefetches(): void {
  while (prefetching < PREFETCH_DOWNLOADS && queue.length > 0) {
    const url = queue.shift()!;
    if (downloads.has(url)) continue;
    prefetching++;
    void download(url, 'low')
      .catch(() => {})
      .finally(() => {
        prefetching--;
        startPrefetches();
      });
  }
}

function download(url: string, priority: RequestPriority): Promise<Blob> {
  const blob = fetch(url, { priority }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.blob();
  });
  downloads.set(url, blob);
  // Se il download non riesce, la prossima richiesta riprova.
  blob.catch(() => {
    if (downloads.get(url) === blob) downloads.delete(url);
  });
  return blob;
}
