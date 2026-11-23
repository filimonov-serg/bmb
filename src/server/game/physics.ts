import { Bomb, Player } from "../../shared/types";
import { wrap, wrappedDelta } from "../../shared/utils";
import {
  TILE_SIZE,
  MAP_COLS,
  MAP_ROWS,
  SLIDE_THRESHOLD,
  PLAYER_RADIUS_RATIO,
  TILE,
} from "./constants";

const WORLD_WIDTH = MAP_COLS * TILE_SIZE;
const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE;

function isTileWalkable(
  map: number[][],
  bombs: Bomb[],
  rawC: number,
  rawR: number,
  playerId: string,
): boolean {
  const c = wrap(rawC, MAP_COLS);
  const r = wrap(rawR, MAP_ROWS);

  if (map[r][c] === TILE.WALL || map[r][c] === TILE.CRATE || map[r][c] === TILE.CHEST) return false;

  const bomb = bombs.find((b) => b.c === c && b.r === r);
  if (bomb) {
    return bomb.passableBy.includes(playerId);
  }
  return true;
}

function canMove(
  map: number[][],
  bombs: Bomb[],
  x: number,
  y: number,
  radius: number,
  playerId: string,
): boolean {
  const points = [
    { x: x - radius, y: y - radius },
    { x: x + radius, y: y - radius },
    { x: x - radius, y: y + radius },
    { x: x + radius, y: y + radius },
  ];
  for (const p of points) {
    const c = Math.floor(p.x / TILE_SIZE);
    const r = Math.floor(p.y / TILE_SIZE);
    if (!isTileWalkable(map, bombs, c, r, playerId)) {
      return false;
    }
  }
  return true;
}

export function updatePlayersMovement(
  players: Record<string, Player>,
  map: number[][],
  bombs: Bomb[],
): void {
  const radius = TILE_SIZE * PLAYER_RADIUS_RATIO;

  for (const id in players) {
    const p = players[id];
    if (!p.alive) continue;

    let dx = 0,
      dy = 0;
    if (p.input.up) dy -= p.speed;
    if (p.input.down) dy += p.speed;
    if (p.input.left) dx -= p.speed;
    if (p.input.right) dx += p.speed;

    const col = Math.floor(p.x / TILE_SIZE);
    const row = Math.floor(p.y / TILE_SIZE);
    const centerX = col * TILE_SIZE + TILE_SIZE / 2;
    const centerY = row * TILE_SIZE + TILE_SIZE / 2;

    if (dx !== 0) {
      if (canMove(map, bombs, p.x + dx, p.y, radius, id)) {
        p.x += dx;
      } else {
        // Пытаемся пнуть бомбу перед собой!
        tryKickBomb(p, id, Math.sign(dx), 0, map, bombs, players);

        if (dy === 0) {
          const nextCol = col + Math.sign(dx);
          if (isTileWalkable(map, bombs, nextCol, row, id)) {
            const diffY = centerY - p.y;
            if (Math.abs(diffY) <= SLIDE_THRESHOLD) {
              p.y += Math.sign(diffY) * Math.min(p.speed, Math.abs(diffY));
            }
          }
        }
      }
    }

    if (dy !== 0) {
      if (canMove(map, bombs, p.x, p.y + dy, radius, id)) {
        p.y += dy;
      } else {
        // Пытаемся пнуть бомбу перед собой!
        tryKickBomb(p, id, 0, Math.sign(dy), map, bombs, players);

        if (dx === 0) {
          const nextRow = row + Math.sign(dy);
          if (isTileWalkable(map, bombs, col, nextRow, id)) {
            const diffX = centerX - p.x;
            if (Math.abs(diffX) <= SLIDE_THRESHOLD) {
              p.x += Math.sign(diffX) * Math.min(p.speed, Math.abs(diffX));
            }
          }
        }
      }
    }

    // Бесшовный перенос координат игрока при пересечении края мира
    p.x = wrap(p.x, WORLD_WIDTH);
    p.y = wrap(p.y, WORLD_HEIGHT);
  }

  // Проверка выхода с бомбы с учетом кратчайшего расстояния через край
  for (const b of bombs) {
    const bombCenterX = b.c * TILE_SIZE + TILE_SIZE / 2;
    const bombCenterY = b.r * TILE_SIZE + TILE_SIZE / 2;
    const halfTile = TILE_SIZE / 2;

    b.passableBy = b.passableBy.filter((id) => {
      const pl = players[id];
      if (!pl || !pl.alive) return false;
      const distX = Math.abs(wrappedDelta(pl.x, bombCenterX, WORLD_WIDTH));
      const distY = Math.abs(wrappedDelta(pl.y, bombCenterY, WORLD_HEIGHT));
      return distX < halfTile + radius && distY < halfTile + radius;
    });
  }
}

// Проверка, может ли бомба сдвинуться на следующую клетку
export function canBombSlideTo(
  map: number[][],
  bombs: Bomb[],
  players: Record<string, Player>,
  rawC: number,
  rawR: number,
): boolean {
  const c = wrap(rawC, MAP_COLS);
  const r = wrap(rawR, MAP_ROWS);

  if (map[r][c] === TILE.WALL || map[r][c] === TILE.CRATE || map[r][c] === TILE.CHEST) return false;

  if (bombs.some((b) => b.c === c && b.r === r)) return false;

  // Бомба останавливается, если на пути стоит живой игрок
  for (const id in players) {
    const p = players[id];
    if (!p.alive) continue;
    if (Math.floor(p.x / TILE_SIZE) === c && Math.floor(p.y / TILE_SIZE) === r) {
      return false;
    }
  }
  return true;
}

function tryKickBomb(
  player: Player,
  playerId: string,
  dirX: number,
  dirY: number,
  map: number[][],
  bombs: Bomb[],
  players: Record<string, Player>,
): void {
  if (!player.canKick) return;

  const col = Math.floor(player.x / TILE_SIZE);
  const row = Math.floor(player.y / TILE_SIZE);
  const targetC = wrap(col + dirX, MAP_COLS);
  const targetR = wrap(row + dirY, MAP_ROWS);

  const bomb = bombs.find((b) => b.c === targetC && b.r === targetR);
  // Пинаем только твердую бомбу (с которой игрок уже сошел) и если за ней свободно
  if (bomb && !bomb.passableBy.includes(playerId)) {
    if (canBombSlideTo(map, bombs, players, targetC + dirX, targetR + dirY)) {
      bomb.vx = dirX;
      bomb.vy = dirY;
      bomb.kickedBy = playerId;
    }
  }
}
