import * as THREE from 'three';
import { spotOf } from '../artworks/createArtwork';

/** Bianco caldo, intorno ai 3500 K. */
const SPOT_COLOR = 0xfff1e0;
const SPOT_PENUMBRA = 0.45;

/**
 * Un gruppo fisso di faretti, puntati sui quadri della sala in cui si trova il visitatore.
 * Il numero di luci nella scena non cambia mai: three.js non deve ricompilare gli shader quando si cambia sala,
 * e sui telefoni il costo resta quello di una sala sola anche se le sale sono tante.
 */
export class LightPool {
  private readonly lights: THREE.SpotLight[] = [];
  private readonly intensities: number[] = [];
  private readonly fadeDuration: number;
  /** Da 0 a 1 durante l'accensione. */
  private level = 1;

  constructor(scene: THREE.Scene, size: number, fadeDuration: number) {
    this.fadeDuration = fadeDuration;
    for (let index = 0; index < size; index++) {
      const light = new THREE.SpotLight(SPOT_COLOR, 0, 0, Math.PI / 6, SPOT_PENUMBRA, 2);
      scene.add(light, light.target);
      this.lights.push(light);
      this.intensities.push(0);
    }
  }

  /** Punta i faretti sui quadri indicati e li accende piano; quelli che avanzano restano spenti. */
  assign(groups: readonly THREE.Object3D[]): void {
    if (groups.length > this.lights.length) console.warn(`Sala con ${groups.length} quadri ma solo ${this.lights.length} faretti`);
    this.lights.forEach((light, index) => {
      const group = groups[index];
      light.intensity = 0;
      this.intensities[index] = 0;
      if (!group) return;
      const spot = spotOf(group);
      group.updateWorldMatrix(true, false);
      light.position.copy(group.localToWorld(spot.position.clone()));
      light.target.position.copy(group.localToWorld(spot.target.clone()));
      light.target.updateMatrixWorld();
      light.angle = spot.angle;
      this.intensities[index] = spot.intensity;
    });
    this.level = 0;
  }

  /** Da chiamare a ogni frame con il tempo trascorso in secondi. */
  update(delta: number): void {
    if (this.level >= 1) return;
    this.level = Math.min(1, this.level + delta / this.fadeDuration);
    const brightness = THREE.MathUtils.smoothstep(this.level, 0, 1);
    this.lights.forEach((light, index) => {
      light.intensity = this.intensities[index] * brightness;
    });
  }
}
