import type { Artwork } from '../artworks/artworksData';
import type { PlayerControls } from '../controls/PlayerControls';

type LoadState = 'loading' | 'ready' | 'error';

interface Step {
  icon: string;
  title: string;
  desktop: string;
  touch: string;
}

// Icone a tratto, colorate con il colore del testo.
const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const STEPS: Step[] = [
  {
    icon: svg('<path d="M12 3v18M3 12h18M12 3 9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'),
    title: 'Muoviti',
    desktop: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o le frecce',
    touch: 'Usa il joystick in basso a sinistra',
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
    desktop: 'La mappa in alto a destra mostra dove sei e dove stai guardando',
    touch: 'La mappa in alto a destra mostra dove sei e dove stai guardando',
  },
];

/**
 * Schermata iniziale con le istruzioni e l'avanzamento del caricamento delle opere.
 * Si riapre come guida dal pulsante «?»; finché è aperta il visitatore resta fermo.
 */
export class StartScreen {
  private readonly controls: PlayerControls;
  private readonly root: HTMLElement;
  private readonly status: HTMLElement;
  private readonly steps: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly helpButton: HTMLButtonElement;
  private state: LoadState = 'loading';
  private mode: 'welcome' | 'help' = 'welcome';
  private open = true;

  /** `hud` è il contenitore in cui va il pulsante per riaprire le istruzioni. */
  constructor(parent: HTMLElement, hud: HTMLElement, controls: PlayerControls) {
    this.controls = controls;

    this.root = document.createElement('div');
    this.root.className = 'start';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'start-title');
    this.root.innerHTML = `
      <div class="start__panel">
        <p class="start__eyebrow">Museo virtuale 3D</p>
        <h1 class="start__title" id="start-title">OpenMuseum</h1>
        <p class="start__status" aria-live="polite"></p>
        <ul class="start__steps"></ul>
        <div class="start__progress"><div class="start__bar"></div></div>
        <button type="button" class="start__button"></button>
      </div>`;
    this.status = this.root.querySelector('.start__status')!;
    this.steps = this.root.querySelector('.start__steps')!;
    this.progress = this.root.querySelector('.start__progress')!;
    this.bar = this.root.querySelector('.start__bar')!;
    this.button = this.root.querySelector('.start__button')!;
    parent.append(this.root);

    this.helpButton = document.createElement('button');
    this.helpButton.type = 'button';
    this.helpButton.className = 'help-button';
    this.helpButton.textContent = '?';
    this.helpButton.setAttribute('aria-label', 'Istruzioni');
    this.helpButton.title = 'Istruzioni';
    hud.append(this.helpButton);

    // Con un tocco non si blocca il puntatore; con mouse o tastiera sì.
    this.button.addEventListener('click', (event) => this.close((event as PointerEvent).pointerType !== 'touch'));
    this.helpButton.addEventListener('click', () => this.showHelp());
    this.root.addEventListener('keydown', (event) => {
      if (event.code === 'Escape' && this.mode === 'help') this.close(false);
    });
    // Le istruzioni cambiano se si passa dal mouse al touch, e il pulsante «?» si nasconde durante le visite guidate.
    controls.onStateChange(() => this.render());

    this.controls.enabled = false;
    this.render();
  }

  get isOpen(): boolean {
    return this.open;
  }

  setProgress(loaded: number, total: number): void {
    if (this.state !== 'loading') return;
    this.status.textContent = total > 0 ? `Caricamento delle opere: ${loaded} di ${total}` : 'Preparazione della sala…';
    this.bar.style.width = `${total > 0 ? (loaded / total) * 100 : 0}%`;
  }

  setReady(artworks: readonly Artwork[]): void {
    this.state = 'ready';
    this.status.textContent = describeCollection(artworks);
    this.render();
    if (this.open) this.button.focus({ preventScroll: true });
  }

  setError(): void {
    this.state = 'error';
    this.status.textContent = 'Impossibile caricare le opere: riprova più tardi';
    this.render();
  }

  /** Riapre la schermata come guida, senza la parte di caricamento. */
  showHelp(): void {
    this.mode = 'help';
    this.open = true;
    this.controls.unlock();
    this.controls.enabled = false;
    this.render();
    this.button.focus({ preventScroll: true });
  }

  /** Chiude la schermata; su PC, se richiesto, blocca subito il puntatore (serve un clic dell'utente). */
  private close(lockPointer: boolean): void {
    if (this.state === 'loading' && this.mode === 'welcome') return;
    this.open = false;
    this.mode = 'help';
    this.controls.enabled = true;
    if (lockPointer && !this.controls.isTouchMode) this.controls.lock();
    this.render();
  }

  private render(): void {
    this.root.hidden = !this.open;
    this.helpButton.hidden = this.open || !this.controls.enabled;
    if (!this.open) return;

    const touch = this.controls.isTouchMode;
    this.steps.innerHTML = STEPS.map(
      (step) => `
        <li class="start__step">
          <span class="start__icon">${step.icon}</span>
          <span><strong>${step.title}</strong><span class="start__text">${touch ? step.touch : step.desktop}</span></span>
        </li>`,
    ).join('');

    const loading = this.state === 'loading' && this.mode === 'welcome';
    this.progress.hidden = !loading;
    this.button.disabled = loading;
    if (this.mode === 'help') this.button.textContent = 'Torna al museo';
    else if (loading) this.button.textContent = 'Caricamento…';
    else this.button.textContent = this.state === 'error' ? 'Entra comunque' : 'Entra nel museo';
  }
}

/** Per esempio «In sala 30 opere di Caravaggio» oppure «In sala 12 opere di 4 artisti». */
function describeCollection(artworks: readonly Artwork[]): string {
  const count = artworks.length;
  if (count === 0) return 'La sala è ancora vuota';
  const works = count === 1 ? "un'opera" : `${count} opere`;
  const authors = new Set(artworks.map((artwork) => artwork.author).filter(Boolean));
  if (authors.size === 1) return `In sala ${works} di ${[...authors][0]}`;
  if (authors.size > 1) return `In sala ${works} di ${authors.size} artisti`;
  return `In sala ${works}`;
}
