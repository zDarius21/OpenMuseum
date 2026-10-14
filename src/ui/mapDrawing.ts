import * as THREE from 'three';
import type { PlacedArtwork } from '../rooms/layout';
import { barrierLines, WALL_IDS, type RoomBounds, type Wall, type WallId } from '../scene/Room';

/** La sala da disegnare, vista dall'alto con il nord in alto. */
export interface MapRoom {
  /** Facce interne delle pareti. */
  bounds: RoomBounds;
  /** Distanza delle transenne dalle pareti. */
  barrierDistance: number;
  doorWidth: number;
  /** Pareti con una porta, al centro. */
  doors: readonly WallId[];
  /** Pareti con i quadri, davanti alle quali corrono le transenne. */
  artWalls: readonly WallId[];
  walls: Record<WallId, Wall>;
  /** Le opere in ordine di data, che è anche l'ordine in cui si incontrano camminando. */
  artworks: readonly PlacedArtwork[];
  /** Per esempio «Sala 2 di 5 · Barocco». */
  caption: string;
}

export const MAP_COLORS = {
  wall: 'rgb(243 239 232 / 0.55)',
  floor: 'rgb(255 255 255 / 0.06)',
  rope: 'rgb(176 64 76 / 0.7)',
  artwork: '#a99f91',
  tour: '#e0bd6e',
  focus: '#ffffff',
} as const;

/** Spessori e misure del disegno, in pixel CSS: la mappa piccola e quella grande hanno tratti diversi. */
export interface MapStroke {
  wall: number;
  rope: number;
  artwork: number;
  /** Raggio del pallino dorato davanti ai quadri con visita guidata. */
  tourDot: number;
}

/** Passa dai metri della sala ai pixel CSS della mappa, con un margine tutto intorno. */
export class MapProjection {
  readonly bounds: RoomBounds;
  /** Pixel per metro. */
  readonly scale: number;
  readonly padding: number;
  /** Misure della mappa in pixel CSS. */
  readonly width: number;
  readonly height: number;

  constructor(bounds: RoomBounds, scale: number, padding: number) {
    this.bounds = bounds;
    this.scale = scale;
    this.padding = padding;
    this.width = Math.round((bounds.east - bounds.west) * scale + 2 * padding);
    this.height = Math.round((bounds.south - bounds.north) * scale + 2 * padding);
  }

  /** La scala più grande con cui la sala, margine compreso, sta in `maxWidth` × `maxHeight`. */
  static fit(bounds: RoomBounds, maxWidth: number, maxHeight: number, padding: number): MapProjection {
    const scale = Math.min((maxWidth - 2 * padding) / (bounds.east - bounds.west), (maxHeight - 2 * padding) / (bounds.south - bounds.north));
    return new MapProjection(bounds, Math.max(scale, 0.1), padding);
  }

  x(x: number): number {
    return this.padding + (x - this.bounds.west) * this.scale;
  }

  y(z: number): number {
    return this.padding + (z - this.bounds.north) * this.scale;
  }
}

/** Dà alla tela le misure della mappa, nitida anche sugli schermi ad alta densità: si disegna poi in pixel CSS. */
export function sizeCanvas(canvas: HTMLCanvasElement, projection: MapProjection, styled = true): CanvasRenderingContext2D {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(projection.width * ratio);
  canvas.height = Math.round(projection.height * ratio);
  if (styled) {
    canvas.style.width = `${projection.width}px`;
    canvas.style.height = `${projection.height}px`;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D non disponibile');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

/** Pavimento, transenne, pareti interrotte dalle porte e quadri, in oro quelli con visita guidata. */
export function drawRoom(ctx: CanvasRenderingContext2D, room: MapRoom, p: MapProjection, stroke: MapStroke): void {
  const { bounds } = room;
  ctx.fillStyle = MAP_COLORS.floor;
  ctx.fillRect(p.x(bounds.west), p.y(bounds.north), (bounds.east - bounds.west) * p.scale, (bounds.south - bounds.north) * p.scale);

  // Transenne davanti alle pareti con i quadri.
  ctx.strokeStyle = MAP_COLORS.rope;
  ctx.lineWidth = stroke.rope;
  ctx.beginPath();
  for (const line of barrierLines(bounds, room.artWalls, room.barrierDistance)) {
    line.forEach((point, index) => (index === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, p.x(point.x), p.y(point.z)));
  }
  ctx.stroke();

  // Pareti, interrotte dalle porte: ognuna da un angolo all'altro, verso destra per chi la guarda dall'interno.
  ctx.strokeStyle = MAP_COLORS.wall;
  ctx.lineWidth = stroke.wall;
  ctx.beginPath();
  for (const id of WALL_IDS) {
    const wall = room.walls[id];
    const ends = room.doors.includes(id)
      ? [
          [-wall.length / 2, -room.doorWidth / 2],
          [room.doorWidth / 2, wall.length / 2],
        ]
      : [[-wall.length / 2, wall.length / 2]];
    for (const [from, to] of ends) {
      const a = wall.center.clone().addScaledVector(wall.right, from);
      const b = wall.center.clone().addScaledVector(wall.right, to);
      ctx.moveTo(p.x(a.x), p.y(a.z));
      ctx.lineTo(p.x(b.x), p.y(b.z));
    }
  }
  ctx.stroke();

  for (const placed of room.artworks) {
    const hasTour = Boolean(placed.artwork.tour?.length);
    drawArtwork(ctx, room, p, placed, hasTour ? MAP_COLORS.tour : MAP_COLORS.artwork, stroke.artwork);
    if (hasTour && stroke.tourDot > 0) {
      // Il pallino sta davanti alla transenna, dove ci si ferma per avviare la visita.
      const spot = spotInFront(room, placed, room.barrierDistance + 0.6);
      ctx.fillStyle = MAP_COLORS.tour;
      ctx.beginPath();
      ctx.arc(p.x(spot.x), p.y(spot.z), stroke.tourDot, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Il quadro è un tratto spesso lungo la parete, appena dentro la sala. */
export function drawArtwork(ctx: CanvasRenderingContext2D, room: MapRoom, p: MapProjection, placed: PlacedArtwork, color: string, lineWidth: number): void {
  const wall = room.walls[placed.wall];
  const center = spotInFront(room, placed, lineWidth / 2 / p.scale);
  const from = center.clone().addScaledVector(wall.right, -placed.artwork.width / 2);
  const to = center.clone().addScaledVector(wall.right, placed.artwork.width / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(p.x(from.x), p.y(from.z));
  ctx.lineTo(p.x(to.x), p.y(to.z));
  ctx.stroke();
}

/** Il punto del pavimento davanti al centro del quadro, a `distance` metri dalla parete. */
export function spotInFront(room: MapRoom, placed: PlacedArtwork, distance: number): THREE.Vector3 {
  const wall = room.walls[placed.wall];
  return wall.center.clone().addScaledVector(wall.right, placed.position).addScaledVector(wall.normal, distance);
}

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

/** Il visitatore: un pallino bianco con il cono di ciò che sta guardando, largo quanto il campo visivo orizzontale. */
export function drawVisitor(ctx: CanvasRenderingContext2D, p: MapProjection, camera: THREE.PerspectiveCamera, size: { cone: number; dot: number }): void {
  const x = p.x(camera.position.x);
  const y = p.y(camera.position.z);
  _euler.setFromQuaternion(camera.quaternion);
  const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
  const heading = Math.atan2(-Math.cos(_euler.y), -Math.sin(_euler.y));
  const cone = ctx.createRadialGradient(x, y, 0, x, y, size.cone);
  cone.addColorStop(0, 'rgb(255 255 255 / 0.45)');
  cone.addColorStop(1, 'rgb(255 255 255 / 0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, size.cone, heading - halfFov, heading + halfFov);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgb(20 18 16 / 0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, size.dot, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Quello che conta per ridisegnare il visitatore: se non cambia, la mappa resta com'è. */
export function visitorState(p: MapProjection, camera: THREE.PerspectiveCamera): string {
  _euler.setFromQuaternion(camera.quaternion);
  return `${p.x(camera.position.x).toFixed(1)} ${p.y(camera.position.z).toFixed(1)} ${_euler.y.toFixed(3)} ${camera.aspect.toFixed(2)}`;
}
