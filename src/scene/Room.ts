import * as THREE from 'three';
import { createBarriers, type BarrierConfig } from './Barriers';
import { createParquetTexture, PARQUET_TILE_SIZE } from './parquet';
import { createTextureCanvas } from '../utils/textureCanvas';

export interface RoomConfig {
  width: number;
  height: number;
  wallThickness: number;
  door: { width: number; height: number };
}

export interface RoomOptions {
  config: RoomConfig;
  depth: number;
  /** Coordinata z della faccia interna della parete sud: la sala si estende da qui verso nord (z decrescente). */
  south: number;
  doors: { south: boolean; north: boolean };
  /** Cartelli sopra le porte, visti dall'interno della sala: per esempio «Sala 3 · Roma ›». */
  signs: { south?: string; north?: string };
  barriers: BarrierConfig;
  maxAnisotropy: number;
  /** Riflessi per i materiali metallici. */
  reflections: THREE.Texture;
}

export const WALL_IDS = ['nord', 'sud', 'est', 'ovest'] as const;
export type WallId = (typeof WALL_IDS)[number];

export interface Wall {
  /** Centro della faccia interna, a livello del pavimento. */
  readonly center: THREE.Vector3;
  /** Direzione perpendicolare alla parete, verso l'interno della sala. */
  readonly normal: THREE.Vector3;
  /** Direzione verso destra per chi guarda la parete dall'interno. */
  readonly right: THREE.Vector3;
  readonly length: number;
}

export interface Room {
  readonly group: THREE.Group;
  /** Volumi solidi contro cui si ferma il visitatore. */
  readonly colliders: THREE.Box3[];
  readonly walls: Record<WallId, Wall>;
  readonly height: number;
  /** Facce interne delle pareti sud e nord, lungo z. */
  readonly south: number;
  readonly north: number;
  /** Libera la memoria della scheda grafica quando la sala viene smontata. */
  dispose(): void;
}

const WALL_COLOR = 0xf3f0ea;
const CEILING_COLOR = 0xf7f6f2;
const BASEBOARD_COLOR = 0x4a443e;
const THRESHOLD_COLOR = 0xd8d2c8;
const BASEBOARD_HEIGHT = 0.12;
const BASEBOARD_DEPTH = 0.015;
/** Larghezza e sporgenza dello stipite intorno alle porte. */
const CASING_WIDTH = 0.08;
const CASING_DEPTH = 0.02;
/** Lo stipite entra un poco nel vano della porta: se combaciasse con il muro, le due facce sfarfallerebbero. */
const CASING_INSET = 0.01;
/** I paletti alle estremità stanno a questa distanza dalle pareti di fondo: troppo poco per passarci dietro. */
const BARRIER_END_GAP = 0.15;
const SIGN_WIDTH = 2.4;
const SIGN_HEIGHT = 0.42;
const SIGN_BACKGROUND = '#2b2724';
const SIGN_TEXT = '#f4efe6';

// Pareti, soffitti, battiscopa e stipiti sono box e piani di misura 1, scalati: la forma è la stessa per tutte le sale.
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitPlane = new THREE.PlaneGeometry(1, 1);
let materials: ReturnType<typeof createMaterials> | null = null;

function createMaterials(maxAnisotropy: number) {
  return {
    wall: new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.95 }),
    ceiling: new THREE.MeshStandardMaterial({ color: CEILING_COLOR, roughness: 1 }),
    baseboard: new THREE.MeshStandardMaterial({ color: BASEBOARD_COLOR, roughness: 0.7 }),
    threshold: new THREE.MeshStandardMaterial({ color: THRESHOLD_COLOR, roughness: 0.4 }),
    floor: new THREE.MeshStandardMaterial({ map: createParquetTexture(maxAnisotropy), roughness: 0.6 }),
  };
}

/**
 * Crea una sala rettangolare centrata sull'asse z, con il pavimento a quota 0, che va da `south` verso nord.
 * Le sale si mettono una dopo l'altra: la parete nord di una e la parete sud della successiva coincidono,
 * con la porta nello stesso punto, e ogni sala costruisce entrambe per restare chiusa anche da sola.
 */
export function createRoom(options: RoomOptions): Room {
  const { width, height, wallThickness: thickness, door } = options.config;
  const { depth, south, maxAnisotropy } = options;
  const north = south - depth;
  const middle = (south + north) / 2;
  const half = width / 2;
  materials ??= createMaterials(maxAnisotropy);
  const shared = materials;

  const group = new THREE.Group();
  group.name = 'room';
  const colliders: THREE.Box3[] = [];
  const disposables: { dispose(): void }[] = [];

  const addBox = (material: THREE.Material, x: number, y: number, z: number, size: THREE.Vector3Tuple, solid = false): void => {
    const mesh = new THREE.Mesh(unitBox, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(...size);
    group.add(mesh);
    if (solid) colliders.push(new THREE.Box3().setFromCenterAndSize(mesh.position, mesh.scale));
  };

  // Pavimento: le coordinate della texture seguono i metri, così lo stesso parquet va bene per sale di ogni misura.
  const floorGeometry = new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2);
  const uv = floorGeometry.getAttribute('uv');
  for (let index = 0; index < uv.count; index++) {
    uv.setXY(index, (uv.getX(index) * width) / PARQUET_TILE_SIZE, (uv.getY(index) * depth) / PARQUET_TILE_SIZE);
  }
  disposables.push(floorGeometry);
  const floor = new THREE.Mesh(floorGeometry, shared.floor);
  floor.position.z = middle;
  group.add(floor);

  const ceiling = new THREE.Mesh(unitPlane, shared.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.scale.set(width, depth, 1);
  ceiling.position.set(0, height, middle);
  group.add(ceiling);

  // Pareti lunghe, che coprono anche gli angoli, con il battiscopa.
  for (const side of [-1, 1]) {
    addBox(shared.wall, side * (half + thickness / 2), height / 2, middle, [thickness, height, depth + 2 * thickness], true);
    addBox(shared.baseboard, side * (half - BASEBOARD_DEPTH / 2), BASEBOARD_HEIGHT / 2, middle, [BASEBOARD_DEPTH, BASEBOARD_HEIGHT, depth]);
  }

  // Pareti di fondo, con la porta al centro se c'è. `inward` è il verso della sala visto dalla parete.
  const endWall = (face: number, inward: number, hasDoor: boolean): void => {
    const z = face - (inward * thickness) / 2;
    const baseboardZ = face + (inward * BASEBOARD_DEPTH) / 2;
    if (!hasDoor) {
      addBox(shared.wall, 0, height / 2, z, [width, height, thickness], true);
      addBox(shared.baseboard, 0, BASEBOARD_HEIGHT / 2, baseboardZ, [width, BASEBOARD_HEIGHT, BASEBOARD_DEPTH]);
      return;
    }
    const sideWidth = (width - door.width) / 2;
    const baseboardWidth = sideWidth - CASING_WIDTH;
    for (const side of [-1, 1]) {
      addBox(shared.wall, side * (door.width / 2 + sideWidth / 2), height / 2, z, [sideWidth, height, thickness], true);
      addBox(shared.baseboard, side * (half - baseboardWidth / 2), BASEBOARD_HEIGHT / 2, baseboardZ, [baseboardWidth, BASEBOARD_HEIGHT, BASEBOARD_DEPTH]);
      // Stipite, che sporge un poco su entrambe le facce del muro.
      addBox(shared.baseboard, side * (door.width / 2 + CASING_WIDTH / 2 - CASING_INSET), door.height / 2, z, [CASING_WIDTH, door.height, thickness + 2 * CASING_DEPTH]);
    }
    addBox(shared.wall, 0, (door.height + height) / 2, z, [door.width, height - door.height, thickness]);
    addBox(shared.baseboard, 0, door.height + CASING_WIDTH / 2 - CASING_INSET, z, [door.width + 2 * CASING_WIDTH, CASING_WIDTH, thickness + 2 * CASING_DEPTH]);
    addBox(shared.threshold, 0, 0.004, z, [door.width, 0.008, thickness]);
  };
  endWall(south, -1, options.doors.south);
  endWall(north, 1, options.doors.north);

  // Cartelli sopra le porte, sulla faccia interna.
  const signY = door.height + CASING_WIDTH + 0.12 + SIGN_HEIGHT / 2;
  for (const [text, face, inward] of [
    [options.signs.south, south, -1],
    [options.signs.north, north, 1],
  ] as const) {
    if (!text) continue;
    const sign = createSign(text, maxAnisotropy);
    sign.position.set(0, signY, face + inward * 0.01);
    if (inward < 0) sign.rotation.y = Math.PI;
    group.add(sign);
    disposables.push(sign.geometry, sign.material as THREE.Material, (sign.material as THREE.MeshStandardMaterial).map!);
  }

  // Transenne lungo le pareti lunghe, da una parete di fondo all'altra: le porte restano libere.
  const inset = options.barriers.distance;
  const barriers = createBarriers(
    [-1, 1].map((side) => [
      { x: side * (half - inset), z: south - BARRIER_END_GAP },
      { x: side * (half - inset), z: north + BARRIER_END_GAP },
    ]),
    options.barriers,
    options.reflections,
  );
  group.add(barriers.group);
  colliders.push(...barriers.colliders);
  disposables.push(barriers);

  const walls: Record<WallId, Wall> = {
    nord: { center: new THREE.Vector3(0, 0, north), normal: new THREE.Vector3(0, 0, 1), right: new THREE.Vector3(1, 0, 0), length: width },
    sud: { center: new THREE.Vector3(0, 0, south), normal: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(-1, 0, 0), length: width },
    est: { center: new THREE.Vector3(half, 0, middle), normal: new THREE.Vector3(-1, 0, 0), right: new THREE.Vector3(0, 0, 1), length: depth },
    ovest: { center: new THREE.Vector3(-half, 0, middle), normal: new THREE.Vector3(1, 0, 0), right: new THREE.Vector3(0, 0, -1), length: depth },
  };

  return {
    group,
    colliders,
    walls,
    height,
    south,
    north,
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
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
