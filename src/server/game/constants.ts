export const TILE_SIZE = 40;
export const MAP_COLS = 36;
export const MAP_ROWS = 36;
export const TICK_RATE = 60;
export const SLIDE_THRESHOLD = 18;
export const PLAYER_RADIUS_RATIO = 0.35;

export const TILE = {
  EMPTY: 0,
  WALL: 1,
  CRATE: 2,
  FOREST: 3,
  CHEST: 4, // Укрепленный сундук (4 HP)
} as const;

export const BASE_STATS = {
  SPEED: 2.5,
  MAX_BOMBS: 2,
  RANGE: 2,
} as const;
