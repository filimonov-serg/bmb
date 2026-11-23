import { Server } from "socket.io";
import { Player, POWERUP_LIMITS, PowerupType } from "../../../shared/types";
import { wrap, wrappedDelta } from "../../../shared/utils";
import { MAP_COLS, MAP_ROWS, TILE, TILE_SIZE } from "../constants";
import { placeBomb, ServerGameState } from "../bombs";
import { botMemories, syncBotPopulation } from "./population";
import { findStepTowards, getDangerSet } from "./pathfinding";

// Проверка, нужен ли боту этот перк (не достигнут ли максимум)
function isUsefulPowerup(bot: Player, type: PowerupType): boolean {
  if (type === "bomb") return bot.maxBombs < POWERUP_LIMITS.MAX_BOMBS;
  if (type === "fire") return bot.range < POWERUP_LIMITS.MAX_RANGE;
  if (type === "speed") return bot.speed < POWERUP_LIMITS.MAX_SPEED;
  if (type === "kick") return !bot.canKick;
  return false;
}

// Проверяет, стоит ли рядом твердая бомба, которую можно пнуть в врага или в полезный перк
function findKickOpportunity(
  bot: Player,
  col: number,
  row: number,
  state: ServerGameState,
): { dc: number; dr: number } | null {
  if (!bot.canKick) return null;

  const dirs = [
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: 0, dr: -1 },
  ];

  for (const d of dirs) {
    const bombC = wrap(col + d.dc, MAP_COLS);
    const bombR = wrap(row + d.dr, MAP_ROWS);
    const bomb = state.bombs.find((b) => b.c === bombC && b.r === bombR);

    // Бомба должна быть твердой и стоящей на месте
    if (!bomb || bomb.passableBy.includes(bot.id) || bomb.vx !== 0 || bomb.vy !== 0) continue;

    // Проверяем траекторию полета бомбы на 10 клеток вперед
    let scanC = bombC;
    let scanR = bombR;
    for (let step = 1; step <= 10; step++) {
      scanC = wrap(scanC + d.dc, MAP_COLS);
      scanR = wrap(scanR + d.dr, MAP_ROWS);

      const tile = state.map[scanR][scanC];
      if (tile === TILE.WALL || tile === TILE.CRATE) break;
      if (state.bombs.some((b) => b.c === scanC && b.r === scanR)) break;

      // 1. На линии выстрела стоит видимый враг!
      const enemyOnLine = Object.values(state.players).some((other) => {
        if (other.id === bot.id || !other.alive) return false;
        const oc = wrap(Math.floor(other.x / TILE_SIZE), MAP_COLS);
        const or = wrap(Math.floor(other.y / TILE_SIZE), MAP_ROWS);
        if (state.map[or][oc] === TILE.FOREST) return false; // Врага в лесу бот не видит
        return oc === scanC && or === scanR;
      });

      // 2. Или на линии лежит полезный перк, который бомба принесет боту!
      const perkOnLine = state.powerups.some(
        (pw) => pw.c === scanC && pw.r === scanR && isUsefulPowerup(bot, pw.type),
      );

      if (enemyOnLine || perkOnLine) {
        return d; // Делаем шаг в сторону бомбы, чтобы пнуть ее!
      }
    }
  }

  return null;
}

function hasVisibleEnemyWithin(
  c: number,
  r: number,
  maxDist: number,
  botId: string,
  state: ServerGameState,
): boolean {
  return Object.values(state.players).some((other) => {
    if (other.id === botId || !other.alive) return false;
    const oc = wrap(Math.floor(other.x / TILE_SIZE), MAP_COLS);
    const or = wrap(Math.floor(other.y / TILE_SIZE), MAP_ROWS);
    if (state.map[or][oc] === TILE.FOREST) return false;
    return (
      Math.abs(wrappedDelta(c, oc, MAP_COLS)) + Math.abs(wrappedDelta(r, or, MAP_ROWS)) <= maxDist
    );
  });
}

function hasAdjacentCrate(c: number, r: number, state: ServerGameState): boolean {
  const dirs = [
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: 0, dr: -1 },
  ];
  return dirs.some(
    (d) => state.map[wrap(r + d.dr, MAP_ROWS)][wrap(c + d.dc, MAP_COLS)] === TILE.CRATE,
  );
}

function applyBotControls(
  bot: Player,
  col: number,
  row: number,
  targetDir: { dx: number; dy: number },
): void {
  const centerX = col * TILE_SIZE + TILE_SIZE / 2;
  const centerY = row * TILE_SIZE + TILE_SIZE / 2;

  bot.input = { up: false, down: false, left: false, right: false };

  if (targetDir.dx !== 0) {
    if (targetDir.dx > 0) bot.input.right = true;
    else bot.input.left = true;

    if (Math.abs(centerY - bot.y) > 4) {
      if (centerY > bot.y) bot.input.down = true;
      else bot.input.up = true;
    }
  } else if (targetDir.dy !== 0) {
    if (targetDir.dy > 0) bot.input.down = true;
    else bot.input.up = true;

    if (Math.abs(centerX - bot.x) > 4) {
      if (centerX > bot.x) bot.input.right = true;
      else bot.input.left = true;
    }
  }
}

export function updateBots(state: ServerGameState, io: Server): void {
  syncBotPopulation(state, io);
  const danger = getDangerSet(state);

  for (const id in state.players) {
    const bot = state.players[id];
    if (!bot.isBot || !bot.alive) continue;

    const mem = botMemories.get(id) || { thinkTicks: 0, targetDir: { dx: 0, dy: 0 } };
    botMemories.set(id, mem);

    const col = wrap(Math.floor(bot.x / TILE_SIZE), MAP_COLS);
    const row = wrap(Math.floor(bot.y / TILE_SIZE), MAP_ROWS);
    const inDanger = danger.has(`${col},${row}`);
    const inForest = state.map[row][col] === TILE.FOREST;

    mem.thinkTicks--;
    if (mem.thinkTicks <= 0 || inDanger) {
      mem.thinkTicks = 7 + Math.floor(Math.random() * 5);
      let step: { dc: number; dr: number } | null = null;

      if (inDanger) {
        // 1. Побег из зоны поражения (включая траектории летящих бомб)
        step = findStepTowards(col, row, (c, r) => !danger.has(`${c},${r}`), null, state, id, 10);
      } else {
        // 2. Проверяем, можно ли прямо сейчас пнуть соседнюю бомбу в врага или в перк!
        step = findKickOpportunity(bot, col, row, state);

        // 3. Тактика засады: если бот в лесу и рядом идет враг (в 3-4 клетках) — замираем и ждем!
        if (
          !step &&
          inForest &&
          hasVisibleEnemyWithin(col, row, 4, id, state) &&
          !hasVisibleEnemyWithin(col, row, 1, id, state)
        ) {
          step = null; // Стоим тихо в кустах
        } else {
          // 4. Ищем только ПОЛЕЗНЫЙ безопасный бонус
          if (!step) {
            step = findStepTowards(
              col,
              row,
              (c, r) =>
                state.powerups.some(
                  (pw) => pw.c === c && pw.r === r && isUsefulPowerup(bot, pw.type),
                ),
              danger,
              state,
              id,
              9,
            );
          }

          // 5. Охота на видимого врага или поиск ящиков
          if (!step) {
            step = findStepTowards(
              col,
              row,
              (c, r) => hasVisibleEnemyWithin(c, r, 2, id, state) || hasAdjacentCrate(c, r, state),
              danger,
              state,
              id,
              12,
            );
          }
        }

        // 6. Безопасная установка бомбы
        if (
          bot.activeBombs < bot.maxBombs &&
          !state.bombs.some((b) => b.c === col && b.r === row)
        ) {
          // В лесу бот ставит бомбу только когда враг подошел вплотную (<= 2 клеток), чтобы не выдать засаду раньше времени
          const attackRange = inForest ? 2 : bot.range;
          const shouldAttack =
            hasVisibleEnemyWithin(col, row, attackRange, id, state) ||
            (!inForest && hasAdjacentCrate(col, row, state));

          if (shouldAttack) {
            const futureDanger = getDangerSet(state, { c: col, r: row, range: bot.range });
            const escapeStep = findStepTowards(
              col,
              row,
              (c, r) => !futureDanger.has(`${c},${r}`),
              null,
              state,
              id,
              6,
            );

            if (escapeStep) {
              placeBomb(bot, id, state.players, state.bombs);
              step = escapeStep;
            }
          }
        }
      }

      mem.targetDir = step ? { dx: step.dc, dy: step.dr } : { dx: 0, dy: 0 };
    }

    applyBotControls(bot, col, row, mem.targetDir);
  }
}
