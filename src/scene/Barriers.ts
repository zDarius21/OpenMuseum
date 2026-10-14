import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface BarrierConfig {
  distance: number;
  postSpacing: number;
  postHeight: number;
  ropeSag: number;
}

/** Punto sul pavimento. */
export interface FloorPoint {
  x: number;
  z: number;
}

export interface Barriers {
  readonly group: THREE.Group;
  /** Volumi lungo la linea dei paletti, che il visitatore non può attraversare. */
  readonly colliders: THREE.Box3[];
  /** Libera la memoria della scheda grafica quando le transenne non servono più. */
  dispose(): void;
}

const BRASS_COLOR = 0xc9a24f;
const VELVET_COLOR = 0x6e0f1f;
const VELVET_SHEEN_COLOR = 0xd04a5e;
const BASE_RADIUS = 0.17;
const BASE_HEIGHT = 0.04;
const POLE_RADIUS = 0.022;
const CAP_RADIUS = 0.045;
const HOOK_RADIUS = 0.03;
const ROPE_RADIUS = 0.018;
/** Il cordone è agganciato poco sotto la sfera in cima al paletto. */
const ROPE_DROP = 0.08;
/** Spessore dei volumi di collisione attorno alla linea dei paletti. */
const COLLIDER_THICKNESS = 0.1;

/** Materiali e forma del paletto, uguali in tutte le sale: si creano una volta sola. */
let shared: { brass: THREE.Material; velvet: THREE.Material; post: THREE.BufferGeometry; postHeight: number } | null = null;

/**
 * Transenne da museo, paletti in ottone e cordoni di velluto, lungo una o più linee spezzate aperte
 * (per chiuderne una basta ripetere il primo punto alla fine).
 * I lati devono essere paralleli agli assi X o Z, perché le collisioni usano box allineati.
 */
export function createBarriers(lines: readonly (readonly FloorPoint[])[], config: BarrierConfig, reflections: THREE.Texture): Barriers {
  const group = new THREE.Group();
  group.name = 'barriers';
  const colliders: THREE.Box3[] = [];
  const posts: FloorPoint[] = [];
  const ropes: THREE.BufferGeometry[] = [];
  const ropeHeight = config.postHeight - ROPE_DROP;
  const half = COLLIDER_THICKNESS / 2;

  for (const line of lines) {
    line.forEach((start, index) => {
      const end = line[index + 1];
      if (!end) {
        posts.push(start);
        return;
      }
      // Paletti equidistanti, con una distanza mai superiore a postSpacing.
      const spans = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.z - start.z) / config.postSpacing));
      for (let span = 0; span < spans; span++) {
        const a = lerpPoint(start, end, span / spans);
        const b = lerpPoint(start, end, (span + 1) / spans);
        posts.push(a);
        ropes.push(createRopeGeometry(a, b, ropeHeight, config.ropeSag));
      }

      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(Math.min(start.x, end.x) - half, 0, Math.min(start.z, end.z) - half),
          new THREE.Vector3(Math.max(start.x, end.x) + half, config.postHeight, Math.max(start.z, end.z) + half),
        ),
      );
    });
  }

  if (!shared || shared.postHeight !== config.postHeight) {
    shared = {
      brass: new THREE.MeshStandardMaterial({ color: BRASS_COLOR, metalness: 1, roughness: 0.3, envMap: reflections }),
      velvet: new THREE.MeshPhysicalMaterial({
        color: VELVET_COLOR,
        roughness: 0.8,
        sheen: 1,
        sheenColor: VELVET_SHEEN_COLOR,
        sheenRoughness: 0.5,
      }),
      post: createPostGeometry(config.postHeight, ropeHeight),
      postHeight: config.postHeight,
    };
  }

  // Tutti i paletti in un'unica InstancedMesh e tutti i cordoni in un'unica geometria: due sole chiamate di disegno.
  const postMesh = new THREE.InstancedMesh(shared.post, shared.brass, posts.length);
  const matrix = new THREE.Matrix4();
  posts.forEach((post, index) => postMesh.setMatrixAt(index, matrix.makeTranslation(post.x, 0, post.z)));
  group.add(postMesh);

  const ropeMesh = new THREE.Mesh(merge(ropes), shared.velvet);
  group.add(ropeMesh);

  return {
    group,
    colliders,
    dispose: () => {
      postMesh.dispose();
      ropeMesh.geometry.dispose();
    },
  };
}

function lerpPoint(a: FloorPoint, b: FloorPoint, t: number): FloorPoint {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

function createPostGeometry(height: number, ropeHeight: number): THREE.BufferGeometry {
  const poleHeight = height - BASE_HEIGHT;
  return merge([
    new THREE.CylinderGeometry(BASE_RADIUS * 0.85, BASE_RADIUS, BASE_HEIGHT, 32).translate(0, BASE_HEIGHT / 2, 0),
    new THREE.CylinderGeometry(POLE_RADIUS, POLE_RADIUS, poleHeight, 16).translate(0, BASE_HEIGHT + poleHeight / 2, 0),
    new THREE.SphereGeometry(CAP_RADIUS, 20, 14).translate(0, height + CAP_RADIUS * 0.6, 0),
    new THREE.SphereGeometry(HOOK_RADIUS, 16, 10).translate(0, ropeHeight, 0),
  ]);
}

/** Cordone tra due paletti, che si abbassa di `sag` a metà campata. */
function createRopeGeometry(a: FloorPoint, b: FloorPoint, height: number, sag: number): THREE.BufferGeometry {
  const start = new THREE.Vector3(a.x, height, a.z);
  const end = new THREE.Vector3(b.x, height, b.z);
  // In una Bézier quadratica il punto centrale scende della metà del punto di controllo.
  const control = start.clone().lerp(end, 0.5);
  control.y -= 2 * sag;
  return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(start, control, end), 24, ROPE_RADIUS, 8);
}

function merge(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(geometries);
  if (!merged) throw new Error('Impossibile unire le geometrie delle transenne');
  for (const geometry of geometries) geometry.dispose();
  return merged;
}
