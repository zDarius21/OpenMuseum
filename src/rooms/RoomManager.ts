import * as THREE from 'three';
import { clearArtworkTexture, disposeArtwork, setArtworkTexture } from '../artworks/createArtwork';
import { hangArtworks, loadArtworkTexture, type HangOptions } from '../artworks/hangArtworks';
import { artworkOf } from '../artworks/pickArtwork';
import type { BarrierConfig } from '../scene/Barriers';
import { createRoom, type Room, type RoomConfig } from '../scene/Room';
import { layoutRoom, type LayoutOptions, type RoomLayout } from './layout';
import { LightPool } from './LightPool';
import type { RoomPlan } from './plan';

/** Una sala del percorso, costruita o no. */
export interface RoomInfo {
  index: number;
  title: string;
  subtitle?: string;
  /** Facce interne delle pareti sud e nord, lungo z: le sale vanno verso nord, cioè verso z più piccole. */
  south: number;
  north: number;
  layout: RoomLayout;
}

export interface RoomManagerOptions {
  scene: THREE.Scene;
  /** Serve a passare le immagini dei quadri alla scheda grafica una alla volta. */
  renderer: THREE.WebGLRenderer;
  room: RoomConfig & {
    /** Sale costruite prima e dopo quella in cui ci si trova. */
    buildRadius: number;
    /** Sale con le immagini caricate prima e dopo quella in cui ci si trova. */
    imageRadius: number;
  };
  layout: LayoutOptions;
  barriers: BarrierConfig;
  hang: HangOptions;
  lights: { count: number; fadeDuration: number };
  /** Chiamata quando il visitatore entra in un'altra sala, e all'inizio della visita. */
  onRoomChange: (room: RoomInfo, total: number) => void;
}

interface Slot {
  info: RoomInfo;
  room: Room | null;
  artworks: THREE.Group | null;
  images: 'none' | 'loading' | 'loaded';
  /** Aumenta quando la sala viene smontata o perde le immagini: i caricamenti ancora in corso capiscono di essere superati. */
  generation: number;
}

/** Distanza dalla parete sud della prima sala da cui parte il visitatore. */
const START_DISTANCE = 1.5;

/**
 * Le sale del museo, in fila da sud a nord e collegate da porte. Sono costruite solo quelle vicine al visitatore,
 * e solo le più vicine hanno le immagini: camminando le altre si costruiscono e si smontano, così il museo
 * pesa come poche sale anche quando sono tante.
 */
export class RoomManager {
  /** Contiene i quadri delle sale costruite: è qui che si cercano i clic. */
  readonly artworksRoot = new THREE.Group();
  /** Volumi solidi delle sale costruite, aggiornati sul posto: è lo stesso array usato da PlayerControls. */
  readonly colliders: THREE.Box3[] = [];
  private readonly options: RoomManagerOptions;
  private readonly roomsGroup = new THREE.Group();
  private readonly lights: LightPool;
  private slots: Slot[] = [];
  private currentIndex = -1;
  /** Immagini arrivate che aspettano il loro turno per passare alla scheda grafica, una per frame. */
  private readonly uploadQueue: (() => void)[] = [];

  constructor(options: RoomManagerOptions) {
    this.options = options;
    this.roomsGroup.name = 'rooms';
    this.artworksRoot.name = 'artworks';
    options.scene.add(this.roomsGroup, this.artworksRoot);
    this.lights = new LightPool(options.scene, options.lights.count, options.lights.fadeDuration);
    // Le immagini decodificate si liberano appena passano alla scheda grafica: se il contesto WebGL si perde,
    // three.js non può ricaricarle da sé e vanno riscaricate.
    options.renderer.domElement.addEventListener('webglcontextrestored', () => this.reloadImages());
  }

  get rooms(): readonly RoomInfo[] {
    return this.slots.map((slot) => slot.info);
  }

  /** La sala in cui si trova il visitatore, una volta entrato nel museo. */
  get current(): RoomInfo | null {
    return this.slots[this.currentIndex]?.info ?? null;
  }

  /** Il punto di partenza, nella prima sala, e un punto verso cui guardare. */
  get start(): { position: THREE.Vector3; lookAt: THREE.Vector3 } {
    const south = this.slots[0]?.info.south ?? 0;
    return { position: new THREE.Vector3(0, 0, south - START_DISTANCE), lookAt: new THREE.Vector3(0, 0, south - START_DISTANCE - 10) };
  }

  /** Il gruppo della sala costruita, con le sue pareti, se c'è. */
  roomOf(index: number): Room | null {
    return this.slots[index]?.room ?? null;
  }

  /** Smonta le sale di prima e calcola posizione e misure delle nuove, senza costruire nulla. */
  plan(plans: readonly RoomPlan[]): void {
    for (const slot of this.slots) this.teardown(slot);
    this.lights.assign([]);
    this.currentIndex = -1;

    let south = 0;
    this.slots = plans.map((plan, index) => {
      const layout = layoutRoom(plan.artworks, this.options.layout);
      const info: RoomInfo = { index, title: plan.title, subtitle: plan.subtitle, south, north: south - layout.depth, layout };
      // La sala successiva comincia dall'altra parte della parete nord.
      south = info.north - this.options.room.wallThickness;
      return { info, room: null, artworks: null, images: 'none', generation: 0 };
    });
  }

  /**
   * Costruisce la prima sala e quelle vicine, poi aspetta le immagini della prima.
   * `onProgress` riceve quante immagini della prima sala sono arrivate.
   */
  async enter(onProgress: (loaded: number, total: number) => void): Promise<void> {
    const slots = this.slots;
    if (slots.length === 0) return;
    const first = slots[0];
    // La prima sala si carica per prima, con l'avanzamento; le vicine dopo, senza farla aspettare.
    this.build(first);
    await this.loadImages(first, onProgress);
    // Se nel frattempo è stato scelto un altro percorso, ci pensa la sua chiamata a enter.
    if (this.slots === slots) this.setCurrent(0);
  }

  /** Da chiamare a ogni frame: segue il visitatore da una sala all'altra. */
  update(position: THREE.Vector3, delta: number): void {
    this.lights.update(delta);
    this.uploadQueue.shift()?.();
    if (this.currentIndex < 0) return;
    const index = this.roomAt(position.z);
    if (index !== this.currentIndex) this.setCurrent(index);
  }

  /** La sala che contiene la coordinata z: il confine tra due sale è a metà della parete che le separa. */
  private roomAt(z: number): number {
    const half = this.options.room.wallThickness / 2;
    const index = this.slots.findIndex((slot) => z <= slot.info.south + half && z > slot.info.north - half);
    if (index >= 0) return index;
    return z > this.slots[0].info.south ? 0 : this.slots.length - 1;
  }

  private setCurrent(index: number): void {
    this.currentIndex = index;
    const { buildRadius, imageRadius } = this.options.room;
    for (const slot of this.slots) {
      const distance = Math.abs(slot.info.index - index);
      if (distance <= buildRadius) this.build(slot);
      else this.teardown(slot);
      if (distance <= imageRadius) void this.loadImages(slot);
      else this.unloadImages(slot);
    }
    const current = this.slots[index];
    this.lights.assign(current.artworks?.children ?? []);
    this.options.onRoomChange(current.info, this.slots.length);
  }

  private build(slot: Slot): void {
    if (slot.room) return;
    const { info } = slot;
    const previous = this.slots[info.index - 1]?.info;
    const next = this.slots[info.index + 1]?.info;
    const room = createRoom({
      config: this.options.room,
      depth: info.layout.depth,
      south: info.south,
      doors: { south: Boolean(previous), north: Boolean(next) },
      signs: {
        south: previous && `‹ Sala ${previous.index + 1} · ${previous.title}`,
        north: next && `Sala ${next.index + 1} · ${next.title} ›`,
      },
      barriers: this.options.barriers,
      maxAnisotropy: this.options.hang.maxAnisotropy,
      reflections: this.options.hang.reflections,
    });
    slot.room = room;
    this.roomsGroup.add(room.group);
    this.colliders.push(...room.colliders);

    slot.artworks = hangArtworks(info.layout.placed, room, this.options.hang);
    this.artworksRoot.add(slot.artworks);
  }

  private teardown(slot: Slot): void {
    const { room, artworks } = slot;
    if (!room) return;
    slot.generation++;
    slot.images = 'none';
    slot.room = null;
    slot.artworks = null;

    const removed = new Set(room.colliders);
    const kept = this.colliders.filter((collider) => !removed.has(collider));
    this.colliders.splice(0, this.colliders.length, ...kept);
    this.roomsGroup.remove(room.group);
    room.dispose();
    if (artworks) {
      this.artworksRoot.remove(artworks);
      for (const group of artworks.children) disposeArtwork(group);
    }
  }

  /** Scarica le immagini dei quadri della sala, se non ci sono già o non stanno già arrivando. */
  private async loadImages(slot: Slot, onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (slot.images !== 'none' || !slot.artworks) return;
    slot.images = 'loading';
    const generation = slot.generation;
    const groups = [...slot.artworks.children];
    let loaded = 0;
    onProgress?.(loaded, groups.length);
    await Promise.all(
      groups.map(async (group) => {
        const texture = await loadArtworkTexture(artworkOf(group), this.options.hang.maxAnisotropy);
        // Più immagini passate alla scheda grafica nello stesso frame lo allungherebbero troppo: una per frame.
        await new Promise<void>((resolve) => this.uploadQueue.push(resolve));
        // Se nel frattempo la sala è stata smontata o ha perso le immagini, questa non serve più.
        if (slot.generation !== generation) {
          texture.dispose();
          return;
        }
        // Subito, e non al primo frame in cui il quadro è inquadrato: girandosi verso una parete arriverebbero tutte insieme.
        this.options.renderer.initTexture(texture);
        setArtworkTexture(group, texture);
        onProgress?.(++loaded, groups.length);
      }),
    );
    if (slot.generation === generation) slot.images = 'loaded';
  }

  /** Toglie le immagini ai quadri di una sala lontana, che restano in piedi con le tele scure. */
  private unloadImages(slot: Slot): void {
    if (slot.images === 'none') return;
    slot.generation++;
    slot.images = 'none';
    for (const group of slot.artworks?.children ?? []) clearArtworkTexture(group);
  }

  /** Riscarica le immagini delle sale vicine, dopo che il contesto WebGL è stato ripristinato. */
  private reloadImages(): void {
    for (const slot of this.slots) {
      this.unloadImages(slot);
      if (this.currentIndex >= 0 && Math.abs(slot.info.index - this.currentIndex) <= this.options.room.imageRadius) void this.loadImages(slot);
    }
  }
}
