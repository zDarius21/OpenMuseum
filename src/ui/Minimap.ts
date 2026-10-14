import * as THREE from 'three';
import { onLanguageChange } from '../i18n/language';
import { t } from '../i18n/strings';
import type { PlacedArtwork } from '../rooms/layout';
import type { Wall, WallId } from '../scene/Room';

/** La sala da disegnare. */
export interface MinimapRoom {
  width: number;
  depth: number;
  /** Faccia interna della parete nord, lungo z: è il lato in alto della mappa. */
  north: number;
  /** Distanza delle transenne dalle pareti. */
  barrierDistance: number;
  doorWidth: number;
  doors: { south: boolean; north: boolean };
  walls: Record<WallId, Wall>;
  artworks: readonly PlacedArtwork[];
  /** Didascalia sotto la mappa, per esempio «Sala 2 di 5 · Roma». */
  caption: string;
}

/** Ingombro massimo della mappa sullo schermo, in pixel CSS. */
const MAX_SIZE = { width: 120, height: 170 };
const MAX_SIZE_SMALL = { width: 72, height: 110 };
const SMALL_SCREEN = window.matchMedia('(max-width: 600px), (max-height: 500px)');
const PADDING = 8;

const WALL_COLOR = 'rgb(243 239 232 / 0.55)';
const FLOOR_COLOR = 'rgb(255 255 255 / 0.06)';
const ROPE_COLOR = 'rgb(176 64 76 / 0.7)';
const ARTWORK_COLOR = '#a99f91';
const TOUR_COLOR = '#e0bd6e';
const FOCUS_COLOR = '#ffffff';

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * Mappa della sala in cui si trova il visitatore, vista dall'alto con il nord in alto: pareti con le porte,
 * transenne, quadri (in oro quelli con visita guidata), il visitatore e il cono di ciò che sta guardando.
 */
export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly caption: HTMLElement;
  private readonly ctx: CanvasRenderingContext2D;
  /** Parte fissa della mappa, ridisegnata solo quando cambiano sala o dimensioni. */
  private readonly background = document.createElement('canvas');
  private room: MinimapRoom | null = null;
  private scale = 1;
  private cssWidth = 0;
  private cssHeight = 0;
  /** Ultimo stato disegnato: se non cambia nulla non si ridisegna. */
  private drawn = '';

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    this.canvas.setAttribute('role', 'img');
    const setLabel = () => this.canvas.setAttribute('aria-label', t().room.map);
    setLabel();
    onLanguageChange(setLabel);
    this.canvas.hidden = true;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non disponibile');
    this.ctx = ctx;

    this.caption = document.createElement('p');
    this.caption.className = 'minimap-caption';
    this.caption.hidden = true;
    parent.append(this.canvas, this.caption);

    window.addEventListener('resize', this.layout);
  }

  /** Cambia la sala disegnata, per esempio quando il visitatore passa una porta. */
  setRoom(room: MinimapRoom | null): void {
    this.room = room;
    this.caption.textContent = room?.caption ?? '';
    this.layout();
  }

  /** Da chiamare a ogni frame. `focusedId` è il quadro di cui è aperta la scheda, evidenziato sulla mappa. */
  update(camera: THREE.PerspectiveCamera, focusedId: string | null, visible: boolean): void {
    const room = this.room;
    this.canvas.hidden = !visible || !room;
    this.caption.hidden = this.canvas.hidden;
    if (this.canvas.hidden || !room) return;

    _euler.setFromQuaternion(camera.quaternion);
    const x = this.toMapX(camera.position.x);
    const y = this.toMapY(camera.position.z);
    const state = `${x.toFixed(1)} ${y.toFixed(1)} ${_euler.y.toFixed(3)} ${camera.aspect.toFixed(2)} ${focusedId} ${this.cssWidth} ${this.cssHeight}`;
    if (state === this.drawn) return;
    this.drawn = state;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.drawImage(this.background, 0, 0, this.cssWidth, this.cssHeight);

    const focused = room.artworks.find((placed) => placed.artwork.id === focusedId);
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
    return PADDING + (x + (this.room?.width ?? 0) / 2) * this.scale;
  }

  private toMapY(z: number): number {
    return PADDING + (z - (this.room?.north ?? 0)) * this.scale;
  }

  /** Adatta le dimensioni allo schermo e alla sala: la sala occupa tutto lo spazio disponibile mantenendo le proporzioni. */
  private readonly layout = (): void => {
    const room = this.room;
    if (!room) return;
    const max = SMALL_SCREEN.matches ? MAX_SIZE_SMALL : MAX_SIZE;
    this.scale = Math.min((max.width - 2 * PADDING) / room.width, (max.height - 2 * PADDING) / room.depth);
    this.cssWidth = Math.round(room.width * this.scale + 2 * PADDING);
    this.cssHeight = Math.round(room.depth * this.scale + 2 * PADDING);

    const ratio = window.devicePixelRatio || 1;
    for (const canvas of [this.canvas, this.background]) {
      canvas.width = Math.round(this.cssWidth * ratio);
      canvas.height = Math.round(this.cssHeight * ratio);
    }
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.drawBackground(room);
  };

  private drawBackground(room: MinimapRoom): void {
    const ctx = this.background.getContext('2d');
    if (!ctx) return;
    const ratio = this.background.width / this.cssWidth;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

    const { width, depth, barrierDistance } = room;
    const left = PADDING;
    const top = PADDING;
    const right = left + width * this.scale;
    const bottom = top + depth * this.scale;
    ctx.fillStyle = FLOOR_COLOR;
    ctx.fillRect(left, top, right - left, bottom - top);

    // Transenne lungo le pareti lunghe.
    const inset = barrierDistance * this.scale;
    ctx.strokeStyle = ROPE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const x of [left + inset, right - inset]) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    ctx.stroke();

    // Pareti, interrotte dalle porte.
    const door = (room.doorWidth / 2) * this.scale;
    const middle = (left + right) / 2;
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.moveTo(right, top);
    ctx.lineTo(right, bottom);
    for (const [y, hasDoor] of [
      [top, room.doors.north],
      [bottom, room.doors.south],
    ] as const) {
      ctx.moveTo(left, y);
      if (hasDoor) {
        ctx.lineTo(middle - door, y);
        ctx.moveTo(middle + door, y);
      }
      ctx.lineTo(right, y);
    }
    ctx.stroke();

    for (const placed of room.artworks) {
      const hasTour = Boolean(placed.artwork.tour?.length);
      this.drawArtwork(ctx, placed, hasTour ? TOUR_COLOR : ARTWORK_COLOR, 3);
      if (hasTour) this.drawTourMarker(ctx, placed);
    }
    this.drawn = '';
  }

  /** Il quadro è un tratto spesso lungo la parete, appena dentro la sala. */
  private drawArtwork(ctx: CanvasRenderingContext2D, placed: PlacedArtwork, color: string, lineWidth: number): void {
    const wall = this.room!.walls[placed.wall];
    const inward = lineWidth / 2 / this.scale;
    const center = wall.center.clone().addScaledVector(wall.right, placed.position).addScaledVector(wall.normal, inward);
    const from = center.clone().addScaledVector(wall.right, -placed.artwork.width / 2);
    const to = center.clone().addScaledVector(wall.right, placed.artwork.width / 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(this.toMapX(from.x), this.toMapY(from.z));
    ctx.lineTo(this.toMapX(to.x), this.toMapY(to.z));
    ctx.stroke();
  }

  /** Un pallino dorato davanti ai quadri con visita guidata, dove ci si ferma per avviarla. */
  private drawTourMarker(ctx: CanvasRenderingContext2D, placed: PlacedArtwork): void {
    const room = this.room!;
    const wall = room.walls[placed.wall];
    const spot = wall.center.clone().addScaledVector(wall.right, placed.position).addScaledVector(wall.normal, room.barrierDistance + 0.6);
    ctx.fillStyle = TOUR_COLOR;
    ctx.beginPath();
    ctx.arc(this.toMapX(spot.x), this.toMapY(spot.z), SMALL_SCREEN.matches ? 2 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
