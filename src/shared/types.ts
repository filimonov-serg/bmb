export const POWERUP_LIMITS = {
  MAX_BOMBS: 8,
  MAX_RANGE: 8,
  MAX_SPEED: 4.5,
} as const;

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface Bomb {
  id: string; // Уникальный ID бомбы для плавной интерполяции на клиенте
  c: number;
  r: number;
  x: number; // Точная пиксельная координата X центра бомбы
  y: number; // Точная пиксельная координата Y центра бомбы
  ownerId: string;
  kickedBy: string | null; // ID игрока, который толкнул бомбу
  range: number;
  timer: number;
  passableBy: string[];
  vx: number; // Направление скольжения по X (-1, 0, 1)
  vy: number; // Направление скольжения по Y (-1, 0, 1)
}

export interface TileCoord {
  c: number;
  r: number;
}

export type MapTemplate = "classic" | "arena" | "maze";

export interface CrateSpawnWarning {
  c: number;
  r: number;
  ticksLeft: number; // Обратный отсчет до превращения в твердый ящик
}

export interface PublicGameState {
  players: Record<string, Player>;
  bombs: Bomb[];
  explosions: Explosion[];
  powerups: Powerup[];
  crateWarnings: CrateSpawnWarning[]; // Список клеток, где скоро вырастет ящик
  roundTimeLeft: number;
  template: MapTemplate;
}

export interface InitPayload {
  id: string;
  map: number[][];
  tileSize: number;
  template: MapTemplate;
}

export type PowerupType = "bomb" | "fire" | "speed" | "kick" | "shield";

export interface Powerup {
  id: string;
  c: number;
  r: number;
  type: PowerupType;
  spawnProtection: number; // Тики неуязвимости при выпадении из ящика
}

export interface PublicGameState {
  players: Record<string, Player>;
  bombs: Bomb[];
  explosions: Explosion[];
  powerups: Powerup[]; // Добавили список бонусов на карте
  crateWarnings: CrateSpawnWarning[];
  chestHp: Record<string, number>;
  roundTimeLeft: number;
  template: MapTemplate;
}

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  speed: number;
  maxBombs: number;
  activeBombs: number;
  range: number;
  canKick: boolean;
  kills: number; // Количество фрагов за раунд
  deaths: number; // Количество смертей за раунд
  alive: boolean;
  input: InputState;
  isBot?: boolean;
  shieldTicks: number;
}

export interface Explosion {
  tiles: TileCoord[];
  timer: number;
  ownerId: string; // ID игрока, чья бомба вызвала этот взрыв
}
