import { Server } from "socket.io";
import {
  Bomb,
  CrateSpawnWarning,
  Explosion,
  MapTemplate,
  Player,
  Powerup,
  TileCoord,
} from "../../shared/types";
import { TILE_SIZE, MAP_COLS, MAP_ROWS, PLAYER_RADIUS_RATIO, TILE } from "./constants";
import { getSpawnPoint } from "./map";
import { dropPlayerPowerups, spawnSpecificPowerup, trySpawnPowerup } from "./powerups";
import { wrap } from "../../shared/utils";
import { canBombSlideTo } from "./physics";

export interface ServerGameState {
  map: number[][];
  players: Record<string, Player>;
  bombs: Bomb[];
  explosions: Explosion[];
  powerups: Powerup[]; // Добавили в состояние сервера
  crateWarnings: CrateSpawnWarning[]; // Добавили в состояние
  roundId: number;
  roundTicksLeft: number;
  template: MapTemplate;
  chestHp: Record<string, number>;
}

const WORLD_WIDTH = MAP_COLS * TILE_SIZE;
const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE;
const BOMB_SLIDE_SPEED = 7; // Скорость катящейся бомбы (пикселей за тик при 60 TPS)

let bombCounter = 0;

export function placeBomb(
  player: Player | undefined,
  playerId: string,
  players: Record<string, Player>,
  bombs: Bomb[],
): void {
  if (!player || !player.alive || player.activeBombs >= player.maxBombs) return;

  const c = wrap(Math.floor(player.x / TILE_SIZE), MAP_COLS);
  const r = wrap(Math.floor(player.y / TILE_SIZE), MAP_ROWS);

  if (bombs.some((b) => b.c === c && b.r === r)) return;

  player.activeBombs++;
  const radius = TILE_SIZE * PLAYER_RADIUS_RATIO;
  const passableBy: string[] = [];

  for (const id in players) {
    const pl = players[id];
    if (!pl.alive) continue;
    const overlapsX = pl.x + radius > c * TILE_SIZE && pl.x - radius < (c + 1) * TILE_SIZE;
    const overlapsY = pl.y + radius > r * TILE_SIZE && pl.y - radius < (r + 1) * TILE_SIZE;
    if (overlapsX && overlapsY) passableBy.push(id);
  }

  bombs.push({
    id: `bomb_${++bombCounter}`,
    c,
    r,
    x: c * TILE_SIZE + TILE_SIZE / 2,
    y: r * TILE_SIZE + TILE_SIZE / 2,
    ownerId: playerId,
    kickedBy: null, // Пока бомбу никто не пинал
    range: player.range,
    timer: 150,
    passableBy,
    vx: 0,
    vy: 0,
  });
}

function detonateBomb(bomb: Bomb, state: ServerGameState, io: Server): void {
  const { map, players, bombs, explosions } = state;
  const idx = bombs.indexOf(bomb);
  if (idx === -1) return;
  bombs.splice(idx, 1);

  const owner = players[bomb.ownerId];
  if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);

  const dirs = [
    { dc: 0, dr: 0 },
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: 0, dr: -1 },
  ];
  const affectedTiles: TileCoord[] = [];

  for (const d of dirs) {
    const steps = d.dc === 0 && d.dr === 0 ? 0 : bomb.range;
    for (let i = d.dc === 0 && d.dr === 0 ? 0 : 1; i <= steps; i++) {
      const nc = wrap(bomb.c + d.dc * i, MAP_COLS);
      const nr = wrap(bomb.r + d.dr * i, MAP_ROWS);

      if (map[nr][nc] === TILE.WALL) break;
      if (map[nr][nc] === TILE.CHEST) {
        const key = `${nc},${nr}`;
        const currentHp = (state.chestHp[key] ?? 4) - 1;

        if (currentHp <= 0) {
          // Сундук разрушен с 4-го взрыва — превращаем в пол и спавним Щит!
          delete state.chestHp[key];
          map[nr][nc] = TILE.EMPTY;
          io.emit("mapUpdate", { c: nc, r: nr, val: TILE.EMPTY });
          spawnSpecificPowerup(nc, nr, "shield", state.powerups);
        } else {
          // Сундук получил повреждение, но еще держится
          state.chestHp[key] = currentHp;
        }
        break; // Луч огня останавливается о сундук
      }

      affectedTiles.push({ c: nc, r: nr });

      const otherBomb = bombs.find((b) => b.c === nc && b.r === nr);
      if (otherBomb) detonateBomb(otherBomb, state, io);

      if (map[nr][nc] === TILE.CRATE) {
        map[nr][nc] = TILE.EMPTY;
        io.emit("mapUpdate", { c: nc, r: nr, val: TILE.EMPTY });
        trySpawnPowerup(nc, nr, state.powerups); // Пытаемся выбить бонус!
        break;
      }
    }
  }

  const killerId = bomb.kickedBy || bomb.ownerId;
  explosions.push({ tiles: affectedTiles, timer: 30, ownerId: killerId });
}

export function updateBombsAndExplosions(state: ServerGameState, io: Server): void {
  const { map, players, bombs, explosions } = state;

  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    if (!b) continue;

    // Плавное пиксельное скольжение пнутой бомбы
    if (b.vx !== 0 || b.vy !== 0) {
      b.passableBy = []; // В движении бомба твердая для всех

      const nextX = wrap(b.x + b.vx * BOMB_SLIDE_SPEED, WORLD_WIDTH);
      const nextY = wrap(b.y + b.vy * BOMB_SLIDE_SPEED, WORLD_HEIGHT);

      // Проверяем передний край бомбы (с учетом половины тайла), не уперлась ли она в препятствие
      const frontX = nextX + b.vx * (TILE_SIZE / 2 - 1);
      const frontY = nextY + b.vy * (TILE_SIZE / 2 - 1);
      const frontC = wrap(Math.floor(frontX / TILE_SIZE), MAP_COLS);
      const frontR = wrap(Math.floor(frontY / TILE_SIZE), MAP_ROWS);

      // Если передний край входит в новую клетку — проверяем, свободна ли она
      if (
        (frontC !== b.c || frontR !== b.r) &&
        !canBombSlideTo(map, bombs, players, frontC, frontR)
      ) {
        b.x = b.c * TILE_SIZE + TILE_SIZE / 2;
        b.y = b.r * TILE_SIZE + TILE_SIZE / 2;
        b.vx = 0;
        b.vy = 0;
        // b.kickedBy пока НЕ сбрасываем, вдруг она остановилась прямо в огне!
      } else {
        b.x = nextX;
        b.y = nextY;
        b.c = wrap(Math.floor(b.x / TILE_SIZE), MAP_COLS);
        b.r = wrap(Math.floor(b.y / TILE_SIZE), MAP_ROWS);
      }
    }

    b.timer--;
    const inFire = explosions.some((exp) => exp.tiles.some((t) => t.c === b.c && t.r === b.r));

    if (b.timer <= 0 || inFire) {
      detonateBomb(b, state, io);
    } else if (b.vx === 0 && b.vy === 0) {
      b.kickedBy = null; // Бомба остановилась и не взорвалась — теперь сбрасываем толкающего
    }
  }

  for (let i = explosions.length - 1; i >= 0; i--) {
    const exp = explosions[i];
    for (const id in players) {
      const p = players[id];
      if (!p.alive || p.shieldTicks > 0) continue; // Игрок под щитом неуязвим к взрывам!

      const pc = wrap(Math.floor(p.x / TILE_SIZE), MAP_COLS);
      const pr = wrap(Math.floor(p.y / TILE_SIZE), MAP_ROWS);

      if (exp.tiles.some((t) => t.c === pc && t.r === pr)) {
        p.alive = false;
        p.deaths++; // +1 смерть погибшему

        // Начисляем фраг владельцу бомбы, если это не самоубийство
        if (exp.ownerId && exp.ownerId !== id && players[exp.ownerId]) {
          players[exp.ownerId].kills++;
        }

        dropPlayerPowerups(p, map, bombs, state.powerups);

        const deathRoundId = state.roundId;
        setTimeout(() => {
          if (players[id] && state.roundId === deathRoundId) {
            const sp = getSpawnPoint(map, bombs, explosions, io);
            players[id].x = sp.x;
            players[id].y = sp.y;
            players[id].alive = true;
          }
        }, 3000);
      }
    }
    exp.timer--;
    if (exp.timer <= 0) explosions.splice(i, 1);
  }
}
