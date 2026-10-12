import './style.css';
import { loadArtworks } from './artworks/artworksData';
import { hangArtworks } from './artworks/hangArtworks';
import { PlayerControls } from './controls/PlayerControls';
import { settings } from './data/settings';
import { Museum } from './scene/Museum';
import { createReflectionMap } from './scene/reflections';
import { createRoom } from './scene/Room';
import { GuidedTour } from './tour/GuidedTour';
import { AimHint } from './ui/AimHint';
import { createControlsHint } from './ui/ControlsHint';
import { Toast } from './ui/Toast';

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

createControlsHint(container, controls);

// Visita guidata: si apre con un clic (o un tocco) su un quadro che ha delle tappe,
// stando vicino al cordone davanti al quadro.
const toast = new Toast(container);
const tour = new GuidedTour({
  museum,
  controls,
  aimHint: new AimHint(container),
  toast,
  parent: container,
  ropeDistance: settings.barriers.distance,
  options: settings.tour,
});
controls.onTap = (pointer) => tour.handleTap(pointer);
museum.onUpdate(() => tour.update());

museum.start();

// Le opere arrivano da Sanity: si aggiungono alla scena appena caricate.
loadArtworks(settings.sanity)
  .then((artworks) => hangArtworks(artworks, room, { maxAnisotropy, reflections, ...settings.artworks }))
  .then((artworks) => {
    museum.scene.add(artworks);
    tour.setArtworks(artworks);
  })
  .catch((error: unknown) => {
    console.error('Impossibile caricare le opere:', error);
    toast.show('Impossibile caricare le opere: riprova più tardi', 8000);
  });

// In sviluppo `museum`, `controls` e `tour` sono raggiungibili dalla console del browser, per il debug.
if (import.meta.env.DEV) Object.assign(window, { museum, controls, tour });
