import type { PlayerControls } from '../controls/PlayerControls';
import { onLanguageChange } from '../i18n/language';
import { t } from '../i18n/strings';

/**
 * Su PC, quando il puntatore non è bloccato (per esempio dopo Esc), ricorda come riprendere la visita.
 * Le istruzioni complete sono nella schermata iniziale; su touch non serve, perché non c'è nulla da bloccare.
 */
export function createControlsHint(parent: HTMLElement, controls: PlayerControls): void {
  const hint = document.createElement('div');
  hint.className = 'hint';
  const render = (): void => {
    hint.innerHTML = `
      <p class="hint__title">${t().hint.title}</p>
      <p>${t().hint.help}</p>`;
  };
  render();
  onLanguageChange(render);
  parent.append(hint);

  const update = (): void => {
    hint.hidden = controls.isTouchMode || controls.isLocked || !controls.enabled;
  };
  controls.onStateChange(update);
  update();
}
