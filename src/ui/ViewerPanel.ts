import { t } from '../i18n/strings';

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
      <div class="viewer__bar" role="toolbar">
        <button type="button" class="viewer__button" data-action="zoomOut">−</button>
        <button type="button" class="viewer__button" data-action="zoomIn">+</button>
        <button type="button" class="viewer__button viewer__button--info" data-action="toggleInfo">i</button>
        <button type="button" class="viewer__button viewer__button--close" data-action="close"></button>
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

  /** Apre i comandi, con i testi nella lingua scelta: durante la vista ravvicinata la lingua non si può cambiare. */
  show(touch: boolean): void {
    const text = t().viewer;
    const find = (selector: string) => this.element.querySelector<HTMLElement>(selector)!;
    find('.viewer__bar').setAttribute('aria-label', text.label);
    for (const [action, label] of [
      ['zoomOut', text.zoomOut],
      ['zoomIn', text.zoomIn],
    ]) {
      const button = find(`[data-action="${action}"]`);
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    find('[data-action="close"]').textContent = text.close;
    this.hint.textContent = touch ? text.touchHint : text.desktopHint;
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
    const label = visible ? t().viewer.hideInfo : t().viewer.showInfo;
    this.infoButton.setAttribute('aria-pressed', String(visible));
    this.infoButton.setAttribute('aria-label', label);
    this.infoButton.title = label;
  }
}
