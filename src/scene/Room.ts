import * as THREE from 'three';
import { createBarriers, type BarrierConfig } from './Barriers';
import { createParquetTexture, PARQUET_TILE_SIZE } from './parquet';

export interface RoomConfig {
  width: number;
  depth: number;
  height: number;
  wallThickness: number;
}

export interface RoomLightsConfig {
  ambientIntensity: number;
  spotColumns: number;
  spotRows: number;
  spotIntensity: number;
}

export interface RoomOptions {
  room: RoomConfig;
  lights: RoomLightsConfig;
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
}

const WALL_COLOR = 0xf3f0ea;
const CEILING_COLOR = 0xf7f6f2;
const BASEBOARD_COLOR = 0x4a443e;
const BASEBOARD_HEIGHT = 0.12;
const BASEBOARD_DEPTH = 0.015;
/** Bianco caldo, intorno ai 3500 K. */
const SPOT_COLOR = 0xfff1e0;

/** Crea una sala rettangolare centrata nell'origine, con il pavimento a quota 0. */
export function createRoom({ room: config, lights, barriers: barrierConfig, maxAnisotropy, reflections }: RoomOptions): Room {
  const { width, depth, height, wallThickness } = config;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  const group = new THREE.Group();
  group.name = 'room';
  const colliders: THREE.Box3[] = [];

  const parquet = createParquetTexture(maxAnisotropy);
  parquet.repeat.set(width / PARQUET_TILE_SIZE, depth / PARQUET_TILE_SIZE);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: parquet, roughness: 0.6 }),
  );
  group.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: CEILING_COLOR, roughness: 1 }),
  );
  ceiling.position.y = height;
  group.add(ceiling);

  // Le pareti sono parallelepipedi pieni: gli stessi volumi servono per le collisioni.
  const wallMaterial = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.95 });
  const baseboardMaterial = new THREE.MeshStandardMaterial({ color: BASEBOARD_COLOR, roughness: 0.7 });

  const addBox = (material: THREE.Material, center: THREE.Vector3, size: THREE.Vector3): void => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.copy(center);
    group.add(mesh);
  };

  const outerWidth = width + 2 * wallThickness;
  const wallBoxes = [
    { center: new THREE.Vector3(0, height / 2, -halfDepth - wallThickness / 2), size: new THREE.Vector3(outerWidth, height, wallThickness) },
    { center: new THREE.Vector3(0, height / 2, halfDepth + wallThickness / 2), size: new THREE.Vector3(outerWidth, height, wallThickness) },
    { center: new THREE.Vector3(halfWidth + wallThickness / 2, height / 2, 0), size: new THREE.Vector3(wallThickness, height, depth) },
    { center: new THREE.Vector3(-halfWidth - wallThickness / 2, height / 2, 0), size: new THREE.Vector3(wallThickness, height, depth) },
  ];
  for (const { center, size } of wallBoxes) {
    addBox(wallMaterial, center, size);
    colliders.push(new THREE.Box3().setFromCenterAndSize(center, size));
  }

  // Battiscopa lungo il lato interno di ogni parete.
  const baseboardY = BASEBOARD_HEIGHT / 2;
  const baseboardInset = BASEBOARD_DEPTH / 2;
  addBox(baseboardMaterial, new THREE.Vector3(0, baseboardY, -halfDepth + baseboardInset), new THREE.Vector3(width, BASEBOARD_HEIGHT, BASEBOARD_DEPTH));
  addBox(baseboardMaterial, new THREE.Vector3(0, baseboardY, halfDepth - baseboardInset), new THREE.Vector3(width, BASEBOARD_HEIGHT, BASEBOARD_DEPTH));
  addBox(baseboardMaterial, new THREE.Vector3(halfWidth - baseboardInset, baseboardY, 0), new THREE.Vector3(BASEBOARD_DEPTH, BASEBOARD_HEIGHT, depth));
  addBox(baseboardMaterial, new THREE.Vector3(-halfWidth + baseboardInset, baseboardY, 0), new THREE.Vector3(BASEBOARD_DEPTH, BASEBOARD_HEIGHT, depth));

  // Transenne lungo tutto il perimetro: tengono i visitatori a distanza dalle pareti.
  const inset = barrierConfig.distance;
  const barriers = createBarriers(
    [
      { x: -halfWidth + inset, z: -halfDepth + inset },
      { x: halfWidth - inset, z: -halfDepth + inset },
      { x: halfWidth - inset, z: halfDepth - inset },
      { x: -halfWidth + inset, z: halfDepth - inset },
    ],
    barrierConfig,
    reflections,
  );
  group.add(barriers.group);
  colliders.push(...barriers.colliders);

  // Luce ambientale: calda dall'alto; dal basso il riflesso chiaro di pavimento e pareti.
  group.add(new THREE.HemisphereLight(0xfffaf2, 0xd9d3cb, lights.ambientIntensity));

  // Faretti a soffitto con la loro plafoniera visibile.
  const fixtureGeometry = new THREE.CylinderGeometry(0.14, 0.14, 0.03, 24);
  const fixtureMaterial = new THREE.MeshBasicMaterial({ color: 0xfff6ea });
  for (let column = 0; column < lights.spotColumns; column++) {
    for (let row = 0; row < lights.spotRows; row++) {
      const x = -halfWidth + (width * (column + 0.5)) / lights.spotColumns;
      const z = -halfDepth + (depth * (row + 0.5)) / lights.spotRows;

      const spot = new THREE.SpotLight(SPOT_COLOR, lights.spotIntensity, 0, Math.PI / 4.5, 0.8, 2);
      spot.position.set(x, height - 0.05, z);
      spot.target.position.set(x, 0, z);
      group.add(spot, spot.target);

      const fixture = new THREE.Mesh(fixtureGeometry, fixtureMaterial);
      fixture.position.set(x, height - 0.015, z);
      group.add(fixture);
    }
  }

  const walls: Record<WallId, Wall> = {
    nord: { center: new THREE.Vector3(0, 0, -halfDepth), normal: new THREE.Vector3(0, 0, 1), right: new THREE.Vector3(1, 0, 0), length: width },
    sud: { center: new THREE.Vector3(0, 0, halfDepth), normal: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(-1, 0, 0), length: width },
    est: { center: new THREE.Vector3(halfWidth, 0, 0), normal: new THREE.Vector3(-1, 0, 0), right: new THREE.Vector3(0, 0, 1), length: depth },
    ovest: { center: new THREE.Vector3(-halfWidth, 0, 0), normal: new THREE.Vector3(1, 0, 0), right: new THREE.Vector3(0, 0, -1), length: depth },
  };

  return { group, colliders, walls, height };
}
