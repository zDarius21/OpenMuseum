import * as THREE from 'three';
import type { Artwork } from '../artworks/artworksData';
import { CANVAS_OFFSET } from '../artworks/createArtwork';
import { artworkOf, pickArtwork } from '../artworks/pickArtwork';
import { isNearArtwork } from '../artworks/proximity';
import type { PlayerControls } from '../controls/PlayerControls';
import { tweenCamera } from '../scene/cameraTween';
import type { Museum } from '../scene/Museum';
import type { Toast } from '../ui/Toast';
import { ViewerPanel } from '../ui/ViewerPanel';

export interface ViewerOptions {
  /** Ingrandimento massimo: 1 = quadro intero. */
  maxZoom: number;
  /** Durata in secondi dell'avvicinamento al quadro e del ritorno. */
  approachDuration: number;
}

interface ArtworkViewerParts {
  museum: Museum;
  controls: PlayerControls;
  toast: Toast;
  /** Elemento in cui inserire i comandi. */
  parent: HTMLElement;
  /** Distanza massima dal muro, in metri, per aprire la vista ravvicinata. */
  reach: number;
  options: ViewerOptions;
}

/** Cosa si vuole vedere: il punto del quadro al centro dello schermo e l'ingrandimento. */
interface View {
  /** Metri dal centro della tela, y verso l'alto. */
  x: number;
  y: number;
  /** 1 = quadro intero. */
  zoom: number;
}

/** Come sta il quadro sullo schermo, ricalcolato a ogni frame perché la finestra può cambiare dimensione. */
interface Framing {
  /** Altezza della scena visibile, in metri, quando la tela intera riempie lo schermo. */
  fitHeight: number;
  maxZoom: number;
  screenWidth: number;
  screenHeight: number;
  /** Centro dello schermo in coordinate della finestra, in pixel. */
  centerX: number;
  centerY: number;
}

interface ActiveView {
  group: THREE.Object3D;
  artwork: Artwork;
  returnPosition: THREE.Vector3;
  returnQuaternion: THREE.Quaternion;
}

/** Distanza minima della camera dalla tela: più vicino la tela verrebbe tagliata dal piano di ritaglio della camera. */
const MIN_DISTANCE = 0.12;
/** Margine attorno alla tela intera: appena più di 1, così si vede un filo della cornice. */
const FIT_MARGIN = 1.03;
/** Rapidità con cui la camera segue zoom e spostamenti: più alto, più reattivo. */
const SMOOTHING = 18;
const WHEEL_SPEED = 0.0015;
/** Ingrandimento di un clic su + o −, e del doppio clic. */
const STEP_ZOOM = 1.5;
const DOUBLE_ZOOM = 2.5;
/** Spostamento con le frecce, in frazione dello schermo. */
const KEY_PAN = 0.15;
const TAP_MAX_DISTANCE = 10;
const TAP_MAX_DURATION = 300;
const DOUBLE_TAP_TIME = 300;
const DOUBLE_TAP_DISTANCE = 30;

/**
 * Vista ravvicinata di un quadro senza visita guidata: la camera lo porta a tutto schermo, centrato, poi si ingrandisce
 * con rotellina, pizzico o doppio clic e ci si sposta trascinando. La scheda dell'opera resta sopra, e si può nascondere.
 */
export class ArtworkViewer {
  private readonly museum: Museum;
  private readonly controls: PlayerControls;
  private readonly toast: Toast;
  private readonly reach: number;
  private readonly options: ViewerOptions;
  private readonly panel: ViewerPanel;
  private readonly canvas: HTMLCanvasElement;
  private artworks: THREE.Object3D | null = null;
  private active: ActiveView | null = null;
  /** False durante l'avvicinamento: zoom e spostamenti partono quando la camera è arrivata. */
  private ready = false;
  private showInfo = true;
  private readonly goal: View = { x: 0, y: 0, zoom: 1 };
  private cameraTween: gsap.core.Tween | null = null;
  private readonly pointers = new Map<number, { x: number; y: number; startX: number; startY: number; startTime: number }>();
  private lastTap: { time: number; x: number; y: number } | null = null;
  private lastPointerType = '';

  constructor({ museum, controls, toast, parent, reach, options }: ArtworkViewerParts) {
    this.museum = museum;
    this.controls = controls;
    this.toast = toast;
    this.reach = reach;
    this.options = options;
    this.canvas = museum.renderer.domElement;
    this.panel = new ViewerPanel(parent, {
      zoomIn: () => this.zoomAround(STEP_ZOOM),
      zoomOut: () => this.zoomAround(1 / STEP_ZOOM),
      toggleInfo: () => this.toggleInfo(),
      // Uscendo con il pulsante si è dentro un clic: su PC si può riprendere subito il controllo del mouse.
      close: () => this.exit(!this.controls.isTouchMode),
    });

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('dblclick', this.onDoubleClick);
    document.addEventListener('keydown', this.onKeyDown);
  }

  get isActive(): boolean {
    return this.active !== null;
  }

  /** Il quadro che si sta guardando da vicino, se c'è. */
  get group(): THREE.Object3D | null {
    return this.active?.group ?? null;
  }

  /** False se il visitatore ha nascosto la scheda per vedere tutto il quadro. */
  get infoVisible(): boolean {
    return this.showInfo;
  }

  /** Indica il gruppo che contiene i quadri appesi, su cui si cercano i clic. */
  setArtworks(root: THREE.Object3D): void {
    this.artworks = root;
  }

  /** Gestisce un clic o un tocco sulla scena: apre la vista ravvicinata se colpisce un quadro senza visita guidata. */
  handleTap(pointer: THREE.Vector2): boolean {
    if (this.active || !this.artworks) return false;
    const group = pickArtwork(pointer, this.museum.camera, this.artworks);
    if (!group || artworkOf(group).tour?.length) return false;
    return this.requestStart(group);
  }

  /** Apre la vista ravvicinata se il visitatore è vicino al cordone, altrimenti lo invita ad avvicinarsi. */
  requestStart(group: THREE.Object3D): boolean {
    if (!isNearArtwork(group, this.museum.camera.position, this.reach)) {
      this.toast.show('Avvicinati al cordone davanti al quadro per guardarlo da vicino');
      return false;
    }
    this.start(group);
    return true;
  }

  start(group: THREE.Object3D): void {
    if (this.active) return;
    this.controls.enabled = false;
    // Il mouse serve libero per trascinare e ingrandire.
    this.controls.unlock();

    const camera = this.museum.camera;
    this.active = { group, artwork: artworkOf(group), returnPosition: camera.position.clone(), returnQuaternion: camera.quaternion.clone() };
    Object.assign(this.goal, { x: 0, y: 0, zoom: 1 });
    this.ready = false;
    this.showInfo = true;
    this.panel.show(this.controls.isTouchMode);
    this.panel.setInfoVisible(true);
    this.canvas.style.cursor = 'grab';

    const { position, quaternion } = this.poseFor(this.goal, this.framing());
    this.cameraTween?.kill();
    this.cameraTween = tweenCamera(camera, position, quaternion, this.options.approachDuration, () => {
      this.ready = true;
    });
  }

  /** Chiude la vista e riporta la camera dov'era il visitatore. */
  exit(relockPointer: boolean): void {
    const viewing = this.active;
    if (!viewing) return;
    this.active = null;
    this.ready = false;
    this.pointers.clear();
    this.panel.hide();
    this.canvas.style.cursor = '';
    if (relockPointer) this.controls.lock();

    this.cameraTween?.kill();
    this.cameraTween = tweenCamera(this.museum.camera, viewing.returnPosition, viewing.returnQuaternion, this.options.approachDuration, () => {
      this.controls.enabled = true;
    });
  }

  /**
   * Da chiamare a ogni frame: la camera insegue con morbidezza la posizione voluta. Spostandosi in linea retta,
   * il punto del quadro sotto il puntatore resta fermo mentre si ingrandisce.
   */
  update(delta: number): void {
    if (!this.active || !this.ready) return;
    const framing = this.framing();
    this.clamp(framing);
    const { position, quaternion } = this.poseFor(this.goal, framing);
    const t = 1 - Math.exp(-SMOOTHING * delta);
    this.museum.camera.position.lerp(position, t);
    this.museum.camera.quaternion.slerp(quaternion, t);
  }

  /** La tela intera riempie lo schermo nella dimensione che la limita, centrata. */
  private framing(): Framing {
    const { artwork } = this.active!;
    const screen = this.canvas.getBoundingClientRect();
    const fitHeight = Math.max(artwork.height / screen.height, artwork.width / screen.width) * screen.height * FIT_MARGIN;
    const halfFov = THREE.MathUtils.degToRad(this.museum.camera.fov) / 2;
    const maxZoom = Math.max(1, Math.min(this.options.maxZoom, fitHeight / (2 * MIN_DISTANCE * Math.tan(halfFov))));
    return {
      fitHeight,
      maxZoom,
      screenWidth: screen.width,
      screenHeight: screen.height,
      centerX: screen.left + screen.width / 2,
      centerY: screen.top + screen.height / 2,
    };
  }

  /** Metri sul quadro per pixel sullo schermo, con l'ingrandimento indicato. */
  private metersPerPixel(framing: Framing, zoom: number): number {
    return framing.fitHeight / zoom / framing.screenHeight;
  }

  /** Posizione della camera, di fronte al quadro, che mostra `view` al centro dello schermo. */
  private poseFor(view: View, framing: Framing): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
    const { group } = this.active!;
    const halfFov = THREE.MathUtils.degToRad(this.museum.camera.fov) / 2;
    const visibleHeight = framing.fitHeight / view.zoom;
    const distance = Math.max(visibleHeight / 2 / Math.tan(halfFov), MIN_DISTANCE);
    const local = new THREE.Vector3(view.x, view.y, CANVAS_OFFSET + distance);
    // La camera guarda lungo il proprio -z: con l'orientamento del quadro guarda la parete di fronte.
    return { position: group.localToWorld(local), quaternion: group.getWorldQuaternion(new THREE.Quaternion()) };
  }

  /** Tiene l'ingrandimento nei limiti e il quadro sullo schermo: non si può uscire dalla tela. */
  private clamp(framing: Framing): void {
    const { artwork } = this.active!;
    const goal = this.goal;
    goal.zoom = THREE.MathUtils.clamp(goal.zoom, 1, framing.maxZoom);
    const scale = this.metersPerPixel(framing, goal.zoom);
    const limitX = Math.max(0, (artwork.width - framing.screenWidth * scale) / 2);
    const limitY = Math.max(0, (artwork.height - framing.screenHeight * scale) / 2);
    goal.x = THREE.MathUtils.clamp(goal.x, -limitX, limitX);
    goal.y = THREE.MathUtils.clamp(goal.y, -limitY, limitY);
  }

  /** Ingrandisce di `factor` tenendo fermo il punto del quadro sotto le coordinate indicate (della finestra). */
  private zoomAt(clientX: number, clientY: number, factor: number): void {
    if (!this.active) return;
    const framing = this.framing();
    const goal = this.goal;
    const dx = clientX - framing.centerX;
    const dy = clientY - framing.centerY;
    const before = this.metersPerPixel(framing, goal.zoom);
    const pointX = goal.x + dx * before;
    const pointY = goal.y - dy * before;
    goal.zoom = THREE.MathUtils.clamp(goal.zoom * factor, 1, framing.maxZoom);
    const after = this.metersPerPixel(framing, goal.zoom);
    goal.x = pointX - dx * after;
    goal.y = pointY + dy * after;
    this.clamp(framing);
  }

  /** Ingrandisce attorno al centro dello schermo, per i pulsanti e la tastiera. */
  private zoomAround(factor: number): void {
    if (!this.active || !this.ready) return;
    const framing = this.framing();
    this.zoomAt(framing.centerX, framing.centerY, factor);
  }

  /** Sposta il quadro insieme al puntatore, di (dx, dy) pixel. */
  private pan(dx: number, dy: number): void {
    if (!this.active) return;
    const framing = this.framing();
    const scale = this.metersPerPixel(framing, this.goal.zoom);
    this.goal.x -= dx * scale;
    this.goal.y += dy * scale;
    this.clamp(framing);
  }

  /** Doppio clic o doppio tocco: si avvicina al punto indicato, oppure torna al quadro intero se già ingrandito. */
  private toggleZoom(clientX: number, clientY: number): void {
    if (this.goal.zoom > 1.01) Object.assign(this.goal, { x: 0, y: 0, zoom: 1 });
    else this.zoomAt(clientX, clientY, DOUBLE_ZOOM);
  }

  /** Mostra o nasconde la scheda dell'opera, che può coprire una parte del quadro. */
  private toggleInfo(): void {
    if (!this.active) return;
    this.showInfo = !this.showInfo;
    this.panel.setInfoVisible(this.showInfo);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.lastPointerType = event.pointerType;
    if (!this.active || !this.ready || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const { pointerId, clientX: x, clientY: y } = event;
    this.pointers.set(pointerId, { x, y, startX: x, startY: y, startTime: performance.now() });
    this.canvas.setPointerCapture(pointerId);
    if (event.pointerType === 'mouse') this.canvas.style.cursor = 'grabbing';
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer || !this.active) return;
    if (this.pointers.size === 1) {
      this.pan(event.clientX - pointer.x, event.clientY - pointer.y);
    } else if (this.pointers.size === 2) {
      // Due dita: si ingrandisce di quanto si allontanano e ci si sposta con il punto medio.
      const other = [...this.pointers.values()].find((entry) => entry !== pointer)!;
      const before = { x: (pointer.x + other.x) / 2, y: (pointer.y + other.y) / 2 };
      const after = { x: (event.clientX + other.x) / 2, y: (event.clientY + other.y) / 2 };
      const distanceBefore = Math.hypot(pointer.x - other.x, pointer.y - other.y);
      const distanceAfter = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (distanceBefore > 0) this.zoomAt(before.x, before.y, distanceAfter / distanceBefore);
      this.pan(after.x - before.x, after.y - before.y);
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    this.pointers.delete(event.pointerId);
    if (event.pointerType === 'mouse') this.canvas.style.cursor = this.active ? 'grab' : '';
    if (event.pointerType === 'mouse' || event.type !== 'pointerup' || this.pointers.size > 0) return;

    // Su touch il doppio clic non arriva: due tocchi brevi e vicini, uno dopo l'altro, fanno lo stesso.
    const now = performance.now();
    const isTap =
      Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < TAP_MAX_DISTANCE && now - pointer.startTime < TAP_MAX_DURATION;
    if (!isTap) return;
    const last = this.lastTap;
    if (last && now - last.time < DOUBLE_TAP_TIME && Math.hypot(event.clientX - last.x, event.clientY - last.y) < DOUBLE_TAP_DISTANCE) {
      this.toggleZoom(event.clientX, event.clientY);
      this.lastTap = null;
    } else {
      this.lastTap = { time: now, x: event.clientX, y: event.clientY };
    }
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (!this.active) return;
    // Niente scorrimento o zoom della pagina, anche con il pizzico sul touchpad (che arriva come rotellina con Ctrl).
    event.preventDefault();
    if (!this.ready) return;
    let pixels = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) pixels *= 16;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) pixels *= window.innerHeight;
    this.zoomAt(event.clientX, event.clientY, Math.exp(-pixels * WHEEL_SPEED));
  };

  private readonly onDoubleClick = (event: MouseEvent): void => {
    if (this.active && this.ready && this.lastPointerType === 'mouse') this.toggleZoom(event.clientX, event.clientY);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.active) return;
    if (event.code === 'Escape') {
      this.exit(false);
      event.preventDefault();
      return;
    }
    if (!this.ready) return;
    const framing = this.framing();
    const stepX = framing.screenWidth * KEY_PAN;
    const stepY = framing.screenHeight * KEY_PAN;
    switch (event.key) {
      case '+':
      case '=':
        this.zoomAround(STEP_ZOOM);
        break;
      case '-':
        this.zoomAround(1 / STEP_ZOOM);
        break;
      case '0':
        Object.assign(this.goal, { x: 0, y: 0, zoom: 1 });
        break;
      case 'i':
      case 'I':
        this.toggleInfo();
        break;
      // Le frecce mostrano la parte del quadro in quella direzione.
      case 'ArrowLeft':
        this.pan(stepX, 0);
        break;
      case 'ArrowRight':
        this.pan(-stepX, 0);
        break;
      case 'ArrowUp':
        this.pan(0, stepY);
        break;
      case 'ArrowDown':
        this.pan(0, -stepY);
        break;
      default:
        return;
    }
    event.preventDefault();
  };
}
