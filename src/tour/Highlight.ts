import gsap from 'gsap';
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fuori dal cerchio il quadro viene scurito; sul bordo del cerchio c'è un sottile anello dorato.
const fragmentShader = /* glsl */ `
  uniform vec2 uSize;
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    vec2 point = (vUv - 0.5) * uSize;
    float distanceFromCenter = distance(point, uCenter);
    float feather = uRadius * 0.25;
    float outside = smoothstep(uRadius, uRadius + feather, distanceFromCenter);
    float ring = 1.0 - smoothstep(0.0, feather * 0.2, abs(distanceFromCenter - uRadius));
    float alpha = max(outside * 0.62, ring * 0.6) * uStrength;
    gl_FragColor = vec4(mix(vec3(0.0), vec3(1.0, 0.86, 0.55), ring), alpha);
  }
`;

/**
 * Evidenzia un'area circolare del quadro scurendo il resto.
 * È un piano trasparente appena davanti alla tela, nelle coordinate locali del quadro (metri, origine al centro).
 */
export class Highlight {
  readonly mesh: THREE.Mesh;

  private readonly uniforms = {
    uSize: { value: new THREE.Vector2() },
    uCenter: { value: new THREE.Vector2() },
    uRadius: { value: 0.3 },
    uStrength: { value: 0 },
  };
  private tween: gsap.core.Tween | null = null;

  constructor(width: number, height: number, offset: number) {
    this.uniforms.uSize.value.set(width, height);
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false }),
    );
    this.mesh.name = 'highlight';
    this.mesh.position.z = offset;
    this.mesh.visible = false;
  }

  /** Sposta l'area evidenziata; con strength 0 l'evidenziazione sparisce. */
  animateTo(center: THREE.Vector2, radius: number, strength: number, duration: number): void {
    this.tween?.kill();
    const state = {
      x: this.uniforms.uCenter.value.x,
      y: this.uniforms.uCenter.value.y,
      radius: this.uniforms.uRadius.value,
      strength: this.uniforms.uStrength.value,
    };
    // Se l'evidenziazione era spenta, compare già nella posizione giusta invece di scivolarci.
    if (state.strength === 0) Object.assign(state, { x: center.x, y: center.y, radius });
    this.mesh.visible = true;
    this.tween = gsap.to(state, {
      x: center.x,
      y: center.y,
      radius,
      strength,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.uniforms.uCenter.value.set(state.x, state.y);
        this.uniforms.uRadius.value = state.radius;
        this.uniforms.uStrength.value = state.strength;
      },
      onComplete: () => {
        this.mesh.visible = strength > 0;
      },
    });
  }

  hide(duration: number): void {
    this.animateTo(this.uniforms.uCenter.value.clone(), this.uniforms.uRadius.value, 0, duration);
  }
}
