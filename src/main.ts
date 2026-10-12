import * as THREE from 'three';
import './style.css';
import { loadArtworks } from './artworks/artworksData';
import { hangArtworks } from './artworks/hangArtworks';
import { artworkOf, pickArtwork, pointerFromEvent } from './artworks/pickArtwork';
import { isNearArtwork } from './artworks/proximity';
import { animateTourBadges } from './artworks/tourBadge';
import { PlayerControls } from './controls/PlayerControls';
import { settings } from './data/settings';
import { Museum } from './scene/Museum';
import { createReflectionMap } from './scene/reflections';
import { createRoom } from './scene/Room';
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

const room = createRoom({ room: settings.room, lights: settings.lights, barriers: settings.barriers, maxAnisotropy, reflections });
museum.scene.add(room.group);

// Si parte dal lato sud, guardando la sala, all'interno delle transenne.
museum.camera.position.set(0, settings.camera.eyeHeight, settings.room.depth / 2 - settings.barriers.distance - 1.5);
const controls = new PlayerControls(museum.camera, museum.renderer.domElement, room.colliders, settings.player);
museum.onUpdate((delta) => controls.update(delta));

// In alto a destra: la mappa e, sotto, il pulsante che riapre le istruzioni.
const hud = document.createElement('div');
hud.className = 'hud';
container.append(hud);
const minimap = new Minimap(hud, { ...settings.room, barrierDistance: settings.barriers.distance, walls: room.walls });
const startScreen = new StartScreen(container, hud, controls);
createControlsHint(container, controls);

// Scheda, visita guidata e vista ravvicinata si aprono solo stando vicino al cordone davanti al quadro.
const reach = settings.barriers.distance + settings.barriers.maxDistanceFromRope;
const isNear = (group: THREE.Object3D) => isNearArtwork(group, museum.camera.position, reach);

// Clic (o tocco) su un quadro: la visita guidata se ha delle tappe, altrimenti la vista ravvicinata.
const toast = new Toast(container);
const card = new ArtworkCard(container, controls, {
  startTour: (group) => tour.requestStart(group),
  view: (group) => viewer.requestStart(group),
});
const tour = new GuidedTour({ museum, controls, toast, parent: container, reach, options: settings.tour });
const viewer = new ArtworkViewer({ museum, controls, toast, parent: container, reach, options: settings.viewer });
controls.onTap = (pointer) => tour.handleTap(pointer) || viewer.handleTap(pointer);

/** Avvia l'azione del quadro: la visita guidata se ce l'ha, altrimenti la vista ravvicinata. */
const openArtwork = (group: THREE.Object3D) => (artworkOf(group).tour?.length ? tour.requestStart(group) : viewer.requestStart(group));

// A ogni frame: scheda (del quadro guardato al centro dello schermo, o di quello nella vista ravvicinata),
// mappa, mirino e bollini delle visite guidate.
const aimHint = new AimHint(container);
const SCREEN_CENTER = new THREE.Vector2(0, 0);
let artworksRoot: THREE.Object3D | null = null;
let elapsed = 0;
museum.onUpdate((delta) => {
  viewer.update(delta);
  const exploring = controls.enabled && !tour.isActive;
  const looked = exploring && artworksRoot ? pickArtwork(SCREEN_CENTER, museum.camera, artworksRoot) : null;
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
  if (event.pointerType !== 'mouse' || controls.isLocked || !controls.enabled || !artworksRoot) return;
  const group = pickArtwork(pointerFromEvent(event, museum.renderer.domElement), museum.camera, artworksRoot);
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

// Le opere arrivano da Sanity: si aggiungono alla scena appena caricate.
loadArtworks(settings.sanity)
  .then((artworks) =>
    hangArtworks(artworks, room, {
      maxAnisotropy,
      reflections,
      ...settings.artworks,
      onProgress: (loaded, total) => startScreen.setProgress(loaded, total),
    }),
  )
  .then((artworks) => {
    museum.scene.add(artworks);
    tour.setArtworks(artworks);
    viewer.setArtworks(artworks);
    artworksRoot = artworks;
    const hung = artworks.children.map(artworkOf);
    minimap.setArtworks(hung);
    startScreen.setReady(hung);
  })
  .catch((error: unknown) => {
    console.error('Impossibile caricare le opere:', error);
    toast.show('Impossibile caricare le opere: riprova più tardi', 8000);
    startScreen.setError();
  });

// In sviluppo `museum`, `controls`, `tour`, `viewer` e `startScreen` sono raggiungibili dalla console del browser, per il debug.
if (import.meta.env.DEV) Object.assign(window, { museum, controls, tour, viewer, startScreen });
