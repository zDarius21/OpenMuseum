import * as THREE from 'three';
import { pointerFromEvent } from '../artworks/pickArtwork';
import { resolveCollisions } from './collisions';
import { Joystick } from './Joystick';

export interface PlayerOptions {
  radius: number;
  speed: number;
  mouseLookSpeed: number;
  touchLookSpeed: number;
}

/** Margine dalla verticale: guardando dritto in alto o in basso la direzione di marcia non sarebbe definita. */
const PITCH_MARGIN = 0.05;
const PITCH_LIMIT = Math.PI / 2 - PITCH_MARGIN;
/** Rapidità con cui la velocità raggiunge quella desiderata: partenze e frenate morbide. */
const ACCELERATION = 10;
/** Un tocco più breve e più corto di così è un "tap", non un trascinamento per guardarsi intorno. */
const TAP_MAX_DISTANCE = 10;
const TAP_MAX_DURATION = 400;
/**
 * Con il puntatore bloccato il browser ogni tanto segnala uno spostamento del mouse enorme che non c'è stato, e la
 * visuale scatterebbe di colpo. Uno spostamento è vero se non supera MOUSE_JUMP_MIN pixel più MOUSE_JUMP_RATIO volte
 * il precedente: la mano accelera un po' alla volta, l'errore arriva tutto insieme, di solito da fermi.
 */
const MOUSE_JUMP_MIN = 50;
const MOUSE_JUMP_RATIO = 3;
/** Dopo una pausa così lunga, in millisecondi, il mouse riparte da fermo. */
const MOUSE_REST = 100;

const FORWARD_KEYS = ['KeyW', 'ArrowUp'];
const BACKWARD_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _target = new THREE.Vector3();
const _step = new THREE.Vector3();
const SCREEN_CENTER = new THREE.Vector2(0, 0);

/**
 * Movimento in prima persona.
 * - PC: clic per bloccare il puntatore, mouse per guardarsi intorno, WASD o frecce per muoversi.
 * - Touch: joystick virtuale per muoversi, trascinare sullo schermo per guardarsi intorno.
 */
export class PlayerControls {
  /**
   * Chiamata a ogni tocco breve sulla scena e a ogni clic con il puntatore bloccato, con il punto in coordinate
   * normalizzate (da -1 a 1). Restituisce true se il clic è stato usato, per esempio per aprire una visita guidata.
   */
  onTap: ((pointer: THREE.Vector2) => boolean) | null = null;

  private isEnabled = true;

  private readonly camera: THREE.Camera;
  private readonly domElement: HTMLElement;
  private readonly colliders: readonly THREE.Box3[];
  private readonly options: PlayerOptions;
  private readonly joystick: Joystick;
  private readonly keys = new Set<string>();
  private readonly velocity = new THREE.Vector3();
  private readonly listeners = new Set<() => void>();
  private touchMode = window.matchMedia('(pointer: coarse)').matches;
  private look: { pointerId: number; x: number; y: number; startX: number; startY: number; startTime: number } | null = null;
  /** L'ultimo spostamento del mouse, in pixel, e quando è arrivato: servono a riconoscere i salti finti. */
  private lastMouseMove = { size: 0, time: 0 };
  /** Dopo un'uscita con Esc: il puntatore si blocca quando il tasto viene rilasciato. */
  private lockOnEscapeUp = false;

  constructor(camera: THREE.Camera, domElement: HTMLElement, colliders: readonly THREE.Box3[], options: PlayerOptions) {
    this.camera = camera;
    this.domElement = domElement;
    this.colliders = colliders;
    this.options = options;

    this.joystick = new Joystick(domElement.parentElement ?? document.body);
    this.joystick.visible = this.touchMode;

    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    domElement.addEventListener('pointerdown', this.onPointerDown);
    domElement.addEventListener('pointermove', this.onPointerMove);
    domElement.addEventListener('pointerup', this.onPointerUp);
    domElement.addEventListener('pointercancel', this.onPointerUp);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  /** True se il puntatore del mouse è bloccato sulla scena. */
  get isLocked(): boolean {
    return document.pointerLockElement === this.domElement;
  }

  /** True se si sta usando il touch screen (joystick visibile). */
  get isTouchMode(): boolean {
    return this.touchMode;
  }

  /** Se false il visitatore resta fermo e il joystick è nascosto, per esempio durante una visita guidata. */
  get enabled(): boolean {
    return this.isEnabled;
  }

  set enabled(enabled: boolean) {
    if (enabled === this.isEnabled) return;
    this.isEnabled = enabled;
    this.joystick.visible = enabled && this.touchMode;
    if (!enabled) {
      this.velocity.set(0, 0, 0);
      this.look = null;
    }
    this.notify();
  }

  /**
   * Blocca il puntatore sulla scena. Va chiamato durante un clic o un tasto premuto dall'utente, oppure dopo che è
   * stata la pagina a sbloccarlo con unlock: in quel caso Chrome ed Edge lo permettono anche senza.
   */
  lock(): void {
    // Il browser rifiuta il blocco se richiesto subito dopo l'uscita con Esc: si riprova al clic successivo.
    // Promise.resolve perché alcuni browser restituiscono undefined invece di una Promise.
    Promise.resolve(this.domElement.requestPointerLock()).catch(() => {});
  }

  unlock(): void {
    this.lockOnEscapeUp = false;
    if (this.isLocked) document.exitPointerLock();
  }

  /**
   * Riprende il controllo del mouse dopo una vista ravvicinata o una visita guidata, senza bisogno di un clic: il
   * puntatore l'aveva sbloccato la pagina, e Chrome ed Edge in quel caso lo ribloccano anche senza (negli altri browser
   * resta il suggerimento che chiede un clic). Uscendo con Esc si aspetta che il tasto sia rilasciato: Chrome tratta
   * ogni evento di Esc che la pagina non ha gestito, rilascio compreso, come «libera il mouse», e un blocco chiesto
   * prima verrebbe tolto subito.
   */
  resume(byEscape: boolean): void {
    if (this.touchMode) return;
    if (byEscape) this.lockOnEscapeUp = true;
    else this.lock();
  }

  /** Registra una funzione chiamata quando cambia il blocco del puntatore o la modalità touch. Restituisce la funzione per rimuoverla. */
  onStateChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  update(delta: number): void {
    if (!this.isEnabled) {
      this.velocity.set(0, 0, 0);
      return;
    }

    const { radius, speed } = this.options;
    let forward = this.axis(FORWARD_KEYS, BACKWARD_KEYS) + this.joystick.value.y;
    let right = this.axis(RIGHT_KEYS, LEFT_KEYS) + this.joystick.value.x;
    const length = Math.hypot(forward, right);
    if (length > 1) {
      forward /= length;
      right /= length;
    }

    // Direzione di marcia dalla sola rotazione orizzontale: guardare in basso non rallenta.
    _euler.setFromQuaternion(this.camera.quaternion);
    _forward.set(-Math.sin(_euler.y), 0, -Math.cos(_euler.y));
    _right.set(-_forward.z, 0, _forward.x);

    _target.set(0, 0, 0).addScaledVector(_forward, forward * speed).addScaledVector(_right, right * speed);
    this.velocity.lerp(_target, 1 - Math.exp(-ACCELERATION * delta));

    // Spostamento a piccoli passi: anche con un frame lento non si attraversano le pareti sottili.
    _step.copy(this.velocity).multiplyScalar(delta);
    const steps = Math.ceil(_step.length() / (radius / 2));
    if (steps === 0) return;
    _step.divideScalar(steps);
    for (let i = 0; i < steps; i++) {
      this.camera.position.add(_step);
      resolveCollisions(this.camera.position, radius, this.colliders);
    }
  }

  private axis(positive: readonly string[], negative: readonly string[]): number {
    const pressed = (codes: readonly string[]) => codes.some((code) => this.keys.has(code));
    return (pressed(positive) ? 1 : 0) - (pressed(negative) ? 1 : 0);
  }

  private setTouchMode(touchMode: boolean): void {
    if (touchMode === this.touchMode) return;
    this.touchMode = touchMode;
    this.joystick.visible = touchMode && this.isEnabled;
    this.notify();
  }

  /** Gira lo sguardo di dx, dy pixel; in alto e in basso si ferma poco prima della verticale. */
  private turn(dx: number, dy: number, speed: number): void {
    _euler.setFromQuaternion(this.camera.quaternion);
    _euler.y -= dx * speed;
    _euler.x = THREE.MathUtils.clamp(_euler.x - dy * speed, -PITCH_LIMIT, PITCH_LIMIT);
    this.camera.quaternion.setFromEuler(_euler);
  }

  private readonly notify = (): void => {
    for (const fn of this.listeners) fn();
  };

  private readonly onPointerLockChange = (): void => {
    // Appena bloccato il mouse è da considerare fermo: anche il primo spostamento può essere un salto finto.
    this.lastMouseMove = { size: 0, time: 0 };
    this.notify();
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.isEnabled || !this.isLocked) return;
    const { movementX: dx, movementY: dy, timeStamp: time } = event;
    const size = Math.hypot(dx, dy);
    const previous = time - this.lastMouseMove.time > MOUSE_REST ? 0 : this.lastMouseMove.size;
    const limit = MOUSE_JUMP_MIN + MOUSE_JUMP_RATIO * previous;
    // Uno spostamento scartato conta come se fosse arrivato al limite: se era un gesto vero e veloce, il successivo
    // passa, e si perde al più un istante di movimento.
    this.lastMouseMove = { size: Math.min(size, limit), time };
    if (size <= limit) this.turn(dx, dy, this.options.mouseLookSpeed);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.setTouchMode(event.pointerType !== 'mouse');
    if (!this.isEnabled) return;

    if (event.pointerType === 'mouse') {
      // Con il puntatore bloccato si mira con il centro dello schermo. Con il puntatore libero il clic riprende solo
      // la visita, come dice il suggerimento al centro dello schermo: uscendo da una vista ravvicinata o da una
      // visita guidata il quadro è proprio lì sotto, e il clic lo riaprirebbe.
      if (this.isLocked) this.onTap?.(SCREEN_CENTER);
      else this.lock();
    } else if (this.look === null) {
      const { pointerId, clientX: x, clientY: y } = event;
      this.look = { pointerId, x, y, startX: x, startY: y, startTime: performance.now() };
      this.domElement.setPointerCapture(event.pointerId);
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.look?.pointerId || !this.isEnabled) return;

    this.turn(event.clientX - this.look.x, event.clientY - this.look.y, this.options.touchLookSpeed);
    this.look.x = event.clientX;
    this.look.y = event.clientY;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.look?.pointerId) return;
    const { startX, startY, startTime } = this.look;
    this.look = null;
    const isTap = Math.hypot(event.clientX - startX, event.clientY - startY) < TAP_MAX_DISTANCE && performance.now() - startTime < TAP_MAX_DURATION;
    if (isTap && event.type === 'pointerup') this.onTap?.(pointerFromEvent(event, this.domElement));
  };


  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
    if (event.code === 'Escape' && this.lockOnEscapeUp) {
      this.lockOnEscapeUp = false;
      // Senza preventDefault Chrome considera il rilascio non gestito e toglie subito il blocco appena chiesto.
      event.preventDefault();
      this.lock();
    }
  };

  /** Se la finestra perde il focus i keyup non arrivano: senza questo il visitatore continuerebbe a camminare. */
  private readonly onBlur = (): void => {
    this.keys.clear();
    this.lockOnEscapeUp = false;
  };
}
