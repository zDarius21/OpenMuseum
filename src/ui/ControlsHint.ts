import type { PlayerControls } from '../controls/PlayerControls';

/**
 * Su PC, quando il puntatore non è bloccato (per esempio dopo Esc), ricorda come riprendere la visita.
 * Le istruzioni complete sono nella schermata iniziale; su touch non serve, perché non c'è nulla da bloccare.
 */
export function createControlsHint(parent: HTMLElement, controls: PlayerControls): void {
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.innerHTML = `
    <p class="hint__title">Clicca per continuare la visita</p>
    <p>Il pulsante <span class="hint__key">?</span> in alto a destra riapre le istruzioni</p>`;
  parent.append(hint);

  const update = (): void => {
    hint.hidden = controls.isTouchMode || controls.isLocked || !controls.enabled;
  };
  controls.onStateChange(update);
  update();
}
