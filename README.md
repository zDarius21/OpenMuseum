# OpenMuseum – 3D Virtual Museum

A 3D virtual museum you can walk through in the browser, on desktop and mobile. Pick the art movements you want to walk through, and the museum builds a sequence of small rooms to explore in first person, each painting shown at its real size with a gilded frame, a spotlight and a wall label. Walk up to the rope in front of a painting and click it to start a guided tour: the camera glides in and zooms on its details while a narrator reads the explanation aloud (currently available for *The Calling of Saint Matthew*).

## Features

- **Route builder:** the start page lays out the art movements on a timeline, from the Renaissance to Impressionism; each movement you pick becomes a stop of the route, in historical order, and turns into one room (or more, when it has more works than a room holds). Below the timeline you see the artists and works of the open movement: every painting can be added to or removed from the route on its own, and the artist buttons pick or drop all the works of an artist at once. A search box finds works and artists across all movements: pick single works directly, or an artist to add or remove all of their works, in every movement, at once. A live summary shows how many stops, works and rooms you'll get. Each room's length adapts to the paintings it holds, which are hung chronologically on the two long walls.
- **Rooms connected by doors:** walk from one room to the next; a sign above each door names the room beyond it, and a banner announces the room you enter.
- **Progressive loading:** only the rooms around the visitor are built, and only the current and adjacent rooms download their images; farther rooms are taken down and their textures freed. While the visitor is still choosing the route, the images of the chosen works already download in the background, in room order, so the first room is often ready as soon as the museum is created. A fixed pool of spotlights, one per painting a room can hold, follows the visitor from room to room, so the lighting cost stays that of a single room and no shaders are recompiled.
- **Welcome screen:** after the route page, shows how to move, look around and start a tour, with instructions tailored to desktop or touch screens and a progress bar while the first room loads. The `?` button opens it again at any time, and lets you change the route and rebuild the museum.
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
├─ ui/            On-screen interface: start page, minimap, artwork card, crosshair, tour and close-up panels
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
| Sandro Botticelli, *The Birth of Venus* (c. 1485) | Uffizi Gallery, Florence | [Commons](https://commons.wikimedia.org/wiki/File:Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg) |
| Sandro Botticelli, *Primavera* (c. 1480) | Uffizi Gallery, Florence | [Commons](https://commons.wikimedia.org/wiki/File:Sandro_Botticelli_-_La_Primavera_-_Google_Art_Project.jpg) |
| Leonardo da Vinci, *Mona Lisa* (1503–1519) | Louvre, Paris | [Commons](https://commons.wikimedia.org/wiki/File:Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg) |
| Leonardo da Vinci, *Annunciation* (c. 1472–1475) | Uffizi Gallery, Florence | [Commons](https://commons.wikimedia.org/wiki/File:Annunciation_%28Leonardo%29_%28cropped%29.jpg) |
| Raphael, *The Marriage of the Virgin* (1504) | Pinacoteca di Brera, Milan | [Commons](https://commons.wikimedia.org/wiki/File:Raffaello_-_Spozalizio_-_Web_Gallery_of_Art.jpg) |
| Titian, *Venus of Urbino* (1538) | Uffizi Gallery, Florence | [Commons](https://commons.wikimedia.org/wiki/File:Tiziano%27s_Venere_di_Urbino_%28from_The_History_BLog%29.jpg) |
| Giorgione, *The Tempest* (c. 1505) | Gallerie dell'Accademia, Venice | [Commons](https://commons.wikimedia.org/wiki/File:Giorgione_-_Das_Gewitter.jpg) |
| Andrea Mantegna, *Lamentation of Christ* (c. 1480) | Pinacoteca di Brera, Milan | [Commons](https://commons.wikimedia.org/wiki/File:Lamentaci%C3%B3n_sobre_Cristo_muerto,_por_Andrea_Mantegna.jpg) |
| Jan van Eyck, *Arnolfini Portrait* (1434) | National Gallery, London | [Commons](https://commons.wikimedia.org/wiki/File:Van_Eyck_-_Arnolfini_Portrait.jpg) |
| Albrecht Dürer, *Self-Portrait with Fur-Trimmed Robe* (1500) | Alte Pinakothek, Munich | [Commons](https://commons.wikimedia.org/wiki/File:D%C3%BCrer_Alte_Pinakothek.jpg) |
| Piero della Francesca, *The Baptism of Christ* (c. 1448–1450) | National Gallery, London | [Commons](https://commons.wikimedia.org/wiki/File:Piero_della_Francesca_-_Battesimo_di_Cristo_%28National_Gallery,_London%29.jpg) |
| Pontormo, *Deposition from the Cross* (1525–1528) | Santa Felicita, Florence | [Commons](https://commons.wikimedia.org/wiki/File:Jacopo_Pontormo_-_Kreuzabnahme_Christi.jpg) |
| Bronzino, *Venus, Cupid, Folly and Time* (c. 1545) | National Gallery, London | [Commons](https://commons.wikimedia.org/wiki/File:Angelo_Bronzino_-_Venus,_Cupid,_Folly_and_Time_-_National_Gallery,_London.jpg) |
| Bronzino, *Portrait of Eleanor of Toledo with Her Son Giovanni* (c. 1545) | Uffizi Gallery, Florence | [Commons](https://commons.wikimedia.org/wiki/File:Bronzino_-_Eleonora_di_Toledo_col_figlio_Giovanni_-_Google_Art_Project.jpg) |
| Parmigianino, *Madonna with the Long Neck* (1534–1540) | Uffizi Gallery, Florence | [Commons](https://commons.wikimedia.org/wiki/File:Parmigianino_-_Madonna_and_Child_with_Angels,_known_as_the_Madonna_with_the_Long_Neck.jpg) |
| Rosso Fiorentino, *Spedalingo Altarpiece* (1518) | Uffizi Gallery, Florence | [Commons](https://commons.wikimedia.org/wiki/File:Rosso_Fiorentino_-_Spedalingo_Altarpiece_-_Google_Art_Project.jpg) |
| El Greco, *View of Toledo* (c. 1599–1600) | Metropolitan Museum of Art, New York | [Commons](https://commons.wikimedia.org/wiki/File:View_of_Toledo_MET_DP349564.jpg) |
| El Greco, *Laocoön* (c. 1610–1614) | National Gallery of Art, Washington | [Commons](https://commons.wikimedia.org/wiki/File:El_Greco_%28Domenikos_Theotokopoulos%29_-_Laoco%C3%B6n_-_Google_Art_Project.jpg) |
| Tintoretto, *Susanna and the Elders* (1555–1556) | Kunsthistorisches Museum, Vienna | [Commons](https://commons.wikimedia.org/wiki/File:Jacopo_Robusti,_called_Tintoretto_-_Susanna_and_the_Elders_-_Google_Art_Project.jpg) |
| Giuseppe Arcimboldo, *Vertumnus* (1590–1591) | Skokloster Castle, Sweden | [Commons](https://commons.wikimedia.org/wiki/File:Vertumnus_%C3%A5rstidernas_gud_m%C3%A5lad_av_Giuseppe_Arcimboldo_1591_-_Skoklosters_slott_-_91503.jpg) |
| Peter Paul Rubens, *The Three Graces* (1630–1635) | Museo del Prado, Madrid | [Commons](https://commons.wikimedia.org/wiki/File:The_Three_Graces,_by_Peter_Paul_Rubens,_from_Prado_in_Google_Earth.jpg) |
| Peter Paul Rubens, *The Judgement of Paris* (1638–1639) | Museo del Prado, Madrid | [Commons](https://commons.wikimedia.org/wiki/File:Peter_Paul_Rubens_115.jpg) |
| Rembrandt, *The Anatomy Lesson of Dr Nicolaes Tulp* (1632) | Mauritshuis, The Hague | [Commons](https://commons.wikimedia.org/wiki/File:Rembrandt_-_The_Anatomy_Lesson_of_Dr_Nicolaes_Tulp.jpg) |
| Rembrandt, *The Return of the Prodigal Son* (c. 1668) | Hermitage Museum, Saint Petersburg | [Commons](https://commons.wikimedia.org/wiki/File:Rembrandt_Harmensz_van_Rijn_-_Return_of_the_Prodigal_Son_-_Google_Art_Project.jpg) |
| Diego Velázquez, *Las Meninas* (1656) | Museo del Prado, Madrid | [Commons](https://commons.wikimedia.org/wiki/File:Las_Meninas,_by_Diego_Vel%C3%A1zquez,_from_Prado_in_Google_Earth.jpg) |
| Johannes Vermeer, *Girl with a Pearl Earring* (c. 1665) | Mauritshuis, The Hague | [Commons](https://commons.wikimedia.org/wiki/File:1665_Girl_with_a_Pearl_Earring.jpg) |
| Johannes Vermeer, *The Milkmaid* (c. 1658–1660) | Rijksmuseum, Amsterdam | [Commons](https://commons.wikimedia.org/wiki/File:Johannes_Vermeer_-_Het_melkmeisje_-_Google_Art_Project.jpg) |
| Guido Reni, *Atalanta and Hippomenes* (c. 1618–1619) | Museo del Prado, Madrid | [Commons](https://commons.wikimedia.org/wiki/File:Hip%C3%B3menes_y_Atalanta_%28Reni%29.jpg) |
| Annibale Carracci, *The Beaneater* (c. 1583–1584) | Galleria Colonna, Rome | [Commons](https://commons.wikimedia.org/wiki/File:Carracci_-_Der_Bohnenesser.jpeg) |
| Bartolomé Esteban Murillo, *The Young Beggar* (c. 1645–1650) | Louvre, Paris | [Commons](https://commons.wikimedia.org/wiki/File:Bartolom%C3%A9_Esteban_Murillo_-_Joven_mendigo_%281645-50%29.jpg) |
| Nicolas Poussin, *Et in Arcadia ego* (c. 1637–1638) | Louvre, Paris | [Commons](https://commons.wikimedia.org/wiki/File:Les_Bergers_d%27Arcadie_-_Nicolas_Poussin_-_Mus%C3%A9e_du_Louvre_Peintures_INV_7300_;_MR_2339.jpg) |
| Artemisia Gentileschi, *Judith Slaying Holofernes* (c. 1620) | Uffizi Gallery, Florence | [Commons](https://commons.wikimedia.org/wiki/File:Artemisia_Gentileschi_-_Giuditta_decapita_Oloferne_-_Google_Art_Project-Adjust.jpg) |
| Orazio Gentileschi, *The Lute Player* (c. 1612–1620) | National Gallery of Art, Washington | [Commons](https://commons.wikimedia.org/wiki/File:Orazio_Gentileschi_-_Il_suonatore_di_liuto_%28National_Gallery_of_Art%29.jpg) |
| Georges de La Tour, *The Cheat with the Ace of Diamonds* (c. 1636–1638) | Louvre, Paris | [Commons](https://commons.wikimedia.org/wiki/File:Le_Tricheur_%C3%A0_l%27as_de_carreau_-_Georges_de_La_Tour_-_Mus%C3%A9e_du_Louvre_Peintures_RF_1972_8.jpg) |
| Gerard van Honthorst, *Christ before the High Priest* (c. 1617) | National Gallery, London | [Commons](https://commons.wikimedia.org/wiki/File:Gerard_van_Honthorst_-_Christ_before_the_High_Priest_-_WGA11650.jpg) |
| Jusepe de Ribera, *The Clubfoot* (1642) | Louvre, Paris | [Commons](https://commons.wikimedia.org/wiki/File:El_patizambo,_por_Jos%C3%A9_de_Ribera.jpg) |
| Hendrick ter Brugghen, *The Calling of Saint Matthew* (1621) | Centraal Museum, Utrecht | [Commons](https://commons.wikimedia.org/wiki/File:Brugghen,_Hendrick_ter_-_The_Calling_of_St._Matthew_-_1621.jpg) |
| Dirck van Baburen, *The Procuress* (1622) | Museum of Fine Arts, Boston | [Commons](https://commons.wikimedia.org/wiki/File:Dirck_van_Baburen_-_The_Procuress_-_Google_Art_Project.jpg) |
| Antoine Watteau, *The Embarkation for Cythera* (1717) | Louvre, Paris | [Commons](https://commons.wikimedia.org/wiki/File:L%27Embarquement_pour_Cyth%C3%A8re,_by_Antoine_Watteau,_from_C2RMF_retouched.jpg) |
| Jean-Honoré Fragonard, *The Swing* (c. 1767) | Wallace Collection, London | [Commons](https://commons.wikimedia.org/wiki/File:Fragonard,_The_Swing.jpg) |
| Jean-Honoré Fragonard, *A Young Girl Reading* (c. 1770) | National Gallery of Art, Washington | [Commons](https://commons.wikimedia.org/wiki/File:Fragonard,_The_Reader.jpg) |
| François Boucher, *Portrait of Madame de Pompadour* (1756) | Alte Pinakothek, Munich | [Commons](https://commons.wikimedia.org/wiki/File:Madame_de_Pompadour.jpg) |
| François Boucher, *Diana Leaving Her Bath* (1742) | Louvre, Paris | [Commons](https://commons.wikimedia.org/wiki/File:Diane_sortant_du_bain_-_Fran%C3%A7ois_Boucher_-_Mus%C3%A9e_du_Louvre_Peintures_INV_2712.jpg) |
| Giovanni Battista Tiepolo, *The Banquet of Cleopatra* (1743–1744) | National Gallery of Victoria, Melbourne | [Commons](https://commons.wikimedia.org/wiki/File:Giambattista_Tiepolo_-_The_Banquet_of_Cleopatra_-_Google_Art_Project.jpg) |
| Canaletto, *The Stonemason's Yard* (c. 1725) | National Gallery, London | [Commons](https://commons.wikimedia.org/wiki/File:Canaletto_-_The_Stonemason%27s_Yard.jpg) |
| Jean-Siméon Chardin, *The Ray* (1725–1726) | Louvre, Paris | [Commons](https://commons.wikimedia.org/wiki/File:La_Raie_-_Jean_Baptiste_Sim%C3%A9on_Chardin_-_Mus%C3%A9e_du_Louvre_Peintures_INV_3197.jpg) |
| Thomas Gainsborough, *Mr and Mrs Andrews* (c. 1750) | National Gallery, London | [Commons](https://commons.wikimedia.org/wiki/File:Thomas_Gainsborough_-_Mr._und_Mrs._Andrews_%28c._1750%29.jpg) |
| Pietro Longhi, *The Rhinoceros* (1751) | Ca' Rezzonico, Venice | [Commons](https://commons.wikimedia.org/wiki/File:Ca%27_Rezzonico_-_Il_rinoceronte_1751_-_Pietro_Longhi_.jpg) |
| Jacques-Louis David, *The Death of Marat* (1793) | Royal Museums of Fine Arts of Belgium, Brussels | [Commons](https://commons.wikimedia.org/wiki/File:Jacques-Louis_David_-_Marat_assassinated_-_Google_Art_Project_2.jpg) |
| Jacques-Louis David, *The Death of Socrates* (1787) | Metropolitan Museum of Art, New York | [Commons](https://commons.wikimedia.org/wiki/File:The_Death_of_Socrates_MET_DP-13139-001.jpg) |
| Jacques-Louis David, *Napoleon Crossing the Alps* (1801) | Château de Malmaison, Rueil-Malmaison | [Commons](https://commons.wikimedia.org/wiki/File:David_-_Napoleon_crossing_the_Alps_-_Malmaison2.jpg) |
| Jean-Auguste-Dominique Ingres, *Grande Odalisque* (1814) | Louvre, Paris | [Commons](https://commons.wikimedia.org/wiki/File:La_grande_odalisque_-_Jean-Auguste_Dominique_Ingres_-_Mus%C3%A9e_du_Louvre_Peintures_RF_1158.jpg) |
| Jean-Auguste-Dominique Ingres, *The Valpinçon Bather* (1808) | Louvre, Paris | [Commons](https://commons.wikimedia.org/wiki/File:Jean-Auguste-Dominique_Ingres_-_La_Baigneuse_Valpin%C3%A7on.jpg) |
| Angelica Kauffman, *Cornelia, Mother of the Gracchi* (1788) | Royal Castle, Warsaw | [Commons](https://commons.wikimedia.org/wiki/File:Angelica_kauffman_ra_cornelia_mother_of_the_gracchi060808%29.jpg) |
| Élisabeth Vigée Le Brun, *Self-Portrait with Her Daughter Julie* (1789) | Louvre, Paris | [Commons](https://commons.wikimedia.org/wiki/File:Self-portrait_with_Her_Daughter_by_Elisabeth-Louise_Vig%C3%A9e_Le_Brun.jpg) |
| Anne-Louis Girodet, *The Sleep of Endymion* (1791) | Louvre, Paris | [Commons](https://commons.wikimedia.org/wiki/File:Girodet_Sleep_of_Endymion.jpg) |
| Eugène Delacroix, *Liberty Leading the People* (1830) | Louvre, Paris | [Commons](https://commons.wikimedia.org/wiki/File:La_Libert%C3%A9_guidant_le_peuple_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_129_-_apr%C3%A8s_restauration_2024.jpg) |
| Théodore Géricault, *Woman with a Monomania of Envy* (c. 1819–1822) | Musée des Beaux-Arts, Lyon | [Commons](https://commons.wikimedia.org/wiki/File:La_Monomane_de_l%27envie.jpg) |
| Caspar David Friedrich, *Wanderer above the Sea of Fog* (c. 1818) | Hamburger Kunsthalle, Hamburg | [Commons](https://commons.wikimedia.org/wiki/File:Friedrich,_Caspar_David_-_Wanderer_%C3%BCber_dem_Nebelmeer.jpg) |
| Caspar David Friedrich, *The Sea of Ice* (1823–1824) | Hamburger Kunsthalle, Hamburg | [Commons](https://commons.wikimedia.org/wiki/File:Friedrich,_Caspar_David_-_Eismeer.jpg) |
| J. M. W. Turner, *Rain, Steam and Speed* (1844) | National Gallery, London | [Commons](https://commons.wikimedia.org/wiki/File:J._M._W._Turner_-_Rain,_Steam_and_Speed_%E2%80%93_The_Great_Western_Railway.jpg) |
| J. M. W. Turner, *The Fighting Temeraire* (1839) | National Gallery, London | [Commons](https://commons.wikimedia.org/wiki/File:Turner,_J._M._W._-_The_Fighting_T%C3%A9m%C3%A9raire_tugged_to_her_last_Berth_to_be_broken.jpg) |
| Francisco Goya, *The Third of May 1808* (1814) | Museo del Prado, Madrid | [Commons](https://commons.wikimedia.org/wiki/File:El_Tres_de_Mayo,_by_Francisco_de_Goya,_from_Prado_in_Google_Earth.jpg) |
| Francisco Goya, *Saturn Devouring His Son* (1820–1823) | Museo del Prado, Madrid | [Commons](https://commons.wikimedia.org/wiki/File:Francisco_de_Goya,_Saturno_devorando_a_su_hijo_%281819-1823%29.jpg) |
| Francesco Hayez, *The Kiss* (1859) | Pinacoteca di Brera, Milan | [Commons](https://commons.wikimedia.org/wiki/File:El_Beso_%28Pinacoteca_de_Brera,_Mil%C3%A1n,_1859%29.jpg) |
| John Constable, *The Hay Wain* (1821) | National Gallery, London | [Commons](https://commons.wikimedia.org/wiki/File:John_Constable_-_The_Hay_Wain_%281821%29.jpg) |
| Claude Monet, *Impression, Sunrise* (1872) | Musée Marmottan Monet, Paris | [Commons](https://commons.wikimedia.org/wiki/File:Monet_-_Impression,_Sunrise.jpg) |
| Claude Monet, *Woman with a Parasol* (1875) | National Gallery of Art, Washington | [Commons](https://commons.wikimedia.org/wiki/File:Claude_Monet_-_Woman_with_a_Parasol_-_Madame_Monet_and_Her_Son_-_Google_Art_Project.jpg) |
| Claude Monet, *Poppy Field near Argenteuil* (1873) | Musée d'Orsay, Paris | [Commons](https://commons.wikimedia.org/wiki/File:Claude_Monet_-_Poppy_Field_-_Google_Art_Project.jpg) |
| Pierre-Auguste Renoir, *Bal du moulin de la Galette* (1876) | Musée d'Orsay, Paris | [Commons](https://commons.wikimedia.org/wiki/File:Renoir,_Pierre-Auguste_-_Dance_at_Le_Moulin_de_la_Galette,_1876.jpg) |
| Pierre-Auguste Renoir, *Luncheon of the Boating Party* (1880–1881) | Phillips Collection, Washington | [Commons](https://commons.wikimedia.org/wiki/File:Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg) |
| Edgar Degas, *The Dance Class* (1874) | Metropolitan Museum of Art, New York | [Commons](https://commons.wikimedia.org/wiki/File:Edgar_Degas_The_Dance_Class.jpg) |
| Edgar Degas, *L'Absinthe* (1875–1876) | Musée d'Orsay, Paris | [Commons](https://commons.wikimedia.org/wiki/File:Edgar_Degas_-_In_a_Caf%C3%A9_-_Google_Art_Project_2.jpg) |
| Édouard Manet, *A Bar at the Folies-Bergère* (1882) | Courtauld Gallery, London | [Commons](https://commons.wikimedia.org/wiki/File:Un_bar_aux_Folies-Berg%C3%A8re_d%27E._Manet_%28Fondation_Vuitton,_Paris%29_%2833539037428%29.jpg) |
| Camille Pissarro, *The Boulevard Montmartre on a Winter Morning* (1897) | Metropolitan Museum of Art, New York | [Commons](https://commons.wikimedia.org/wiki/File:The_Boulevard_Montmartre_on_a_Winter_Morning.JPG) |
| Berthe Morisot, *The Cradle* (1872) | Musée d'Orsay, Paris | [Commons](https://commons.wikimedia.org/wiki/File:Berthe_Morisot_-_Le_berceau.jpg) |
| Gustave Caillebotte, *Paris Street; Rainy Day* (1877) | Art Institute of Chicago | [Commons](https://commons.wikimedia.org/wiki/File:Gustave_Caillebotte_-_Paris_Street,_Rainy_Day_-_1964.336_-_Art_Institute_of_Chicago.jpg) |
| Alfred Sisley, *Flood at Port-Marly* (1876) | Musée d'Orsay, Paris | [Commons](https://commons.wikimedia.org/wiki/File:La_inundaci%C3%B3n_en_Port_Marly,_por_Alfred_Sisley.jpg) |
