import './style.css';
import { loadArtworks } from './artworks/artworksData';
import { hangArtworks } from './artworks/hangArtworks';
import { PlayerControls } from './controls/PlayerControls';
import { settings } from './data/settings';
import { Museum } from './scene/Museum';
import { createReflectionMap } from './scene/reflections';
import { createRoom } from './scene/Room';
import { createControlsHint } from './ui/ControlsHint';

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

museum.start();

// Le opere arrivano da un file JSON: si aggiungono alla scena appena caricate.
loadArtworks(`${import.meta.env.BASE_URL}data/artworks.json`)
  .then((artworks) => hangArtworks(artworks, room, { maxAnisotropy, reflections, ...settings.artworks }))
  .then((artworks) => museum.scene.add(artworks))
  .catch((error: unknown) => console.error('Impossibile caricare le opere:', error));

// In sviluppo `museum` e `controls` sono raggiungibili dalla console del browser, per il debug.
if (import.meta.env.DEV) Object.assign(window, { museum, controls });
