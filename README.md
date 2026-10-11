# OpenMuseum – Museo virtuale 3D

Un museo virtuale 3D che si visita camminando nel browser: cliccando su un'opera parte una spiegazione guidata, con la camera che zooma sui dettagli mentre il testo viene letto ad alta voce.

## Tecnologie

| Componente          | Scelta                                 |
| ------------------- | -------------------------------------- |
| Grafica 3D          | [Three.js](https://threejs.org)        |
| Build e linguaggio  | [Vite](https://vite.dev) + TypeScript  |
| Animazioni camera   | GSAP *(dalla Fase 5)*                  |
| Voce narrante       | Web Speech API *(dalla Fase 5)*        |
| Contenuti           | File JSON + immagini di pubblico dominio |
| Pubblicazione       | GitHub Pages o Vercel                  |

## Avvio in locale

Requisiti: [Node.js](https://nodejs.org) 20.19+ oppure 22.12+.

```bash
npm install
npm run dev
```

Poi apri <http://localhost:5173>.

Per provarlo dal telefono sulla stessa rete Wi-Fi: `npm run dev -- --host`, e apri dal telefono l'indirizzo "Network" mostrato nel terminale.

## Comandi

| Azione                | PC                                   | Smartphone / tablet               |
| --------------------- | ------------------------------------ | --------------------------------- |
| Iniziare              | Clic sulla scena                     | —                                 |
| Muoversi              | `W` `A` `S` `D` o frecce             | Joystick in basso a sinistra      |
| Guardarsi intorno     | Mouse                                | Trascinare il dito sullo schermo  |
| Liberare il mouse     | `Esc`                                | —                                 |

## Impostazioni

Dimensioni della sala, transenne, luci, velocità di movimento e campo visivo si cambiano in [`src/data/settings.ts`](src/data/settings.ts), senza toccare il resto del codice.

## Aggiungere un quadro

Le opere si trovano in [`public/data/artworks.json`](public/data/artworks.json): per aggiungerne una basta aggiungere una voce, senza toccare il codice.

```json
{
  "id": "coniugi-arnolfini",
  "title": "Ritratto dei coniugi Arnolfini",
  "author": "Jan van Eyck",
  "year": 1434,
  "image": "images/coniugi-arnolfini.jpg",
  "width": 0.6,
  "height": 0.82,
  "wall": "nord",
  "position": -2.5,
  "source": "https://commons.wikimedia.org/wiki/File:..."
}
```

| Campo          | Obbligatorio | Significato                                                                 |
| -------------- | ------------ | --------------------------------------------------------------------------- |
| `id`           | sì           | Identificativo unico, senza spazi                                           |
| `title`        | sì           | Titolo dell'opera                                                           |
| `wall`         | sì           | Parete: `nord` (di fronte all'ingresso), `sud`, `est` (a destra), `ovest`    |
| `position`     | sì           | Metri dal centro della parete, positivi verso destra guardando la parete    |
| `width`, `height` | sì        | Misure reali della tela in metri, cornice esclusa                           |
| `centerHeight` | no           | Altezza da terra del centro del quadro (predefinita 1,55 m)                 |
| `image`        | no           | Immagine in `public/`; se manca o non si carica si usa un'immagine simbolica |
| `author`, `year`, `location`, `source` | no | Autore, anno, museo che la conserva e pagina da cui proviene l'immagine |

Cornice, faretto e targhetta (autore, titolo e anno, a destra del quadro) si creano da soli in base ai dati. Se una voce ha un errore (campo mancante, quadro che esce dalla parete o si sovrappone a un altro) viene saltata, con un avviso nella console del browser che spiega il motivo.

## Script

| Comando           | Cosa fa                                                       |
| ----------------- | ------------------------------------------------------------- |
| `npm run dev`     | Server di sviluppo con ricaricamento automatico               |
| `npm run build`   | Controllo dei tipi TypeScript e build di produzione in `dist/` |
| `npm run preview` | Serve in locale la build di produzione                        |
| `npm run deploy`  | Build e pubblicazione su GitHub Pages (ramo `gh-pages`)       |

## Struttura

```
src/
├─ main.ts        Punto di ingresso: crea il museo e avvia il rendering
├─ style.css      Stili globali
├─ scene/         Renderer, camera, ciclo di rendering e ambienti (sale, luci)
├─ controls/      Movimento in prima persona: tastiera, mouse, joystick touch
├─ artworks/      Caricamento delle opere, cornici e faretti
├─ ui/            Interfaccia: schermata iniziale, sottotitoli, pulsanti, minimappa
├─ data/          Impostazioni del museo
└─ utils/         Funzioni di supporto
public/
├─ data/          Contenuti modificabili senza ricompilare (artworks.json)
└─ images/        Immagini delle opere
```

Unità di misura nella scena: 1 = 1 metro.

## Pubblicazione

### GitHub Pages

1. Crea un repository su GitHub e collegalo: `git remote add origin https://github.com/<utente>/<repo>.git`
2. Esegui `npm run deploy`: la build viene pubblicata sul ramo `gh-pages`.
3. Su GitHub, in **Settings → Pages**, scegli come sorgente il ramo `gh-pages`.

Il sito sarà su `https://<utente>.github.io/<repo>/`. La build usa percorsi relativi, quindi funziona anche in una sottocartella senza altre modifiche.

### Vercel

Importa il repository su [vercel.com](https://vercel.com): Vite viene riconosciuto in automatico (build `npm run build`, cartella `dist`).

## Roadmap

- [x] **Fase 1 – Setup del progetto:** la pagina si avvia in locale e mostra una scena vuota
- [x] **Fase 2 – La sala:** pavimento, pareti, soffitto, luci e transenne, con dimensioni configurabili
- [x] **Fase 3 – Camminare dentro:** prima persona con WASD e mouse, collisioni, joystick touch
- [x] **Fase 4 – I quadri:** opere caricate da `artworks.json`, con cornice e faretto
- [ ] **Fase 5 – La visita guidata con zoom:** tappe con zoom sui dettagli, sottotitoli e voce narrante
- [ ] **Fase 6 – Interfaccia:** schermata iniziale, minimappa, pannello informativo
- [ ] **Fase 7 – Più sale ed editor dei dettagli**
- [ ] **Fase 8 – Rifinitura e pubblicazione**

## Crediti

Le immagini delle opere sono riproduzioni di dipinti di pubblico dominio, da [Wikimedia Commons](https://commons.wikimedia.org). La fonte di ciascuna è anche nel campo `source` di `artworks.json`.

| Opera | Collocazione | Fonte |
| ----- | ------------ | ----- |
| Caravaggio, *Ragazzo morso da un ramarro* (1594-1595 circa) | National Gallery, Londra | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_-_Boy_Bitten_by_a_Lizard.jpg) |
| Caravaggio, *Bacco* (1596 circa) | Galleria degli Uffizi, Firenze | [Commons](https://commons.wikimedia.org/wiki/File:Baco,_por_Caravaggio.jpg) |
| Caravaggio, *Canestra di frutta* (1599 circa) | Pinacoteca Ambrosiana, Milano | [Commons](https://commons.wikimedia.org/wiki/File:Basket_of_Fruit-Caravaggio_(c.1595).jpg) |
| Caravaggio, *Vocazione di san Matteo* (1599-1600) | San Luigi dei Francesi, Roma | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_%E2%80%94_The_Calling_of_Saint_Matthew.jpg) |
| Caravaggio, *Giuditta e Oloferne* (1598-1599 circa) | Palazzo Barberini, Roma | [Commons](https://commons.wikimedia.org/wiki/File:Judith_Beheading_Holofernes-Caravaggio_(c.1598-9).jpg) |
| Caravaggio, *Cena in Emmaus* (1601) | National Gallery, Londra | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_-_Supper_at_Emmaus_-_National_Gallery_London.jpeg) |
| Caravaggio, *Incredulità di san Tommaso* (1601-1602) | Bildergalerie, Potsdam | [Commons](https://commons.wikimedia.org/wiki/File:Caravaggio_incredulity.jpg) |
| Caravaggio, *Davide con la testa di Golia* (1609-1610 circa) | Galleria Borghese, Roma | [Commons](https://commons.wikimedia.org/wiki/File:David_with_the_Head_of_Goliath-Caravaggio_(1610).jpg) |
