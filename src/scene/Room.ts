import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBarriers, type BarrierConfig, type Barriers, type FloorPoint } from './Barriers';
import { createMoldingGeometry, type ProfilePoint } from './molding';
import { createParquetTexture, PARQUET_TILE_SIZE } from './parquet';
import { createTextureCanvas } from '../utils/textureCanvas';

export interface RoomConfig {
  height: number;
  wallThickness: number;
  door: { width: number; height: number };
}

/** Facce interne delle quattro pareti: da ovest a est lungo x, da sud a nord lungo z (il nord è verso z più piccole). */
export interface RoomBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

export const WALL_IDS = ['nord', 'sud', 'est', 'ovest'] as const;
export type WallId = (typeof WALL_IDS)[number];

export interface RoomOptions {
  config: RoomConfig;
  bounds: RoomBounds;
  /** Pareti con una porta, al centro. */
  doors: readonly WallId[];
  /** Pareti con i quadri: davanti hanno le transenne. */
  artWalls: readonly WallId[];
  /** Cartelli sopra le porte, visti dall'interno della sala: per esempio «Sala 3 · Roma ›». */
  signs: Partial<Record<WallId, string>>;
  /** Colore delle pareti, quello della corrente della sala. */
  wallColor: string;
  barriers: BarrierConfig;
  maxAnisotropy: number;
  /** Riflessi per i materiali metallici. */
  reflections: THREE.Texture;
}

export interface Wall {
  /** Centro della faccia interna, a livello del pavimento. */
  readonly center: THREE.Vector3;
  /** Direzione perpendicolare alla parete, verso l'interno della sala. */
  readonly normal: THREE.Vector3;
  /** Direzione verso destra per chi guarda la parete dall'interno. */
  readonly right: THREE.Vector3;
  readonly length: number;
}

/** Per ogni parete, la direzione verso l'interno della sala e quella verso destra per chi la guarda. */
export const WALL_AXES: Record<WallId, { readonly normal: THREE.Vector3; readonly right: THREE.Vector3 }> = {
  nord: { normal: new THREE.Vector3(0, 0, 1), right: new THREE.Vector3(1, 0, 0) },
  sud: { normal: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(-1, 0, 0) },
  est: { normal: new THREE.Vector3(-1, 0, 0), right: new THREE.Vector3(0, 0, 1) },
  ovest: { normal: new THREE.Vector3(1, 0, 0), right: new THREE.Vector3(0, 0, -1) },
};

export interface Room {
  readonly group: THREE.Group;
  /** Volumi solidi contro cui si ferma il visitatore: le pareti e, se ci sono, le transenne. */
  readonly colliders: THREE.Box3[];
  readonly walls: Record<WallId, Wall>;
  readonly height: number;
  readonly bounds: RoomBounds;
  /** Chiude una porta con un pezzo di parete, o la riapre: dietro una sala non costruita si vedrebbe lo sfondo scuro. */
  setDoorClosed(wall: WallId, closed: boolean): void;
  /** Mette o toglie le transenne, con le loro collisioni: la sala nasce vuota. */
  setBarriers(present: boolean): void;
  /** Rifà i cartelli sopra le porte, per esempio in un'altra lingua. */
  setSigns(signs: RoomOptions['signs']): void;
  /** Libera la memoria della scheda grafica quando la sala viene smontata. */
  dispose(): void;
}

/** Distanza dalle pareti del binario sul soffitto, che fa il giro della sala, a cui sono appesi i faretti dei quadri. */
export const SPOT_TRACK_DISTANCE = 1.55;

/**
 * Ordine in cui si disegnano le sale, dal primo: quello che sporge (cornicioni, battiscopa, binari, cartelli), poi le
 * pareti, poi il resto. Così la scheda grafica scarta senza colorarle le parti di parete e di soffitto nascoste
 * davanti, e le sale dietro le porte; senza, l'ordine sarebbe quello di creazione dei materiali.
 * I quadri vengono ancora prima (vedi createArtwork).
 */
export const DRAW_ORDER = { inFront: -2, walls: -1 } as const;

const CEILING_COLOR = 0xf7f5f0;
/** Stucco del cornicione, delle cornici delle porte e del lucernario. */
const TRIM_COLOR = 0xf1ece2;
const BASEBOARD_COLOR = 0x3d3833;
const THRESHOLD_COLOR = 0xd8d2c8;
const FIXTURE_COLOR = 0x2b2b2e;
const BASEBOARD_HEIGHT = 0.14;
const BASEBOARD_DEPTH = 0.015;
/** Il rivestimento dello spessore del muro nel vano della porta, che entra un poco nel vano. */
const LINING = 0.02;
/** Larghezza della cornice delle porte sulla faccia del muro. */
const ARCHITRAVE_WIDTH = 0.16;
/** I paletti alle estremità stanno a questa distanza dalle pareti con le porte: troppo poco per passarci dietro. */
const BARRIER_END_GAP = 0.15;
const SIGN_WIDTH = 2.4;
const SIGN_HEIGHT = 0.42;
const SIGN_BACKGROUND = '#2b2724';
const SIGN_TEXT = '#f4efe6';
/** Lucernario al centro del soffitto: distanza dalle pareti, profondità del pozzo e misure dei vetri. */
const LAYLIGHT_MARGIN = 2.8;
const LAYLIGHT_WELL = 0.3;
const LAYLIGHT_PANE = { width: 0.73, depth: 1.1 };
const TRACK_SIZE = { width: 0.05, height: 0.045 };

/** Cornicione tra parete e soffitto, in sezione: dal soffitto, una gola concava, un tondino e un listello contro il muro. */
const CORNICE: ProfilePoint[] = [
  { offset: -0.25, height: 0, shade: 0.8 },
  { offset: -0.25, height: 0.03, shade: 0.95 },
  { offset: -0.21, height: 0.04, shade: 1 },
  ...quarterCircle(-0.2, 0.23, 0.17, 5, [0.92, 0.82, 0.78, 0.8, 0.88]),
  { offset: -0.032, height: 0.245, shade: 1 },
  { offset: -0.02, height: 0.258, shade: 0.95 },
  { offset: -0.012, height: 0.262, shade: 0.85 },
  { offset: -0.012, height: 0.28, shade: 0.8 },
  { offset: 0, height: 0.28, shade: 0.7 },
];
/** Cornice delle porte, in sezione: due fasce a gradino e un piccolo tondino verso l'esterno. */
const ARCHITRAVE: ProfilePoint[] = [
  { offset: 0, height: 0, shade: 0.75 },
  { offset: 0, height: 0.03, shade: 0.9 },
  { offset: 0.015, height: 0.035, shade: 1 },
  { offset: 0.055, height: 0.035, shade: 1 },
  { offset: 0.06, height: 0.042, shade: 0.95 },
  { offset: 0.11, height: 0.042, shade: 1 },
  { offset: 0.125, height: 0.052, shade: 1 },
  { offset: 0.145, height: 0.05, shade: 0.95 },
  { offset: ARCHITRAVE_WIDTH, height: 0.03, shade: 0.85 },
  { offset: ARCHITRAVE_WIDTH, height: 0, shade: 0.75 },
];
/** Il pozzo del lucernario, che sale dal soffitto fino ai vetri, e la fascia che lo incornicia sotto il soffitto. */
const LAYLIGHT_FRAME: ProfilePoint[] = [
  { offset: 0, height: -LAYLIGHT_WELL, shade: 0.7 },
  { offset: 0, height: 0.05, shade: 0.95 },
  { offset: 0.03, height: 0.07, shade: 1 },
  { offset: 0.1, height: 0.06, shade: 0.95 },
  { offset: 0.15, height: 0.02, shade: 0.88 },
  { offset: 0.16, height: 0, shade: 0.8 },
];

const UP = new THREE.Vector3(0, 1, 0);
/** Il pezzo di parete che chiude una porta è un piano di misura 1, scalato. */
const unitPlane = new THREE.PlaneGeometry(1, 1);
let materials: ReturnType<typeof createMaterials> | null = null;
/** I materiali dei pezzi che sporgono dalle pareti e dal soffitto, da disegnare per primi. */
const IN_FRONT = new Set<THREE.Material>();
/** Un materiale per colore di parete: lo stesso shader per tutti, cambia solo il colore. */
const wallMaterials = new Map<string, THREE.MeshStandardMaterial>();

function createMaterials(maxAnisotropy: number) {
  const created = {
    ceiling: new THREE.MeshStandardMaterial({ color: CEILING_COLOR, roughness: 1 }),
    trim: new THREE.MeshStandardMaterial({ color: TRIM_COLOR, roughness: 0.85, vertexColors: true }),
    baseboard: new THREE.MeshStandardMaterial({ color: BASEBOARD_COLOR, roughness: 0.6 }),
    threshold: new THREE.MeshStandardMaterial({ color: THRESHOLD_COLOR, roughness: 0.4 }),
    fixture: new THREE.MeshStandardMaterial({ color: FIXTURE_COLOR, roughness: 0.5, metalness: 0.3 }),
    // Lucidato a cera: i faretti ci si riflettono appena. Niente riflessi dell'ambiente, che sui telefoni costano
    // troppo su una superficie grande come il pavimento.
    floor: new THREE.MeshStandardMaterial({ map: createParquetTexture(maxAnisotropy), roughness: 0.5 }),
    // I vetri smerigliati del lucernario: non ricevono luce, sono loro a sembrare accesi.
    glass: new THREE.MeshBasicMaterial({ map: createLaylightTexture(maxAnisotropy) }),
  };
  for (const material of [created.trim, created.baseboard, created.fixture]) IN_FRONT.add(material);
  return created;
}

/**
 * Crea una sala rettangolare con il pavimento a quota 0, tra le facce interne delle pareti in `bounds`.
 * Le sale si affiancano su una pianta a griglia: due sale vicine hanno una parete in comune e, se nel percorso
 * vengono una dopo l'altra, la porta al centro. Ogni sala costruisce la metà di ogni muro dalla sua parte, con il suo colore.
 */
export function createRoom(options: RoomOptions): Room {
  const { height, wallThickness: thickness, door } = options.config;
  const { bounds, maxAnisotropy } = options;
  const width = bounds.east - bounds.west;
  const depth = bounds.south - bounds.north;
  const centerX = (bounds.west + bounds.east) / 2;
  const centerZ = (bounds.south + bounds.north) / 2;
  materials ??= createMaterials(maxAnisotropy);
  const shared = materials;
  const wall = wallMaterial(options.wallColor, height);
  const walls = Object.fromEntries(WALL_IDS.map((id) => [id, wallOf(id, bounds)])) as Record<WallId, Wall>;
  const frames = Object.fromEntries(WALL_IDS.map((id) => [id, wallFrame(walls[id])])) as Record<WallId, THREE.Matrix4>;

  const group = new THREE.Group();
  group.name = 'room';
  const colliders: THREE.Box3[] = [];
  const disposables: { dispose(): void }[] = [];
  const parts = new Parts();

  /** Un box nel riferimento di una parete (vedi wallFrame), o in quello della scena se `frame` è null. */
  const addBox = (
    material: THREE.Material,
    frame: THREE.Matrix4 | null,
    x: number,
    y: number,
    z: number,
    size: THREE.Vector3Tuple,
    solid = false,
  ): void => {
    const geometry = new THREE.BoxGeometry(...size).translate(x, y, z);
    if (frame) geometry.applyMatrix4(frame);
    parts.add(material, geometry);
    if (solid) {
      geometry.computeBoundingBox();
      colliders.push(geometry.boundingBox!.clone());
    }
  };

  // Pavimento: le coordinate della texture seguono i metri, così lo stesso parquet va bene per sale di ogni misura;
  // partono dall'asse della sala, dove si incontrano le punte della spina.
  const floorGeometry = new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2);
  const uv = floorGeometry.getAttribute('uv');
  for (let index = 0; index < uv.count; index++) {
    uv.setXY(index, ((uv.getX(index) - 0.5) * width) / PARQUET_TILE_SIZE, (uv.getY(index) * depth) / PARQUET_TILE_SIZE);
  }
  disposables.push(floorGeometry);
  const floor = new THREE.Mesh(floorGeometry, shared.floor);
  floor.position.set(centerX, 0, centerZ);
  group.add(floor);

  // Soffitto con il lucernario al centro: quattro fasce intorno all'apertura, il pozzo e i vetri.
  const laylight = { width: Math.max(2, width - 2 * LAYLIGHT_MARGIN), depth: Math.max(2, depth - 2 * LAYLIGHT_MARGIN) };
  const sideStrip = (width - laylight.width) / 2;
  const endStrip = (depth - laylight.depth) / 2;
  const ceilingPiece = (w: number, d: number, x: number, z: number) =>
    parts.add(shared.ceiling, new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2).translate(centerX + x, height, centerZ + z));
  for (const side of [-1, 1]) {
    ceilingPiece(sideStrip, depth, side * (width / 2 - sideStrip / 2), 0);
    ceilingPiece(laylight.width, endStrip, 0, side * (depth / 2 - endStrip / 2));
  }
  parts.add(shared.trim, horizontalMolding(laylight.width / 2, laylight.depth / 2, LAYLIGHT_FRAME).translate(centerX, height, centerZ));
  const glassGeometry = new THREE.PlaneGeometry(laylight.width, laylight.depth).rotateX(Math.PI / 2);
  const glassUv = glassGeometry.getAttribute('uv');
  const panes = {
    x: Math.max(1, Math.round(laylight.width / LAYLIGHT_PANE.width)),
    z: Math.max(1, Math.round(laylight.depth / LAYLIGHT_PANE.depth)),
  };
  for (let index = 0; index < glassUv.count; index++) glassUv.setXY(index, glassUv.getX(index) * panes.x, glassUv.getY(index) * panes.z);
  disposables.push(glassGeometry);
  const glass = new THREE.Mesh(glassGeometry, shared.glass);
  glass.position.set(centerX, height + LAYLIGHT_WELL, centerZ);
  group.add(glass);

  // Cornicione lungo tutto il giro delle pareti.
  parts.add(shared.trim, horizontalMolding(width / 2, depth / 2, CORNICE).translate(centerX, height, centerZ));

  // Binario dei faretti sul soffitto, che fa il giro della sala alla stessa distanza da tutte le pareti:
  // i tratti nord e sud stanno tra quelli est e ovest, senza sovrapporsi.
  const track = { width: width - 2 * SPOT_TRACK_DISTANCE, depth: depth - 2 * SPOT_TRACK_DISTANCE };
  const trackY = height - TRACK_SIZE.height / 2;
  for (const side of [-1, 1]) {
    addBox(shared.fixture, null, centerX + (side * track.width) / 2, trackY, centerZ, [TRACK_SIZE.width, TRACK_SIZE.height, track.depth + TRACK_SIZE.width]);
    addBox(shared.fixture, null, centerX, trackY, centerZ + (side * track.depth) / 2, [track.width - TRACK_SIZE.width, TRACK_SIZE.height, TRACK_SIZE.width]);
  }

  // Pareti, con la porta al centro se c'è, costruite nel riferimento di ognuna: x lungo la parete, z verso la sala.
  // Ogni sala costruisce metà spessore del muro, dalla sua parte: due sale vicine possono avere colori diversi.
  // Le pareti est e ovest arrivano fino a metà degli angoli, così il giro è chiuso.
  // Con la porta resta il pezzo di parete che la chiude, nascosto finché non serve.
  const halfThickness = thickness / 2;
  const wallZ = -halfThickness / 2;
  const baseboardZ = BASEBOARD_DEPTH / 2;
  const closures: Partial<Record<WallId, THREE.Mesh>> = {};
  for (const id of WALL_IDS) {
    const { length } = walls[id];
    const frame = frames[id];
    const end = length / 2 + (runsAlongX(id) ? 0 : halfThickness);
    if (!options.doors.includes(id)) {
      addBox(wall, frame, 0, height / 2, wallZ, [2 * end, height, halfThickness], true);
      addBox(shared.baseboard, frame, 0, BASEBOARD_HEIGHT / 2, baseboardZ, [length, BASEBOARD_HEIGHT, BASEBOARD_DEPTH]);
      continue;
    }
    const sideWidth = end - door.width / 2;
    const baseboardWidth = (length - door.width) / 2 - ARCHITRAVE_WIDTH;
    for (const side of [-1, 1]) {
      addBox(wall, frame, side * (door.width / 2 + sideWidth / 2), height / 2, wallZ, [sideWidth, height, halfThickness], true);
      const baseboardX = side * (length / 2 - baseboardWidth / 2);
      addBox(shared.baseboard, frame, baseboardX, BASEBOARD_HEIGHT / 2, baseboardZ, [baseboardWidth, BASEBOARD_HEIGHT, BASEBOARD_DEPTH]);
      addBox(shared.trim, frame, side * (door.width / 2 - LINING / 2), door.height / 2, wallZ, [LINING, door.height, halfThickness]);
    }
    addBox(wall, frame, 0, (door.height + height) / 2, wallZ, [door.width, height - door.height, halfThickness]);
    addBox(shared.trim, frame, 0, door.height - LINING / 2, wallZ, [door.width, LINING, halfThickness]);
    addBox(shared.threshold, frame, 0, 0.004, wallZ, [door.width, 0.008, halfThickness]);

    // La cornice della porta, sulla faccia del muro verso la sala; in basso i montanti finiscono sotto il pavimento.
    const opening = { halfWidth: door.width / 2 - LINING, halfHeight: (door.height - LINING) / 2 };
    const architrave = createMoldingGeometry(opening.halfWidth, opening.halfHeight, ARCHITRAVE, ['right', 'top', 'left']);
    parts.add(shared.trim, architrave.translate(0, opening.halfHeight, 0).applyMatrix4(frame));

    // A metà del muro, con i bordi nascosti dal rivestimento del vano: da lontano sembra la parete della sala dopo.
    const closure = new THREE.Mesh(unitPlane, wall);
    placeOnWall(closure, frame, 0, door.height / 2, -halfThickness);
    closure.scale.set(door.width, door.height, 1);
    closure.visible = false;
    group.add(closure);
    closures[id] = closure;
  }

  for (const mesh of parts.build()) {
    if (mesh.material === wall) mesh.renderOrder = DRAW_ORDER.walls;
    else if (IN_FRONT.has(mesh.material as THREE.Material)) mesh.renderOrder = DRAW_ORDER.inFront;
    disposables.push(mesh.geometry);
    group.add(mesh);
  }

  // Cartelli sopra le porte, sulla faccia interna. Cambiando lingua si rifanno.
  const signY = door.height + ARCHITRAVE_WIDTH + 0.1 + SIGN_HEIGHT / 2;
  let signs: THREE.Mesh[] = [];
  const setSigns = (texts: RoomOptions['signs']): void => {
    for (const sign of signs) {
      group.remove(sign);
      const material = sign.material as THREE.MeshStandardMaterial;
      sign.geometry.dispose();
      material.map?.dispose();
      material.dispose();
    }
    signs = [];
    for (const id of options.doors) {
      const text = texts[id];
      if (!text) continue;
      const sign = createSign(text, maxAnisotropy);
      sign.renderOrder = DRAW_ORDER.inFront;
      placeOnWall(sign, frames[id], 0, signY, 0.01);
      group.add(sign);
      signs.push(sign);
    }
  };
  setSigns(options.signs);

  // Transenne davanti alle pareti con i quadri: le porte restano libere.
  // Si mettono solo nelle sale arredate: quelle vuote si vedono da lontano, attraverso le porte.
  const fixedColliders = colliders.length;
  let barriers: Barriers | null = null;
  const setBarriers = (present: boolean): void => {
    if (present === (barriers !== null)) return;
    if (barriers) {
      group.remove(barriers.group);
      barriers.dispose();
      barriers = null;
      colliders.length = fixedColliders;
      return;
    }
    barriers = createBarriers(barrierLines(bounds, options.artWalls, options.barriers.distance), options.barriers, options.reflections);
    group.add(barriers.group);
    colliders.push(...barriers.colliders);
  };

  return {
    group,
    colliders,
    walls,
    height,
    bounds,
    setDoorClosed: (id, closed) => {
      const closure = closures[id];
      if (closure) closure.visible = closed;
    },
    setBarriers,
    setSigns,
    dispose: () => {
      setBarriers(false);
      setSigns({});
      for (const item of disposables) item.dispose();
    },
  };
}

/** Le pareti nord e sud corrono lungo x, quindi sono lunghe quanto la sala è larga; est e ovest lungo z. */
export function runsAlongX(wall: WallId): boolean {
  return wall === 'nord' || wall === 'sud';
}

/** Le pareti in senso orario, viste dall'alto con il nord in alto. */
export const CLOCKWISE: readonly WallId[] = ['sud', 'ovest', 'nord', 'est'];

/**
 * Le transenne, a `inset` dalle pareti con i quadri: una linea spezzata per ogni gruppo di pareti vicine, che gira
 * negli angoli e finisce poco prima delle pareti senza quadri, quelle con le porte.
 */
export function barrierLines(bounds: RoomBounds, artWalls: readonly WallId[], inset: number): FloorPoint[][] {
  // Davanti a ogni parete la linea ha x costante (est, ovest) o z costante (nord, sud).
  const line = { ovest: bounds.west + inset, est: bounds.east - inset, nord: bounds.north + inset, sud: bounds.south - inset };
  const stop = {
    ovest: bounds.west + BARRIER_END_GAP,
    est: bounds.east - BARRIER_END_GAP,
    nord: bounds.north + BARRIER_END_GAP,
    sud: bounds.south - BARRIER_END_GAP,
  };
  /** Il punto della linea davanti a `wall` che sta alla coordinata `along` lungo la parete. */
  const point = (wall: WallId, along: number): FloorPoint => (runsAlongX(wall) ? { x: along, z: line[wall] } : { x: line[wall], z: along });
  /** L'angolo tra le linee di due pareti vicine. */
  const corner = (a: WallId, b: WallId): FloorPoint => (runsAlongX(a) ? { x: line[b], z: line[a] } : { x: line[a], z: line[b] });
  const at = (index: number) => CLOCKWISE[index % CLOCKWISE.length];
  const hasArt = (wall: WallId) => artWalls.includes(wall);

  const first = CLOCKWISE.findIndex((wall) => !hasArt(wall));
  if (first < 0) {
    const loop = CLOCKWISE.map((wall, index) => corner(wall, at(index + 1)));
    return [[...loop, loop[0]]];
  }
  // Si parte dalla parete dopo una senza quadri, così ogni linea comincia e finisce contro una parete senza quadri.
  const lines: FloorPoint[][] = [];
  let current: FloorPoint[] = [];
  for (let step = 1; step < CLOCKWISE.length; step++) {
    const [previous, wall, next] = [at(first + step - 1), at(first + step), at(first + step + 1)];
    if (!hasArt(wall)) continue;
    if (!hasArt(previous)) lines.push((current = [point(wall, stop[previous])]));
    current.push(hasArt(next) ? corner(wall, next) : point(wall, stop[next]));
  }
  return lines;
}

/** La parete `id` di una sala: centro della faccia interna, direzioni e lunghezza. */
function wallOf(id: WallId, bounds: RoomBounds): Wall {
  const centerX = (bounds.west + bounds.east) / 2;
  const centerZ = (bounds.south + bounds.north) / 2;
  const center = {
    nord: new THREE.Vector3(centerX, 0, bounds.north),
    sud: new THREE.Vector3(centerX, 0, bounds.south),
    est: new THREE.Vector3(bounds.east, 0, centerZ),
    ovest: new THREE.Vector3(bounds.west, 0, centerZ),
  }[id];
  const length = runsAlongX(id) ? bounds.east - bounds.west : bounds.south - bounds.north;
  return { center, normal: WALL_AXES[id].normal.clone(), right: WALL_AXES[id].right.clone(), length };
}

/** Il riferimento di una parete: x verso destra guardandola dall'interno, y in alto, z verso la sala, con l'origine nel centro della faccia a terra. */
function wallFrame(wall: Wall): THREE.Matrix4 {
  return new THREE.Matrix4().makeBasis(wall.right, UP, wall.normal).setPosition(wall.center);
}

/** Mette un oggetto in un punto del riferimento di una parete, girato come la parete. */
function placeOnWall(object: THREE.Object3D, frame: THREE.Matrix4, x: number, y: number, z: number): void {
  object.position.set(x, y, z).applyMatrix4(frame);
  object.quaternion.setFromRotationMatrix(frame);
}

/**
 * Raccoglie i pezzi della sala per materiale e alla fine li unisce in una mesh per materiale:
 * una sala intera costa una decina di chiamate di disegno, anche con cornicioni e cornici.
 */
class Parts {
  private readonly pieces = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(material: THREE.Material, geometry: THREE.BufferGeometry): void {
    const list = this.pieces.get(material) ?? [];
    list.push(geometry);
    this.pieces.set(material, list);
  }

  build(): THREE.Mesh[] {
    return [...this.pieces].map(([material, geometries]) => {
      // Per unirle, le geometrie devono avere gli stessi attributi: niente coordinate di texture, che qui non servono,
      // e il colore dei vertici solo se il materiale lo usa (bianco per i pezzi che non lo hanno).
      const prepared = geometries.map((source) => {
        const geometry = source.index ? source.toNonIndexed() : source;
        if (geometry !== source) source.dispose();
        geometry.deleteAttribute('uv');
        const hasColor = geometry.hasAttribute('color');
        if (material.vertexColors && !hasColor) {
          const white = new Float32Array(geometry.getAttribute('position').count * 3).fill(1);
          geometry.setAttribute('color', new THREE.BufferAttribute(white, 3));
        } else if (!material.vertexColors && hasColor) geometry.deleteAttribute('color');
        return geometry;
      });
      const merged = mergeGeometries(prepared);
      if (!merged) throw new Error('Impossibile unire le geometrie della sala');
      for (const geometry of prepared) geometry.dispose();
      return new THREE.Mesh(merged, material);
    });
  }
}

/** Una modanatura sul soffitto, che gira intorno a un rettangolo sul piano XZ e scende verso il basso. */
function horizontalMolding(halfWidth: number, halfDepth: number, profile: readonly ProfilePoint[]): THREE.BufferGeometry {
  return createMoldingGeometry(halfWidth, halfDepth, profile).rotateX(Math.PI / 2);
}

/** Punti lungo un quarto di cerchio nel profilo di una modanatura: dal punto più vicino al soffitto a quello più vicino al muro. */
function quarterCircle(centerOffset: number, centerHeight: number, radius: number, count: number, shades: readonly number[]): ProfilePoint[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / (count - 1)) * (Math.PI / 2);
    return { offset: centerOffset + radius * Math.sin(angle), height: centerHeight - radius * Math.cos(angle), shade: shades[index] };
  });
}

/**
 * Pareti un po' più scure vicino al pavimento e al soffitto, dove nella realtà arriva meno luce diffusa:
 * l'ombra tocca solo la luce d'ambiente, non quella dei faretti. Costa due righe nello shader.
 */
function wallMaterial(color: string, height: number): THREE.MeshStandardMaterial {
  const cached = wallMaterials.get(color);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldHeight;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldHeight = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWorldHeight;').replace(
      '#include <aomap_fragment>',
      `#include <aomap_fragment>
      reflectedLight.indirectDiffuse *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 1.1, vWorldHeight))
        - 0.18 * smoothstep(${(height - 0.9).toFixed(2)}, ${height.toFixed(2)}, vWorldHeight);`,
    );
  };
  material.customProgramCacheKey = () => `wall-shade-${height}`;
  wallMaterials.set(color, material);
  return material;
}

/** Un riquadro di vetro smerigliato del lucernario, più chiaro al centro, con i telai sottili sui bordi: si ripete. */
function createLaylightTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const ctx = createTextureCanvas(size, size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.75);
  gradient.addColorStop(0, '#fffcf4');
  gradient.addColorStop(1, '#eee6d6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  // Il telaio è a metà sul bordo di ogni riquadro: ripetendo la texture, due metà fanno un telaio intero.
  ctx.strokeStyle = '#8d857a';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

/** Cartello scuro con il testo chiaro, che si rimpicciolisce se il testo è lungo. */
function createSign(text: string, maxAnisotropy: number): THREE.Mesh {
  const ctx = createTextureCanvas(1024, Math.round((1024 * SIGN_HEIGHT) / SIGN_WIDTH));
  const { canvas } = ctx;
  ctx.fillStyle = SIGN_BACKGROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = SIGN_TEXT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 72;
  do {
    ctx.font = `italic ${size}px Georgia, 'Times New Roman', serif`;
    size -= 4;
  } while (ctx.measureText(text).width > canvas.width - 80 && size > 32);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(SIGN_WIDTH, SIGN_HEIGHT), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }));
  sign.name = 'sign';
  return sign;
}
