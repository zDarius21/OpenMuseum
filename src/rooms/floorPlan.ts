import type { RoomBounds, WallId } from '../scene/Room';
import { placeArtworks, planWalls, type LayoutOptions, type RoomLayout } from './layout';
import type { RoomPlan } from './plan';

/** Una sala al suo posto nella pianta del museo. */
export interface PlacedRoom {
  bounds: RoomBounds;
  /** Pareti con la porta verso la sala precedente e verso la successiva. */
  doors: { previous?: WallId; next?: WallId };
  layout: RoomLayout;
}

interface Cell {
  column: number;
  row: number;
}

/**
 * Dispone le sale su una pianta quasi quadrata invece che in un unico corridoio: il percorso sale verso nord nella
 * prima colonna, scende nella seconda, risale nella terza e così via, da ovest a est, con la porta al centro della
 * parete tra una sala e la successiva. Le sale di una colonna hanno la stessa larghezza e quelle di una fila la
 * stessa profondità, così i muri combaciano. La prima sala è centrata sull'asse z e comincia a z = 0.
 */
export function planFloor(plans: readonly RoomPlan[], options: LayoutOptions & { wallThickness: number }): PlacedRoom[] {
  if (plans.length === 0) return [];
  const rows = Math.ceil(Math.sqrt(plans.length));
  const cells: Cell[] = plans.map((_, index) => {
    const column = Math.floor(index / rows);
    const step = index % rows;
    return { column, row: column % 2 === 0 ? step : rows - 1 - step };
  });

  const rooms = plans.map((plan, index) => {
    const cell = cells[index];
    const previous = index > 0 ? sideTowards(cell, cells[index - 1]) : undefined;
    const next = index < plans.length - 1 ? sideTowards(cell, cells[index + 1]) : undefined;
    // La prima sala non ha la porta d'ingresso: il visitatore parte dalla parete sud.
    const walls = planWalls(plan.artworks, { entrance: previous ?? 'sud', exit: next }, options);
    return { cell, doors: { previous, next }, walls };
  });

  const widths: number[] = [];
  const depths: number[] = [];
  for (const { cell, walls } of rooms) {
    widths[cell.column] = Math.max(widths[cell.column] ?? 0, walls.width);
    depths[cell.row] = Math.max(depths[cell.row] ?? 0, walls.depth);
  }
  // Facce interne della parete ovest di ogni colonna e della parete sud di ogni fila: tra due sale c'è un muro.
  const wests = [-widths[0] / 2];
  for (const width of widths) wests.push(wests[wests.length - 1] + width + options.wallThickness);
  const souths = [0];
  for (const depth of depths) souths.push(souths[souths.length - 1] - depth - options.wallThickness);

  return rooms.map(({ cell, doors, walls }) => {
    const width = widths[cell.column];
    const depth = depths[cell.row];
    const west = wests[cell.column];
    const south = souths[cell.row];
    return { bounds: { west, east: west + width, south, north: south - depth }, doors, layout: placeArtworks(walls, width, depth) };
  });
}

/** La parete di `from` che confina con la cella vicina `to`: le file crescono verso nord, le colonne verso est. */
function sideTowards(from: Cell, to: Cell): WallId {
  if (to.row > from.row) return 'nord';
  if (to.row < from.row) return 'sud';
  return to.column > from.column ? 'est' : 'ovest';
}
