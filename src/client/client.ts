import { wrap, wrappedDelta } from "../shared/utils";
import { setupInput } from "./input";
import { setupNetwork, ClientGameData } from "./network";
import { renderMinimap } from "./minimap";
import { renderLeaderboard } from "./leaderboard";
import { createSprites } from "./sprites";
import { particles } from "./particles";
import { cameraShake } from "./camera";
import { renderExplosions } from "./fireRenderer";
import { setupLoginUI, renderHUD } from "./ui";
import {
  renderWorldBase,
  renderCrateWarnings,
  renderForestCanopy,
  DrawWrappedFn,
  renderScorchMarks,
} from "./worldRenderer";
import {
  renderPowerups,
  renderBombs,
  renderPlayers,
  renderPlayerForestOutline,
} from "./entityRenderer";
import { floatingText } from "./floatingText";

declare const io: () => any;

const socket = io();
const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const gameData: ClientGameData = {
  myId: null,
  map: [],
  tileSize: 40,
  template: "classic",
  serverState: {
    players: {},
    bombs: [],
    explosions: [],
    powerups: [],
    crateWarnings: [],
    roundTimeLeft: 180,
    template: "classic",
    chestHp: {},
  },
  renderPlayers: {},
  renderBombs: {},
};

const sprites = createSprites(gameData.tileSize);

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

setupInput(socket);
setupNetwork(socket, gameData);
setupLoginUI(socket);

let lastTime = performance.now();

function updateInterpolation(dt: number, worldW: number, worldH: number): void {
  if (worldW === 0 || worldH === 0) return;

  const smoothFactor = 1 - Math.exp(-25 * dt);
  const { tileSize, serverState, renderPlayers, renderBombs } = gameData;

  // 1. Интерполяция игроков
  for (const id in renderPlayers) {
    const rp = renderPlayers[id];
    const sp = serverState.players[id];
    if (!sp) continue;

    const dx = wrappedDelta(rp.x, sp.x, worldW);
    const dy = wrappedDelta(rp.y, sp.y, worldH);
    const dist = Math.hypot(dx, dy);

    if (dist > tileSize * 3) {
      rp.x = sp.x;
      rp.y = sp.y;
      rp.walkTime = 0;
    } else {
      if (dist > 0.4) {
        rp.walkTime += dt * 11;
        if (sp.alive) {
          particles.spawnFootstepDust(rp.x, rp.y, sp.speed);
        }
        if (Math.abs(dx) > Math.abs(dy)) {
          rp.facing = dx > 0 ? "right" : "left";
        } else {
          rp.facing = dy > 0 ? "down" : "up";
        }
      } else {
        rp.walkTime = 0;
      }
      rp.x = wrap(rp.x + dx * smoothFactor, worldW);
      rp.y = wrap(rp.y + dy * smoothFactor, worldH);
    }
  }

  // 2. Интерполяция бомб + пыль при скольжении
  for (const sb of serverState.bombs) {
    const rb = renderBombs[sb.id];
    if (!rb) continue;

    const dx = wrappedDelta(rb.x, sb.x, worldW);
    const dy = wrappedDelta(rb.y, sb.y, worldH);
    const dist = Math.hypot(dx, dy);

    if (dist > tileSize * 3) {
      rb.x = sb.x;
      rb.y = sb.y;
    } else {
      rb.x = wrap(rb.x + dx * smoothFactor, worldW);
      rb.y = wrap(rb.y + dy * smoothFactor, worldH);
    }

    if (sb.vx !== 0 || sb.vy !== 0) {
      particles.spawnSlideDust(rb.x, rb.y);
    }
  }
}

function render(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  const { myId, map, tileSize, serverState, renderPlayers: playersMap } = gameData;
  const rows = map.length;
  const cols = rows > 0 ? map[0].length : 0;
  const worldW = cols * tileSize;
  const worldH = rows * tileSize;

  // Обновление физики и анимаций на клиенте
  updateInterpolation(dt, worldW, worldH);
  particles.update(dt, worldW, worldH);
  floatingText.update(dt);
  cameraShake.update(dt);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const me = myId ? playersMap[myId] : null;
  const camTarget = me || (rows > 0 ? { x: worldW / 2, y: worldH / 2 } : null);

  if (camTarget && rows > 0) {
    ctx.save();
    const shakeOffset = cameraShake.getOffset();
    const camX = Math.round(canvas.width / 2 - camTarget.x + shakeOffset.x);
    const camY = Math.round(canvas.height / 2 - camTarget.y + shakeOffset.y);
    ctx.translate(camX, camY);

    const bounds = {
      startCol: Math.floor((camTarget.x - canvas.width / 2) / tileSize) - 1,
      endCol: Math.ceil((camTarget.x + canvas.width / 2) / tileSize) + 1,
      startRow: Math.floor((camTarget.y - canvas.height / 2) / tileSize) - 1,
      endRow: Math.ceil((camTarget.y + canvas.height / 2) / tileSize) + 1,
    };

    const drawWrapped: DrawWrappedFn = (worldX, worldY, drawFn) => {
      const relX = camTarget.x + wrappedDelta(camTarget.x, worldX, worldW);
      const relY = camTarget.y + wrappedDelta(camTarget.y, worldY, worldH);
      if (
        Math.abs(relX - camTarget.x) <= canvas.width / 2 + tileSize &&
        Math.abs(relY - camTarget.y) <= canvas.height / 2 + tileSize
      ) {
        drawFn(relX, relY);
      }
    };

    // Послойная отрисовка игрового мира
    renderWorldBase(ctx, map, tileSize, bounds, sprites, serverState.chestHp || {});
    renderScorchMarks(ctx, map, tileSize, now, drawWrapped);
    renderCrateWarnings(ctx, serverState.crateWarnings || [], tileSize, now, drawWrapped);
    renderPowerups(ctx, gameData, sprites, now, drawWrapped);
    renderBombs(ctx, gameData, sprites, now, drawWrapped);
    renderExplosions(ctx, serverState.explosions, tileSize, cols, rows, now, drawWrapped);
    renderPlayers(ctx, gameData, sprites, drawWrapped);
    renderForestCanopy(ctx, map, tileSize, bounds, sprites);
    renderPlayerForestOutline(ctx, gameData, now, drawWrapped); // Силуэт игрока поверх листвы
    particles.render(ctx, drawWrapped);
    floatingText.render(ctx, drawWrapped);

    ctx.restore();
  }

  // Поверх всего — элементы интерфейса (HUD, таблица лидеров и миникарта)
  renderHUD(ctx, canvas, gameData, dt);
  renderLeaderboard(ctx, gameData);
  renderMinimap(ctx, canvas, gameData);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
