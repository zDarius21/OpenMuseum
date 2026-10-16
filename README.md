# OpenMuseum – 3D Virtual Museum

A 3D virtual museum you can walk through in the browser, on desktop and mobile. Pick the art movements you want to walk through, and the museum builds a sequence of small rooms to explore in first person, each painting shown at its real size with a gilded frame, a spotlight and a wall label. Walk up to the rope in front of a painting and click it to see it full screen, or press the gold "Audioguida" button above its label to start the audio guide: the camera glides in and zooms on its details while a narrator reads the explanation aloud (available for 27 key works, at least three for every art movement).
The museum can be visited at https://www.open-museum-tau.vercel.app

## Features

- **Route builder:** the start page lays out the art movements on a timeline, from the Renaissance to Impressionism; each movement you pick becomes a stop of the route, in historical order, and turns into one room (or more, when it has more works than a room holds). Below the timeline you see the artists and works of the open movement: every painting can be added to or removed from the route on its own, and the artist buttons pick or drop all the works of an artist at once. A search box finds works and artists across all movements: pick single works directly, or an artist to add or remove all of their works, in every movement, at once. A live summary shows how many stops, works and rooms you'll get. Rooms are square, at least 10 × 10 m, and grow only when their paintings need more wall; the paintings hang chronologically on the walls without doors.
- **Rooms connected by doors:** the rooms are laid out on a near-square floor plan instead of a single corridor: the route winds north through one column of rooms, turns, comes back south through the next, and so on. Walk from one room to the next; a sign above each door names the room beyond it, and a banner announces the room you enter. Walls come in three quiet tones (gray, light green and beige), changing from one art movement to the next.
- **Progressive loading:** only the rooms around the visitor are built, and only the current and adjacent rooms download their images; farther rooms are taken down and their textures freed. While the visitor is still choosing the route, the images of the chosen works already download in the background, in room order, so the first room is often ready as soon as the museum is created. A fixed pool of spotlights, one per painting a room can hold, follows the visitor from room to room, so the lighting cost stays that of a single room and no shaders are recompiled.
- **Welcome screen:** after the route page, shows how to move, look around and start a tour, with instructions tailored to desktop or touch screens and a progress bar while the first room loads. The `?` button opens it again at any time, and lets you change the route and rebuild the museum.
- **Artwork info card:** standing at the rope in front of a painting and looking at it opens a card with its author, title, date, size, location and a short description, plus a large button with headphones to start its audio guide, if it has one, or one for the close-up view (`Enter` on desktop).
- **Close-up view:** standing at the rope, clicking or tapping any painting fills the screen with it, centered, with no narration and its info card on top (the `i` button hides it). Zoom toward any point with the mouse wheel, a pinch or a double click, drag to explore the details, and press `Esc` or the close button to step back to where you were. For paintings with an audio guide, the card's button (or `Enter`) starts it from there, and at the end brings you back to the rope.
- **Minimap:** a top-down map of the current room, with its doors, shows where you are and which way you are looking, with the painting whose card is open highlighted and the room's name below. Clicking or tapping it (or pressing `M`) enlarges it: the works are numbered in front of their wall, in gold those with a guided tour, next to a list with title, artist and date; hovering a work in the list or on the map highlights it in both.
- **Audio guide button:** paintings with a guided tour have a gold "Audioguida" button with headphones above their label, with a pulsing outline; clicking or tapping it from the rope starts the tour. They are also marked in gold on the minimap.
- **Guided tours (audio guide):** the audio guide button above the label, or the one in the info card, starts a step-by-step tour while standing near the rope (from farther away, a hint asks you to come closer). For each step the camera animates to a detail defined in the artwork's data, the detail is highlighted, and a subtitle is shown and read aloud with the Web Speech API. The tour advances on its own and can be paused, stepped back and forth, or closed (keyboard: arrows, `Space`, `Esc`).
- **First-person exploration** with keyboard and mouse on desktop, and a virtual joystick plus drag-to-look on touch screens.
- **Collisions** with walls and velvet-rope barriers that keep visitors at a realistic distance from the paintings.
- **Content managed in a headless CMS:** artworks, images and guided tours live in [Sanity](https://www.sanity.io) and are edited in Sanity Studio, a web form with validation. A published change shows up in the museum on the next page load, with no rebuild or redeploy. Frame, spotlight and label are generated automatically from the data.
- **Optimized images:** paintings are served by Sanity's image CDN, capped at 2048 px on the longer side and converted to WebP or AVIF when the browser supports them.
- **Robust content loading:** invalid entries are skipped with a clear console warning, a placeholder image is used if a picture fails to load, and a message appears if the content can't be reached.
- **Procedural assets:** the parquet floor and placeholder images are drawn in code, keeping downloads small.
- **Configurable:** room size, how many rooms are built and loaded around the visitor, menu options, lighting, barriers, movement speed, field of view and tour timing live in a single settings file.

The in-app interface (labels, hints, console messages) is in Italian.

## Tech stack

| Component        | Choice                                        |
| ---------------- | --------------------------------------------- |
| 3D graphics      | [Three.js](https://threejs.org)               |
| Build & language | [Vite](https://vite.dev) + TypeScript         |
| Camera animation | [GSAP](https://gsap.com)                      |
| Narration        | Web Speech API (built into the browser)       |
| Content          | [Sanity](https://www.sanity.io) (headless CMS) + public domain images |
| Hosting          | GitHub Pages or Vercel                        |

## Getting started

Requirements: [Node.js](https://nodejs.org) 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

To try it on a phone connected to the same Wi-Fi network, run `npm run dev -- --host` and open the "Network" address shown in the terminal. That address must also be listed among the project's CORS origins (see [Deployment](#deployment)).

The artworks are read from the Sanity project configured in the `sanity` section of [`src/data/settings.ts`](src/data/settings.ts), so an internet connection is needed even in development.

## Controls

| Action        | Desktop                      | Phone / tablet                 |
| ------------- | ---------------------------- | ------------------------------ |
| Start         | Click the scene              | —                              |
| Move          | `W` `A` `S` `D` or arrow keys | Joystick in the bottom-left corner |
| Look around   | Mouse                        | Drag a finger on the screen    |
| Release mouse | `Esc`                        | —                              |
| Close-up      | Stand near the rope and click a painting | Stand near the rope, then tap the painting |
| Audio guide   | Stand near the rope and click the gold "Audioguida" button above the label, or press `Enter` (also from the close-up) | Tap the "Audioguida" button above the label, or the one on the info card |
| During a tour | Buttons, or `←` `→` to change step, `Space` to pause, `Esc` to exit | Buttons |
| Room map      | `M` to open and close (or click the minimap when the mouse is free), `Esc` to close | Tap the minimap |

## Settings

Room size, how many rooms are built and loaded around the visitor, the number of works per room, barriers, lighting, movement speed, field of view, guided tour timing and the Sanity project (`projectId`, `dataset`) can be changed in [`src/data/settings.ts`](src/data/settings.ts) without touching the rest of the code.

## Managing artworks

Artworks are edited in Sanity Studio, which lives in the [`studio/`](studio/) folder:

```bash
cd studio
npm install
npm run dev
```

Open <http://localhost:3333> and sign in with a Sanity account that has access to the project. To add a painting, create a new **Opera**, fill in the fields and press **Publish**: the museum shows it on the next page load. The Studio checks required fields and value ranges before publishing.

| Field (in the Studio) | Required | Meaning |
| --------------------- | -------- | ------- |
| Titolo                | yes      | Title of the artwork |
| Identificativo        | yes      | Unique short name, generated from the title |
| Larghezza, Altezza    | yes      | Real canvas size in meters, frame excluded |
| Immagine              | no       | The painting; if missing or not loadable, a placeholder is used |
| Corrente              | yes      | Art movement: the stop of the route, and the rooms, the work belongs to. The list lives in [`src/data/movements.ts`](src/data/movements.ts) (with each movement's color) and in the Studio schema |
| Autore                | no       | Author; the start page lets visitors pick artists one by one, so spell each name the same way |
| Anno                  | no       | Date, for example "1599 circa": its first year orders the paintings within the rooms |
| Dove è conservata     | no       | Museum and city, for example "Galleria Borghese, Roma" |
| Fonte dell'immagine   | no       | The page the image comes from |
| Descrizione           | no       | Two or three sentences about the work, shown in its info card |

### Guided tour

Add steps to the **Visita guidata** list of an artwork to give it a guided tour. Each step (**Tappa**) zooms on a detail:

| Field              | Required | Meaning |
| ------------------ | -------- | ------- |
| Centro x, Centro y | yes      | Center of the detail on the image, from 0 to 1 starting at the top-left corner |
| Zoom               | yes      | `1` shows the whole painting, `2` is twice as close, and so on |
| Testo              | yes      | Subtitle, also read aloud |
| Raggio evidenziato | no       | Radius of the highlighted area, as a fraction of the painting's longer side; by default it follows the zoom. Steps at zoom 1 are highlighted only if a radius is given |

Timing of the camera moves, the pause between steps, the voice speed and how close to the rope the visitor must be (`maxDistanceFromRope`) are in the `tour` section of the settings file.

Frame, spotlight and label (author, title and year, to the right of the painting) are created automatically. If a painting doesn't fit on its wall or overlaps another one, it is skipped and the browser console explains why.

## Scripts

| Command           | What it does                                              |
| ----------------- | --------------------------------------------------------- |
| `npm run dev`     | Development server with hot reload                        |
| `npm run build`   | TypeScript type check and production build into `dist/`   |
| `npm run preview` | Serves the production build locally                       |
| `npm run deploy`  | Builds and publishes to GitHub Pages (`gh-pages` branch)  |

In the `studio/` folder:

| Command           | What it does                                                   |
| ----------------- | -------------------------------------------------------------- |
| `npm run dev`     | Runs Sanity Studio at <http://localhost:3333>                  |
| `npm run deploy`  | Publishes the Studio online at `https://<name>.sanity.studio`  |

## Project structure

```
src/
├─ main.ts        Entry point: builds the museum and starts rendering
├─ style.css      Global styles
├─ scene/         Renderer, camera, render loop, room with doors, barriers
├─ controls/      First-person movement: keyboard, mouse, touch joystick, collisions
├─ rooms/         Route planning by art movement, room layout, progressive building and loading, spotlight pool
├─ artworks/      Artwork loading and validation, frames, labels, tour badges and click picking
├─ tour/          Guided tour: camera animation, detail highlight, narration
├─ viewer/        Close-up view: framing, zoom and pan
├─ ui/            On-screen interface: start page, minimap and room map, artwork card, crosshair, tour and close-up panels
├─ data/          Museum settings and the list of art movements
└─ utils/         Helper functions
studio/           Sanity Studio: the schema of the artworks and the editing interface
```

Scene units: 1 = 1 meter.

## Deployment

The museum reads the artworks from Sanity directly in the browser, so every address it is served from must be allowed in [sanity.io/manage](https://www.sanity.io/manage) under **API → CORS origins** (without credentials). Otherwise the museum opens without paintings.

### GitHub Pages

1. Run `npm run deploy`: the build is published to the `gh-pages` branch.
2. On GitHub, under **Settings → Pages**, select the `gh-pages` branch as the source.

The site will be available at `https://<user>.github.io/<repo>/`. The build uses relative paths, so it works from a subfolder with no extra configuration.

### Vercel

Import the repository on [vercel.com](https://vercel.com): Vite is detected automatically (build command `npm run build`, output folder `dist`).

## Credits

The artwork images are reproductions of public domain paintings from [Wikimedia Commons](https://commons.wikimedia.org). Each source is also recorded in the artwork's *Fonte dell'immagine* field in Sanity.
