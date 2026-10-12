/** Cosa si sta mirando: niente di particolare, oppure un quadro con visita guidata da vicino o da lontano. */
export type AimTarget = 'none' | 'tour-near' | 'tour-far';

/** Mirino al centro dello schermo quando il puntatore è bloccato, con l'invito a cliccare se si mira un quadro con visita guidata. */
export class AimHint {
  private readonly crosshair: HTMLElement;
  private readonly label: HTMLElement;

  constructor(parent: HTMLElement) {
    this.crosshair = document.createElement('div');
    this.crosshair.className = 'crosshair';
    this.crosshair.hidden = true;

    this.label = document.createElement('div');
    this.label.className = 'aim-label';
    this.label.hidden = true;

    parent.append(this.crosshair, this.label);
  }

  update(visible: boolean, target: AimTarget): void {
    this.crosshair.hidden = !visible;
    this.crosshair.classList.toggle('crosshair--active', target === 'tour-near');
    this.label.hidden = !visible || target === 'none';
    this.label.textContent = target === 'tour-near' ? 'Clic per la visita guidata' : 'Avvicinati per la visita guidata';
  }
}
