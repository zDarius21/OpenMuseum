/** Sotto questa frazione della corsa il joystick è considerato fermo, per evitare derive involontarie. */
const DEAD_ZONE = 0.12;

/** Joystick virtuale per muoversi dal touch screen. */
export class Joystick {
  /** Direzione corrente, con componenti tra -1 e 1: x verso destra, y in avanti. */
  readonly value = { x: 0, y: 0 };

  private readonly element: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private pointerId: number | null = null;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'joystick';
    this.element.hidden = true;
    this.knob = document.createElement('div');
    this.knob.className = 'joystick__knob';
    this.element.append(this.knob);
    parent.append(this.element);

    this.element.addEventListener('pointerdown', this.onPointerDown);
    this.element.addEventListener('pointermove', this.onPointerMove);
    this.element.addEventListener('pointerup', this.onPointerUp);
    this.element.addEventListener('pointercancel', this.onPointerUp);
  }

  set visible(visible: boolean) {
    this.element.hidden = !visible;
    if (!visible) this.reset();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.pointerId !== null) return;
    this.pointerId = event.pointerId;
    this.element.setPointerCapture(event.pointerId);
    this.track(event);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId === this.pointerId) this.track(event);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.pointerId) this.reset();
  };

  private track(event: PointerEvent): void {
    const rect = this.element.getBoundingClientRect();
    const maxDistance = (rect.width - this.knob.offsetWidth) / 2;
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    if (distance > maxDistance) {
      dx *= maxDistance / distance;
      dy *= maxDistance / distance;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;

    // Riporta l'intervallo [DEAD_ZONE, 1] a [0, 1] mantenendo la direzione.
    const magnitude = Math.min(distance / maxDistance, 1);
    const scale = magnitude < DEAD_ZONE ? 0 : (magnitude - DEAD_ZONE) / (1 - DEAD_ZONE) / magnitude;
    this.value.x = (dx / maxDistance) * scale;
    this.value.y = (-dy / maxDistance) * scale;
  }

  private reset(): void {
    this.pointerId = null;
    this.value.x = 0;
    this.value.y = 0;
    this.knob.style.transform = '';
  }
}
