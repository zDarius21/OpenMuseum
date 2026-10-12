/**
 * Impostazioni generali del museo.
 * Unità di misura nella scena: 1 = 1 metro.
 */
export const settings = {
  room: {
    /** Larghezza, lungo l'asse X. */
    width: 16,
    /** Profondità, lungo l'asse Z. */
    depth: 32,
    height: 4.5,
    wallThickness: 0.2,
  },
  barriers: {
    /** Distanza delle transenne dalle pareti. */
    distance: 1,
    /** Distanza massima tra due paletti. */
    postSpacing: 2.2,
    postHeight: 0.95,
    /** Quanto si abbassa il cordone a metà tra due paletti. */
    ropeSag: 0.1,
  },
  lights: {
    /** Luce diffusa che rende leggibili anche le zone lontane dai faretti. */
    ambientIntensity: 3.2,
    /** Faretti a soffitto disposti a griglia: colonne (lungo X) × file (lungo Z); 0 per nessuno. */
    spotColumns: 0,
    spotRows: 0,
    /** Intensità di ogni faretto, in candele. */
    spotIntensity: 60,
  },
  artworks: {
    /** Altezza da terra del centro dei quadri che non la indicano. */
    defaultCenterHeight: 1.55,
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
    /** Distanza massima dal cordone, in metri, per poter avviare la visita guidata di un quadro. */
    maxDistanceFromRope: 1.2,
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
