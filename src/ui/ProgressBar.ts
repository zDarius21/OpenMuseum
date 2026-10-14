export interface ProgressBarOptions {
  /** Parte della barra, da 0 a 1, che si riempie subito, qualunque sia il caricamento vero. */
  fastShare: number;
  /** Secondi per riempire la parte veloce. */
  fastDuration: number;
  /** Secondi per riempire quello che manca quando il caricamento finisce. */
  finishDuration: number;
}

/**
 * Senza progressi veri la parte lenta avanza lo stesso, sempre più piano, fino a questa frazione:
 * la barra non sembra mai bloccata, ma resta spazio per il caricamento vero.
 */
const CREEP_SHARE = 0.8;
/** Secondi in cui l'avanzamento senza progressi veri arriva a circa due terzi di CREEP_SHARE. */
const CREEP_TIME = 8;
/** Un frame lungo, con la pagina impegnata, fa avanzare il tempo della barra al massimo di tanto: la barra si ferma invece di saltare. */
const MAX_STEP = 0.05;

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Barra di avanzamento che fa sembrare l'attesa più breve: corre subito fino a `fastShare`, poi rallenta e
 * nel resto segue il caricamento vero. Non torna mai indietro, e a caricamento finito si riempie in un attimo.
 */
export class ProgressBar {
  private readonly track: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly options: ProgressBarOptions;
  /** Secondi della barra dall'inizio, che avanzano al massimo di MAX_STEP per frame. */
  private clock = 0;
  private lastFrame = 0;
  /** Avanzamento vero, da 0 a 1. */
  private real = 0;
  /** Quello che mostra la barra, da 0 a 1. */
  private value = 0;
  private finishing: { from: number; start: number; done: () => void } | null = null;
  private frame = 0;

  /** `track` è il contenitore (con il ruolo di barra di avanzamento), `fill` la parte colorata. */
  constructor(track: HTMLElement, fill: HTMLElement, options: ProgressBarOptions) {
    this.track = track;
    this.fill = fill;
    this.options = options;
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    this.draw(0);
  }

  /** Riparte da zero. */
  start(): void {
    cancelAnimationFrame(this.frame);
    this.clock = 0;
    this.lastFrame = performance.now();
    this.real = 0;
    this.finishing = null;
    this.draw(0);
    this.frame = requestAnimationFrame(this.tick);
  }

  /** Avanzamento vero, da 0 a 1. */
  set(real: number): void {
    this.real = Math.max(this.real, Math.min(real, 1));
  }

  /** Il caricamento è finito: la barra si riempie e poi chiama `done`. */
  complete(done: () => void): void {
    if (!this.frame) {
      this.draw(1);
      done();
      return;
    }
    this.finishing = { from: this.value, start: this.clock, done };
  }

  // Il tempo si legge con performance.now e non dall'argomento di requestAnimationFrame, che può essere di poco
  // precedente a start e darebbe un tempo trascorso negativo.
  private readonly tick = (): void => {
    const now = performance.now();
    this.clock += Math.min((now - this.lastFrame) / 1000, MAX_STEP);
    this.lastFrame = now;

    if (this.finishing) {
      const { from, start, done } = this.finishing;
      const t = Math.min((this.clock - start) / this.options.finishDuration, 1);
      this.draw(from + (1 - from) * easeOut(t));
      if (t === 1) {
        this.finishing = null;
        this.frame = 0;
        done();
        return;
      }
    } else {
      const { fastShare, fastDuration } = this.options;
      const fast = fastShare * easeOut(Math.min(this.clock / fastDuration, 1));
      // Il caricamento vero riempie quello che l'avanzamento automatico non ha ancora coperto: ogni passo si vede.
      const creep = CREEP_SHARE * (1 - Math.exp(-this.clock / CREEP_TIME));
      const slow = (1 - fastShare) * (creep + (1 - creep) * this.real);
      this.draw(Math.max(this.value, fast + slow));
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private draw(value: number): void {
    this.value = value;
    this.fill.style.transform = `scaleX(${value})`;
    const percent = String(Math.round(value * 100));
    if (this.track.getAttribute('aria-valuenow') !== percent) this.track.setAttribute('aria-valuenow', percent);
  }
}
