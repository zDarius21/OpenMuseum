/**
 * Impostazioni generali del museo.
 * Unità di misura nella scena: 1 = 1 metro.
 */
export const settings = {
  /** Le sale si generano dai filtri scelti all'inizio, una dopo l'altra verso nord, collegate da porte. */
  rooms: {
    /** Larghezza, lungo l'asse X: le opere stanno sulle due pareti lunghe, est e ovest. */
    width: 10,
    /** Profondità minima: le sale con opere grandi si allungano da sole. */
    minDepth: 9,
    height: 4.5,
    wallThickness: 0.2,
    /** Spazio minimo tra due opere (targhetta compresa) e tra un'opera e le pareti di fondo. */
    minGap: 0.9,
    door: { width: 2.2, height: 3.2 },
    /** Quante sale costruire (pareti, cornici, targhette) prima e dopo quella in cui ci si trova. */
    buildRadius: 2,
    /** Quante sale, prima e dopo quella in cui ci si trova, hanno le immagini caricate. */
    imageRadius: 1,
  },
  /** Scelte del menu iniziale. */
  visit: {
    /** Quante opere per sala si possono scegliere; la più alta è anche il numero di faretti. */
    perRoomOptions: [4, 6, 8],
    defaultPerRoom: 6,
    /** Raggruppando per città, quelle con meno opere di così finiscono insieme in «Altre città». */
    minCityRoom: 3,
  },
  barriers: {
    /** Distanza delle transenne dalle pareti. */
    distance: 1,
    /** Distanza massima tra due paletti. */
    postSpacing: 2.2,
    postHeight: 0.95,
    /** Quanto si abbassa il cordone a metà tra due paletti. */
    ropeSag: 0.1,
    /** Distanza massima dal cordone, in metri, per aprire la scheda, la visita guidata o la vista ravvicinata di un quadro. */
    maxDistanceFromRope: 1.2,
  },
  lights: {
    /** Luce diffusa che rende leggibili anche le zone lontane dai faretti. */
    ambientIntensity: 3.2,
    /** Durata in secondi dell'accensione dei faretti quando si entra in una sala. */
    fadeDuration: 0.6,
  },
  artworks: {
    /** Altezza da terra del centro dei quadri; quelli alti vengono alzati quanto basta. */
    defaultCenterHeight: 1.55,
    /** Distanza minima da terra del bordo inferiore della cornice. */
    minBottom: 0.45,
    /** Quanta luce porta il faretto di ogni quadro: la potenza si adatta da sola alla distanza. */
    spotStrength: 6,
  },
  tour: {
    /** Durata in secondi dell'avvicinamento al quadro e del ritorno al proprio posto. */
    approachDuration: 1.6,
    /** Durata in secondi dello spostamento da una tappa all'altra. */
    stepDuration: 1.4,
    /** Pausa in secondi tra la fine della lettura di una tappa e la successiva. */
    pauseBetweenStops: 1,
    /** Velocità della voce narrante: 1 normale, meno di 1 più lenta. */
    voiceRate: 1,
  },
  /** Vista ravvicinata dei quadri senza visita guidata. */
  viewer: {
    /** Ingrandimento massimo: 1 = quadro intero. Sui quadri piccoli può essere minore, per non attraversare la tela. */
    maxZoom: 6,
    /** Durata in secondi dell'avvicinamento al quadro e del ritorno al proprio posto. */
    approachDuration: 1,
  },
  camera: {
    /** Campo visivo verticale, in gradi. */
    fov: 70,
    /** Campo visivo orizzontale minimo: sui telefoni in verticale il fov si allarga per non vedere solo davanti a sé. */
    minHorizontalFov: 60,
    near: 0.1,
    far: 200,
    /** Altezza degli occhi del visitatore. */
    eyeHeight: 1.6,
  },
  player: {
    /** Ingombro del visitatore per le collisioni con le pareti. */
    radius: 0.35,
    /** Velocità di camminata, in m/s. */
    speed: 3.5,
    /** Sensibilità dello sguardo trascinando il dito, in radianti per pixel. */
    touchLookSpeed: 0.005,
  },
  renderer: {
    /** Oltre 2 il costo cresce molto senza differenze visibili, soprattutto sui telefoni. */
    maxPixelRatio: 2,
    background: 0x1a1a1f,
  },
  /** Il progetto Sanity da cui arrivano le opere: si gestiscono con lo Studio nella cartella studio. */
  sanity: {
    projectId: 'e0nf18h9',
    dataset: 'production',
    /** Versione dell'API: una data fissa, così il formato delle risposte non cambia da solo. */
    apiVersion: '2025-02-19',
    /** Lato più lungo, in pixel, con cui si scaricano le immagini: Sanity riduce quelle più grandi. */
    maxImageSize: 2048,
  },
} as const;
