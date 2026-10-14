import type { PlayerControls } from '../controls/PlayerControls';
import type { CatalogFacets, Grouping, VisitFilters } from '../rooms/plan';
import { ProgressBar, type ProgressBarOptions } from './ProgressBar';

interface Step {
  icon: string;
  title: string;
  desktop: string;
  touch: string;
}

export interface StartScreenOptions {
  perRoomOptions: readonly number[];
  defaultPerRoom: number;
  loadingBar: ProgressBarOptions;
  /** Quante opere e quante sale darebbero i filtri, per il riepilogo sotto il modulo. */
  preview(filters: VisitFilters): { artworks: number; rooms: number };
  /** Chiamata con «Crea il museo»: costruisce le sale. */
  onCreate(filters: VisitFilters): void;
  /** Chiamata quando il visitatore entra (o torna) nel museo chiudendo la schermata. */
  onEnter(): void;
}

// Icone a tratto, colorate con il colore del testo.
const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const STEPS: Step[] = [
  {
    icon: svg('<path d="M12 3v18M3 12h18M12 3 9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'),
    title: 'Muoviti',
    desktop: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o le frecce; le porte portano alle altre sale',
    touch: 'Usa il joystick in basso a sinistra; le porte portano alle altre sale',
  },
  {
    icon: svg('<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
    title: 'Guardati intorno',
    desktop: 'Muovi il mouse; <kbd>Esc</kbd> lo libera',
    touch: 'Trascina il dito sullo schermo',
  },
  {
    icon: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>'),
    title: 'Scopri le opere',
    desktop: 'Fermati al cordone davanti a un quadro e guardalo: compare la sua scheda',
    touch: 'Fermati al cordone davanti a un quadro e inquadralo: compare la sua scheda',
  },
  {
    icon: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 8v5M8 10.5h5"/>'),
    title: 'Guarda da vicino',
    desktop: 'Dal cordone clicca un quadro: rotellina per ingrandire, trascina per spostarti',
    touch: 'Dal cordone tocca un quadro: pizzica per ingrandire, trascina per spostarti',
  },
  {
    icon: '<span class="start__badge" aria-hidden="true"></span>',
    title: 'Visite guidate',
    desktop: 'Le opere con questo simbolo hanno una visita narrata: avvicinati al cordone e clicca il quadro',
    touch: 'Le opere con questo simbolo hanno una visita narrata: avvicinati al cordone e tocca il quadro',
  },
  {
    icon: svg('<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>'),
    title: 'Orientati',
    desktop: 'La mappa in alto a destra mostra la sala in cui sei e dove stai guardando',
    touch: 'La mappa in alto a destra mostra la sala in cui sei e dove stai guardando',
  },
];

const GROUPINGS: { value: Grouping; label: string }[] = [
  { value: 'period', label: 'Periodo' },
  { value: 'city', label: 'Città' },
];

/**
 * Schermata iniziale in due passi: il menu con i filtri da cui si generano le sale, poi le istruzioni con
 * l'avanzamento del caricamento della prima sala. Dal pulsante «?» si riaprono le istruzioni e si possono
 * cambiare i filtri; finché è aperta il visitatore resta fermo.
 */
export class StartScreen {
  private readonly controls: PlayerControls;
  private readonly options: StartScreenOptions;
  private readonly root: HTMLElement;
  private readonly status: HTMLElement;
  private readonly form: HTMLFormElement;
  private readonly summary: HTMLElement;
  private readonly createButton: HTMLButtonElement;
  private readonly guide: HTMLElement;
  private readonly steps: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly bar: ProgressBar;
  private readonly enterButton: HTMLButtonElement;
  private readonly filtersButton: HTMLButtonElement;
  private readonly helpButton: HTMLButtonElement;
  private facets: CatalogFacets | null = null;
  private step: 'filters' | 'guide' = 'filters';
  /** Stato del museo: da creare, in preparazione (prima sala in caricamento), pronto. */
  private museum: 'none' | 'loading' | 'ready' = 'none';
  private open = true;

  /** `hud` è il contenitore in cui va il pulsante per riaprire le istruzioni. */
  constructor(parent: HTMLElement, hud: HTMLElement, controls: PlayerControls, options: StartScreenOptions) {
    this.controls = controls;
    this.options = options;

    this.root = document.createElement('div');
    this.root.className = 'start';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'start-title');
    this.root.innerHTML = `
      <div class="start__panel">
        <p class="start__eyebrow">Museo virtuale 3D</p>
        <h1 class="start__title" id="start-title">OpenMuseum</h1>
        <p class="start__status" aria-live="polite">Caricamento del catalogo…</p>
        <form class="start__filters" hidden></form>
        <div class="start__guide" hidden>
          <ul class="start__steps"></ul>
          <div class="start__progress" aria-label="Caricamento della prima sala"><div class="start__bar"></div></div>
          <button type="button" class="start__button" data-action="enter"></button>
          <button type="button" class="start__link" data-action="filters">Cambia i filtri</button>
        </div>
      </div>`;
    this.status = this.root.querySelector('.start__status')!;
    this.form = this.root.querySelector('.start__filters')!;
    this.guide = this.root.querySelector('.start__guide')!;
    this.steps = this.root.querySelector('.start__steps')!;
    this.progress = this.root.querySelector('.start__progress')!;
    this.bar = new ProgressBar(this.progress, this.root.querySelector('.start__bar')!, options.loadingBar);
    this.enterButton = this.root.querySelector('[data-action="enter"]')!;
    this.filtersButton = this.root.querySelector('[data-action="filters"]')!;
    parent.append(this.root);

    // Il modulo si riempie quando arriva il catalogo; qui i suoi elementi fissi.
    this.summary = document.createElement('p');
    this.summary.className = 'start__summary';
    this.summary.setAttribute('aria-live', 'polite');
    this.createButton = document.createElement('button');
    this.createButton.type = 'submit';
    this.createButton.className = 'start__button';
    this.createButton.textContent = 'Crea il museo';

    this.helpButton = document.createElement('button');
    this.helpButton.type = 'button';
    this.helpButton.className = 'help-button';
    this.helpButton.textContent = '?';
    this.helpButton.setAttribute('aria-label', 'Istruzioni');
    this.helpButton.title = 'Istruzioni';
    hud.append(this.helpButton);

    this.form.addEventListener('input', () => this.updateSummary());
    this.form.addEventListener('click', this.onFormClick);
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.create();
    });
    // Con un tocco non si blocca il puntatore; con mouse o tastiera sì.
    this.enterButton.addEventListener('click', (event) => this.close((event as PointerEvent).pointerType !== 'touch'));
    this.filtersButton.addEventListener('click', () => this.showStep('filters'));
    this.helpButton.addEventListener('click', () => this.showHelp());
    this.root.addEventListener('keydown', (event) => {
      if (event.code !== 'Escape' || this.museum !== 'ready') return;
      if (this.step === 'filters') this.showStep('guide');
      else this.close(false);
    });
    // Le istruzioni cambiano se si passa dal mouse al touch, e il pulsante «?» si nasconde durante le visite guidate.
    controls.onStateChange(() => this.render());

    this.controls.enabled = false;
    this.render();
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Mostra il menu con i filtri, costruito sugli anni e sulle città del catalogo. */
  setCatalog(facets: CatalogFacets): void {
    this.facets = facets;
    this.buildForm(facets);
    this.showStep('filters');
  }

  setCatalogError(): void {
    this.status.textContent = 'Impossibile caricare il catalogo: riprova più tardi';
  }

  /** A che punto è la preparazione della prima sala. Il testo non lo dice: la barra corre più del caricamento vero. */
  setProgress(done: number, total: number): void {
    if (this.museum !== 'loading') return;
    this.bar.set(total > 0 ? done / total : 0);
  }

  /** La prima sala è pronta: `summary` è per esempio «5 sale · 30 opere». Il museo si apre quando la barra è piena. */
  setReady(summary: string): void {
    this.bar.complete(() => {
      this.museum = 'ready';
      this.status.textContent = summary;
      this.render();
      if (this.open) this.enterButton.focus({ preventScroll: true });
    });
  }

  /** Riapre la schermata sulle istruzioni, da cui si possono anche cambiare i filtri. */
  showHelp(): void {
    this.open = true;
    this.controls.unlock();
    this.controls.enabled = false;
    this.showStep('guide');
  }

  private showStep(step: 'filters' | 'guide'): void {
    this.step = step;
    if (step === 'filters') {
      this.status.textContent = 'Scegli quali opere vedere e come dividerle nelle sale';
      this.updateSummary();
    }
    this.render();
    (step === 'filters' ? this.createButton : this.enterButton).focus({ preventScroll: true });
  }

  private create(): void {
    const filters = this.readFilters();
    if (!filters || this.options.preview(filters).artworks === 0) return;
    this.museum = 'loading';
    this.status.textContent = 'Preparazione della prima sala…';
    this.bar.start();
    this.showStep('guide');
    // Le sale si costruiscono dopo che la barra è comparsa: costruirle ferma la pagina per un attimo, e il clic
    // sembrerebbe non fare nulla.
    requestAnimationFrame(() => setTimeout(() => this.options.onCreate(filters)));
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

  private render(): void {
    this.root.hidden = !this.open;
    this.helpButton.hidden = this.open || !this.controls.enabled;
    if (!this.open) return;

    this.form.hidden = this.step !== 'filters' || !this.facets;
    this.guide.hidden = this.step !== 'guide';
    if (this.step !== 'guide') return;

    const touch = this.controls.isTouchMode;
    this.steps.innerHTML = STEPS.map(
      (step) => `
        <li class="start__step">
          <span class="start__icon">${step.icon}</span>
          <span><strong>${step.title}</strong><span class="start__text">${touch ? step.touch : step.desktop}</span></span>
        </li>`,
    ).join('');
    const loading = this.museum !== 'ready';
    this.progress.hidden = !loading;
    this.enterButton.disabled = loading;
    this.enterButton.textContent = loading ? 'Caricamento…' : 'Entra nel museo';
    this.filtersButton.hidden = loading;
  }

  private buildForm(facets: CatalogFacets): void {
    const years = Array.from({ length: facets.maxYear - facets.minYear + 1 }, (_, index) => facets.minYear + index);
    const yearOptions = (selected: number) => years.map((year) => `<option${year === selected ? ' selected' : ''}>${year}</option>`).join('');
    const cities = facets.cities
      .map(
        (city) => `
          <label class="chip">
            <input type="checkbox" name="city" value="${escapeHtml(city.name)}" checked />
            <span>${escapeHtml(city.name)} <small>${city.count}</small></span>
          </label>`,
      )
      .join('');
    const perRoom = this.options.perRoomOptions
      .map(
        (count) => `
          <label class="segment">
            <input type="radio" name="perRoom" value="${count}"${count === this.options.defaultPerRoom ? ' checked' : ''} />
            <span>${count}</span>
          </label>`,
      )
      .join('');
    const groupBy = GROUPINGS.map(
      ({ value, label }, index) => `
        <label class="segment">
          <input type="radio" name="groupBy" value="${value}"${index === 0 ? ' checked' : ''} />
          <span>${label}</span>
        </label>`,
    ).join('');

    this.form.innerHTML = `
      <fieldset class="field">
        <legend>Sale ordinate per</legend>
        <div class="segments">${groupBy}</div>
      </fieldset>
      <fieldset class="field">
        <legend>Periodo</legend>
        <div class="field__row">
          <label class="select">dal <select name="fromYear">${yearOptions(facets.minYear)}</select></label>
          <label class="select">al <select name="toYear">${yearOptions(facets.maxYear)}</select></label>
        </div>
      </fieldset>
      <fieldset class="field">
        <legend>Città <button type="button" class="start__link" data-cities="all">tutte</button> · <button type="button" class="start__link" data-cities="none">nessuna</button></legend>
        <div class="chips">${cities}</div>
      </fieldset>
      <fieldset class="field">
        <legend>Opere per sala</legend>
        <div class="segments">${perRoom}</div>
      </fieldset>
      <label class="toggle"${facets.tours === 0 ? ' hidden' : ''}>
        <input type="checkbox" name="onlyTours" />
        <span>Solo opere con visita guidata <small>${facets.tours}</small></span>
      </label>`;
    this.form.append(this.summary, this.createButton);
  }

  /** I filtri scelti, o null se il catalogo non è ancora arrivato. */
  private readFilters(): VisitFilters | null {
    if (!this.facets) return null;
    const data = new FormData(this.form);
    const fromYear = Number(data.get('fromYear'));
    const toYear = Number(data.get('toYear'));
    return {
      groupBy: data.get('groupBy') as Grouping,
      // Se gli anni sono invertiti, si scambiano invece di non trovare nulla.
      fromYear: Math.min(fromYear, toYear),
      toYear: Math.max(fromYear, toYear),
      cities: data.getAll('city').map(String),
      onlyTours: data.get('onlyTours') !== null,
      perRoom: Number(data.get('perRoom')),
    };
  }

  private updateSummary(): void {
    const filters = this.readFilters();
    if (!filters) return;
    const { artworks, rooms } = this.options.preview(filters);
    const works = artworks === 1 ? "Un'opera" : `${artworks} opere`;
    const halls = rooms === 1 ? 'una sala' : `${rooms} sale`;
    this.summary.textContent = artworks === 0 ? 'Nessuna opera con questi filtri' : `${works} in ${halls}`;
    this.createButton.disabled = artworks === 0;
  }

  /** «tutte» e «nessuna» accanto alle città. */
  private readonly onFormClick = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-cities]');
    if (!button) return;
    const checked = button.dataset.cities === 'all';
    for (const input of this.form.querySelectorAll<HTMLInputElement>('input[name="city"]')) input.checked = checked;
    this.updateSummary();
  };
}

/** I nomi delle città arrivano da Sanity: vanno inseriti come testo, non come HTML. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.codePointAt(0)};`);
}
