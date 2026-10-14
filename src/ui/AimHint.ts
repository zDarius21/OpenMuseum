import { t } from '../i18n/strings';

/**
 * Cosa si sta mirando: niente di particolare, un quadro con visita guidata da vicino o da lontano,
 * oppure da vicino un quadro senza visita, che si può guardare da vicino.
 */
export type AimTarget = 'none' | 'tour-near' | 'tour-far' | 'view-near';

/** L'invito per ogni bersaglio, nella lingua scelta. */
const LABELS: Record<Exclude<AimTarget, 'none'>, () => string> = {
  'tour-near': () => t().aim.tourNear,
  'tour-far': () => t().aim.tourFar,
  'view-near': () => t().aim.viewNear,
};

/** Mirino al centro dello schermo quando il puntatore è bloccato, con l'invito a cliccare se si mira un quadro abbastanza vicino. */
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
    this.crosshair.classList.toggle('crosshair--active', target === 'tour-near' || target === 'view-near');
    this.label.hidden = !visible || target === 'none';
    if (target !== 'none') this.label.textContent = LABELS[target]();
  }
}
