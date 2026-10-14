import { textsOf, type Artwork } from '../artworks/artworksData';
import type { PlayerControls } from '../controls/PlayerControls';
import { movementName, type Movement } from '../data/movements';
import { language, LANGUAGES, onLanguageChange, setLanguage, type Language } from '../i18n/language';
import { t } from '../i18n/strings';
import { artistOf, artistsOf, type MovementFacet } from '../rooms/plan';
import { HEADPHONES_ICON } from './icons';
import { ProgressBar, type ProgressBarOptions } from './ProgressBar';

export interface StartScreenOptions {
  loadingBar: ProgressBarOptions;
  /** Quante opere e quante sale darebbero le opere scelte (per id), per il riepilogo in fondo alla pagina. */
  preview(route: ReadonlySet<string>): { artworks: number; rooms: number };
  /** Chiamata quando cambiano le opere scelte (per id), anche più volte con le stesse: le immagini possono arrivare prima. */
  onRouteChange(route: ReadonlySet<string>): void;
  /** Chiamata con «Inizia il percorso» con le opere scelte: costruisce le sale. */
  onCreate(route: ReadonlySet<string>): void;
  /** Chiamata quando il visitatore entra (o torna) nel museo chiudendo la schermata. */
  onEnter(): void;
}

// Icone a tratto, colorate con il colore del testo.
const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/** Le icone dei passi delle istruzioni, nello stesso ordine dei testi in src/i18n/strings.ts. */
const STEP_ICONS = [
  svg('<path d="M12 3v18M3 12h18M12 3 9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'),
  svg('<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>'),
  svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 8v5M8 10.5h5"/>'),
  `<span class="start__badge" aria-hidden="true">${HEADPHONES_ICON}</span>`,
  svg('<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>'),
];

/** Il nome di ogni lingua nella lingua stessa, per il selettore, con la sigla che si vede sul pulsante. */
const LANGUAGE_NAMES: Record<Language, { name: string; short: string }> = {
  it: { name: 'Italiano', short: 'IT' },
  en: { name: 'English', short: 'EN' },
};

/** Il segno di spunta delle tappe e delle opere scelte. */
const CHECK = svg('<path d="m5.5 12.5 4 4.5 9-10.5"/>');

/** Dai due caratteri in su la ricerca sostituisce le opere della corrente aperta. */
const MIN_QUERY = 2;

/**
 * Schermata iniziale in due passi. Il primo è il percorso: le correnti in fila sono le tappe, e ognuna diventa
 * una o più sale; sotto, gli artisti e le opere della corrente aperta, oppure i risultati della ricerca. Ogni opera
 * si mette nel percorso o si toglie da sola; il cerchio della corrente e gli artisti le scelgono a gruppi.
 * Il secondo sono le istruzioni, con l'avanzamento del caricamento della prima sala. Dal pulsante «?» si
 * riaprono le istruzioni e si può cambiare il percorso; finché la schermata è aperta il visitatore resta fermo.
 * In alto, su tutti e due i passi, si sceglie la lingua del sito.
 */
export class StartScreen {
  private readonly controls: PlayerControls;
  private readonly options: StartScreenOptions;
  private readonly root: HTMLElement;
  private readonly search: HTMLInputElement;
  private readonly languages: HTMLElement;
  private readonly route: HTMLElement;
  private readonly status: HTMLElement;
  private readonly timeline: HTMLElement;
  private readonly artists: HTMLElement;
  private readonly works: HTMLElement;
  private readonly guide: HTMLElement;
  private readonly steps: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly bar: ProgressBar;
  private readonly createButton: HTMLButtonElement;
  private readonly enterButton: HTMLButtonElement;
  private readonly routeButton: HTMLButtonElement;
  private readonly backButton: HTMLButtonElement;
  private readonly helpButton: HTMLButtonElement;
  private facets: MovementFacet[] = [];
  /** Ogni opera del catalogo, per id, con la sua corrente. */
  private readonly entries = new Map<string, { artwork: Artwork; facet: MovementFacet }>();
  /** Le opere scelte di ogni corrente, per id: una corrente è nel percorso se ne ha almeno una. */
  private readonly chosen = new Map<string, Set<string>>();
  /** Le opere scelte delle correnti tolte con un clic sul cerchio: rimettendole nel percorso tornano com'erano. */
  private readonly previous = new Map<string, Set<string>>();
  /** La corrente di cui si vedono artisti e opere. */
  private focused: string | null = null;
  private query = '';
  private step: 'route' | 'guide' = 'route';
  /** Stato del museo: da creare, in preparazione (prima sala in caricamento), pronto. */
  private museum: 'none' | 'loading' | 'ready' = 'none';
  /** Sale e opere del museo pronto, per il riepilogo «5 sale · 30 opere». */
  private readySize = { rooms: 0, artworks: 0 };
  private catalogStatus: 'loading' | 'empty' | 'error' | 'ready' = 'loading';
  private open = true;

  /** `hud` è il contenitore in cui va il pulsante per riaprire le istruzioni. */
  constructor(parent: HTMLElement, hud: HTMLElement, controls: PlayerControls, options: StartScreenOptions) {
    this.controls = controls;
    this.options = options;

    this.root = document.createElement('div');
    this.root.className = 'start';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.innerHTML = `
      <header class="start__header">
        <p class="start__logo">OpenMuseum</p>
        <input class="start__search" type="search" autocomplete="off" enterkeyhint="search" />
        <div class="languages" role="group">
          ${LANGUAGES.map(
            (code) => `<button type="button" class="languages__button" data-language="${code}" lang="${code}" aria-label="${LANGUAGE_NAMES[code].name}" title="${LANGUAGE_NAMES[code].name}">${LANGUAGE_NAMES[code].short}</button>`,
          ).join('')}
        </div>
      </header>
      <main class="start__main">
        <section class="start__route">
          <h1 class="start__title" id="start-route-title" data-text="routeTitle"></h1>
          <p class="start__lead" data-text="routeLead"></p>
          <p class="start__status" aria-live="polite"></p>
          <div class="timeline-scroll"><ol class="timeline"></ol></div>
          <div class="artists"></div>
          <ul class="works" id="start-works"></ul>
        </section>
        <section class="start__guide" hidden>
          <h1 class="start__title" id="start-guide-title" data-text="guideTitle"></h1>
          <ul class="start__steps"></ul>
        </section>
      </main>
      <footer class="start__footer">
        <div class="start__state">
          <p class="start__summary" aria-live="polite"></p>
          <div class="start__progress"><div class="start__bar"></div></div>
        </div>
        <div class="start__actions">
          <button type="button" class="start__link" data-action="back" data-text="back"></button>
          <button type="button" class="start__link" data-action="route" data-text="changeRoute"></button>
          <button type="button" class="start__button" data-action="create" data-text="create"></button>
          <button type="button" class="start__button" data-action="enter"></button>
        </div>
      </footer>`;
    const find = <T extends HTMLElement>(selector: string) => this.root.querySelector<T>(selector)!;
    this.search = find('.start__search');
    this.languages = find('.languages');
    this.route = find('.start__route');
    this.status = find('.start__status');
    this.timeline = find('.timeline');
    this.artists = find('.artists');
    this.works = find('.works');
    this.guide = find('.start__guide');
    this.steps = find('.start__steps');
    this.summary = find('.start__summary');
    this.progress = find('.start__progress');
    this.bar = new ProgressBar(this.progress, find('.start__bar'), options.loadingBar);
    this.createButton = find('[data-action="create"]');
    this.enterButton = find('[data-action="enter"]');
    this.routeButton = find('[data-action="route"]');
    this.backButton = find('[data-action="back"]');
    parent.append(this.root);

    this.helpButton = document.createElement('button');
    this.helpButton.type = 'button';
    this.helpButton.className = 'help-button';
    this.helpButton.textContent = '?';
    hud.append(this.helpButton);

    this.languages.addEventListener('click', (event) => {
      const code = (event.target as HTMLElement).closest<HTMLElement>('[data-language]')?.dataset.language;
      if (code) setLanguage(code as Language);
    });
    this.timeline.addEventListener('click', this.onTimelineClick);
    this.artists.addEventListener('click', this.onArtistsClick);
    this.works.addEventListener('click', this.onWorksClick);
    this.search.addEventListener('input', () => {
      this.query = this.search.value;
      this.renderDetails();
    });
    this.createButton.addEventListener('click', () => this.create());
    // Con un tocco non si blocca il puntatore; con mouse o tastiera sì.
    const enter = (event: MouseEvent) => this.close((event as PointerEvent).pointerType !== 'touch');
    this.enterButton.addEventListener('click', enter);
    this.backButton.addEventListener('click', enter);
    this.routeButton.addEventListener('click', () => this.showStep('route'));
    this.helpButton.addEventListener('click', () => this.showHelp());
    this.root.addEventListener('keydown', (event) => {
      if (event.code !== 'Escape') return;
      // Esc nella ricerca la svuota e basta.
      if (event.target === this.search && this.search.value) return;
      if (this.museum !== 'ready') return;
      if (this.step === 'route') this.showStep('guide');
      else this.close(false);
    });
    // Le istruzioni cambiano se si passa dal mouse al touch, e il pulsante «?» si nasconde durante le visite guidate.
    controls.onStateChange(() => this.render());
    onLanguageChange(() => this.applyLanguage());

    this.controls.enabled = false;
    this.applyLanguage();
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Mostra le correnti del catalogo; all'inizio è scelta, con tutte le sue opere, e aperta la prima che ne ha. */
  setCatalog(facets: MovementFacet[]): void {
    this.facets = facets;
    for (const facet of facets) for (const artwork of facet.artworks) this.entries.set(artwork.id, { artwork, facet });
    const first = facets.find((facet) => facet.artworks.length > 0);
    this.catalogStatus = first ? 'ready' : 'empty';
    this.renderStatus();
    if (first) {
      this.selectMovement(first);
      this.focused = first.movement.id;
    }
    // Appena aperta la pagina nessun pulsante prende il focus: si comincia dall'alto.
    this.showStep('route', false);
  }

  setCatalogError(): void {
    this.catalogStatus = 'error';
    this.renderStatus();
  }

  /** A che punto è la preparazione della prima sala. Il testo non lo dice: la barra corre più del caricamento vero. */
  setProgress(done: number, total: number): void {
    if (this.museum !== 'loading') return;
    this.bar.set(total > 0 ? done / total : 0);
  }

  /** La prima sala è pronta: il museo ha `rooms` sale e `artworks` opere. Si può entrare quando la barra è piena. */
  setReady(rooms: number, artworks: number): void {
    this.bar.complete(() => {
      this.museum = 'ready';
      this.readySize = { rooms, artworks };
      this.render();
      if (this.open && this.step === 'guide') this.enterButton.focus({ preventScroll: true });
    });
  }

  /** Riapre la schermata sulle istruzioni, da cui si può anche cambiare il percorso. */
  showHelp(): void {
    this.open = true;
    this.controls.unlock();
    this.controls.enabled = false;
    this.showStep('guide');
  }

  private showStep(step: 'route' | 'guide', focus = true): void {
    this.step = step;
    this.root.scrollTop = 0;
    this.render();
    if (step === 'route') this.renderRoute();
    if (focus) (step === 'route' ? this.createButton : this.enterButton).focus({ preventScroll: true });
  }

  private create(): void {
    const route = this.routeIds();
    if (this.options.preview(route).artworks === 0) return;
    this.museum = 'loading';
    this.bar.start();
    this.showStep('guide');
    // Le sale si costruiscono dopo che la barra è comparsa: costruirle ferma la pagina per un attimo, e il clic
    // sembrerebbe non fare nulla.
    requestAnimationFrame(() => setTimeout(() => this.options.onCreate(route)));
  }

  /** Chiude la schermata; su PC, se richiesto, blocca subito il puntatore (serve un clic dell'utente). */
  private close(lockPointer: boolean): void {
    if (this.museum !== 'ready') return;
    this.open = false;
    this.controls.enabled = true;
    if (lockPointer && !this.controls.isTouchMode) this.controls.lock();
    this.render();
    this.options.onEnter();
  }

  /** Le opere scelte di tutte le correnti, per id. */
  private routeIds(): Set<string> {
    return new Set([...this.chosen.values()].flatMap((ids) => [...ids]));
  }

  /** Una corrente è nel percorso se ha almeno un'opera scelta. */
  private isSelected(movement: string): boolean {
    return (this.chosen.get(movement)?.size ?? 0) > 0;
  }

  /** Le opere scelte di una corrente, che si possono cambiare. */
  private chosenOf(movement: string): Set<string> {
    let ids = this.chosen.get(movement);
    if (!ids) this.chosen.set(movement, (ids = new Set()));
    return ids;
  }

  private isChosen(artwork: Artwork): boolean {
    return this.chosen.get(artwork.movement)?.has(artwork.id) ?? false;
  }

  /** Le opere di un artista nella corrente aperta («» è «Tutti»), oppure in tutto il catalogo durante la ricerca. */
  private artistWorks(artist: string): Artwork[] {
    const works = this.searching ? [...this.entries.values()].map(({ artwork }) => artwork) : (this.focusedFacet?.artworks ?? []);
    return works.filter((artwork) => artist === '' || artistOf(artwork) === artist);
  }

  /** Mette nel percorso una corrente con le opere che aveva quando è stata tolta, oppure con tutte. */
  private selectMovement(facet: MovementFacet): void {
    const id = facet.movement.id;
    this.chosen.set(id, this.previous.get(id) ?? new Set(facet.artworks.map((artwork) => artwork.id)));
    this.previous.delete(id);
  }

  private get focusedFacet(): MovementFacet | undefined {
    return this.facets.find(({ movement }) => movement.id === this.focused);
  }

  /** Se la ricerca è attiva: al posto delle opere della corrente aperta si vedono i risultati. */
  private get searching(): boolean {
    return this.query.trim().length >= MIN_QUERY;
  }

  /** Mostra il passo aperto, il pulsante «?» e i pulsanti in fondo alla pagina. */
  private render(): void {
    this.root.hidden = !this.open;
    this.helpButton.hidden = this.open || !this.controls.enabled;
    if (!this.open) return;

    const onRoute = this.step === 'route';
    const loading = this.museum === 'loading';
    this.route.hidden = !onRoute;
    this.guide.hidden = onRoute;
    this.search.hidden = !onRoute;
    this.root.setAttribute('aria-labelledby', onRoute ? 'start-route-title' : 'start-guide-title');
    this.createButton.hidden = !onRoute;
    this.backButton.hidden = !onRoute || this.museum !== 'ready';
    this.enterButton.hidden = onRoute;
    this.routeButton.hidden = onRoute || loading;
    this.progress.hidden = onRoute || !loading;

    if (onRoute) {
      this.renderSummary();
      return;
    }
    const text = t().start;
    this.summary.textContent = loading ? text.preparingFirstRoom : text.ready(this.readySize.rooms, this.readySize.artworks);
    this.enterButton.disabled = loading;
    this.enterButton.textContent = loading ? text.loading : text.enter;
    const touch = this.controls.isTouchMode;
    this.steps.innerHTML = text.steps
      .map(
        (step, index) => `
        <li class="start__step">
          <span class="start__icon">${STEP_ICONS[index]}</span>
          <span><strong>${step.title}</strong><span class="start__text">${touch ? step.touch : step.desktop}</span></span>
        </li>`,
      )
      .join('');
  }

  /** Mette nella lingua scelta i testi fissi della pagina e ridisegna il resto. */
  private applyLanguage(): void {
    const text = t().start;
    document.title = t().page.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t().page.description);
    for (const element of this.root.querySelectorAll<HTMLElement>('[data-text]')) {
      element.textContent = text[element.dataset.text as 'routeTitle' | 'routeLead' | 'guideTitle' | 'back' | 'changeRoute' | 'create'];
    }
    this.search.placeholder = text.search;
    this.search.setAttribute('aria-label', text.search);
    this.languages.setAttribute('aria-label', t().language.group);
    for (const button of this.languages.querySelectorAll<HTMLButtonElement>('[data-language]')) {
      button.setAttribute('aria-pressed', String(button.dataset.language === language()));
    }
    this.progress.setAttribute('aria-label', text.loadingFirstRoom);
    this.helpButton.setAttribute('aria-label', text.help);
    this.helpButton.title = text.help;
    this.renderStatus();
    this.render();
    if (this.open && this.step === 'route') this.renderRoute();
  }

  /** Sotto il titolo: il catalogo in arrivo, vuoto o irraggiungibile. */
  private renderStatus(): void {
    const text = t().start;
    const messages = { loading: text.loadingCatalog, empty: text.emptyCatalog, error: text.catalogError, ready: '' };
    this.status.textContent = messages[this.catalogStatus];
  }

  /** «2 tappe · 38 opere · 5 sale», e il pulsante per partire. */
  private renderSummary(): void {
    const stops = this.facets.filter(({ movement }) => this.isSelected(movement.id)).length;
    const { artworks, rooms } = this.options.preview(this.routeIds());
    const text = t().start;
    let summary = '';
    if (this.facets.length > 0) summary = stops === 0 ? text.chooseStop : [text.stops(stops), text.works(artworks), text.rooms(rooms)].join(' · ');
    this.summary.textContent = summary;
    this.createButton.disabled = artworks === 0;
  }

  /** Le tappe, poi artisti e opere della corrente aperta. */
  private renderRoute(): void {
    this.timeline.innerHTML = this.facets
      .map(({ movement, artworks }) => {
        const empty = artworks.length === 0;
        return `
          <li class="stop" style="--tint: ${movement.color}">
            <button type="button" class="stop__button" data-movement="${movement.id}" aria-controls="start-works"${empty ? ' disabled' : ''}>
              <span class="stop__dot" aria-hidden="true">${CHECK}</span>
              <span class="stop__name">${movementName(movement)}</span>
              <span class="stop__count">${empty ? t().start.noWorks : t().start.works(artworks.length)}</span>
            </button>
          </li>`;
      })
      .join('');
    this.renderDetails();
  }

  /** Segni di spunta su tappe, artisti e opere scelte, la tappa aperta, i conteggi. */
  private renderSelection(): void {
    for (const button of this.timeline.querySelectorAll<HTMLButtonElement>('[data-movement]')) {
      const id = button.dataset.movement!;
      button.setAttribute('aria-pressed', String(this.isSelected(id)));
      if (id === this.focused) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }

    // Un artista è premuto se sono scelte tutte le sue opere; nella corrente aperta, se lo sono tutte, solo «Tutti».
    const facet = this.focusedFacet;
    const chosen = facet ? facet.artworks.filter((artwork) => this.isChosen(artwork)).length : 0;
    const all = facet !== undefined && chosen === facet.artworks.length;
    for (const pill of this.artists.querySelectorAll<HTMLButtonElement>('[data-artist]')) {
      const artist = pill.dataset.artist!;
      const full = this.artistWorks(artist).every((artwork) => this.isChosen(artwork));
      const alone = this.searching || artist === '' || (facet !== undefined && artistsOf(facet.artworks).length === 1);
      pill.setAttribute('aria-pressed', String(alone ? full : full && !all));
    }
    const counter = this.artists.querySelector('[data-counter]');
    if (facet && counter) counter.textContent = t().start.chosen(chosen, facet.artworks.length);

    for (const button of this.works.querySelectorAll<HTMLButtonElement>('[data-artwork]')) {
      const { artwork } = this.entries.get(button.dataset.artwork!)!;
      const on = this.chosen.get(artwork.movement)?.has(artwork.id) ?? false;
      button.setAttribute('aria-pressed', String(on));
      // Fuori dalla ricerca le opere che non entreranno nel museo si vedono più chiare.
      button.parentElement!.classList.toggle('work--off', !on && !this.searching);
    }
    this.renderSummary();
    this.options.onRouteChange(this.routeIds());
  }

  /** Gli artisti e le opere della corrente aperta, oppure i risultati della ricerca. */
  private renderDetails(): void {
    if (this.searching) {
      this.renderSearch();
      return;
    }

    const facet = this.focusedFacet;
    if (!facet) {
      this.artists.innerHTML = '';
      this.works.innerHTML = '';
      this.renderSelection();
      return;
    }
    const pill = (artist: string, label: string) => `<button type="button" class="pill" data-artist="${escapeHtml(artist)}">${escapeHtml(label)}</button>`;
    const artists = artistsOf(facet.artworks);
    const label = facet.movement.artists[language()];
    this.artists.style.setProperty('--tint', facet.movement.color);
    this.artists.setAttribute('role', 'group');
    this.artists.setAttribute('aria-label', label);
    // Con un solo artista «Tutti» farebbe lo stesso: c'è solo il suo pulsante.
    const pills = (artists.length > 1 ? pill('', t().start.all) : '') + artists.map((name) => pill(name, name)).join('');
    this.artists.innerHTML = `<span class="artists__label">${escapeHtml(label)}:</span>${pills}<span class="artists__count" data-counter></span>`;
    this.works.innerHTML = facet.artworks.map((artwork) => workItem(artwork, facet.movement, false)).join('');
    this.renderSelection();
  }

  /** Le opere e gli artisti che corrispondono alla ricerca, in tutto il catalogo. */
  private renderSearch(): void {
    const query = normalize(this.query.trim());
    const results = this.facets.flatMap((facet) =>
      facet.artworks.filter((artwork) => normalize(`${textsOf(artwork).title} ${artistOf(artwork)}`).includes(query)).map((artwork) => ({ artwork, facet })),
    );
    // Gli artisti trovati, ognuno con il colore della prima corrente in cui compare.
    const artists = new Map<string, Movement>();
    for (const { artwork, facet } of this.entries.values()) {
      const name = artistOf(artwork);
      if (!artists.has(name) && normalize(name).includes(query)) artists.set(name, facet.movement);
    }
    const text = t().start;
    const found = text.found(results.length);
    if (artists.size > 0) {
      this.artists.setAttribute('role', 'group');
      this.artists.setAttribute('aria-label', text.artistsFound);
      this.artists.innerHTML = `
        <span class="artists__label">${text.artists}</span>
        ${[...artists].map(([name, movement]) => `<button type="button" class="pill" data-artist="${escapeHtml(name)}" style="--tint: ${movement.color}">${escapeHtml(name)}</button>`).join('')}
        <span class="artists__count">${found}</span>`;
    } else {
      this.artists.removeAttribute('role');
      this.artists.removeAttribute('aria-label');
      this.artists.innerHTML = `
        <span class="artists__label">${found}</span>
        ${results.length > 0 ? `<span class="artists__hint">${text.pickResults}</span>` : ''}`;
    }
    this.works.innerHTML = results.map(({ artwork, facet }) => workItem(artwork, facet.movement, true)).join('');
    this.renderSelection();
  }

  /**
   * Un clic su una tappa la apre e, se non c'è, la mette nel percorso con tutte le sue opere; un clic sulla tappa
   * già aperta la toglie o la rimette, lasciandola aperta.
   */
  private readonly onTimelineClick = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-movement]');
    if (!button || button.disabled) return;
    const id = button.dataset.movement!;
    const facet = this.facets.find(({ movement }) => movement.id === id)!;
    if (id === this.focused && !this.searching) {
      if (this.isSelected(id)) {
        this.previous.set(id, this.chosen.get(id)!);
        this.chosen.delete(id);
      } else this.selectMovement(facet);
      this.renderSelection();
      return;
    }
    this.focused = id;
    if (!this.isSelected(id)) this.selectMovement(facet);
    this.clearSearch();
    this.renderDetails();
  };

  /**
   * Un artista premuto toglie dal percorso le sue opere, uno non premuto le aggiunge; «Tutti» sceglie tutte quelle
   * della corrente. Nella corrente, se erano scelte tutte, un artista lascia solo le sue. Durante la ricerca un
   * artista vale per tutto il catalogo, e la sua prima corrente diventa quella aperta.
   */
  private readonly onArtistsClick = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-artist]');
    if (!button) return;
    const artist = button.dataset.artist!;
    const works = this.artistWorks(artist);
    if (works.length === 0) return;
    if (artist !== '' && button.getAttribute('aria-pressed') === 'true') {
      for (const artwork of works) this.chosenOf(artwork.movement).delete(artwork.id);
    } else {
      const facet = this.focusedFacet;
      const onlyThis = !this.searching && artist !== '' && facet !== undefined && artistsOf(facet.artworks).length > 1;
      if (onlyThis && facet.artworks.every((artwork) => this.isChosen(artwork))) this.chosenOf(facet.movement.id).clear();
      for (const artwork of works) this.chosenOf(artwork.movement).add(artwork.id);
    }
    for (const artwork of works) this.previous.delete(artwork.movement);
    this.focused = works[0].movement;
    this.renderSelection();
  };

  /** Un clic su un'opera la mette nel percorso o la toglie; nella ricerca la sua corrente diventa quella aperta. */
  private readonly onWorksClick = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-artwork]');
    const entry = button && this.entries.get(button.dataset.artwork!);
    if (!entry) return;
    const { artwork } = entry;
    const ids = this.chosenOf(artwork.movement);
    if (ids.has(artwork.id)) ids.delete(artwork.id);
    else ids.add(artwork.id);
    this.previous.delete(artwork.movement);
    this.focused = artwork.movement;
    this.renderSelection();
  };

  private clearSearch(): void {
    this.query = '';
    this.search.value = '';
  }
}

/** La scheda di un'opera: tutta la scheda è un pulsante che la mette nel percorso o la toglie. Nella ricerca dice anche la corrente. */
function workItem(artwork: Artwork, movement: Movement, withMovement: boolean): string {
  const image = artwork.thumb ? `<img class="work__image" src="${escapeHtml(artwork.thumb)}" alt="" loading="lazy" decoding="async" />` : '';
  const { title } = textsOf(artwork);
  const label = [title, artistOf(artwork), ...(withMovement ? [movementName(movement)] : [])].join(', ');
  return `
    <li class="work" style="--tint: ${movement.color}">
      <button type="button" class="work__pick" data-artwork="${escapeHtml(artwork.id)}" aria-label="${escapeHtml(label)}"></button>
      <span class="work__frame">${image}<span class="work__check" aria-hidden="true">${CHECK}</span></span>
      <span class="work__title">${escapeHtml(title)}</span>
      <span class="work__artist">${escapeHtml(artistOf(artwork))}</span>${withMovement ? `
      <span class="work__movement">${movementName(movement)}</span>` : ''}
    </li>`;
}

/** Per la ricerca: minuscole e senza accenti, così «rococo» trova «Rococò». */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** I testi arrivano da Sanity: vanno inseriti come testo, non come HTML. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.codePointAt(0)};`);
}
