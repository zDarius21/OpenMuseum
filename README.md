# OpenMuseum – 3D Virtual Museum

A 3D virtual museum you can walk through in the browser, on desktop and mobile. Explore a gallery of Caravaggio's paintings in first person, each shown at its real size with a gilded frame, a dedicated spotlight and a wall label. Walk up to the rope in front of a painting and click it to start a guided tour: the camera glides in and zooms on its details while a narrator reads the explanation aloud (currently available for *The Calling of Saint Matthew*).

## Features

- **Guided tours:** clicking or tapping a painting while standing near its rope starts a step-by-step tour (from farther away, a hint asks you to come closer). For each step the camera animates to a detail defined in the JSON, the detail is highlighted, and a subtitle is shown and read aloud with the Web Speech API. The tour advances on its own and can be paused, stepped back and forth, or closed (keyboard: arrows, `Space`, `Esc`).
- **First-person exploration** with keyboard and mouse on desktop, and a virtual joystick plus drag-to-look on touch screens.
- **Collisions** with walls and velvet-rope barriers that keep visitors at a realistic distance from the paintings.
- **Data-driven artworks:** paintings are loaded from a JSON file, so adding one requires no code changes. Frame, spotlight and label are generated automatically from the data.
- **Robust content loading:** invalid entries are skipped with a clear console warning, and a placeholder image is used if a picture fails to load.
- **Procedural assets:** the parquet floor and placeholder images are drawn in code, keeping downloads small.
- **Configurable:** room size, lighting, barriers, movement speed, field of view and tour timing live in a single settings file.

The in-app interface (labels, hints, console messages) is in Italian.

## Tech stack

| Component        | Choice                                        |
| ---------------- | --------------------------------------------- |
| 3D graphics      | [Three.js](https://threejs.org)               |
| Build & language | [Vite](https://vite.dev) + TypeScript         |
| Camera animation | [GSAP](https://gsap.com)                      |
| Narration        | Web Speech API (built into the browser)       |
| Content          | JSON file + public domain images              |
| Hosting          | GitHub Pages or Vercel                        |

## Getting started

Requirements: [Node.js](https://nodejs.org) 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

To try it on a phone connected to the same Wi-Fi network, run `npm run dev -- --host` and open the "Network" address shown in the terminal.

## Controls

| Action        | Desktop                      | Phone / tablet                 |
| ------------- | ---------------------------- | ------------------------------ |
| Start         | Click the scene              | —                              |
| Move          | `W` `A` `S` `D` or arrow keys | Joystick in the bottom-left corner |
| Look around   | Mouse                        | Drag a finger on the screen    |
| Release mouse | `Esc`                        | —                              |
| Guided tour   | Stand near the rope of a painting marked "▶ Visita guidata" on its label, then click it | Stand near the rope, then tap the painting |
| During a tour | Buttons, or `←` `→` to change step, `Space` to pause, `Esc` to exit | Buttons |

## Settings

Room size, barriers, lighting, movement speed, field of view and guided tour timing can be changed in [`src/data/settings.ts`](src/data/settings.ts) without touching the rest of the code.

## Adding a painting

Artworks are listed in [`public/data/artworks.json`](public/data/artworks.json). To add one, add an entry; no code changes are needed.

```json
{
  "id": "arnolfini-portrait",
  "title": "The Arnolfini Portrait",
  "author": "Jan van Eyck",
  "year": 1434,
  "image": "images/arnolfini-portrait.jpg",
  "width": 0.6,
  "height": 0.82,
  "wall": "nord",
  "position": -2.5,
  "source": "https://commons.wikimedia.org/wiki/File:..."
}
```

| Field          | Required | Meaning                                                                       |
| -------------- | -------- | ----------------------------------------------------------------------------- |
| `id`           | yes      | Unique identifier, no spaces                                                  |
| `title`        | yes      | Title of the artwork                                                          |
| `wall`         | yes      | Wall: `nord` (north, facing the entrance), `sud` (south), `est` (east, right), `ovest` (west, left) |
| `position`     | yes      | Meters from the center of the wall, positive to the right when facing it      |
| `width`, `height` | yes   | Real canvas size in meters, frame excluded                                    |
| `centerHeight` | no       | Height of the painting's center from the floor (default 1.55 m)               |
| `image`        | no       | Image inside `public/`; if missing or not loadable, a placeholder is used     |
| `author`, `year`, `location`, `source` | no | Author, year, museum that holds the work, and the page the image comes from |

### Guided tour

Add a `tour` list to an artwork to give it a guided tour. Each step zooms on a detail:

```json
"tour": [
  { "x": 0.5, "y": 0.5, "zoom": 1, "text": "Overview of the painting…" },
  { "x": 0.76, "y": 0.41, "zoom": 2.4, "radius": 0.15, "text": "Christ's hand recalls Adam's in Michelangelo's Creation…" }
]
```

| Field    | Required | Meaning                                                                                 |
| -------- | -------- | --------------------------------------------------------------------------------------- |
| `x`, `y` | yes      | Center of the detail on the image, from 0 to 1 starting at the top-left corner         |
| `zoom`   | yes      | `1` shows the whole painting, `2` is twice as close, and so on                          |
| `text`   | yes      | Subtitle, also read aloud                                                               |
| `radius` | no       | Radius of the highlighted area, as a fraction of the painting's longer side; by default it follows the zoom. Steps at zoom 1 are highlighted only if a radius is given |

Timing of the camera moves, the pause between steps, the voice speed and how close to the rope the visitor must be (`maxDistanceFromRope`) are in the `tour` section of the settings file.

Frame, spotlight and label (author, title and year, to the right of the painting) are created automatically. If an entry has an error (a missing field, a painting that doesn't fit on its wall or overlaps another one), it is skipped and the browser console explains why. Invalid tour steps are skipped the same way, without affecting the rest of the tour.

## Scripts

| Command           | What it does                                              |
| ----------------- | --------------------------------------------------------- |
| `npm run dev`     | Development server with hot reload                        |
| `npm run build`   | TypeScript type check and production build into `dist/`   |
| `npm run preview` | Serves the production build locally                       |
| `npm run deploy`  | Builds and publishes to GitHub Pages (`gh-pages` branch)  |

## Project structure

```
src/
├─ main.ts        Entry point: builds the museum and starts rendering
├─ style.css      Global styles
├─ scene/         Renderer, camera, render loop, room, lights and barriers
├─ controls/      First-person movement: keyboard, mouse, touch joystick, collisions
├─ artworks/      Artwork loading and validation, frames, spotlights, labels and click picking
├─ tour/          Guided tour: camera animation, detail highlight, narration
├─ ui/            On-screen interface: controls hint, crosshair, tour panel
├─ data/          Museum settings
└─ utils/         Helper functions
public/
├─ data/          Content editable without rebuilding (artworks.json)
└─ images/        Artwork images
```

Scene units: 1 = 1 meter.

## Deployment

### GitHub Pages

1. Run `npm run deploy`: the build is published to the `gh-pages` branch.
2. On GitHub, under **Settings → Pages**, select the `gh-pages` branch as the source.

The site will be available at `https://<user>.github.io/<repo>/`. The build uses relative paths, so it works from a subfolder with no extra configuration.

### Vercel

Import the repository on [vercel.com](https://vercel.com): Vite is detected automatically (build command `npm run build`, output folder `dist`).

## Credits

The artwork images are reproductions of public domain paintings from [Wikimedia Commons](https://commons.wikimedia.org). Each source is also recorded in the `source` field of `artworks.json`.

| Artwork | Collection | Source |
| ------- | ---------- | ------ |
| Caravaggio, *Boy Bitten by a Lizard* (c. 1594–1595) | National Gallery, London | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_-_Boy_Bitten_by_a_Lizard.jpg) |
| Caravaggio, *Bacchus* (c. 1596) | Uffizi Gallery, Florence | [Commons](https://commons.wikimedia.org/wiki/File:Baco,_por_Caravaggio.jpg) |
| Caravaggio, *Basket of Fruit* (c. 1599) | Pinacoteca Ambrosiana, Milan | [Commons](https://commons.wikimedia.org/wiki/File:Basket_of_Fruit-Caravaggio_(c.1595).jpg) |
| Caravaggio, *The Calling of Saint Matthew* (1599–1600) | San Luigi dei Francesi, Rome | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_%E2%80%94_The_Calling_of_Saint_Matthew.jpg) |
| Caravaggio, *Judith Beheading Holofernes* (c. 1598–1599) | Palazzo Barberini, Rome | [Commons](https://commons.wikimedia.org/wiki/File:Judith_Beheading_Holofernes-Caravaggio_(c.1598-9).jpg) |
| Caravaggio, *Supper at Emmaus* (1601) | National Gallery, London | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_-_Supper_at_Emmaus_-_National_Gallery_London.jpeg) |
| Caravaggio, *The Incredulity of Saint Thomas* (1601–1602) | Bildergalerie, Potsdam | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_incredulity.jpg) |
| Caravaggio, *David with the Head of Goliath* (c. 1609–1610) | Galleria Borghese, Rome | [Commons](https://commons.wikimedia.org/wiki/File:David_with_the_Head_of_Goliath-Caravaggio_(1610).jpg) |
