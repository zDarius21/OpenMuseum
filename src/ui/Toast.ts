/** Breve messaggio in alto al centro dello schermo, che sparisce da solo. */
export class Toast {
  private readonly element: HTMLElement;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'toast';
    this.element.hidden = true;
    // I lettori di schermo annunciano il messaggio.
    this.element.setAttribute('role', 'status');
    parent.append(this.element);
  }

  show(message: string, duration = 2500): void {
    this.element.textContent = message;
    this.element.hidden = false;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.element.hidden = true;
    }, duration);
  }
}
