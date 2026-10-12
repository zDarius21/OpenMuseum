import type * as THREE from 'three';
import { artworkOf } from '../artworks/pickArtwork';
import type { Artwork } from '../artworks/artworksData';
import type { PlayerControls } from '../controls/PlayerControls';

/** Quanto resta visibile la scheda, in millisecondi, dopo aver distolto lo sguardo: evita lampeggi tra un quadro e l'altro. */
const HIDE_DELAY = 600;

export interface ArtworkCardActions {
  startTour(group: THREE.Object3D): void;
  view(group: THREE.Object3D): void;
}

/**
 * Scheda dell'opera davanti a cui ci si è fermati: autore, titolo, anno, misure, luogo, descrizione e il pulsante
 * della visita guidata, oppure, per i quadri senza visita, quello per guardarli da vicino.
 */
export class ArtworkCard {
  private readonly controls: PlayerControls;
  private readonly root: HTMLElement;
  private readonly actions: ArtworkCardActions;
  private group: THREE.Object3D | null = null;
  private touch = false;
  private viewing = false;
  private hideAt: number | null = null;

  constructor(parent: HTMLElement, controls: PlayerControls, actions: ArtworkCardActions) {
    this.controls = controls;
    this.actions = actions;
    this.root = document.createElement('section');
    this.root.className = 'card';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', "Scheda dell'opera");
    this.root.setAttribute('aria-live', 'polite');
    this.root.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
      if (this.group && action === 'tour') this.actions.startTour(this.group);
      if (this.group && action === 'view') this.actions.view(this.group);
      if (target.closest('.card__more')) this.toggleDescription();
    });
    parent.append(this.root);
  }

  /** Il quadro di cui è aperta la scheda, se c'è. */
  get current(): THREE.Object3D | null {
    return this.root.hidden ? null : this.group;
  }

  /**
   * Da chiamare a ogni frame con il quadro da mostrare (o null). Con `visible` false la scheda si chiude subito,
   * per esempio durante una visita guidata; con `viewing` true il quadro è già nella vista ravvicinata.
   */
  update(group: THREE.Object3D | null, visible: boolean, viewing: boolean): void {
    if (!visible) {
      this.hide();
      return;
    }
    if (!group) {
      if (!this.group) return;
      const now = performance.now();
      this.hideAt ??= now + HIDE_DELAY;
      if (now >= this.hideAt) this.hide();
      return;
    }

    this.hideAt = null;
    const touch = this.controls.isTouchMode;
    if (group !== this.group || touch !== this.touch || viewing !== this.viewing) {
      this.group = group;
      this.touch = touch;
      this.viewing = viewing;
      this.root.classList.toggle('card--viewing', viewing);
      this.render(artworkOf(group));
    }
    this.root.hidden = false;
  }

  /** Sugli schermi piccoli la descrizione è ridotta a poche righe: il pulsante la apre e la richiude. */
  private toggleDescription(): void {
    const expanded = this.root.classList.toggle('card--expanded');
    const more = this.root.querySelector('.card__more');
    if (!more) return;
    more.textContent = expanded ? 'Riduci' : 'Leggi tutto';
    more.setAttribute('aria-expanded', String(expanded));
  }

  private hide(): void {
    this.root.hidden = true;
    this.group = null;
    this.hideAt = null;
  }

  private render(artwork: Artwork): void {
    const meta = [artwork.year, formatSize(artwork)].filter(Boolean).join(' · ');
    const stops = artwork.tour?.length ?? 0;
    // Su PC si può usare anche Invio, mentre il puntatore è bloccato e il pulsante non si può cliccare.
    const shortcut = this.touch ? '' : '<kbd>Invio</kbd>';
    let action = '';
    if (stops) {
      action = `
        <button type="button" class="card__button" data-action="tour"><span>▶ Avvia la visita guidata</span>${shortcut}</button>
        <p class="card__note">${stops} tappe, con voce narrante</p>`;
    } else if (!this.viewing) {
      action = `<button type="button" class="card__button card__button--view" data-action="view"><span>⤢ Guarda da vicino</span>${shortcut}</button>`;
    }

    const description = artwork.description
      ? `<p class="card__description">${escapeHtml(artwork.description)}</p>
         <button type="button" class="card__more" aria-expanded="false">Leggi tutto</button>`
      : '';

    this.root.classList.remove('card--expanded');
    this.root.innerHTML = `
      ${artwork.author ? `<p class="card__author">${escapeHtml(artwork.author)}</p>` : ''}
      <h2 class="card__title">${escapeHtml(artwork.title)}</h2>
      <p class="card__meta">${escapeHtml(meta)}</p>
      ${artwork.location ? `<p class="card__location">${escapeHtml(artwork.location)}</p>` : ''}
      ${description}
      ${action}
      ${sourceLink(artwork.source)}`;
  }
}

/** Misure come nelle didascalie dei musei: altezza × larghezza, in centimetri. */
function formatSize({ width, height }: Artwork): string {
  const cm = (meters: number) => (meters * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 });
  return `${cm(height)} × ${cm(width)} cm`;
}

function sourceLink(source: string | undefined): string {
  if (!source) return '';
  let host: string;
  try {
    host = new URL(source).hostname;
  } catch {
    return '';
  }
  const name = host.endsWith('wikimedia.org') ? 'Wikimedia Commons' : host;
  return `<a class="card__source" href="${escapeHtml(source)}" target="_blank" rel="noopener">Immagine: ${escapeHtml(name)} ↗</a>`;
}

/** I testi arrivano da Sanity: vanno inseriti come testo, non come HTML. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.codePointAt(0)};`);
}
