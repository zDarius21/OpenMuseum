import type { PlayerControls } from '../controls/PlayerControls';

/**
 * Suggerimento con i comandi al centro dello schermo.
 * Su PC resta visibile finché il puntatore non è bloccato; su touch sparisce al primo tocco.
 */
export function createControlsHint(parent: HTMLElement, controls: PlayerControls): void {
  const hint = document.createElement('div');
  hint.className = 'hint';
  parent.append(hint);

  let touched = false;

  const update = (): void => {
    if (controls.isTouchMode) {
      hint.innerHTML = `
        <p class="hint__title">Benvenuto nel museo</p>
        <p>Usa il joystick per muoverti e trascina sullo schermo per guardarti intorno</p>`;
      hint.hidden = touched;
    } else {
      hint.innerHTML = `
        <p class="hint__title">Clicca per esplorare</p>
        <p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o frecce per muoverti · mouse per guardarti intorno</p>
        <p><kbd>Esc</kbd> per liberare il mouse</p>`;
      hint.hidden = controls.isLocked;
    }
  };

  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' || touched) return;
    touched = true;
    update();
  });
  controls.onStateChange(update);
  update();
}
