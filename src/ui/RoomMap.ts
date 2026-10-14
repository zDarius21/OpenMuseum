import type * as THREE from 'three';
import { textsOf } from '../artworks/artworksData';
import type { PlayerControls } from '../controls/PlayerControls';
import { formatYear, t } from '../i18n/strings';
import { HEADPHONES_ICON } from './icons';
import { drawArtwork, drawRoom, drawVisitor, MAP_COLORS, MapProjection, sizeCanvas, spotInFront, visitorState, type MapRoom } from './mapDrawing';

/** Margine intorno alla sala, in pixel CSS. */
const PADDING = 14;

/** Un numero sulla mappa, davanti al suo quadro. */
interface Badge {
  x: number;
  y: number;
  radius: number;
}

/**
 * La mappa della sala a tutto schermo: le opere numerate davanti alla loro parete, in oro quelle con visita guidata,
 * e accanto l'elenco con titolo, autore e anno. Passando sopra un'opera, nell'elenco o sulla mappa, si illumina anche
 * l'altra. Mentre è aperta il visitatore resta fermo; si chiude con il pulsante, con M o con Esc.
 */
export class RoomMap {
  private readonly controls: PlayerControls;
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly plan: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly list: HTMLOListElement;
  private readonly key: HTMLElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private room: MapRoom | null = null;
  private projection: MapProjection | null = null;
  private badges: Badge[] = [];
  /** L'opera illuminata, come posizione in `room.artworks`. */
  private active: number | null = null;
  private drawn = '';

  constructor(parent: HTMLElement, controls: PlayerControls) {
    this.controls = controls;
    this.root = document.createElement('div');
    this.root.className = 'room-map';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'room-map-title');
    this.root.innerHTML = `
      <div class="room-map__panel">
        <header class="room-map__header">
          <h2 class="room-map__title" id="room-map-title"></h2>
          <button type="button" class="room-map__close"></button>
        </header>
        <div class="room-map__body">
          <div class="room-map__plan"><canvas class="room-map__canvas" aria-hidden="true"></canvas></div>
          <ol class="room-map__list"></ol>
        </div>
        <p class="room-map__key"></p>
      </div>`;
    const find = <T extends HTMLElement>(selector: string) => this.root.querySelector<T>(selector)!;
    this.title = find('.room-map__title');
    this.closeButton = find<HTMLButtonElement>('.room-map__close');
    this.plan = find('.room-map__plan');
    this.canvas = find<HTMLCanvasElement>('.room-map__canvas');
    this.list = find<HTMLOListElement>('.room-map__list');
    this.key = find('.room-map__key');
    parent.append(this.root);

    this.closeButton.addEventListener('click', () => this.close());
    // Un clic fuori dal pannello chiude la mappa.
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.close();
    });
    this.list.addEventListener('pointerover', (event) => this.setActive(this.itemIndex(event.target)));
    // Con le dita il puntatore «esce» appena si alza il dito: l'opera toccata resta illuminata.
    const leave = (event: PointerEvent) => event.pointerType === 'mouse' && this.setActive(null);
    this.list.addEventListener('pointerleave', leave);
    this.list.addEventListener('focusin', (event) => this.setActive(this.itemIndex(event.target)));
    this.list.addEventListener('focusout', () => this.setActive(null));
    this.canvas.addEventListener('pointermove', (event) => this.setActive(this.badgeAt(event), true));
    this.canvas.addEventListener('pointerleave', leave);
    // Su touch un tocco sulla mappa illumina l'opera più vicina, e la mostra nell'elenco.
    this.canvas.addEventListener('pointerdown', (event) => this.setActive(this.badgeAt(event), true));
    document.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.layout);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  /** Apre la mappa della sala, con i testi nella lingua scelta: mentre è aperta la lingua non si può cambiare. */
  open(room: MapRoom): void {
    if (this.isOpen) return;
    this.controls.enabled = false;
    // Il mouse serve libero per passare sopra le opere e per chiudere.
    this.controls.unlock();
    this.room = room;
    this.active = null;
    this.render(room);
    this.root.hidden = false;
    this.layout();
    this.closeButton.focus({ preventScroll: true });
  }

  /** Chiude la mappa e riprende la visita. `byEscape` se si chiude con il tasto Esc. */
  close(byEscape = false): void {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.closeButton.blur();
    this.room = null;
    this.controls.enabled = true;
    // Su PC si riprende subito a guardarsi intorno, senza cliccare.
    this.controls.resume(byEscape);
  }

  /** Da chiamare a ogni frame: ridisegna solo se è cambiato qualcosa. */
  update(camera: THREE.PerspectiveCamera): void {
    const { room, projection: p, ctx } = this;
    if (!this.isOpen || !room || !p || !ctx) return;
    const state = `${visitorState(p, camera)} ${this.active} ${p.width} ${p.height}`;
    if (state === this.drawn) return;
    this.drawn = state;

    ctx.clearRect(0, 0, p.width, p.height);
    drawRoom(ctx, room, p, { wall: 2, rope: 1.5, artwork: 5, tourDot: 0 });
    if (this.active !== null) drawArtwork(ctx, room, p, room.artworks[this.active], MAP_COLORS.focus, 7);
    drawVisitor(ctx, p, camera, { cone: Math.max(40, p.scale * 2.2), dot: 6 });
    this.drawBadges(ctx, room);
  }

  private render(room: MapRoom): void {
    const text = t();
    this.title.textContent = room.caption;
    this.closeButton.textContent = text.room.closeMap;
    this.closeButton.setAttribute('aria-label', text.room.closeMapLabel);
    this.list.setAttribute('aria-label', text.room.works);
    this.list.innerHTML = room.artworks
      .map(({ artwork }, index) => {
        const { title, author } = textsOf(artwork);
        const meta = [author ?? text.artwork.unknownArtist, artwork.year === undefined ? '' : formatYear(artwork.year)].filter(Boolean).join(' · ');
        const tour = artwork.tour?.length ? `<span class="room-map__tour">${HEADPHONES_ICON}${text.artwork.audioGuide}</span>` : '';
        return `
          <li class="room-map__item" data-index="${index}" tabindex="0">
            <span class="room-map__number${tour ? ' room-map__number--tour' : ''}">${index + 1}</span>
            <span class="room-map__text">
              <span class="room-map__work">${escapeHtml(title)}</span>
              <span class="room-map__meta">${escapeHtml(meta)}</span>
              ${tour}
            </span>
          </li>`;
      })
      .join('');
    const close = this.controls.isTouchMode ? '' : `<span>${text.room.mapKeys}</span>`;
    this.key.innerHTML = `
      <span class="room-map__key-you">${text.room.you}</span>
      <span class="room-map__key-rope">${text.room.rope}</span>
      ${close}`;
  }

  /** La sala riempie lo spazio a disposizione, mantenendo le proporzioni. */
  private readonly layout = (): void => {
    const room = this.room;
    if (!this.isOpen || !room) return;
    const box = this.plan.getBoundingClientRect();
    const p = MapProjection.fit(room.bounds, box.width, box.height, PADDING);
    this.projection = p;
    this.ctx = sizeCanvas(this.canvas, p);
    this.drawn = '';
  };

  /** I numeri delle opere, davanti al centro di ciascuna, tra la parete e la transenna. */
  private drawBadges(ctx: CanvasRenderingContext2D, room: MapRoom): void {
    const p = this.projection!;
    const radius = Math.min(Math.max(p.scale * 0.32, 9), 13);
    // Abbastanza lontano dalla parete da non coprire il quadro, ma senza superare la transenna.
    const distance = Math.min(Math.max(room.barrierDistance / 2, (radius + 6) / p.scale), room.barrierDistance);
    ctx.font = `600 ${Math.round(radius * 1.1)}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.badges = room.artworks.map((placed, index) => {
      const spot = spotInFront(room, placed, distance);
      const badge = { x: p.x(spot.x), y: p.y(spot.z), radius };
      const active = index === this.active;
      const size = active ? radius + 2 : radius;
      ctx.fillStyle = active ? MAP_COLORS.focus : placed.artwork.tour?.length ? MAP_COLORS.tour : MAP_COLORS.artwork;
      ctx.strokeStyle = 'rgb(20 18 16 / 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(badge.x, badge.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1c1a17';
      ctx.fillText(String(index + 1), badge.x, badge.y + 0.5);
      return badge;
    });
  }

  /** Illumina un'opera sulla mappa e nell'elenco; `reveal` la porta in vista nell'elenco, se è lungo. */
  private setActive(index: number | null, reveal = false): void {
    if (index === this.active) return;
    this.active = index;
    this.canvas.style.cursor = index === null ? '' : 'pointer';
    for (const item of this.list.children) {
      const current = Number((item as HTMLElement).dataset.index) === index;
      item.classList.toggle('room-map__item--active', current);
      if (current && reveal) item.scrollIntoView({ block: 'nearest' });
    }
  }

  private itemIndex(target: EventTarget | null): number | null {
    const item = (target as HTMLElement | null)?.closest<HTMLElement>('.room-map__item');
    return item ? Number(item.dataset.index) : null;
  }

  /** Il numero sotto il puntatore, con un po' di margine per le dita. */
  private badgeAt(event: PointerEvent): number | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const slack = event.pointerType === 'mouse' ? 4 : 14;
    let best: number | null = null;
    let bestDistance = Infinity;
    this.badges.forEach((badge, index) => {
      const distance = Math.hypot(badge.x - x, badge.y - y);
      if (distance <= badge.radius + slack && distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.isOpen) return;
    if (event.code === 'Escape' || event.code === 'KeyM') {
      this.close(event.code === 'Escape');
      event.preventDefault();
    }
  };
}

/** I testi arrivano da Sanity: vanno inseriti come testo, non come HTML. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.codePointAt(0)};`);
}
