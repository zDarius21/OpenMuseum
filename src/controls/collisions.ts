import type { Box3, Vector3 } from 'three';

/**
 * Spinge fuori dai volumi solidi un cerchio di raggio `radius` centrato in `position`.
 * Lavora solo sul piano XZ: si cammina su un pavimento piano, quindi l'altezza non conta.
 * Lo spostamento avviene solo perpendicolarmente all'ostacolo, così contro un muro si scivola.
 */
export function resolveCollisions(position: Vector3, radius: number, colliders: readonly Box3[]): void {
  for (const box of colliders) {
    const closestX = Math.max(box.min.x, Math.min(position.x, box.max.x));
    const closestZ = Math.max(box.min.z, Math.min(position.z, box.max.z));
    const dx = position.x - closestX;
    const dz = position.z - closestZ;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= radius * radius) continue;

    if (distanceSq > 1e-12) {
      const distance = Math.sqrt(distanceSq);
      const push = (radius - distance) / distance;
      position.x += dx * push;
      position.z += dz * push;
    } else {
      // Centro dentro il volume: esce dal lato più vicino.
      const exits = [
        { gap: position.x - box.min.x, apply: () => (position.x = box.min.x - radius) },
        { gap: box.max.x - position.x, apply: () => (position.x = box.max.x + radius) },
        { gap: position.z - box.min.z, apply: () => (position.z = box.min.z - radius) },
        { gap: box.max.z - position.z, apply: () => (position.z = box.max.z + radius) },
      ];
      exits.reduce((best, exit) => (exit.gap < best.gap ? exit : best)).apply();
    }
  }
}
