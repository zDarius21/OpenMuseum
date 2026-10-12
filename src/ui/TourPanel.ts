import type { Artwork } from '../artworks/artworksData';

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

  constructor(parent: HTMLElement, actions: TourPanelActions) {
    this.root = element('section', 'tour');
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Visita guidata');

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
    this.previousButton = button('‹ Indietro', 'Tappa precedente', actions.previous);
    this.playButton = button('', '', actions.togglePause);
    this.nextButton = button('Avanti ›', 'Tappa successiva', actions.next);
    const exitButton = button('✕ Esci', 'Esci dalla visita guidata', actions.exit);
    exitButton.classList.add('tour__button--exit');
    buttons.append(this.previousButton, this.playButton, this.nextButton, exitButton);

    this.root.append(header, this.subtitle, buttons);
    parent.append(this.root);
  }

  show(artwork: Artwork): void {
    this.title.textContent = artwork.title;
    this.author.textContent = [artwork.author, artwork.year].filter(Boolean).join(', ');
    this.root.hidden = false;
  }

  update(state: TourPanelState): void {
    this.counter.textContent = `${state.index + 1} / ${state.total}`;
    this.subtitle.textContent = state.text;
    this.previousButton.disabled = state.index === 0;
    this.nextButton.disabled = state.index === state.total - 1;
    let [label, description] = ['❚❚ Pausa', 'Metti in pausa'];
    if (state.finished) [label, description] = ['↺ Ricomincia', 'Ricomincia la visita'];
    else if (state.paused) [label, description] = ['▶ Riprendi', 'Riprendi la visita'];
    this.playButton.textContent = label;
    this.playButton.setAttribute('aria-label', description);
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

function button(text: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const node = element('button', 'tour__button');
  node.type = 'button';
  node.textContent = text;
  if (ariaLabel) node.setAttribute('aria-label', ariaLabel);
  node.addEventListener('click', (event) => {
    onClick();
    // Dopo un clic con mouse o dito il pulsante perde il focus, altrimenti Spazio (pausa) lo riattiverebbe.
    // Con la tastiera (detail 0) il focus resta, per continuare a navigare con Tab.
    if (event.detail > 0) node.blur();
  });
  return node;
}
