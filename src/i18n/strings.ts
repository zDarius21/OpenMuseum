import { language, type Language } from './language';

/** «1 opera», «12 opere». */
const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

/** Un passo delle istruzioni, con il testo per mouse e tastiera e quello per touch. */
interface Step {
  title: string;
  desktop: string;
  touch: string;
}

/** I testi dell'interfaccia in italiano. Le altre lingue hanno le stesse voci. */
const it = {
  page: {
    title: 'OpenMuseum – Museo virtuale 3D',
    description: 'Museo virtuale 3D con visite guidate interattive e zoom narrato sui dettagli delle opere.',
  },
  /** Per la voce narrante e per scegliere tra le voci del sistema. */
  speech: 'it-IT',
  language: {
    group: 'Lingua',
  },
  start: {
    search: 'Cerca un titolo o un artista',
    routeTitle: 'Scegli le tappe del tuo percorso',
    routeLead: "Ogni corrente che tocchi diventa una sala, nell'ordine in cui si sono succedute.",
    loadingCatalog: 'Caricamento del catalogo…',
    emptyCatalog: 'Il catalogo è ancora vuoto',
    catalogError: 'Impossibile caricare il catalogo: riprova più tardi',
    guideTitle: 'Come si visita',
    loadingFirstRoom: 'Caricamento della prima sala',
    preparingFirstRoom: 'Preparazione della prima sala…',
    back: 'Torna al museo',
    changeRoute: 'Cambia il percorso',
    create: 'Inizia il percorso',
    loading: 'Caricamento…',
    enter: 'Entra nel museo',
    help: 'Istruzioni',
    chooseStop: 'Scegli almeno una tappa',
    stops: (n: number) => plural(n, 'tappa', 'tappe'),
    works: (n: number) => plural(n, 'opera', 'opere'),
    rooms: (n: number) => plural(n, 'sala', 'sale'),
    noWorks: 'nessuna opera',
    chosen: (chosen: number, total: number) => `${plural(chosen, 'opera', 'opere')} su ${total} nel percorso`,
    all: 'Tutti',
    artists: 'Artisti:',
    artistsFound: 'Artisti trovati',
    found: (n: number) => (n === 0 ? 'Nessuna opera trovata' : plural(n, 'opera trovata', 'opere trovate')),
    pickResults: 'Scegli quelle da mettere nel percorso',
    /** Il riepilogo del museo pronto, per esempio «5 sale · 30 opere». */
    ready: (rooms: number, works: number) => `${rooms === 1 ? 'Una sala' : `${rooms} sale`} · ${works === 1 ? "un'opera" : `${works} opere`}`,
    steps: [
      {
        title: 'Muoviti',
        desktop: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o le frecce; le porte portano alle altre sale',
        touch: 'Usa il joystick in basso a sinistra; le porte portano alle altre sale',
      },
      {
        title: 'Guardati intorno',
        desktop: 'Muovi il mouse; <kbd>Esc</kbd> lo libera',
        touch: 'Trascina il dito sullo schermo',
      },
      {
        title: 'Scopri le opere',
        desktop: 'Fermati al cordone davanti a un quadro e guardalo: compare la sua scheda',
        touch: 'Fermati al cordone davanti a un quadro e inquadralo: compare la sua scheda',
      },
      {
        title: 'Guarda da vicino',
        desktop: 'Dal cordone clicca un quadro: rotellina per ingrandire, trascina per spostarti',
        touch: 'Dal cordone tocca un quadro: pizzica per ingrandire, trascina per spostarti',
      },
      {
        title: 'Visite guidate',
        desktop: 'Le opere con questo simbolo hanno una visita narrata: avvicinati al cordone e clicca il quadro',
        touch: 'Le opere con questo simbolo hanno una visita narrata: avvicinati al cordone e tocca il quadro',
      },
      {
        title: 'Orientati',
        desktop: 'La mappa in alto a destra mostra la sala in cui sei e dove stai guardando',
        touch: 'La mappa in alto a destra mostra la sala in cui sei e dove stai guardando',
      },
    ] as Step[],
  },
  room: {
    /** Nel cartello d'ingresso e sotto la mappa: «Sala 2 di 5 · Barocco». */
    caption: (index: number, total: number, title: string) => `Sala ${index} di ${total} · ${title}`,
    /** Sopra le porte: «‹ Sala 1 · Rinascimento», «Sala 3 · Barocco ›». */
    previousSign: (index: number, title: string) => `‹ Sala ${index} · ${title}`,
    nextSign: (index: number, title: string) => `Sala ${index} · ${title} ›`,
    map: 'Mappa della sala',
  },
  artwork: {
    unknownArtist: 'Autore ignoto',
    /** La targhetta accanto ai quadri con la visita guidata. */
    labelTour: '▶ Visita guidata',
    /** «1599 circa» resta com'è. */
    circa: (years: string) => `${years} circa`,
  },
  card: {
    label: "Scheda dell'opera",
    more: 'Leggi tutto',
    less: 'Riduci',
    enterKey: 'Invio',
    startTour: '▶ Avvia la visita guidata',
    tourNote: (stops: number) => `${plural(stops, 'tappa', 'tappe')}, con voce narrante`,
    view: '⤢ Guarda da vicino',
    image: (source: string) => `Immagine: ${source} ↗`,
  },
  aim: {
    tourNear: 'Clic per la visita guidata',
    tourFar: 'Avvicinati per la visita guidata',
    viewNear: 'Clic per guardarlo da vicino',
  },
  hint: {
    title: 'Clicca per continuare la visita',
    help: 'Il pulsante <span class="hint__key">?</span> in alto a destra riapre le istruzioni',
  },
  tour: {
    label: 'Visita guidata',
    tooFar: 'Avvicinati al cordone davanti al quadro per la visita guidata',
    previous: '‹ Indietro',
    previousLabel: 'Tappa precedente',
    next: 'Avanti ›',
    nextLabel: 'Tappa successiva',
    exit: '✕ Esci',
    exitLabel: 'Esci dalla visita guidata',
    pause: '❚❚ Pausa',
    pauseLabel: 'Metti in pausa',
    restart: '↺ Ricomincia',
    restartLabel: 'Ricomincia la visita',
    resume: '▶ Riprendi',
    resumeLabel: 'Riprendi la visita',
  },
  viewer: {
    label: 'Vista ravvicinata',
    tooFar: 'Avvicinati al cordone davanti al quadro per guardarlo da vicino',
    zoomOut: 'Riduci',
    zoomIn: 'Ingrandisci',
    close: '✕ Chiudi',
    showInfo: 'Mostra la scheda',
    hideInfo: 'Nascondi la scheda',
    touchHint: 'Pizzica per ingrandire · trascina per spostarti · doppio tocco per avvicinarti',
    desktopHint: 'Rotellina per ingrandire · trascina per spostarti · doppio clic per avvicinarti · Esc per uscire',
  },
};

export type Strings = typeof it;

const en: Strings = {
  page: {
    title: 'OpenMuseum – 3D virtual museum',
    description: 'A 3D virtual museum with interactive guided tours and narrated close-ups of the artworks.',
  },
  speech: 'en-US',
  language: {
    group: 'Language',
  },
  start: {
    search: 'Search for a title or an artist',
    routeTitle: 'Choose the stops on your route',
    routeLead: 'Each movement you pick becomes a room, in the order in which they followed one another.',
    loadingCatalog: 'Loading the catalog…',
    emptyCatalog: 'The catalog is still empty',
    catalogError: "Couldn't load the catalog: please try again later",
    guideTitle: 'How to visit',
    loadingFirstRoom: 'Loading the first room',
    preparingFirstRoom: 'Preparing the first room…',
    back: 'Back to the museum',
    changeRoute: 'Change your route',
    create: 'Start your visit',
    loading: 'Loading…',
    enter: 'Enter the museum',
    help: 'Instructions',
    chooseStop: 'Choose at least one stop',
    stops: (n) => plural(n, 'stop', 'stops'),
    works: (n) => plural(n, 'work', 'works'),
    rooms: (n) => plural(n, 'room', 'rooms'),
    noWorks: 'no works',
    chosen: (chosen, total) => `${chosen} of ${plural(total, 'work', 'works')} on your route`,
    all: 'All',
    artists: 'Artists:',
    artistsFound: 'Artists found',
    found: (n) => (n === 0 ? 'No works found' : plural(n, 'work found', 'works found')),
    pickResults: 'Pick the ones to add to your route',
    ready: (rooms, works) => `${rooms === 1 ? 'One room' : `${rooms} rooms`} · ${works === 1 ? 'one work' : `${works} works`}`,
    steps: [
      {
        title: 'Move',
        desktop: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys; the doors lead to the other rooms',
        touch: 'Use the joystick at the bottom left; the doors lead to the other rooms',
      },
      {
        title: 'Look around',
        desktop: 'Move the mouse; <kbd>Esc</kbd> releases it',
        touch: 'Drag your finger across the screen',
      },
      {
        title: 'Discover the works',
        desktop: 'Stop at the rope in front of a painting and look at it: its info card appears',
        touch: 'Stop at the rope in front of a painting and frame it: its info card appears',
      },
      {
        title: 'Take a closer look',
        desktop: 'From the rope, click a painting: scroll to zoom, drag to move around',
        touch: 'From the rope, tap a painting: pinch to zoom, drag to move around',
      },
      {
        title: 'Guided tours',
        desktop: 'Works with this symbol have a narrated tour: walk up to the rope and click the painting',
        touch: 'Works with this symbol have a narrated tour: walk up to the rope and tap the painting',
      },
      {
        title: 'Find your way',
        desktop: "The map at the top right shows the room you're in and where you're looking",
        touch: "The map at the top right shows the room you're in and where you're looking",
      },
    ],
  },
  room: {
    caption: (index, total, title) => `Room ${index} of ${total} · ${title}`,
    previousSign: (index, title) => `‹ Room ${index} · ${title}`,
    nextSign: (index, title) => `Room ${index} · ${title} ›`,
    map: 'Room map',
  },
  artwork: {
    unknownArtist: 'Unknown artist',
    labelTour: '▶ Guided tour',
    circa: (years) => `c. ${years}`,
  },
  card: {
    label: 'Artwork info',
    more: 'Read more',
    less: 'Show less',
    enterKey: 'Enter',
    startTour: '▶ Start the guided tour',
    tourNote: (stops) => `${plural(stops, 'stop', 'stops')}, with narration`,
    view: '⤢ Take a closer look',
    image: (source) => `Image: ${source} ↗`,
  },
  aim: {
    tourNear: 'Click for the guided tour',
    tourFar: 'Move closer for the guided tour',
    viewNear: 'Click to take a closer look',
  },
  hint: {
    title: 'Click to continue your visit',
    help: 'The <span class="hint__key">?</span> button at the top right reopens the instructions',
  },
  tour: {
    label: 'Guided tour',
    tooFar: 'Walk up to the rope in front of the painting for the guided tour',
    previous: '‹ Back',
    previousLabel: 'Previous stop',
    next: 'Next ›',
    nextLabel: 'Next stop',
    exit: '✕ Exit',
    exitLabel: 'Exit the guided tour',
    pause: '❚❚ Pause',
    pauseLabel: 'Pause',
    restart: '↺ Restart',
    restartLabel: 'Restart the tour',
    resume: '▶ Resume',
    resumeLabel: 'Resume the tour',
  },
  viewer: {
    label: 'Close-up view',
    tooFar: 'Walk up to the rope in front of the painting to take a closer look',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    close: '✕ Close',
    showInfo: 'Show the info card',
    hideInfo: 'Hide the info card',
    touchHint: 'Pinch to zoom · drag to move around · double-tap to zoom in',
    desktopHint: 'Scroll to zoom · drag to move around · double-click to zoom in · Esc to exit',
  },
};

const STRINGS: Record<Language, Strings> = { it, en };

/** I testi dell'interfaccia nella lingua scelta. Vanno letti al momento di mostrarli, non salvati: la lingua può cambiare. */
export function t(): Strings {
  return STRINGS[language()];
}

/** L'anno come si scrive nella lingua scelta: «1599 circa» diventa «c. 1599» in inglese. */
export function formatYear(year: string | number): string {
  const text = String(year);
  const circa = text.match(/^(.*?)\s+circa$/i);
  return circa ? t().artwork.circa(circa[1]) : text;
}
