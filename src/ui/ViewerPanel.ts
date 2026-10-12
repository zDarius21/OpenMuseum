export interface ViewerPanelActions {
  zoomIn(): void;
  zoomOut(): void;
  toggleInfo(): void;
  close(): void;
}

/** Per quanti millisecondi resta visibile il promemoria dei gesti. */
const HINT_DURATION = 5000;

/** Comandi della vista ravvicinata: riduci, ingrandisci, mostra o nascondi la scheda, chiudi, con un promemoria dei gesti. */
export class ViewerPanel {
  private readonly element: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly infoButton: HTMLButtonElement;
  private hintTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(parent: HTMLElement, actions: ViewerPanelActions) {
    this.element = document.createElement('div');
    this.element.className = 'viewer';
    this.element.hidden = true;
    this.element.innerHTML = `
      <div class="viewer__bar" role="toolbar" aria-label="Vista ravvicinata">
        <button type="button" class="viewer__button" data-action="zoomOut" aria-label="Riduci" title="Riduci">−</button>
        <button type="button" class="viewer__button" data-action="zoomIn" aria-label="Ingrandisci" title="Ingrandisci">+</button>
        <button type="button" class="viewer__button viewer__button--info" data-action="toggleInfo">i</button>
        <button type="button" class="viewer__button viewer__button--close" data-action="close">✕ Chiudi</button>
      </div>
      <p class="viewer__hint"></p>`;
    this.hint = this.element.querySelector('.viewer__hint')!;
    this.infoButton = this.element.querySelector('.viewer__button--info')!;
    parent.append(this.element);

    this.element.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
      if (!button) return;
      actions[button.dataset.action as keyof ViewerPanelActions]();
      // Dopo un clic con mouse o dito il pulsante perde il focus; con la tastiera (detail 0) lo tiene.
      if (event.detail > 0) button.blur();
    });
  }

  show(touch: boolean): void {
    this.hint.textContent = touch
      ? 'Pizzica per ingrandire · trascina per spostarti · doppio tocco per avvicinarti'
      : 'Rotellina per ingrandire · trascina per spostarti · doppio clic per avvicinarti · Esc per uscire';
    this.hint.classList.remove('viewer__hint--faded');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.hint.classList.add('viewer__hint--faded'), HINT_DURATION);
    this.element.hidden = false;
  }

  hide(): void {
    clearTimeout(this.hintTimer);
    this.element.hidden = true;
  }

  /** Il pulsante «i» appare premuto quando la scheda è visibile. */
  setInfoVisible(visible: boolean): void {
    const label = visible ? 'Nascondi la scheda' : 'Mostra la scheda';
    this.infoButton.setAttribute('aria-pressed', String(visible));
    this.infoButton.setAttribute('aria-label', label);
    this.infoButton.title = label;
  }
}
