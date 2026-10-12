import gsap from 'gsap';
import type * as THREE from 'three';

/** Sposta e ruota la camera con un'animazione morbida verso la posizione e l'orientamento indicati. */
export function tweenCamera(
  camera: THREE.Camera,
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  duration: number,
  onComplete: () => void,
): gsap.core.Tween {
  const fromPosition = camera.position.clone();
  const fromQuaternion = camera.quaternion.clone();
  const progress = { t: 0 };
  return gsap.to(progress, {
    t: 1,
    duration,
    ease: 'power2.inOut',
    onUpdate: () => {
      camera.position.lerpVectors(fromPosition, position, progress.t);
      camera.quaternion.slerpQuaternions(fromQuaternion, quaternion, progress.t);
    },
    onComplete,
  });
}
