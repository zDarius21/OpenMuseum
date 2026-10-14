import type * as THREE from 'three';
import { onLanguageChange } from '../i18n/language';
import { t } from '../i18n/strings';
import { drawArtwork, drawRoom, drawVisitor, MAP_COLORS, MapProjection, sizeCanvas, visitorState, type MapRoom } from './mapDrawing';

/** Ingombro massimo della mappa sullo schermo, in pixel CSS. */
const MAX_SIZE = { width: 120, height: 170 };
const MAX_SIZE_SMALL = { width: 72, height: 110 };
const SMALL_SCREEN = window.matchMedia('(max-width: 600px), (max-height: 500px)');
const PADDING = 8;
const STROKE = { wall: 1.5, rope: 1, artwork: 3, tourDot: 2.5 };
const STROKE_SMALL = { ...STROKE, tourDot: 2 };

/**
 * Mappa della sala in cui si trova il visitatore, vista dall'alto con il nord in alto: pareti con le porte,
 * transenne, quadri (in oro quelli con visita guidata), il visitatore e il cono di ciò che sta guardando.
 * È anche un pulsante: toccandola (o con il tasto M) si apre la mappa grande, con l'elenco delle opere.
 */
export class Minimap {
  private readonly button: HTMLButtonElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly caption: HTMLElement;
  private ctx: CanvasRenderingContext2D | null = null;
  /** Parte fissa della mappa, ridisegnata solo quando cambiano sala o dimensioni. */
  private readonly background = document.createElement('canvas');
  private room: MapRoom | null = null;
  private projection: MapProjection | null = null;
  /** Ultimo stato disegnato: se non cambia nulla non si ridisegna. */
  private drawn = '';

  /** `expand` apre la mappa grande. */
  constructor(parent: HTMLElement, expand: () => void) {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'minimap';
    this.button.hidden = true;
    this.canvas = document.createElement('canvas');
    // Su PC il simbolo ricorda il tasto M, sugli schermi touch invita a toccare.
    const badge = document.createElement('span');
    badge.className = 'minimap__expand';
    badge.setAttribute('aria-hidden', 'true');
    badge.innerHTML = '<span class="minimap__key">M</span><span class="minimap__icon">⤢</span>';
    this.button.append(this.canvas, badge);
    this.button.addEventListener('click', (event) => {
      // Dopo un clic con mouse o dito il pulsante perde il focus: Invio non deve riaprire la mappa.
      if (event.detail > 0) this.button.blur();
      expand();
    });
    const setLabel = () => {
      this.button.setAttribute('aria-label', `${t().room.map} · ${t().room.expandMap}`);
      this.button.title = `${t().room.expandMap} (M)`;
    };
    setLabel();
    onLanguageChange(setLabel);

    this.caption = document.createElement('p');
    this.caption.className = 'minimap-caption';
    this.caption.hidden = true;
    parent.append(this.button, this.caption);

    window.addEventListener('resize', this.layout);
  }

  /** Cambia la sala disegnata, per esempio quando il visitatore passa una porta. */
  setRoom(room: MapRoom | null): void {
    this.room = room;
    this.caption.textContent = room?.caption ?? '';
    this.layout();
  }

  /** Da chiamare a ogni frame. `focusedId` è il quadro di cui è aperta la scheda, evidenziato sulla mappa. */
  update(camera: THREE.PerspectiveCamera, focusedId: string | null, visible: boolean): void {
    const { room, projection: p, ctx } = this;
    this.button.hidden = !visible || !room;
    this.caption.hidden = this.button.hidden;
    if (this.button.hidden || !room || !p || !ctx) return;

    const state = `${visitorState(p, camera)} ${focusedId} ${p.width} ${p.height}`;
    if (state === this.drawn) return;
    this.drawn = state;

    ctx.clearRect(0, 0, p.width, p.height);
    ctx.drawImage(this.background, 0, 0, p.width, p.height);
    const focused = room.artworks.find((placed) => placed.artwork.id === focusedId);
    if (focused) drawArtwork(ctx, room, p, focused, MAP_COLORS.focus, 5);
    const small = SMALL_SCREEN.matches;
    drawVisitor(ctx, p, camera, { cone: small ? 20 : 30, dot: small ? 3 : 4 });
  }

  /** Adatta le dimensioni allo schermo e alla sala: la sala occupa tutto lo spazio disponibile mantenendo le proporzioni. */
  private readonly layout = (): void => {
    const room = this.room;
    if (!room) return;
    const small = SMALL_SCREEN.matches;
    const max = small ? MAX_SIZE_SMALL : MAX_SIZE;
    const p = MapProjection.fit(room.bounds, max.width, max.height, PADDING);
    this.projection = p;
    this.ctx = sizeCanvas(this.canvas, p);
    const background = sizeCanvas(this.background, p, false);
    background.clearRect(0, 0, p.width, p.height);
    drawRoom(background, room, p, small ? STROKE_SMALL : STROKE);
    this.drawn = '';
  };
}
