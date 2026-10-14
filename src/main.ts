import * as THREE from 'three';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import './style.css';
import { loadArtworks, type Artwork } from './artworks/artworksData';
import { prefetchImages } from './artworks/imageCache';
import { artworkOf, pickArtworkPart, type ArtworkPart } from './artworks/pickArtwork';
import { isNearArtwork } from './artworks/proximity';
import { animateTourBadges } from './artworks/tourBadge';
import { PlayerControls } from './controls/PlayerControls';
import { MOVEMENTS } from './data/movements';
import { settings } from './data/settings';
import { onLanguageChange } from './i18n/language';
import { t } from './i18n/strings';
import { compareByYear, movementFacets, planRooms, roomTitle } from './rooms/plan';
import { RoomManager, type RoomInfo } from './rooms/RoomManager';
import { Museum } from './scene/Museum';
import { createReflectionMap } from './scene/reflections';
import { GuidedTour } from './tour/GuidedTour';
import { AimHint, type AimTarget } from './ui/AimHint';
import { ArtworkCard } from './ui/ArtworkCard';
import { createControlsHint } from './ui/ControlsHint';
import { Minimap } from './ui/Minimap';
import { RoomMap } from './ui/RoomMap';
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

// In alto a destra: la mappa della sala, che toccata si ingrandisce, e sotto il pulsante che riapre le istruzioni.
const hud = document.createElement('div');
hud.className = 'hud';
container.append(hud);
const minimap = new Minimap(hud, () => openRoomMap());
const toast = new Toast(container);

// Le sale si generano dalle tappe scelte nel menu iniziale; sono costruite solo quelle vicine al visitatore.
const rooms = new RoomManager({
  scene: museum.scene,
  renderer: museum.renderer,
  camera: museum.camera,
  room: settings.rooms,
  layout: { ...settings.rooms, ...settings.artworks },
  barriers: settings.barriers,
  hang: { maxAnisotropy, reflections, spotStrength: settings.artworks.spotStrength },
  lights: { count: settings.visit.perRoom, fadeDuration: settings.lights.fadeDuration },
  onRoomChange: (room, total) => {
    minimap.setRoom(minimapRoom(room, total));
    if (!startScreen.isOpen) announceRoom(room, total);
  },
});

const controls = new PlayerControls(museum.camera, museum.renderer.domElement, rooms.colliders, settings.player);
museum.onUpdate((delta) => controls.update(delta));

let catalog: Artwork[] = [];
/** Aumenta a ogni museo creato: un caricamento superato da un nuovo percorso non tocca più il menu. */
let creation = 0;
const planRoute = (route: ReadonlySet<string>) => planRooms(catalog, route, MOVEMENTS, settings.visit.perRoom);
const startScreen = new StartScreen(container, hud, controls, {
  loadingBar: settings.loadingBar,
  preview: (route) => {
    const plans = planRoute(route);
    return { artworks: plans.reduce((sum, plan) => sum + plan.artworks.length, 0), rooms: plans.length };
  },
  // Le immagini delle opere scelte cominciano ad arrivare già mentre si sceglie, prima quelle della prima sala.
  onRouteChange: (route) => prefetchImages(planRoute(route).flatMap((plan) => plan.artworks.flatMap((artwork) => artwork.image ?? []))),
  onCreate: (route) => void createMuseum(route),
  onEnter: () => {
    const room = rooms.current;
    if (room) announceRoom(room, rooms.rooms.length);
  },
});
createControlsHint(container, controls);

/** Genera le sale dalle opere scelte e porta il visitatore all'inizio della prima, che si carica per prima. */
async function createMuseum(route: ReadonlySet<string>): Promise<void> {
  const id = ++creation;
  const plans = planRoute(route);
  rooms.plan(plans);
  const { position, lookAt } = rooms.start;
  museum.camera.position.set(position.x, settings.camera.eyeHeight, position.z);
  museum.camera.lookAt(lookAt.x, settings.camera.eyeHeight, lookAt.z);

  await rooms.enter((done, total) => {
    if (id === creation) startScreen.setProgress(done, total);
  });
  if (id !== creation) return;
  startScreen.setReady(plans.length, rooms.rooms.reduce((sum, room) => sum + room.layout.placed.length, 0));
}

/** Il cartello che compare entrando in una sala. */
function announceRoom(room: RoomInfo, total: number): void {
  toast.show(t().room.caption(room.index + 1, total, roomTitle(room)), 3000);
}

function minimapRoom(room: RoomInfo, total: number) {
  return {
    bounds: room.bounds,
    barrierDistance: settings.barriers.distance,
    doorWidth: settings.rooms.door.width,
    doors: [room.doors.previous, room.doors.next].filter((wall) => wall !== undefined),
    artWalls: room.layout.artWalls,
    walls: rooms.roomOf(room.index)!.walls,
    // Sulla mappa grande le opere sono numerate in ordine di data, che è l'ordine in cui si incontrano camminando.
    artworks: [...room.layout.placed].sort((a, b) => compareByYear(a.artwork, b.artwork)),
    caption: t().room.caption(room.index + 1, total, roomTitle(room)),
  };
}

// Cambiando lingua dalla schermata iniziale si rifanno i testi già nel museo: cartelli, targhette e la mappa.
// La schermata e la scheda dell'opera si aggiornano da sole.
onLanguageChange(() => {
  rooms.refreshTexts();
  const room = rooms.current;
  if (room) minimap.setRoom(minimapRoom(room, rooms.rooms.length));
});

// Scheda, visita guidata e vista ravvicinata si aprono solo stando vicino al cordone davanti al quadro.
const reach = settings.barriers.distance + settings.barriers.maxDistanceFromRope;
const isNear = (group: THREE.Object3D) => isNearArtwork(group, museum.camera.position, reach);

/** Avvia l'audioguida. Dalla vista a tutto schermo parte da dove si è, e alla fine riporta il visitatore al cordone. */
const startTour = (group: THREE.Object3D) => {
  const from = viewer.group === group ? viewer.handOff() : null;
  if (from) tour.start(group, from);
  else tour.requestStart(group);
};
const card = new ArtworkCard(container, controls, { startTour, view: (group) => viewer.requestStart(group) });
const tour = new GuidedTour({ museum, controls, toast, parent: container, reach, options: settings.tour });
const viewer = new ArtworkViewer({ museum, controls, toast, parent: container, reach, options: settings.viewer });
// La mappa grande della sala va sopra tutto il resto dell'interfaccia.
const roomMap = new RoomMap(container, controls);
// Clic (o tocco) sulla scena: il pulsante dell'audioguida, sopra la targhetta, fa partire la spiegazione; il quadro si
// apre a tutto schermo, senza voce, anche se ha l'audioguida.
controls.onTap = (pointer) => {
  const hit = pickArtworkPart(pointer, museum.camera, rooms.artworksRoot);
  if (!hit) return false;
  return hit.part === 'badge' ? tour.requestStart(hit.group) : viewer.requestStart(hit.group);
};

/** L'azione principale della scheda: l'audioguida se il quadro ce l'ha, altrimenti la vista a tutto schermo. */
const openArtwork = (group: THREE.Object3D) => (artworkOf(group).tour?.length ? startTour(group) : viewer.requestStart(group));

// A ogni frame: sale da costruire o smontare, scheda (del quadro guardato al centro dello schermo, o di quello
// nella vista ravvicinata), mappa, mirino e bollini delle visite guidate.
const aimHint = new AimHint(container);
const SCREEN_CENTER = new THREE.Vector2(0, 0);
let elapsed = 0;
museum.onUpdate((delta) => {
  rooms.update(museum.camera.position, delta);
  viewer.update(delta);
  const exploring = controls.enabled && !tour.isActive;
  const hit = exploring ? pickArtworkPart(SCREEN_CENTER, museum.camera, rooms.artworksRoot) : null;
  const looked = hit?.group ?? null;
  const near = looked !== null && isNear(looked);
  const focused = viewer.group ?? (near ? looked : null);
  card.update(focused, exploring || (viewer.isActive && viewer.infoVisible), viewer.isActive);
  minimap.update(museum.camera, focused && artworkOf(focused).id, exploring);
  roomMap.update(museum.camera);
  aimHint.update(controls.isLocked && exploring, aimTarget(hit, near));
  elapsed += delta;
  animateTourBadges(elapsed);
});

/** L'invito sotto il mirino: il pulsante dell'audioguida la avvia, il quadro si apre a tutto schermo; da lontano, avvicinarsi. */
function aimTarget(hit: { group: THREE.Object3D; part: ArtworkPart } | null, near: boolean): AimTarget {
  if (!hit) return 'none';
  if (hit.part === 'badge') return near ? 'tour-near' : 'tour-far';
  if (near) return 'view-near';
  return artworkOf(hit.group).tour?.length ? 'tour-far' : 'none';
}

/** Apre la mappa grande della sala in cui si trova il visitatore, se sta esplorando. Restituisce true se l'ha aperta. */
function openRoomMap(): boolean {
  const room = rooms.current;
  if (!room || !controls.enabled || tour.isActive || viewer.isActive || roomMap.isOpen) return false;
  roomMap.open(minimapRoom(room, rooms.rooms.length));
  return true;
}

// Su PC il tasto M apre la mappa grande; a chiuderla ci pensa la mappa stessa, con M o con Esc.
document.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyM' || event.repeat || event.defaultPrevented || event.target instanceof HTMLInputElement) return;
  if (openRoomMap()) event.preventDefault();
});

// Su PC Invio fa come il pulsante della scheda: l'audioguida se il quadro ce l'ha, altrimenti la vista a tutto schermo.
// Anche dalla vista a tutto schermo Invio fa partire l'audioguida.
document.addEventListener('keydown', (event) => {
  if (event.code !== 'Enter' || event.repeat || event.target instanceof HTMLButtonElement || tour.isActive) return;
  const viewing = viewer.group;
  if (viewing) {
    if (!artworkOf(viewing).tour?.length) return;
    startTour(viewing);
  } else {
    if (!controls.enabled || !card.current) return;
    openArtwork(card.current);
  }
  event.preventDefault();
});

museum.start();

// Il catalogo (solo i dati e le miniature, non le immagini grandi) arriva da Sanity: serve al menu per proporre le tappe.
loadArtworks(settings.sanity, MOVEMENTS.map((movement) => movement.id))
  .then((artworks) => {
    catalog = artworks;
    startScreen.setCatalog(movementFacets(artworks, MOVEMENTS));
  })
  .catch((error: unknown) => {
    console.error('Impossibile caricare le opere:', error);
    startScreen.setCatalogError();
  });

// In sviluppo `museum`, `controls`, `rooms`, `tour`, `viewer`, `roomMap` e `startScreen` sono raggiungibili dalla console del browser, per il debug.
if (import.meta.env.DEV) Object.assign(window, { museum, controls, rooms, tour, viewer, roomMap, startScreen });
