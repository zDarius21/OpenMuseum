import * as THREE from 'three';
import { clearArtworkTexture, disposeArtwork, setArtworkTexture } from '../artworks/createArtwork';
import { hangArtworks, loadArtworkTexture, type HangOptions } from '../artworks/hangArtworks';
import { redrawLabel } from '../artworks/label';
import { artworkOf } from '../artworks/pickArtwork';
import { t } from '../i18n/strings';
import type { BarrierConfig } from '../scene/Barriers';
import { createRoom, type Room, type RoomConfig } from '../scene/Room';
import { layoutRoom, type LayoutOptions, type RoomLayout } from './layout';
import { LightPool } from './LightPool';
import { roomTitle, type RoomPlan } from './plan';

/** Una sala del percorso, costruita o no. Il titolo, nella lingua scelta, si ricava con roomTitle. */
export interface RoomInfo extends Pick<RoomPlan, 'movement' | 'part'> {
  index: number;
  /** Facce interne delle pareti sud e nord, lungo z: le sale vanno verso nord, cioè verso z più piccole. */
  south: number;
  north: number;
  layout: RoomLayout;
}

export interface RoomManagerOptions {
  scene: THREE.Scene;
  /** Servono a passare le immagini dei quadri alla scheda grafica una alla volta e a compilare gli shader in anticipo. */
  renderer: THREE.WebGLRenderer;
  camera: THREE.Camera;
  room: RoomConfig & {
    /** Sale vuote (pareti, pavimento e porte) prima e dopo quella in cui ci si trova: si vedono dalle porte. */
    shellRadius: number;
    /** Sale arredate, con quadri, targhette e transenne, prima e dopo quella in cui ci si trova. */
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
  /** Pareti, pavimento e porte. */
  room: Room | null;
  /** I quadri, solo nelle sale arredate. */
  artworks: THREE.Group | null;
  images: 'none' | 'loading' | 'loaded';
  /** Aumenta quando la sala perde i quadri o le immagini: i caricamenti ancora in corso capiscono di essere superati. */
  generation: number;
}

/** Distanza dalla parete sud della prima sala da cui parte il visitatore. */
const START_DISTANCE = 1.5;

/**
 * Le sale del museo, in fila da sud a nord e collegate da porte. Sono costruite solo quelle vicine al visitatore:
 * le più lontane vuote, perché si vedano in fondo attraverso le porte; le vicine arredate, e le più vicine con
 * le immagini. Camminando le altre si costruiscono e si smontano, così il museo pesa come poche sale anche quando sono tante.
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
      const info: RoomInfo = { index, movement: plan.movement, part: plan.part, south, north: south - layout.depth, layout };
      // La sala successiva comincia dall'altra parte della parete nord.
      south = info.north - this.options.room.wallThickness;
      return { info, room: null, artworks: null, images: 'none', generation: 0 };
    });
  }

  /**
   * Costruisce la prima sala e quelle vicine, poi aspetta gli shader e le immagini della prima.
   * `onProgress` riceve quanti di questi passi sono finiti: uno per immagine, più uno per gli shader.
   */
  async enter(onProgress: (done: number, total: number) => void): Promise<void> {
    const slots = this.slots;
    if (slots.length === 0) return;
    const first = slots[0];
    // Si costruisce subito tutto quello che si vede dalla prima sala, così gli shader si compilano insieme.
    // Le immagini della prima sala arrivano intanto; quelle delle vicine dopo, senza farla aspettare.
    this.arrange(0);
    let images = 0;
    let total = first.artworks!.children.length;
    let compiled = false;
    const report = () => onProgress(images + (compiled ? 1 : 0), total + 1);
    report();
    await Promise.all([
      this.prepareGpu().then(() => {
        compiled = true;
        report();
      }),
      this.loadImages(first, (loaded, count) => {
        images = loaded;
        total = count;
        report();
      }),
    ]);
    // Se nel frattempo è stato scelto un altro percorso, ci pensa la sua chiamata a enter.
    if (this.slots === slots) this.setCurrent(0);
  }

  /**
   * Prepara la scheda grafica per le sale costruite senza fermare la pagina. Gli shader si compilano in parallelo:
   * la prima volta ci vogliono anche due secondi, e la schermata iniziale resterebbe bloccata. Intanto le texture
   * (targhette, cartelli, parquet) passano una per frame, invece che tutte insieme al primo frame.
   * Fino ad allora le sale restano nascoste, se no il primo frame farebbe tutto subito, aspettando.
   */
  private async prepareGpu(): Promise<void> {
    const { renderer, scene, camera } = this.options;
    this.roomsGroup.visible = false;
    this.artworksRoot.visible = false;
    const textures = new Set<THREE.Texture>();
    scene.traverse((object) => {
      // Le targhette hanno un materiale per faccia.
      const materials = [(object as THREE.Mesh).material ?? []].flat();
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    const uploads = [...textures].map(
      (texture) => new Promise<void>((resolve) => this.uploadQueue.push(() => (renderer.initTexture(texture), resolve()))),
    );
    await Promise.all([renderer.compileAsync(scene, camera), ...uploads]);
    this.roomsGroup.visible = true;
    this.artworksRoot.visible = true;
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
    this.arrange(index);
    const { imageRadius } = this.options.room;
    for (const slot of this.slots) {
      if (Math.abs(slot.info.index - index) <= imageRadius) void this.loadImages(slot);
      else this.unloadImages(slot);
    }
    const current = this.slots[index];
    this.lights.assign(current.artworks?.children ?? []);
    this.options.onRoomChange(current.info, this.slots.length);
  }

  /** Costruisce, arreda, svuota e smonta le sale secondo la distanza da quella indicata. Le immagini sono a parte. */
  private arrange(index: number): void {
    const { shellRadius, buildRadius } = this.options.room;
    for (const slot of this.slots) {
      const distance = Math.abs(slot.info.index - index);
      if (distance <= buildRadius) this.furnish(slot);
      else if (distance <= shellRadius) {
        this.build(slot);
        this.unfurnish(slot);
      } else this.teardown(slot);
    }
    this.closeDoorsToEmptyRooms();
  }

  /**
   * Chiude le porte che danno su sale non costruite, e riapre le altre: invece del vuoto scuro, attraverso
   * le porte in fondo si vede bianco come le pareti, e quando la sala si costruisce lo stacco si nota poco.
   */
  private closeDoorsToEmptyRooms(): void {
    for (const slot of this.slots) {
      const { index } = slot.info;
      slot.room?.setDoorClosed('south', !this.slots[index - 1]?.room);
      slot.room?.setDoorClosed('north', !this.slots[index + 1]?.room);
    }
  }

  /** Rifà nella lingua scelta i testi delle sale costruite: cartelli sopra le porte e targhette dei quadri. */
  refreshTexts(): void {
    for (const slot of this.slots) {
      slot.room?.setSigns(this.signsOf(slot.info));
      for (const group of slot.artworks?.children ?? []) {
        const label = group.getObjectByName('label');
        if (label instanceof THREE.Mesh) redrawLabel(label, artworkOf(group));
      }
    }
  }

  /** I cartelli sopra le porte di una sala, con il numero e il titolo della sala precedente e di quella successiva. */
  private signsOf(info: RoomInfo): { south?: string; north?: string } {
    const previous = this.slots[info.index - 1]?.info;
    const next = this.slots[info.index + 1]?.info;
    return {
      south: previous && t().room.previousSign(previous.index + 1, roomTitle(previous)),
      north: next && t().room.nextSign(next.index + 1, roomTitle(next)),
    };
  }

  /** Costruisce la sala vuota: pareti, pavimento, soffitto, porte e cartelli. */
  private build(slot: Slot): void {
    if (slot.room) return;
    const { info } = slot;
    const room = createRoom({
      config: this.options.room,
      depth: info.layout.depth,
      south: info.south,
      doors: { south: info.index > 0, north: info.index < this.slots.length - 1 },
      signs: this.signsOf(info),
      barriers: this.options.barriers,
      maxAnisotropy: this.options.hang.maxAnisotropy,
      reflections: this.options.hang.reflections,
    });
    slot.room = room;
    this.roomsGroup.add(room.group);
  }

  /**
   * Arreda la sala, costruendola se serve: quadri (ancora senza immagini), targhette e transenne.
   * Le collisioni servono solo qui: alle sale vuote, sempre lontane, non ci si avvicina.
   */
  private furnish(slot: Slot): void {
    this.build(slot);
    const room = slot.room!;
    if (slot.artworks) return;
    room.setBarriers(true);
    this.colliders.push(...room.colliders);
    slot.artworks = hangArtworks(slot.info.layout.placed, room, this.options.hang);
    this.artworksRoot.add(slot.artworks);
  }

  /** Toglie quadri e transenne, e lascia la sala vuota. */
  private unfurnish(slot: Slot): void {
    const { room, artworks } = slot;
    if (!room || !artworks) return;
    slot.generation++;
    slot.images = 'none';
    slot.artworks = null;

    const removed = new Set(room.colliders);
    const kept = this.colliders.filter((collider) => !removed.has(collider));
    this.colliders.splice(0, this.colliders.length, ...kept);
    room.setBarriers(false);
    this.artworksRoot.remove(artworks);
    for (const group of artworks.children) disposeArtwork(group);
  }

  private teardown(slot: Slot): void {
    const { room } = slot;
    if (!room) return;
    this.unfurnish(slot);
    slot.room = null;
    this.roomsGroup.remove(room.group);
    room.dispose();
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
