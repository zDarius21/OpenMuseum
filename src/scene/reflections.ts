import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Mappa di riflessi generica per i materiali metallici (ottone, cornici dorate):
 * senza qualcosa da riflettere un metallo apparirebbe quasi nero.
 */
export function createReflectionMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = new RoomEnvironment();
  const texture = pmrem.fromScene(environment, 0.04).texture;
  environment.dispose();
  pmrem.dispose();
  return texture;
}
