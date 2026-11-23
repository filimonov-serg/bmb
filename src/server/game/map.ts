import { Server } from "socket.io";
import {
  Bomb,
  CrateSpawnWarning,
  Explosion,
  MapTemplate,
  Player,
  Powerup,
} from "../../shared/types";
import { wrap } from "../../shared/utils";
import { TILE_SIZE, MAP_COLS, MAP_ROWS, TILE } from "./constants";

function generateClassicTile(r: number, c: number): number {
  if (r % 2 === 0 && c % 2 === 0) return TILE.WALL;
  return pickWalkableOrCrate(r, c, 0.45);
}

function generateArenaTile(r: number, c: number): number {
  const centerR = Math.floor(MAP_ROWS / 2);
  const centerC = Math.floor(MAP_COLS / 2);

  if (Math.abs(r - centerR) <= 3 && Math.abs(c - centerC) <= 3) {
    return pickWalkableOrCrate(r, c, 0.15);
  }
  if ((r % 4 === 2 || r % 4 === 3) && (c % 4 === 2 || c % 4 === 3)) {
    return TILE.WALL;
  }
  return pickWalkableOrCrate(r, c, 0.3);
}

function generateMazeTile(r: number, c: number): number {
  if (r % 4 === 0 && c % 6 !== 3) return TILE.WALL;
  if (c % 6 === 0 && r % 4 !== 2) return TILE.WALL;
  return pickWalkableOrCrate(r, c, 0.6);
}

export function createMap(template: MapTemplate = "classic"): number[][] {
  const map: number[][] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      // Больше никаких внешних стен — карта бесшовная!
      if (template === "arena") row.push(generateArenaTile(r, c));
      else if (template === "maze") row.push(generateMazeTile(r, c));
      else row.push(generateClassicTile(r, c));
    }
    map.push(row);
  }
  return map;
}

function hasSafePocket(map: number[][], bombs: Bomb[], startC: number, startR: number): boolean {
  const visited = new Set<string>([`${startC},${startR}`]);
  const queue: { c: number; r: number }[] = [{ c: startC, r: startR }];
  const dirs = [
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: 0, dr: -1 },
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.size >= 3) return true;

    for (const d of dirs) {
      // Зацикливаем координаты соседей через края карты
      const nc = wrap(curr.c + d.dc, MAP_COLS);
      const nr = wrap(curr.r + d.dr, MAP_ROWS);
      const key = `${nc},${nr}`;

      if (
        !visited.has(key) &&
        (map[nr][nc] === TILE.EMPTY || map[nr][nc] === TILE.FOREST) &&
        !bombs.some((b) => b.c === nc && b.r === nr)
      ) {
        visited.add(key);
        queue.push({ c: nc, r: nr });
      }
    }
  }
  return false;
}

export function getSpawnPoint(
  map: number[][],
  bombs: Bomb[],
  explosions: Explosion[],
  io: Server,
): { x: number; y: number } {
  for (let attempt = 0; attempt < 200; attempt++) {
    const c = Math.floor(Math.random() * MAP_COLS);
    const r = Math.floor(Math.random() * MAP_ROWS);

    if (map[r][c] !== TILE.EMPTY) continue;

    const hasBomb = bombs.some((b) => b.c === c && b.r === r);
    const hasFire = explosions.some((exp) => exp.tiles.some((t) => t.c === c && t.r === r));
    if (hasBomb || hasFire) continue;

    if (hasSafePocket(map, bombs, c, r)) {
      return { x: c * TILE_SIZE + TILE_SIZE / 2, y: r * TILE_SIZE + TILE_SIZE / 2 };
    }
  }

  while (true) {
    const c = Math.floor(Math.random() * MAP_COLS);
    const r = Math.floor(Math.random() * MAP_ROWS);
    if (map[r][c] === TILE.EMPTY) {
      const dirs = [
        { dc: 1, dr: 0 },
        { dc: -1, dr: 0 },
        { dc: 0, dr: 1 },
        { dc: 0, dr: -1 },
      ];
      let cleared = 0;
      for (const d of dirs) {
        const nc = wrap(c + d.dc, MAP_COLS);
        const nr = wrap(r + d.dr, MAP_ROWS);
        if (map[nr][nc] === TILE.CRATE && cleared < 2) {
          map[nr][nc] = TILE.EMPTY;
          io.emit("mapUpdate", { c: nc, r: nr, val: TILE.EMPTY });
          cleared++;
        }
      }
      return { x: c * TILE_SIZE + TILE_SIZE / 2, y: r * TILE_SIZE + TILE_SIZE / 2 };
    }
  }
}

const TARGET_CRATE_RATIO = 0.35; // Поддерживаем минимум 35% ящиков на карте
const REGEN_INTERVAL_TICKS = 90; // Попытка начать регенерацию каждые 1.5 секунды
const WARNING_DURATION_TICKS = 120; // 2 секунды предупреждения перед появлением ящика

let regenCooldown = REGEN_INTERVAL_TICKS;

// Проверяет, свободна ли клетка (c, r) от игроков, бомб, взрывов, бонусов и других предупреждений
function isCellCompletelyFree(
  c: number,
  r: number,
  map: number[][],
  players: Record<string, Player>,
  bombs: Bomb[],
  explosions: Explosion[],
  powerups: Powerup[],
  warnings: CrateSpawnWarning[],
): boolean {
  if (map[r][c] !== TILE.EMPTY) return false;
  if (bombs.some((b) => b.c === c && b.r === r)) return false;
  if (powerups.some((pw) => pw.c === c && pw.r === r)) return false;
  if (warnings.some((w) => w.c === c && w.r === r)) return false;
  if (explosions.some((exp) => exp.tiles.some((t) => t.c === c && t.r === r))) return false;

  for (const id in players) {
    const p = players[id];
    if (!p.alive) continue;
    const pc = wrap(Math.floor(p.x / TILE_SIZE), MAP_COLS);
    const pr = wrap(Math.floor(p.y / TILE_SIZE), MAP_ROWS);
    if (pc === c && pr === r) return false;
  }

  return true;
}

export function updateCrateRegeneration(
  map: number[][],
  players: Record<string, Player>,
  bombs: Bomb[],
  explosions: Explosion[],
  powerups: Powerup[],
  warnings: CrateSpawnWarning[],
  io: Server,
): void {
  // 1. Обновляем активные предупреждения
  for (let i = warnings.length - 1; i >= 0; i--) {
    const w = warnings[i];
    w.ticksLeft--;

    if (w.ticksLeft <= 0) {
      warnings.splice(i, 1);

      // Проверяем перед самым появлением, что никто не забежал в эту клетку
      if (isCellCompletelyFree(w.c, w.r, map, players, bombs, explosions, powerups, warnings)) {
        map[w.r][w.c] = TILE.CRATE;
        io.emit("mapUpdate", { c: w.c, r: w.r, val: TILE.CRATE });
      }
    }
  }

  // 2. Периодически запускаем спавн нового ящика, если карта опустела
  regenCooldown--;
  if (regenCooldown > 0) return;
  regenCooldown = REGEN_INTERVAL_TICKS;

  // Считаем текущее количество ящиков на карте
  let currentCrates = 0;
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (map[r][c] === TILE.CRATE) currentCrates++;
    }
  }

  const maxTargetCrates = Math.floor(MAP_COLS * MAP_ROWS * TARGET_CRATE_RATIO);
  if (currentCrates + warnings.length >= maxTargetCrates) return;

  // Делаем до 30 случайных попыток найти подходящую пустую клетку
  for (let attempt = 0; attempt < 30; attempt++) {
    const c = Math.floor(Math.random() * MAP_COLS);
    const r = Math.floor(Math.random() * MAP_ROWS);

    if (isCellCompletelyFree(c, r, map, players, bombs, explosions, powerups, warnings)) {
      warnings.push({
        c,
        r,
        ticksLeft: WARNING_DURATION_TICKS,
      });
      break;
    }
  }
}

function pickWalkableOrCrate(r: number, c: number, crateChance: number): number {
  // Используем плавную тригонометрическую волну, чтобы лес рос «островками» (рощами), а не одиночными кустами
  const forestWave = Math.sin(r * 0.7) * Math.cos(c * 0.7) + Math.sin((r + c) * 0.4);
  if (forestWave > 1.05) {
    return TILE.FOREST;
  }
  return Math.random() < crateChance ? TILE.CRATE : TILE.EMPTY;
}

// Размещает укрепленные сундуки на карте и возвращает словарь их прочности (по 4 HP)
export function spawnChests(map: number[][], count: number = 4): Record<string, number> {
  const chestHp: Record<string, number> = {};
  let placed = 0;

  for (let attempt = 0; attempt < 200 && placed < count; attempt++) {
    const c = Math.floor(Math.random() * MAP_COLS);
    const r = Math.floor(Math.random() * MAP_ROWS);

    if (map[r][c] === TILE.EMPTY || map[r][c] === TILE.CRATE) {
      map[r][c] = TILE.CHEST;
      chestHp[`${c},${r}`] = 4;
      placed++;
    }
  }
  return chestHp;
}
