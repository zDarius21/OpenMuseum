import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { resolveCollisions } from './collisions';
import { Joystick } from './Joystick';

export interface PlayerOptions {
  radius: number;
  speed: number;
  touchLookSpeed: number;
}

/** Margine dalla verticale: guardando dritto in alto o in basso la direzione di marcia non sarebbe definita. */
const PITCH_MARGIN = 0.05;
const PITCH_LIMIT = Math.PI / 2 - PITCH_MARGIN;
/** Rapidità con cui la velocità raggiunge quella desiderata: partenze e frenate morbide. */
const ACCELERATION = 10;

const FORWARD_KEYS = ['KeyW', 'ArrowUp'];
const BACKWARD_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _target = new THREE.Vector3();
const _step = new THREE.Vector3();

/**
 * Movimento in prima persona.
 * - PC: clic per bloccare il puntatore, mouse per guardarsi intorno, WASD o frecce per muoversi.
 * - Touch: joystick virtuale per muoversi, trascinare sullo schermo per guardarsi intorno.
 */
export class PlayerControls {
  /** Se false il visitatore resta fermo, per esempio durante una visita guidata. */
  enabled = true;

  private readonly camera: THREE.Camera;
  private readonly domElement: HTMLElement;
  private readonly colliders: readonly THREE.Box3[];
  private readonly options: PlayerOptions;
  private readonly pointerLock: PointerLockControls;
  private readonly joystick: Joystick;
  private readonly keys = new Set<string>();
  private readonly velocity = new THREE.Vector3();
  private readonly listeners = new Set<() => void>();
  private touchMode = window.matchMedia('(pointer: coarse)').matches;
  private look: { pointerId: number; x: number; y: number } | null = null;

  constructor(camera: THREE.Camera, domElement: HTMLElement, colliders: readonly THREE.Box3[], options: PlayerOptions) {
    this.camera = camera;
    this.domElement = domElement;
    this.colliders = colliders;
    this.options = options;

    this.pointerLock = new PointerLockControls(camera, domElement);
    this.pointerLock.minPolarAngle = PITCH_MARGIN;
    this.pointerLock.maxPolarAngle = Math.PI - PITCH_MARGIN;
    this.pointerLock.addEventListener('lock', this.notify);
    this.pointerLock.addEventListener('unlock', this.notify);

    this.joystick = new Joystick(domElement.parentElement ?? document.body);
    this.joystick.visible = this.touchMode;

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
    // Letto dal documento: PointerLockControls aggiorna il suo `isLocked` solo dopo aver inviato l'evento.
    return document.pointerLockElement === this.domElement;
  }

  /** True se si sta usando il touch screen (joystick visibile). */
  get isTouchMode(): boolean {
    return this.touchMode;
  }

  /** Registra una funzione chiamata quando cambia il blocco del puntatore o la modalità touch. Restituisce la funzione per rimuoverla. */
  onStateChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  update(delta: number): void {
    if (!this.enabled) {
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
    this.joystick.visible = touchMode;
    this.notify();
  }

  private readonly notify = (): void => {
    for (const fn of this.listeners) fn();
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.setTouchMode(event.pointerType !== 'mouse');
    if (!this.enabled) return;

    if (event.pointerType === 'mouse') {
      if (!this.isLocked) {
        // Il browser rifiuta il blocco se richiesto subito dopo l'uscita con Esc: si riprova al clic successivo.
        // Promise.resolve perché alcuni browser restituiscono undefined invece di una Promise.
        Promise.resolve(this.domElement.requestPointerLock()).catch(() => {});
      }
    } else if (this.look === null) {
      this.look = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      this.domElement.setPointerCapture(event.pointerId);
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.look?.pointerId || !this.enabled) return;

    const speed = this.options.touchLookSpeed;
    _euler.setFromQuaternion(this.camera.quaternion);
    _euler.y -= (event.clientX - this.look.x) * speed;
    _euler.x = THREE.MathUtils.clamp(_euler.x - (event.clientY - this.look.y) * speed, -PITCH_LIMIT, PITCH_LIMIT);
    this.camera.quaternion.setFromEuler(_euler);

    this.look.x = event.clientX;
    this.look.y = event.clientY;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.look?.pointerId) this.look = null;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  /** Se la finestra perde il focus i keyup non arrivano: senza questo il visitatore continuerebbe a camminare. */
  private readonly onBlur = (): void => {
    this.keys.clear();
  };
}
