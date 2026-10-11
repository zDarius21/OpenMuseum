import * as THREE from 'three';
import { settings } from '../data/settings';

type Updater = (delta: number) => void;

/**
 * Nucleo dell'applicazione: renderer, scena, camera e ciclo di rendering.
 * Gli altri moduli (sala, controlli, opere, visita guidata) si agganciano al ciclo con `onUpdate`.
 */
export class Museum {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private readonly container: HTMLElement;
  private readonly updaters = new Set<Updater>();
  private lastTime: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.renderer.maxPixelRatio));
    // Neutral comprime solo le luci forti e lascia fedeli i colori, importante per i quadri.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(settings.renderer.background);

    const { fov, near, far, eyeHeight } = settings.camera;
    this.camera = new THREE.PerspectiveCamera(fov, 1, near, far);
    this.camera.position.set(0, eyeHeight, 0);

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  /** Registra una funzione da chiamare a ogni frame con il tempo trascorso in secondi. Restituisce la funzione per rimuoverla. */
  onUpdate(fn: Updater): () => void {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  start(): void {
    this.renderer.setAnimationLoop(this.tick);
  }

  stop(): void {
    this.renderer.setAnimationLoop(null);
    this.lastTime = null;
  }

  private readonly tick = (time: number): void => {
    // Limitato a 0.1 s per evitare salti quando la scheda torna in primo piano.
    const delta = this.lastTime === null ? 0 : Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    for (const fn of this.updaters) fn(delta);
    this.renderer.render(this.scene, this.camera);
  };

  private readonly resize = (): void => {
    const { clientWidth: width, clientHeight: height } = this.container;
    this.renderer.setSize(width, height);

    const aspect = width / height;
    const { fov, minHorizontalFov } = settings.camera;
    const halfHorizontal = THREE.MathUtils.degToRad(minHorizontalFov) / 2;
    const fovForMinHorizontal = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(halfHorizontal) / aspect));
    this.camera.aspect = aspect;
    this.camera.fov = Math.max(fov, fovForMinHorizontal);
    this.camera.updateProjectionMatrix();
  };
}
