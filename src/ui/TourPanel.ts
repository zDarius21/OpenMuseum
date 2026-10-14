import { textsOf, type Artwork } from '../artworks/artworksData';
import { formatYear, t } from '../i18n/strings';

export interface TourPanelActions {
  previous(): void;
  togglePause(): void;
  next(): void;
  exit(): void;
}

export interface TourPanelState {
  index: number;
  total: number;
  text: string;
  paused: boolean;
  finished: boolean;
}

/** Pannello in basso durante la visita guidata: titolo, sottotitolo della tappa e pulsanti. */
export class TourPanel {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly author: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly previousButton: HTMLButtonElement;
  private readonly playButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly exitButton: HTMLButtonElement;

  constructor(parent: HTMLElement, actions: TourPanelActions) {
    this.root = element('section', 'tour');
    this.root.hidden = true;

    const header = element('header', 'tour__header');
    const heading = element('div', 'tour__heading');
    this.title = element('h2', 'tour__title');
    this.author = element('span', 'tour__author');
    this.counter = element('span', 'tour__counter');
    heading.append(this.title, this.author);
    header.append(heading, this.counter);

    this.subtitle = element('p', 'tour__subtitle');
    // I lettori di schermo annunciano ogni nuovo sottotitolo.
    this.subtitle.setAttribute('aria-live', 'polite');

    const buttons = element('div', 'tour__buttons');
    this.previousButton = button(actions.previous);
    this.playButton = button(actions.togglePause);
    this.nextButton = button(actions.next);
    this.exitButton = button(actions.exit);
    this.exitButton.classList.add('tour__button--exit');
    buttons.append(this.previousButton, this.playButton, this.nextButton, this.exitButton);

    this.root.append(header, this.subtitle, buttons);
    parent.append(this.root);
  }

  /** Apre il pannello, con i testi nella lingua scelta: durante la visita la lingua non si può cambiare. */
  show(artwork: Artwork): void {
    const { title, author } = textsOf(artwork);
    const text = t().tour;
    this.title.textContent = title;
    this.author.textContent = [author, artwork.year === undefined ? '' : formatYear(artwork.year)].filter(Boolean).join(', ');
    this.root.setAttribute('aria-label', text.label);
    label(this.previousButton, text.previous, text.previousLabel);
    label(this.nextButton, text.next, text.nextLabel);
    label(this.exitButton, text.exit, text.exitLabel);
    this.root.hidden = false;
  }

  update(state: TourPanelState): void {
    this.counter.textContent = `${state.index + 1} / ${state.total}`;
    this.subtitle.textContent = state.text;
    this.previousButton.disabled = state.index === 0;
    this.nextButton.disabled = state.index === state.total - 1;
    const text = t().tour;
    if (state.finished) label(this.playButton, text.restart, text.restartLabel);
    else if (state.paused) label(this.playButton, text.resume, text.resumeLabel);
    else label(this.playButton, text.pause, text.pauseLabel);
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Frazione dell'altezza dello schermo coperta dal pannello: la camera inquadra lo spazio libero sopra. */
  get coveredFraction(): number {
    if (this.root.hidden) return 0;
    const top = this.root.getBoundingClientRect().top;
    return Math.min(Math.max((window.innerHeight - top) / window.innerHeight, 0), 0.6);
  }
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function button(onClick: () => void): HTMLButtonElement {
  const node = element('button', 'tour__button');
  node.type = 'button';
  node.addEventListener('click', (event) => {
    onClick();
    // Dopo un clic con mouse o dito il pulsante perde il focus, altrimenti Spazio (pausa) lo riattiverebbe.
    // Con la tastiera (detail 0) il focus resta, per continuare a navigare con Tab.
    if (event.detail > 0) node.blur();
  });
  return node;
}

/** Il testo del pulsante e la sua descrizione per i lettori di schermo. */
function label(node: HTMLButtonElement, text: string, ariaLabel: string): void {
  node.textContent = text;
  node.setAttribute('aria-label', ariaLabel);
}
