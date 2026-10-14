# OpenMuseum – 3D Virtual Museum

A 3D virtual museum you can walk through in the browser, on desktop and mobile. Choose which paintings to see and how to group them, and the museum builds a sequence of small rooms to explore in first person, each painting shown at its real size with a gilded frame, a spotlight and a wall label. Walk up to the rope in front of a painting and click it to start a guided tour: the camera glides in and zooms on its details while a narrator reads the explanation aloud (currently available for *The Calling of Saint Matthew*).

## Features

- **Visit builder:** the start menu filters the collection by period, city and guided tours, and groups the paintings into rooms by period or by city, with 4, 6 or 8 works per room; a live summary shows how many works and rooms you'll get. Each room's length adapts to the paintings it holds, which are hung chronologically on the two long walls.
- **Rooms connected by doors:** walk from one room to the next; a sign above each door names the room beyond it, and a banner announces the room you enter.
- **Progressive loading:** only the rooms around the visitor are built, and only the current and adjacent rooms download their images; farther rooms are taken down and their textures freed. A fixed pool of eight spotlights follows the visitor from room to room, so the lighting cost stays that of a single room and no shaders are recompiled.
- **Welcome screen:** after the menu, shows how to move, look around and start a tour, with instructions tailored to desktop or touch screens and a progress bar while the first room loads. The `?` button opens it again at any time, and lets you change the filters and rebuild the museum.
- **Artwork info card:** standing at the rope in front of a painting and looking at it opens a card with its author, title, date, size, location and a short description, plus a button to start its guided tour or, for paintings without one, the close-up view (`Enter` on desktop).
- **Close-up view:** standing at the rope, clicking or tapping a painting without a guided tour fills the screen with it, centered, with its info card on top (the `i` button hides it). Zoom toward any point with the mouse wheel, a pinch or a double click, drag to explore the details, and press `Esc` or the close button to step back to where you were.
- **Minimap:** a top-down map of the current room, with its doors, shows where you are and which way you are looking, with the painting whose card is open highlighted and the room's name below.
- **Guided tour markers:** paintings with a tour have a gold ▶ badge with a pulsing ring next to their label, and are marked in gold on the minimap.
- **Guided tours:** clicking or tapping a painting while standing near its rope, or using the button in its info card, starts a step-by-step tour (from farther away, a hint asks you to come closer). For each step the camera animates to a detail defined in the artwork's data, the detail is highlighted, and a subtitle is shown and read aloud with the Web Speech API. The tour advances on its own and can be paused, stepped back and forth, or closed (keyboard: arrows, `Space`, `Esc`).
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
| Guided tour   | Stand near the rope of a painting marked "▶ Visita guidata" on its label, then click it | Stand near the rope, then tap the painting |
| During a tour | Buttons, or `←` `→` to change step, `Space` to pause, `Esc` to exit | Buttons |

## Settings

Room size, how many rooms are built and loaded around the visitor, the menu options, barriers, lighting, movement speed, field of view, guided tour timing and the Sanity project (`projectId`, `dataset`) can be changed in [`src/data/settings.ts`](src/data/settings.ts) without touching the rest of the code.

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
| Anno                  | no       | Date, for example "1599 circa": its first year orders the paintings and drives the period filter |
| Dove è conservata     | no       | Museum and city separated by a comma, for example "Galleria Borghese, Roma": the city drives the city filter and the rooms by city |
| Autore, Fonte dell'immagine | no | Author, and the page the image comes from |
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
├─ rooms/         Visit filters, grouping into rooms, room layout, progressive building and loading, spotlight pool
├─ artworks/      Artwork loading and validation, frames, labels, tour badges and click picking
├─ tour/          Guided tour: camera animation, detail highlight, narration
├─ viewer/        Close-up view: framing, zoom and pan
├─ ui/            On-screen interface: start menu, minimap, artwork card, crosshair, tour and close-up panels
├─ data/          Museum settings
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

| Artwork | Collection | Source |
| ------- | ---------- | ------ |
| Caravaggio, *Young Sick Bacchus* (c. 1593–1594) | Galleria Borghese, Rome | [Commons](https://commons.wikimedia.org/wiki/File:Young_Sick_Bacchus-Caravaggio_(1593).jpg) |
| Caravaggio, *Boy with a Basket of Fruit* (c. 1593–1594) | Galleria Borghese, Rome | [Commons](https://commons.wikimedia.org/wiki/File:Boy_with_a_Basket_of_Fruit-Caravaggio_(1593).jpg) |
| Caravaggio, *The Fortune Teller* (c. 1594) | Capitoline Museums, Rome | [Commons](https://commons.wikimedia.org/wiki/File:The_Fortune_Teller-Caravaggio_(Rome).jpg) |
| Caravaggio, *Boy Bitten by a Lizard* (c. 1594–1595) | National Gallery, London | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_-_Boy_Bitten_by_a_Lizard.jpg) |
| Caravaggio, *The Cardsharps* (c. 1594–1595) | Kimbell Art Museum, Fort Worth | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_-_The_Cardsharps_(1596-97)_Kimbell_Art_Museum.jpg) |
| Caravaggio, *Penitent Magdalene* (c. 1594–1596) | Galleria Doria Pamphilj, Rome | [Commons](https://commons.wikimedia.org/wiki/File:Penitent_Magdalene-Caravaggio_(1594-6).jpg) |
| Caravaggio, *The Lute Player* (c. 1596) | Hermitage Museum, Saint Petersburg | [Commons](https://commons.wikimedia.org/wiki/File:Michelangelo_Caravaggio_020.jpg) |
| Caravaggio, *Bacchus* (c. 1596) | Uffizi Gallery, Florence | [Commons](https://commons.wikimedia.org/wiki/File:Baco,_por_Caravaggio.jpg) |
| Caravaggio, *The Musicians* (c. 1597) | Metropolitan Museum of Art, New York | [Commons](https://commons.wikimedia.org/wiki/File:The_Musicians_MET_DP-687-001.jpg) |
| Caravaggio, *Rest on the Flight into Egypt* (c. 1597) | Galleria Doria Pamphilj, Rome | [Commons](https://commons.wikimedia.org/wiki/File:Rest_on_the_Flight_into_Egypt-Caravaggio_(c.1597).jpg) |
| Caravaggio, *Basket of Fruit* (c. 1599) | Pinacoteca Ambrosiana, Milan | [Commons](https://commons.wikimedia.org/wiki/File:Basket_of_Fruit-Caravaggio_(c.1595).jpg) |
| Caravaggio, *Saint Catherine of Alexandria* (c. 1598–1599) | Thyssen-Bornemisza Museum, Madrid | [Commons](https://commons.wikimedia.org/wiki/File:Saint_Catherine_of_Alexandria_(Caravaggio).jpg) |
| Caravaggio, *The Calling of Saint Matthew* (1599–1600) | San Luigi dei Francesi, Rome | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_%E2%80%94_The_Calling_of_Saint_Matthew.jpg) |
| Caravaggio, *The Inspiration of Saint Matthew* (1602) | San Luigi dei Francesi, Rome | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_-_La_inspiraci%C3%B3n_de_San_Mateo_(San_Luigi_dei_Francesi,_Roma).jpg) |
| Caravaggio, *The Martyrdom of Saint Matthew* (1599–1600) | San Luigi dei Francesi, Rome | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_%E2%80%94_The_Martyrdom_of_Saint_Matthew.jpg) |
| Caravaggio, *Judith Beheading Holofernes* (c. 1598–1599) | Palazzo Barberini, Rome | [Commons](https://commons.wikimedia.org/wiki/File:Judith_Beheading_Holofernes-Caravaggio_(c.1598-9).jpg) |
| Caravaggio, *Crucifixion of Saint Peter* (1601) | Santa Maria del Popolo, Rome | [Commons](https://commons.wikimedia.org/wiki/File:Crucifixion_of_Saint_Peter-Caravaggio_(c.1600).jpg) |
| Caravaggio, *Conversion on the Way to Damascus* (1601) | Santa Maria del Popolo, Rome | [Commons](https://commons.wikimedia.org/wiki/File:Conversion_on_the_Way_to_Damascus-Caravaggio_(c.1600-1).jpg) |
| Caravaggio, *Supper at Emmaus* (1601) | National Gallery, London | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_-_Supper_at_Emmaus_-_National_Gallery_London.jpeg) |
| Caravaggio, *The Incredulity of Saint Thomas* (1601–1602) | Bildergalerie, Potsdam | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_incredulity.jpg) |
| Caravaggio, *Amor Vincit Omnia* (1601–1602) | Gemäldegalerie, Berlin | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_-_Cupid_as_Victor_-_Google_Art_Project.jpg) |
| Caravaggio, *The Taking of Christ* (1602) | National Gallery of Ireland, Dublin | [Commons](https://commons.wikimedia.org/wiki/File:The_Taking_of_Christ-Caravaggio_(c.1602).jpg) |
| Caravaggio, *Sacrifice of Isaac* (c. 1603) | Uffizi Gallery, Florence | [Commons](https://commons.wikimedia.org/wiki/File:Sacrifice_of_Isaac-Caravaggio_(Uffizi).jpg) |
| Caravaggio, *The Entombment of Christ* (1603–1604) | Pinacoteca Vaticana, Vatican City | [Commons](https://commons.wikimedia.org/wiki/File:The_Entombment_of_Christ-Caravaggio_(c.1602-3).jpg) |
| Caravaggio, *Madonna of Loreto* (1604–1606) | Sant'Agostino, Rome | [Commons](https://commons.wikimedia.org/wiki/File:Madonna_di_Loreto-Caravaggio_(c.1604-6).jpg) |
| Caravaggio, *Supper at Emmaus* (1606) | Pinacoteca di Brera, Milan | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_%E2%80%94_Supper_at_Emmaus.jpg) |
| Caravaggio, *The Flagellation of Christ* (1607) | Museo di Capodimonte, Naples | [Commons](https://commons.wikimedia.org/wiki/File:The_Flagellation_of_Christ-Caravaggio_(1607).jpg) |
| Caravaggio, *David with the Head of Goliath* (c. 1609–1610) | Galleria Borghese, Rome | [Commons](https://commons.wikimedia.org/wiki/File:David_with_the_Head_of_Goliath-Caravaggio_(1610).jpg) |
| Caravaggio, *The Denial of Saint Peter* (1610) | Metropolitan Museum of Art, New York | [Commons](https://commons.wikimedia.org/wiki/File:The_Denial_of_Saint_Peter_MET_DP-12413-001.jpg) |
| Caravaggio, *The Martyrdom of Saint Ursula* (1610) | Gallerie d'Italia, Naples | [Commons](https://commons.wikimedia.org/wiki/File:The_Martyrdom_of_Saint_Ursula-Caravaggio_(1610).jpg) |
