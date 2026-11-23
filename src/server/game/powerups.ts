import { Bomb, Explosion, Player, Powerup, PowerupType, POWERUP_LIMITS } from "../../shared/types";
import { wrap } from "../../shared/utils";
import { BASE_STATS, MAP_COLS, MAP_ROWS, TICK_RATE, TILE, TILE_SIZE } from "./constants";

const DROP_CHANCE = 0.35;
const TYPES: PowerupType[] = ["bomb", "fire", "speed", "kick"];
const SHIELD_DURATION_TICKS = TICK_RATE * 15; // Ровно 15 секунд (900 тиков при 60 TPS)

let powerupCounter = 0;

export function trySpawnPowerup(c: number, r: number, powerups: Powerup[]): void {
  if (Math.random() > DROP_CHANCE) return;

  const type = TYPES[Math.floor(Math.random() * TYPES.length)];
  powerups.push({
    id: `pw_${++powerupCounter}`,
    c,
    r,
    type,
    spawnProtection: 35,
  });
}

export function spawnSpecificPowerup(
  c: number,
  r: number,
  type: PowerupType,
  powerups: Powerup[],
): void {
  powerups.push({
    id: `pw_${++powerupCounter}`,
    c,
    r,
    type,
    spawnProtection: 35,
  });
}

export function updatePowerups(
  players: Record<string, Player>,
  bombs: Bomb[],
  powerups: Powerup[],
  explosions: Explosion[],
): void {
  // 1. Уменьшаем таймер щита СТРОГО ОДИН РАЗ за тик (вне цикла по бонусам!)
  for (const id in players) {
    if (players[id].shieldTicks > 0) {
      players[id].shieldTicks--;
    }
  }

  // 2. Обрабатываем сами бонусы на карте
  for (let i = powerups.length - 1; i >= 0; i--) {
    const pw = powerups[i];

    if (pw.spawnProtection > 0) {
      pw.spawnProtection--;
    }

    // Подбор живым игроком
    let pickedUp = false;
    for (const id in players) {
      const p = players[id];
      if (!p.alive) continue;

      const pc = wrap(Math.floor(p.x / TILE_SIZE), MAP_COLS);
      const pr = wrap(Math.floor(p.y / TILE_SIZE), MAP_ROWS);

      if (pc === pw.c && pr === pw.r) {
        if (applyPowerup(p, pw.type)) {
          powerups.splice(i, 1);
          pickedUp = true;
          break;
        }
      }
    }
    if (pickedUp) continue;

    // Подбор летящей бомбой для игрока, который ее толкнул
    let collectedByBomb = false;
    for (const b of bombs) {
      if ((b.vx !== 0 || b.vy !== 0) && b.c === pw.c && b.r === pw.r && b.kickedBy) {
        const kicker = players[b.kickedBy];
        if (kicker && kicker.alive && applyPowerup(kicker, pw.type)) {
          powerups.splice(i, 1);
          collectedByBomb = true;
          break;
        }
      }
    }
    if (collectedByBomb) continue;

    // Сгорание в огне после окончания защиты спавна
    if (pw.spawnProtection <= 0) {
      const inFire = explosions.some((exp) => exp.tiles.some((t) => t.c === pw.c && t.r === pw.r));
      if (inFire) {
        powerups.splice(i, 1);
      }
    }
  }
}

function applyPowerup(player: Player, type: PowerupType): boolean {
  if (type === "bomb") {
    if (player.maxBombs >= POWERUP_LIMITS.MAX_BOMBS) return false;
    player.maxBombs++;
    return true;
  }

  if (type === "fire") {
    if (player.range >= POWERUP_LIMITS.MAX_RANGE) return false;
    player.range++;
    return true;
  }

  if (type === "speed") {
    if (player.speed >= POWERUP_LIMITS.MAX_SPEED) return false;
    player.speed = Math.min(POWERUP_LIMITS.MAX_SPEED, Number((player.speed + 0.4).toFixed(2)));
    return true;
  }

  if (type === "kick") {
    if (player.canKick) return false;
    player.canKick = true;
    return true;
  }

  if (type === "shield") {
    player.shieldTicks = SHIELD_DURATION_TICKS;
    return true;
  }

  return false;
}

export function dropPlayerPowerups(
  player: Player,
  map: number[][],
  bombs: Bomb[],
  powerups: Powerup[],
): void {
  const loot: PowerupType[] = [];

  if (player.canKick) {
    loot.push("kick");
    player.canKick = false;
  }

  const extraBombs = Math.max(0, player.maxBombs - BASE_STATS.MAX_BOMBS);
  for (let i = 0; i < extraBombs; i++) loot.push("bomb");

  const extraRange = Math.max(0, player.range - BASE_STATS.RANGE);
  for (let i = 0; i < extraRange; i++) loot.push("fire");

  const extraSpeed = Math.max(0, Math.round((player.speed - BASE_STATS.SPEED) / 0.4));
  for (let i = 0; i < extraSpeed; i++) loot.push("speed");

  player.maxBombs = BASE_STATS.MAX_BOMBS;
  player.range = BASE_STATS.RANGE;
  player.speed = BASE_STATS.SPEED;

  if (loot.length === 0) return;

  const startC = wrap(Math.floor(player.x / TILE_SIZE), MAP_COLS);
  const startR = wrap(Math.floor(player.y / TILE_SIZE), MAP_ROWS);
  const visited = new Set<string>([`${startC},${startR}`]);
  const queue: { c: number; r: number }[] = [{ c: startC, r: startR }];
  const freeTiles: { c: number; r: number }[] = [];
  const dirs = [
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: 0, dr: -1 },
  ];

  while (queue.length > 0 && freeTiles.length < loot.length) {
    const curr = queue.shift()!;

    const isEmpty = map[curr.r]?.[curr.c] === TILE.EMPTY;
    const hasBomb = bombs.some((b) => b.c === curr.c && b.r === curr.r);
    const hasPowerup = powerups.some((pw) => pw.c === curr.c && pw.r === curr.r);

    if (isEmpty && !hasBomb && !hasPowerup) {
      freeTiles.push(curr);
    }

    for (const d of dirs) {
      const nc = wrap(curr.c + d.dc, MAP_COLS);
      const nr = wrap(curr.r + d.dr, MAP_ROWS);
      const key = `${nc},${nr}`;

      if (!visited.has(key) && map[nr][nc] === TILE.EMPTY) {
        visited.add(key);
        queue.push({ c: nc, r: nr });
      }
    }
  }

  const count = Math.min(loot.length, freeTiles.length);
  for (let i = 0; i < count; i++) {
    powerups.push({
      id: `pw_${++powerupCounter}`,
      c: freeTiles[i].c,
      r: freeTiles[i].r,
      type: loot[i],
      spawnProtection: 45,
    });
  }
}
