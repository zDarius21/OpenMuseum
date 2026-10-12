import * as THREE from 'three';
import type { Artwork } from '../artworks/artworksData';
import type { Wall, WallId } from '../scene/Room';

export interface MinimapRoom {
  width: number;
  depth: number;
  /** Distanza delle transenne dalle pareti. */
  barrierDistance: number;
  walls: Record<WallId, Wall>;
}

/** Ingombro massimo della mappa sullo schermo, in pixel CSS. */
const MAX_SIZE = { width: 120, height: 200 };
const MAX_SIZE_SMALL = { width: 72, height: 124 };
const SMALL_SCREEN = window.matchMedia('(max-width: 600px), (max-height: 500px)');
const PADDING = 8;

const WALL_COLOR = 'rgb(243 239 232 / 0.4)';
const FLOOR_COLOR = 'rgb(255 255 255 / 0.06)';
const ROPE_COLOR = 'rgb(176 64 76 / 0.7)';
const ARTWORK_COLOR = '#a99f91';
const TOUR_COLOR = '#e0bd6e';
const FOCUS_COLOR = '#ffffff';

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * Mappa della sala vista dall'alto, con il nord in alto: pareti, transenne, quadri (in oro quelli con
 * visita guidata), il visitatore e il cono di ciò che sta guardando.
 */
export class Minimap {
  private readonly room: MinimapRoom;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  /** Parte fissa della mappa, ridisegnata solo quando cambiano dimensioni o quadri. */
  private readonly background = document.createElement('canvas');
  private artworks: readonly Artwork[] = [];
  private scale = 1;
  private cssWidth = 0;
  private cssHeight = 0;
  /** Ultimo stato disegnato: se non cambia nulla non si ridisegna. */
  private drawn = '';

  constructor(parent: HTMLElement, room: MinimapRoom) {
    this.room = room;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Mappa della sala');
    this.canvas.hidden = true;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non disponibile');
    this.ctx = ctx;
    parent.append(this.canvas);

    this.layout();
    window.addEventListener('resize', this.layout);
  }

  setArtworks(artworks: readonly Artwork[]): void {
    this.artworks = artworks;
    this.drawBackground();
  }

  /** Da chiamare a ogni frame. `focusedId` è il quadro di cui è aperta la scheda, evidenziato sulla mappa. */
  update(camera: THREE.PerspectiveCamera, focusedId: string | null, visible: boolean): void {
    this.canvas.hidden = !visible;
    if (!visible) return;

    _euler.setFromQuaternion(camera.quaternion);
    const x = this.toMapX(camera.position.x);
    const y = this.toMapY(camera.position.z);
    const state = `${x.toFixed(1)} ${y.toFixed(1)} ${_euler.y.toFixed(3)} ${camera.aspect.toFixed(2)} ${focusedId} ${this.cssWidth}`;
    if (state === this.drawn) return;
    this.drawn = state;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.drawImage(this.background, 0, 0, this.cssWidth, this.cssHeight);

    const focused = this.artworks.find((artwork) => artwork.id === focusedId);
    if (focused) this.drawArtwork(ctx, focused, FOCUS_COLOR, 5);

    // Cono visivo: largo quanto il campo visivo orizzontale, sfumato verso l'esterno.
    const length = SMALL_SCREEN.matches ? 20 : 30;
    const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
    const heading = Math.atan2(-Math.cos(_euler.y), -Math.sin(_euler.y));
    const cone = ctx.createRadialGradient(x, y, 0, x, y, length);
    cone.addColorStop(0, 'rgb(255 255 255 / 0.45)');
    cone.addColorStop(1, 'rgb(255 255 255 / 0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, length, heading - halfFov, heading + halfFov);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgb(20 18 16 / 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, SMALL_SCREEN.matches ? 3 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private toMapX(x: number): number {
    return PADDING + (x + this.room.width / 2) * this.scale;
  }

  private toMapY(z: number): number {
    return PADDING + (z + this.room.depth / 2) * this.scale;
  }

  /** Adatta le dimensioni allo schermo: la sala occupa tutto lo spazio disponibile mantenendo le proporzioni. */
  private readonly layout = (): void => {
    const max = SMALL_SCREEN.matches ? MAX_SIZE_SMALL : MAX_SIZE;
    const { width, depth } = this.room;
    this.scale = Math.min((max.width - 2 * PADDING) / width, (max.height - 2 * PADDING) / depth);
    this.cssWidth = Math.round(width * this.scale + 2 * PADDING);
    this.cssHeight = Math.round(depth * this.scale + 2 * PADDING);

    const ratio = window.devicePixelRatio || 1;
    for (const canvas of [this.canvas, this.background]) {
      canvas.width = Math.round(this.cssWidth * ratio);
      canvas.height = Math.round(this.cssHeight * ratio);
    }
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.drawBackground();
  };

  private drawBackground(): void {
    const ctx = this.background.getContext('2d');
    if (!ctx) return;
    const ratio = this.background.width / this.cssWidth;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

    const { width, depth, barrierDistance } = this.room;
    const left = this.toMapX(-width / 2);
    const top = this.toMapY(-depth / 2);
    ctx.fillStyle = FLOOR_COLOR;
    ctx.fillRect(left, top, width * this.scale, depth * this.scale);

    const inset = barrierDistance * this.scale;
    ctx.strokeStyle = ROPE_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + inset, top + inset, width * this.scale - 2 * inset, depth * this.scale - 2 * inset);

    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, width * this.scale, depth * this.scale);

    for (const artwork of this.artworks) {
      this.drawArtwork(ctx, artwork, artwork.tour?.length ? TOUR_COLOR : ARTWORK_COLOR, 3);
      if (artwork.tour?.length) this.drawTourMarker(ctx, artwork);
    }
    this.drawn = '';
  }

  /** Il quadro è un tratto spesso lungo la parete, appena dentro la sala. */
  private drawArtwork(ctx: CanvasRenderingContext2D, artwork: Artwork, color: string, lineWidth: number): void {
    const wall = this.room.walls[artwork.wall];
    const inward = lineWidth / 2 / this.scale;
    const center = wall.center.clone().addScaledVector(wall.right, artwork.position).addScaledVector(wall.normal, inward);
    const from = center.clone().addScaledVector(wall.right, -artwork.width / 2);
    const to = center.clone().addScaledVector(wall.right, artwork.width / 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(this.toMapX(from.x), this.toMapY(from.z));
    ctx.lineTo(this.toMapX(to.x), this.toMapY(to.z));
    ctx.stroke();
  }

  /** Un pallino dorato davanti ai quadri con visita guidata, dove ci si ferma per avviarla. */
  private drawTourMarker(ctx: CanvasRenderingContext2D, artwork: Artwork): void {
    const wall = this.room.walls[artwork.wall];
    const spot = wall.center
      .clone()
      .addScaledVector(wall.right, artwork.position)
      .addScaledVector(wall.normal, this.room.barrierDistance + 0.6);
    ctx.fillStyle = TOUR_COLOR;
    ctx.beginPath();
    ctx.arc(this.toMapX(spot.x), this.toMapY(spot.z), SMALL_SCREEN.matches ? 2 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
