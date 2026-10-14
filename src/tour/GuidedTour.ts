import * as THREE from 'three';
import type { Artwork, TourStop } from '../artworks/artworksData';
import { CANVAS_OFFSET, frameWidthFor } from '../artworks/createArtwork';
import { artworkOf, pickArtwork } from '../artworks/pickArtwork';
import { isNearArtwork } from '../artworks/proximity';
import type { PlayerControls } from '../controls/PlayerControls';
import { language } from '../i18n/language';
import { t } from '../i18n/strings';
import { tweenCamera } from '../scene/cameraTween';
import type { Museum } from '../scene/Museum';
import type { Toast } from '../ui/Toast';
import { TourPanel } from '../ui/TourPanel';
import { Highlight } from './Highlight';
import { Narrator } from './Narrator';

export interface TourOptions {
  /** Durata in secondi dell'avvicinamento al quadro e del ritorno. */
  approachDuration: number;
  /** Durata in secondi dello spostamento da una tappa all'altra. */
  stepDuration: number;
  /** Pausa in secondi tra la fine della lettura e la tappa successiva. */
  pauseBetweenStops: number;
  voiceRate: number;
}

interface GuidedTourParts {
  museum: Museum;
  controls: PlayerControls;
  toast: Toast;
  /** Elemento in cui inserire il pannello della visita. */
  parent: HTMLElement;
  /** Distanza massima dal muro, in metri, per avviare la visita di un quadro. */
  reach: number;
  options: TourOptions;
}

interface ActiveTour {
  group: THREE.Object3D;
  artwork: Artwork;
  stops: TourStop[];
  index: number;
  paused: boolean;
  finished: boolean;
  highlight: Highlight;
  returnPosition: THREE.Vector3;
  returnQuaternion: THREE.Quaternion;
}

/** Margine attorno al quadro quando è inquadrato per intero. */
const FIT_MARGIN = 1.12;
/** Distanza minima della camera dalla tela, anche con zoom molto forti. */
const MIN_DISTANCE = 0.2;
/** Raggio predefinito dell'area evidenziata a zoom 1, in frazione del lato più lungo del quadro. */
const DEFAULT_RADIUS = 0.3;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Visita guidata di un quadro: la camera si avvicina, poi per ogni tappa zooma su un dettaglio,
 * lo evidenzia, mostra il sottotitolo e lo legge ad alta voce. Finita una tappa passa da sola alla successiva.
 */
export class GuidedTour {
  private readonly museum: Museum;
  private readonly controls: PlayerControls;
  private readonly toast: Toast;
  private readonly reach: number;
  private readonly options: TourOptions;
  private readonly panel: TourPanel;
  private readonly narrator = new Narrator(t().speech);
  // WeakMap: quando una sala viene smontata, le evidenziazioni dei suoi quadri se ne vanno con loro.
  private readonly highlights = new WeakMap<THREE.Object3D, Highlight>();
  private artworks: THREE.Object3D | null = null;
  private active: ActiveTour | null = null;
  /** Aumenta a ogni cambio di tappa, pausa o uscita: le attese ancora in corso capiscono di essere superate. */
  private generation = 0;
  private cameraTween: gsap.core.Tween | null = null;

  constructor({ museum, controls, toast, parent, reach, options }: GuidedTourParts) {
    this.museum = museum;
    this.controls = controls;
    this.toast = toast;
    this.reach = reach;
    this.options = options;
    this.narrator.rate = options.voiceRate;
    this.panel = new TourPanel(parent, {
      previous: () => this.previous(),
      togglePause: () => this.togglePause(),
      next: () => this.next(),
      exit: () => this.exit(),
    });

    document.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
  }

  get isActive(): boolean {
    return this.active !== null;
  }

  /** Indica il gruppo che contiene i quadri appesi, su cui si cercano i clic. */
  setArtworks(root: THREE.Object3D): void {
    this.artworks = root;
  }

  /**
   * Gestisce un clic o un tocco sulla scena: se colpisce un quadro con visita guidata e il visitatore
   * è vicino al cordone la avvia; se è lontano lo invita ad avvicinarsi.
   */
  handleTap(pointer: THREE.Vector2): boolean {
    if (this.active) return false;
    const group = this.pickTourArtwork(pointer);
    return group ? this.requestStart(group) : false;
  }

  /** Avvia la visita del quadro se il visitatore è vicino al cordone, altrimenti lo invita ad avvicinarsi. */
  requestStart(group: THREE.Object3D): boolean {
    if (!this.isNear(group)) {
      this.toast.show(t().tour.tooFar);
      return false;
    }
    this.start(group);
    return true;
  }

  /** True se il visitatore sta davanti al quadro, abbastanza vicino al cordone. */
  isNear(group: THREE.Object3D): boolean {
    return isNearArtwork(group, this.museum.camera.position, this.reach);
  }

  start(group: THREE.Object3D): void {
    const artwork = artworkOf(group);
    if (this.active || !artwork.tour?.length) return;

    this.controls.enabled = false;
    // La voce nella lingua scelta: durante la visita la lingua non si può cambiare.
    this.narrator.setLanguage(t().speech);
    // Il mouse serve libero per usare i pulsanti.
    this.controls.unlock();
    this.museum.renderer.domElement.style.cursor = '';

    const camera = this.museum.camera;
    this.active = {
      group,
      artwork,
      stops: artwork.tour,
      index: 0,
      paused: false,
      finished: false,
      highlight: this.highlightFor(group, artwork),
      returnPosition: camera.position.clone(),
      returnQuaternion: camera.quaternion.clone(),
    };
    this.panel.show(artwork);
    this.goTo(0, this.options.approachDuration);
  }

  next(): void {
    if (this.active && this.active.index < this.active.stops.length - 1) this.goTo(this.active.index + 1);
  }

  previous(): void {
    if (this.active && this.active.index > 0) this.goTo(this.active.index - 1);
  }

  togglePause(): void {
    const tour = this.active;
    if (!tour) return;
    if (tour.finished) {
      tour.paused = false;
      this.goTo(0);
      return;
    }
    tour.paused = !tour.paused;
    const generation = ++this.generation;
    if (tour.paused) this.narrator.stop();
    // Riprendendo, la tappa corrente viene riletta dall'inizio.
    else void this.narrate(generation);
    this.refreshPanel();
  }

  /** Esce dalla visita e riporta la camera dov'era il visitatore. `byEscape` se si esce con il tasto Esc invece che con il pulsante. */
  exit(byEscape = false): void {
    const tour = this.active;
    if (!tour) return;
    this.active = null;
    this.generation++;
    this.narrator.stop();
    tour.highlight.hide(0.5);
    this.panel.hide();
    // Su PC si riprende subito a guardarsi intorno, senza cliccare.
    this.controls.resume(byEscape);
    this.animateCamera(tour.returnPosition, tour.returnQuaternion, this.options.approachDuration, () => {
      this.controls.enabled = true;
    });
  }

  private goTo(index: number, duration = this.options.stepDuration): void {
    const tour = this.active;
    if (!tour) return;
    tour.index = index;
    tour.finished = false;
    const generation = ++this.generation;
    this.narrator.stop();
    this.refreshPanel();

    const stop = tour.stops[index];
    const { artwork } = tour;
    const center = new THREE.Vector2((stop.x - 0.5) * artwork.width, (0.5 - stop.y) * artwork.height);
    const radius = (stop.radius ?? DEFAULT_RADIUS / stop.zoom) * Math.max(artwork.width, artwork.height);
    // A quadro intero non si evidenzia nulla, a meno che la tappa non indichi un raggio.
    const strength = stop.zoom > 1 || stop.radius !== undefined ? 1 : 0;
    tour.highlight.animateTo(center, radius, strength, duration);

    const { position, quaternion } = this.poseFor(tour, stop);
    this.animateCamera(position, quaternion, duration, () => {
      if (generation === this.generation && !tour.paused) void this.narrate(generation);
    });
  }

  /** Legge la tappa corrente; alla fine, dopo una breve pausa, passa alla successiva. */
  private async narrate(generation: number): Promise<void> {
    const tour = this.active;
    if (!tour) return;
    const completed = await this.narrator.speak(tour.stops[tour.index].text[language()]);
    const stillCurrent = () => generation === this.generation && this.active === tour && !tour.paused;
    if (!completed || !stillCurrent()) return;

    await new Promise((resolve) => setTimeout(resolve, this.options.pauseBetweenStops * 1000));
    if (!stillCurrent()) return;
    if (tour.index < tour.stops.length - 1) {
      this.goTo(tour.index + 1);
    } else {
      tour.finished = true;
      this.refreshPanel();
    }
  }

  /** Posizione e orientamento della camera per inquadrare una tappa, guardando il quadro di fronte. */
  private poseFor(tour: ActiveTour, stop: TourStop): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
    const { artwork, group } = tour;
    const camera = this.museum.camera;
    const frameWidth = frameWidthFor(artwork);
    const covered = this.panel.coveredFraction;
    const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;

    // Altezza della scena visibile sullo schermo: a zoom 1 il quadro intero sta nello spazio sopra il pannello.
    const fitHeight =
      (Math.max(artwork.height + 2 * frameWidth, (artwork.width + 2 * frameWidth) / camera.aspect) * FIT_MARGIN) / (1 - covered);
    const visibleHeight = fitHeight / stop.zoom;
    const distance = Math.max(visibleHeight / 2 / Math.tan(halfFov), MIN_DISTANCE);

    // Il dettaglio va al centro dello spazio libero sopra il pannello, non al centro dello schermo.
    const target = new THREE.Vector3(
      (stop.x - 0.5) * artwork.width,
      (0.5 - stop.y) * artwork.height - (covered / 2) * visibleHeight,
      CANVAS_OFFSET,
    );
    group.localToWorld(target);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()));
    const position = target.clone().addScaledVector(normal, distance);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(position, target, UP));
    return { position, quaternion };
  }

  private animateCamera(position: THREE.Vector3, quaternion: THREE.Quaternion, duration: number, onComplete: () => void): void {
    this.cameraTween?.kill();
    this.cameraTween = tweenCamera(this.museum.camera, position, quaternion, duration, onComplete);
  }

  private refreshPanel(): void {
    const tour = this.active;
    if (!tour) return;
    this.panel.update({
      index: tour.index,
      total: tour.stops.length,
      text: tour.stops[tour.index].text[language()],
      paused: tour.paused,
      finished: tour.finished,
    });
  }

  private highlightFor(group: THREE.Object3D, artwork: Artwork): Highlight {
    let highlight = this.highlights.get(group);
    if (!highlight) {
      highlight = new Highlight(artwork.width, artwork.height, CANVAS_OFFSET + 0.002);
      group.add(highlight.mesh);
      this.highlights.set(group, highlight);
    }
    return highlight;
  }

  private pickTourArtwork(pointer: THREE.Vector2): THREE.Object3D | null {
    if (!this.artworks) return null;
    const group = pickArtwork(pointer, this.museum.camera, this.artworks);
    return group && artworkOf(group).tour?.length ? group : null;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.active) return;
    // Spazio e Invio su un pulsante attivano già il pulsante stesso.
    const onButton = event.target instanceof HTMLButtonElement;
    switch (event.code) {
      case 'ArrowRight':
        this.next();
        break;
      case 'ArrowLeft':
        this.previous();
        break;
      case 'Space':
        if (onButton) return;
        this.togglePause();
        break;
      case 'Escape':
        this.exit(true);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /** Se la finestra cambia dimensione durante una tappa, la camera si riposiziona per inquadrarla di nuovo bene. */
  private readonly onResize = (): void => {
    const tour = this.active;
    if (!tour || this.cameraTween?.isActive()) return;
    const { position, quaternion } = this.poseFor(tour, tour.stops[tour.index]);
    this.museum.camera.position.copy(position);
    this.museum.camera.quaternion.copy(quaternion);
  };
}
