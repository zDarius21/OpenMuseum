import * as THREE from 'three';

/**
 * Un punto del profilo di una modanatura, in sezione: `offset` è la distanza dal bordo del rettangolo verso l'esterno
 * (negativa verso l'interno), `height` quanto sporge dal piano su cui appoggia. `shade` scurisce il punto, da 0 a 1:
 * nelle gole e negli incavi finge l'ombra che la luce diffusa non fa.
 */
export interface ProfilePoint {
  offset: number;
  height: number;
  shade?: number;
}

export type MoldingSide = 'bottom' | 'right' | 'top' | 'left';

const ALL_SIDES: readonly MoldingSide[] = ['bottom', 'right', 'top', 'left'];
/** Due tratti del profilo che si piegano meno di così sembrano una superficie curva; oltre, uno spigolo. */
const SMOOTH_ANGLE = Math.cos(THREE.MathUtils.degToRad(55));

/**
 * Una modanatura che gira intorno a un rettangolo, con gli angoli tagliati a 45° come una cornice: il profilo scorre
 * lungo i lati. Il rettangolo è centrato nell'origine sul piano XY e la modanatura sporge verso +Z.
 * Il profilo va dall'interno verso l'esterno (offset crescente): la superficie visibile è quella che guarda +Z e il centro.
 * Con `sides` si possono lasciare fuori dei lati, per esempio quello in basso di una porta.
 */
export function createMoldingGeometry(
  halfWidth: number,
  halfHeight: number,
  profile: readonly ProfilePoint[],
  sides: readonly MoldingSide[] = ALL_SIDES,
): THREE.BufferGeometry {
  const corners = {
    bottom: [new THREE.Vector2(-halfWidth, -halfHeight), new THREE.Vector2(halfWidth, -halfHeight), new THREE.Vector2(0, -1)],
    right: [new THREE.Vector2(halfWidth, -halfHeight), new THREE.Vector2(halfWidth, halfHeight), new THREE.Vector2(1, 0)],
    top: [new THREE.Vector2(halfWidth, halfHeight), new THREE.Vector2(-halfWidth, halfHeight), new THREE.Vector2(0, 1)],
    left: [new THREE.Vector2(-halfWidth, halfHeight), new THREE.Vector2(-halfWidth, -halfHeight), new THREE.Vector2(-1, 0)],
  } as const;

  // Normale di ogni tratto del profilo nel piano della sezione: (verso l'esterno, verso +Z).
  const segmentNormals = profile.slice(1).map((point, index) => {
    const previous = profile[index];
    return new THREE.Vector2(previous.height - point.height, point.offset - previous.offset).normalize();
  });
  // Agli estremi di ogni tratto la normale si media con quella del tratto vicino, se la piega è dolce.
  const endNormal = (segment: number, neighbor: number): THREE.Vector2 => {
    const own = segmentNormals[segment];
    const other = segmentNormals[neighbor];
    if (!other || own.dot(other) < SMOOTH_ANGLE) return own;
    return own.clone().add(other).normalize();
  };

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();

  for (const side of sides) {
    const [start, end, outward] = corners[side];
    const along = end.clone().sub(start).normalize();
    // Il punto del profilo all'inizio e alla fine del lato: verso l'esterno il lato si allunga, per il taglio a 45°.
    const at = (point: ProfilePoint, atEnd: boolean): THREE.Vector3 => {
      const base = atEnd ? end : start;
      const sign = atEnd ? 1 : -1;
      return new THREE.Vector3(
        base.x + outward.x * point.offset + along.x * point.offset * sign,
        base.y + outward.y * point.offset + along.y * point.offset * sign,
        point.height,
      );
    };
    const toWorld = (normal: THREE.Vector2) => new THREE.Vector3(outward.x * normal.x, outward.y * normal.x, normal.y);

    segmentNormals.forEach((_, segment) => {
      const from = profile[segment];
      const to = profile[segment + 1];
      const quad = [at(from, false), at(from, true), at(to, true), at(to, false)];
      const quadNormals = [endNormal(segment, segment - 1), endNormal(segment, segment - 1), endNormal(segment, segment + 1), endNormal(segment, segment + 1)].map(toWorld);
      const shades = [from.shade ?? 1, from.shade ?? 1, to.shade ?? 1, to.shade ?? 1];
      // L'ordine dei vertici decide quale faccia si vede: si gira se il triangolo guarda dalla parte sbagliata.
      a.copy(quad[0]);
      b.copy(quad[1]);
      c.copy(quad[2]);
      faceNormal.subVectors(c, b).cross(a.sub(b));
      const flip = faceNormal.dot(toWorld(segmentNormals[segment])) < 0;
      const order = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      for (const index of order) {
        positions.push(quad[index].x, quad[index].y, quad[index].z);
        normals.push(quadNormals[index].x, quadNormals[index].y, quadNormals[index].z);
        colors.push(shades[index], shades[index], shades[index]);
      }
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}
