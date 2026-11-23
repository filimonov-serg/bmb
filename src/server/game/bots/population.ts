import { Server } from "socket.io";
import { BASE_STATS } from "../constants";
import { getSpawnPoint } from "../map";
import { ServerGameState } from "../bombs";

const TARGET_POPULATION = 6; // Целевое количество бойцов на арене (люди + боты)
const BOT_NAMES = [
  "[BOT] Sparky",
  "[BOT] Pyro",
  "[BOT] Blast",
  "[BOT] Fuse",
  "[BOT] Nitro",
  "[BOT] Boom",
  "[BOT] Rex",
  "[BOT] Nova",
];

export interface BotMemory {
  thinkTicks: number;
  targetDir: { dx: number; dy: number };
}

let botCounter = 0;
export const botMemories = new Map<string, BotMemory>();

export function syncBotPopulation(state: ServerGameState, io: Server): void {
  const allPlayers = Object.values(state.players);
  const humans = allPlayers.filter((p) => !p.isBot);
  const bots = allPlayers.filter((p) => p.isBot);

  // Если людей нет на сервере — удаляем всех ботов для экономии CPU
  if (humans.length === 0) {
    for (const b of bots) {
      delete state.players[b.id];
      botMemories.delete(b.id);
    }
    return;
  }

  const desiredBots = Math.max(0, TARGET_POPULATION - humans.length);

  if (bots.length < desiredBots) {
    const botId = `bot_${++botCounter}`;
    const name = BOT_NAMES[botCounter % BOT_NAMES.length];
    const spawn = getSpawnPoint(state.map, state.bombs, state.explosions, io);

    state.players[botId] = {
      id: botId,
      name,
      isBot: true,
      x: spawn.x,
      y: spawn.y,
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
      speed: BASE_STATS.SPEED,
      maxBombs: BASE_STATS.MAX_BOMBS,
      activeBombs: 0,
      range: BASE_STATS.RANGE,
      canKick: false,
      kills: 0,
      deaths: 0,
      alive: true,
      input: { up: false, down: false, left: false, right: false },
      shieldTicks: 0,
    };
    botMemories.set(botId, { thinkTicks: 0, targetDir: { dx: 0, dy: 0 } });
  } else if (bots.length > desiredBots) {
    const botToRemove = bots.find((b) => !b.alive) || bots[bots.length - 1];
    if (botToRemove) {
      delete state.players[botToRemove.id];
      botMemories.delete(botToRemove.id);
    }
  }
}
