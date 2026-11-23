import { InitPayload, MapTemplate, PublicGameState } from "../shared/types";
import { wrappedDelta } from "../shared/utils";
import { sound } from "./sound";
import { particles } from "./particles";
import { cameraShake } from "./camera";
import { Direction } from "./sprites";
import { addScorchMarks, clearScorchMarks } from "./worldRenderer";
import { floatingText } from "./floatingText";

export interface RenderPlayer {
  name: string;
  x: number;
  y: number;
  color: string;
  alive: boolean;
  facing: Direction;
  walkTime: number;
}

export interface RenderBomb {
  x: number;
  y: number;
  wasMoving: boolean;
}

export interface ClientGameData {
  myId: string | null;
  map: number[][];
  tileSize: number;
  template: MapTemplate;
  serverState: PublicGameState;
  renderPlayers: Record<string, RenderPlayer>;
  renderBombs: Record<string, RenderBomb>;
}

export function setupNetwork(socket: any, gameData: ClientGameData): void {
  let prevStats: {
    maxBombs: number;
    range: number;
    speed: number;
    canKick: boolean;
    kills: number;
    alive: boolean;
    shieldTicks: number;
  } | null = null;

  socket.on("init", (data: InitPayload) => {
    gameData.myId = data.id;
    gameData.map = data.map;
    gameData.tileSize = data.tileSize;
    gameData.template = data.template;
  });

  socket.on("roundStart", ({ map, template }: { map: number[][]; template: MapTemplate }) => {
    gameData.map = map;
    gameData.template = template;
    particles.clear();
    clearScorchMarks();
    floatingText.clear();
    cameraShake.reset();
  });

  socket.on("mapUpdate", ({ c, r, val }: { c: number; r: number; val: number }) => {
    if (gameData.map[r]) {
      const oldVal = gameData.map[r][c];
      gameData.map[r][c] = val;

      // Если в клетке был ящик (2) или сундук (4) и она стала пустой (0) — пускаем щепки
      if ((oldVal === 2 || oldVal === 4) && val === 0) {
        const wx = c * gameData.tileSize + gameData.tileSize / 2;
        const wy = r * gameData.tileSize + gameData.tileSize / 2;
        particles.spawnCrateDebris(wx, wy);
      }
    }
  });

  socket.on("state", (newState: PublicGameState) => {
    const myId = gameData.myId;
    const me = myId ? newState.players[myId] : null;
    const rows = gameData.map.length;
    const cols = rows > 0 ? gameData.map.length : 0;
    const worldW = cols * gameData.tileSize;
    const worldH = rows * gameData.tileSize;

    // 1. Звуки, тряска и всплывающие надписи для нашего игрока
    if (me) {
      if (prevStats) {
        if (me.maxBombs > prevStats.maxBombs) {
          sound.playPowerup();
          floatingText.spawnPowerupText(me.x, me.y, "bomb");
        } else if (me.range > prevStats.range) {
          sound.playPowerup();
          floatingText.spawnPowerupText(me.x, me.y, "fire");
        } else if (me.speed > prevStats.speed) {
          sound.playPowerup();
          floatingText.spawnPowerupText(me.x, me.y, "speed");
        } else if (me.canKick && !prevStats.canKick) {
          sound.playPowerup();
          floatingText.spawnPowerupText(me.x, me.y, "kick");
        } else if (me.shieldTicks > prevStats.shieldTicks) {
          sound.playPowerup();
          floatingText.spawnPowerupText(me.x, me.y, "shield");
        }

        if (me.kills > prevStats.kills) {
          floatingText.spawn(me.x, me.y - 12, "+1 KILL!", "#ffeaa7");
        }

        if (prevStats.alive && !me.alive) {
          sound.playDeath();
          cameraShake.add(1.0);
        }
      }
      prevStats = {
        maxBombs: me.maxBombs,
        range: me.range,
        speed: me.speed,
        canKick: me.canKick,
        kills: me.kills,
        alive: me.alive,
        shieldTicks: me.shieldTicks,
      };
    }

    // 2. Вспышка частиц при подборе любого бонуса на карте
    const newPowerupIds = new Set(newState.powerups.map((p) => p.id));
    for (const oldPw of gameData.serverState.powerups || []) {
      if (!newPowerupIds.has(oldPw.id)) {
        const inFire = newState.explosions.some((exp) =>
          exp.tiles.some((t) => t.c === oldPw.c && t.r === oldPw.r),
        );
        if (!inFire) {
          const px = oldPw.c * gameData.tileSize + gameData.tileSize / 2;
          const py = oldPw.r * gameData.tileSize + gameData.tileSize / 2;
          particles.spawnPowerupPickup(px, py, oldPw.type);
        }
      }
    }

    // 3. Звук, искры, следы копоти и тряска камеры от каждого нового взрыва (timer === 29)
    for (const exp of newState.explosions) {
      if (exp.timer === 29) {
        addScorchMarks(exp.tiles);

        for (const t of exp.tiles) {
          const tx = t.c * gameData.tileSize + gameData.tileSize / 2;
          const ty = t.r * gameData.tileSize + gameData.tileSize / 2;
          particles.spawnExplosionSparks(tx, ty);
        }

        const centerTile = exp.tiles[0];
        if (centerTile && me && worldW > 0) {
          const expX = centerTile.c * gameData.tileSize + gameData.tileSize / 2;
          const expY = centerTile.r * gameData.tileSize + gameData.tileSize / 2;

          const dist = Math.hypot(
            wrappedDelta(me.x, expX, worldW),
            wrappedDelta(me.y, expY, worldH),
          );

          const maxHearingDist = gameData.tileSize * 18;
          const volume = Math.max(0, 1 - dist / maxHearingDist);
          sound.playExplosion(volume);

          const maxShakeDist = gameData.tileSize * 10;
          const shakeIntensity = Math.max(0, 1 - dist / maxShakeDist);
          if (shakeIntensity > 0) {
            cameraShake.add(shakeIntensity);
          }
        }
      }
    }

    gameData.serverState = newState;

    // 4. Синхронизация визуальных игроков
    for (const id in newState.players) {
      const sp = newState.players[id];
      if (!gameData.renderPlayers[id]) {
        gameData.renderPlayers[id] = {
          name: sp.name,
          x: sp.x,
          y: sp.y,
          color: sp.color,
          alive: sp.alive,
          facing: "down",
          walkTime: 0,
        };
      } else {
        gameData.renderPlayers[id].name = sp.name;
        gameData.renderPlayers[id].color = sp.color;
        gameData.renderPlayers[id].alive = sp.alive;
      }
    }
    for (const id in gameData.renderPlayers) {
      if (!newState.players[id]) {
        delete gameData.renderPlayers[id];
      }
    }

    // 5. Синхронизация визуальных бомб + звуки установки и пинка
    const activeBombIds = new Set<string>();
    for (const sb of newState.bombs) {
      activeBombIds.add(sb.id);
      const isMoving = sb.vx !== 0 || sb.vy !== 0;

      if (!gameData.renderBombs[sb.id]) {
        gameData.renderBombs[sb.id] = { x: sb.x, y: sb.y, wasMoving: isMoving };
        if (me && worldW > 0) {
          const dist = Math.hypot(
            wrappedDelta(me.x, sb.x, worldW),
            wrappedDelta(me.y, sb.y, worldH),
          );
          if (dist < gameData.tileSize * 12) {
            sound.playPlaceBomb();
          }
        }
      } else {
        if (!gameData.renderBombs[sb.id].wasMoving && isMoving) {
          sound.playKick();
        }
        gameData.renderBombs[sb.id].wasMoving = isMoving;
      }
    }
    for (const id in gameData.renderBombs) {
      if (!activeBombIds.has(id)) {
        delete gameData.renderBombs[id];
      }
    }
  });
}
