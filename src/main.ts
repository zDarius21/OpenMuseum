import * as THREE from 'three';
import './style.css';
import { loadArtworks, type Artwork } from './artworks/artworksData';
import { artworkOf, pickArtwork, pointerFromEvent } from './artworks/pickArtwork';
import { isNearArtwork } from './artworks/proximity';
import { animateTourBadges } from './artworks/tourBadge';
import { PlayerControls } from './controls/PlayerControls';
import { settings } from './data/settings';
import { catalogFacets, filterArtworks, planRooms, type VisitFilters } from './rooms/plan';
import { RoomManager, type RoomInfo } from './rooms/RoomManager';
import { Museum } from './scene/Museum';
import { createReflectionMap } from './scene/reflections';
import { GuidedTour } from './tour/GuidedTour';
import { AimHint, type AimTarget } from './ui/AimHint';
import { ArtworkCard } from './ui/ArtworkCard';
import { createControlsHint } from './ui/ControlsHint';
import { Minimap } from './ui/Minimap';
import { StartScreen } from './ui/StartScreen';
import { Toast } from './ui/Toast';
import { ArtworkViewer } from './viewer/ArtworkViewer';

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('Elemento #app non trovato in index.html');

const museum = new Museum(container);

const maxAnisotropy = museum.renderer.capabilities.getMaxAnisotropy();
const reflections = createReflectionMap(museum.renderer);

// Luce diffusa per tutto il museo: calda dall'alto; dal basso il riflesso chiaro di pavimento e pareti.
museum.scene.add(new THREE.HemisphereLight(0xfffaf2, 0xd9d3cb, settings.lights.ambientIntensity));

// In alto a destra: la mappa della sala e, sotto, il pulsante che riapre le istruzioni.
const hud = document.createElement('div');
hud.className = 'hud';
container.append(hud);
const minimap = new Minimap(hud);
const toast = new Toast(container);

// Le sale si generano dai filtri del menu iniziale; sono costruite solo quelle vicine al visitatore.
const rooms = new RoomManager({
  scene: museum.scene,
  renderer: museum.renderer,
  camera: museum.camera,
  room: settings.rooms,
  layout: { ...settings.rooms, ...settings.artworks },
  barriers: settings.barriers,
  hang: { maxAnisotropy, reflections, spotStrength: settings.artworks.spotStrength },
  lights: { count: Math.max(...settings.visit.perRoomOptions), fadeDuration: settings.lights.fadeDuration },
  onRoomChange: (room, total) => {
    minimap.setRoom(minimapRoom(room, total));
    if (!startScreen.isOpen) announceRoom(room, total);
  },
});

const controls = new PlayerControls(museum.camera, museum.renderer.domElement, rooms.colliders, settings.player);
museum.onUpdate((delta) => controls.update(delta));

let catalog: Artwork[] = [];
/** Aumenta a ogni museo creato: un caricamento superato da una nuova scelta di filtri non tocca più il menu. */
let creation = 0;
const startScreen = new StartScreen(container, hud, controls, {
  perRoomOptions: settings.visit.perRoomOptions,
  defaultPerRoom: settings.visit.defaultPerRoom,
  loadingBar: settings.loadingBar,
  preview: (filters) => {
    const works = filterArtworks(catalog, filters);
    return { artworks: works.length, rooms: planRooms(works, filters, settings.visit.minCityRoom).length };
  },
  onCreate: (filters) => void createMuseum(filters),
  onEnter: () => {
    const room = rooms.current;
    if (room) announceRoom(room, rooms.rooms.length);
  },
});
createControlsHint(container, controls);

/** Genera le sale dai filtri e porta il visitatore all'inizio della prima, che si carica per prima. */
async function createMuseum(filters: VisitFilters): Promise<void> {
  const id = ++creation;
  const plans = planRooms(filterArtworks(catalog, filters), filters, settings.visit.minCityRoom);
  rooms.plan(plans);
  const { position, lookAt } = rooms.start;
  museum.camera.position.set(position.x, settings.camera.eyeHeight, position.z);
  museum.camera.lookAt(lookAt.x, settings.camera.eyeHeight, lookAt.z);

  await rooms.enter((done, total) => {
    if (id === creation) startScreen.setProgress(done, total);
  });
  if (id !== creation) return;
  const count = rooms.rooms.reduce((sum, room) => sum + room.layout.placed.length, 0);
  const halls = plans.length === 1 ? 'Una sala' : `${plans.length} sale`;
  const works = count === 1 ? "un'opera" : `${count} opere`;
  startScreen.setReady(`${halls} · ${works}`);
}

/** Il cartello che compare entrando in una sala. */
function announceRoom(room: RoomInfo, total: number): void {
  toast.show(`Sala ${room.index + 1} di ${total} · ${room.title}`, 3000);
}

function minimapRoom(room: RoomInfo, total: number) {
  return {
    width: settings.rooms.width,
    depth: room.layout.depth,
    north: room.north,
    barrierDistance: settings.barriers.distance,
    doorWidth: settings.rooms.door.width,
    doors: { south: room.index > 0, north: room.index < total - 1 },
    walls: rooms.roomOf(room.index)!.walls,
    artworks: room.layout.placed,
    caption: `Sala ${room.index + 1} di ${total} · ${room.title}`,
  };
}

// Scheda, visita guidata e vista ravvicinata si aprono solo stando vicino al cordone davanti al quadro.
const reach = settings.barriers.distance + settings.barriers.maxDistanceFromRope;
const isNear = (group: THREE.Object3D) => isNearArtwork(group, museum.camera.position, reach);

// Clic (o tocco) su un quadro: la visita guidata se ha delle tappe, altrimenti la vista ravvicinata.
const card = new ArtworkCard(container, controls, {
  startTour: (group) => tour.requestStart(group),
  view: (group) => viewer.requestStart(group),
});
const tour = new GuidedTour({ museum, controls, toast, parent: container, reach, options: settings.tour });
const viewer = new ArtworkViewer({ museum, controls, toast, parent: container, reach, options: settings.viewer });
tour.setArtworks(rooms.artworksRoot);
viewer.setArtworks(rooms.artworksRoot);
controls.onTap = (pointer) => tour.handleTap(pointer) || viewer.handleTap(pointer);

/** Avvia l'azione del quadro: la visita guidata se ce l'ha, altrimenti la vista ravvicinata. */
const openArtwork = (group: THREE.Object3D) => (artworkOf(group).tour?.length ? tour.requestStart(group) : viewer.requestStart(group));

// A ogni frame: sale da costruire o smontare, scheda (del quadro guardato al centro dello schermo, o di quello
// nella vista ravvicinata), mappa, mirino e bollini delle visite guidate.
const aimHint = new AimHint(container);
const SCREEN_CENTER = new THREE.Vector2(0, 0);
let elapsed = 0;
museum.onUpdate((delta) => {
  rooms.update(museum.camera.position, delta);
  viewer.update(delta);
  const exploring = controls.enabled && !tour.isActive;
  const looked = exploring ? pickArtwork(SCREEN_CENTER, museum.camera, rooms.artworksRoot) : null;
  const near = looked !== null && isNear(looked);
  const focused = viewer.group ?? (near ? looked : null);
  card.update(focused, exploring || (viewer.isActive && viewer.infoVisible), viewer.isActive);
  minimap.update(museum.camera, focused && artworkOf(focused).id, exploring);
  aimHint.update(controls.isLocked && exploring, aimTarget(looked, near));
  elapsed += delta;
  animateTourBadges(elapsed);
});

function aimTarget(group: THREE.Object3D | null, near: boolean): AimTarget {
  if (!group) return 'none';
  if (artworkOf(group).tour?.length) return near ? 'tour-near' : 'tour-far';
  return near ? 'view-near' : 'none';
}

// Su PC, senza puntatore bloccato, il cursore diventa una mano sopra i quadri abbastanza vicini da aprire.
museum.renderer.domElement.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse' || controls.isLocked || !controls.enabled) return;
  const group = pickArtwork(pointerFromEvent(event, museum.renderer.domElement), museum.camera, rooms.artworksRoot);
  museum.renderer.domElement.style.cursor = group && isNear(group) ? 'pointer' : '';
});

// Su PC, con la scheda aperta, Invio fa come il pulsante della scheda.
document.addEventListener('keydown', (event) => {
  if (event.code !== 'Enter' || event.repeat || event.target instanceof HTMLButtonElement) return;
  if (!controls.enabled || tour.isActive || !card.current) return;
  openArtwork(card.current);
  event.preventDefault();
});

museum.start();

// Il catalogo (solo i dati, non le immagini) arriva da Sanity: serve al menu per proporre i filtri.
loadArtworks(settings.sanity)
  .then((artworks) => {
    catalog = artworks;
    startScreen.setCatalog(catalogFacets(artworks));
  })
  .catch((error: unknown) => {
    console.error('Impossibile caricare le opere:', error);
    startScreen.setCatalogError();
  });

// In sviluppo `museum`, `controls`, `rooms`, `tour`, `viewer` e `startScreen` sono raggiungibili dalla console del browser, per il debug.
if (import.meta.env.DEV) Object.assign(window, { museum, controls, rooms, tour, viewer, startScreen });
