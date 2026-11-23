import { POWERUP_LIMITS, PowerupType } from "../shared/types";
import { wrap } from "../shared/utils";
import { ClientGameData } from "./network";
import { SpriteSheet } from "./sprites";
import { DrawWrappedFn } from "./worldRenderer";

export function renderPowerups(
  ctx: CanvasRenderingContext2D,
  gameData: ClientGameData,
  sprites: SpriteSheet,
  now: number,
  drawWrapped: DrawWrappedFn,
): void {
  const { myId, tileSize, serverState } = gameData;
  const myServerPlayer = myId ? serverState.players[myId] : null;

  const isMaxedOut = (type: PowerupType): boolean => {
    if (!myServerPlayer) return false;
    if (type === "bomb") return myServerPlayer.maxBombs >= POWERUP_LIMITS.MAX_BOMBS;
    if (type === "fire") return myServerPlayer.range >= POWERUP_LIMITS.MAX_RANGE;
    if (type === "speed") return myServerPlayer.speed >= POWERUP_LIMITS.MAX_SPEED;
    if (type === "kick") return myServerPlayer.canKick;
    return false;
  };

  const bobOffset = Math.sin(now / 180) * 2;
  for (const pw of serverState.powerups || []) {
    drawWrapped(pw.c * tileSize, pw.r * tileSize, (x, y) => {
      const maxed = isMaxedOut(pw.type);
      ctx.save();
      if (maxed) {
        ctx.globalAlpha = 0.35;
      }
      ctx.drawImage(sprites.powerups[pw.type], x, y + (maxed ? 0 : bobOffset));
      ctx.restore();
    });
  }
}

export function renderBombs(
  ctx: CanvasRenderingContext2D,
  gameData: ClientGameData,
  sprites: SpriteSheet,
  now: number,
  drawWrapped: DrawWrappedFn,
): void {
  const { tileSize, serverState, renderBombs: bombsMap } = gameData;
  const MAX_TIMER = 150; // Начальный таймер бомбы на сервере

  for (const sb of serverState.bombs) {
    const rb = bombsMap[sb.id] || sb;
    drawWrapped(rb.x, rb.y, (x, y) => {
      // Прогресс сгорания фитиля от 0.0 (только поставили) до 1.0 (взрыв)
      const progress = 1 - Math.max(0, Math.min(1, sb.timer / MAX_TIMER));

      // Квадратичная фаза (progress * progress) дает плавное, но стремительное ускорение пульса без рывков!
      const pulseAngle = progress * progress * Math.PI * 16;
      const pulseWave = Math.abs(Math.sin(pulseAngle)); // Всегда от 0 до 1 (мягкие "удары сердца")

      const scale = 0.96 + pulseWave * (0.1 + progress * 0.12);
      const drawSize = tileSize * scale;

      ctx.drawImage(sprites.bomb, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);

      // На последней трети таймера бомба начинает наливаться красным жаром на пиках пульса
      if (progress > 0.65) {
        const dangerAlpha = ((progress - 0.65) / 0.35) * pulseWave * 0.65;
        ctx.save();
        ctx.fillStyle = `rgba(255, 71, 87, ${dangerAlpha})`;
        ctx.beginPath();
        ctx.arc(x, y + 2 * scale, drawSize * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Мерцающая искра на кончике фитиля (ускоряется перед взрывом)
      const sparkBlink = Math.sin(pulseAngle * 2) > 0;
      ctx.fillStyle = sparkBlink ? "#fff200" : "#ff4757";
      ctx.beginPath();
      ctx.arc(x, y - drawSize * 0.42, sparkBlink ? 3.5 : 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

export function renderPlayers(
  ctx: CanvasRenderingContext2D,
  gameData: ClientGameData,
  sprites: SpriteSheet,
  drawWrapped: DrawWrappedFn,
): void {
  const { myId, map, tileSize, renderPlayers: playersMap } = gameData;
  const rows = map.length;
  if (rows === 0) return;
  const cols = map[0].length;

  const walkCycle = [1, 0, 2, 0];

  const me = myId ? playersMap[myId] : null;
  const myCol = me ? wrap(Math.floor(me.x / tileSize), cols) : -1;
  const myRow = me ? wrap(Math.floor(me.y / tileSize), rows) : -1;

  for (const id in playersMap) {
    const p = playersMap[id];
    if (!p.alive) continue;

    const pCol = wrap(Math.floor(p.x / tileSize), cols);
    const pRow = wrap(Math.floor(p.y / tileSize), rows);
    const inForest = map[pRow]?.[pCol] === 3;
    const isMe = id === myId;

    // Скрываем соперников в лесу, если мы не стоим в той же клетке
    if (inForest && !isMe && (pCol !== myCol || pRow !== myRow)) {
      continue;
    }

    drawWrapped(p.x, p.y, (x, y) => {
      ctx.save();
      if (inForest) {
        ctx.globalAlpha = 0.5;
      }

      const step = p.walkTime > 0 ? walkCycle[Math.floor(p.walkTime) % 4] : 0;
      const playerSprite = sprites.getPlayerSprite(p.color, p.facing, step);
      ctx.drawImage(playerSprite, x - tileSize / 2, y - tileSize / 2);

      const sp = gameData.serverState.players[id];
      if (sp && sp.shieldTicks > 0) {
        const pulse = Math.sin(performance.now() / 80) * 2;
        ctx.strokeStyle = sp.shieldTicks < 180 ? "#ff7675" : "#00d2d3";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, tileSize * 0.46 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(0, 210, 211, 0.18)";
        ctx.fill();
      }

      // Никнейм над головой
      ctx.font = isMe ? "bold 12px monospace" : "12px monospace";
      ctx.textAlign = "center";

      const textWidth = ctx.measureText(p.name).width;
      const labelY = y - tileSize * 0.58;

      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(x - textWidth / 2 - 4, labelY - 11, textWidth + 8, 14);

      ctx.fillStyle = isMe ? "#ffeaa7" : "#ffffff";
      ctx.fillText(p.name, x, labelY);

      ctx.restore();
    });
  }
  ctx.textAlign = "left";
}

// Рисует пунктирный контур-силуэт ВАШЕГО персонажа поверх крон леса, чтобы не терять себя в засаде
export function renderPlayerForestOutline(
  ctx: CanvasRenderingContext2D,
  gameData: ClientGameData,
  now: number,
  drawWrapped: DrawWrappedFn,
): void {
  const { myId, map, tileSize, renderPlayers: playersMap } = gameData;
  const me = myId ? playersMap[myId] : null;
  if (!me || !me.alive || map.length === 0) return;

  const rows = map.length;
  const cols = map[0].length;
  const myCol = wrap(Math.floor(me.x / tileSize), cols);
  const myRow = wrap(Math.floor(me.y / tileSize), rows);

  // Рисуем контур только если наш персонаж прямо сейчас стоит в клетке леса (3)
  if (map[myRow]?.[myCol] !== 3) return;

  drawWrapped(me.x, me.y, (x, y) => {
    ctx.save();

    const radius = tileSize * 0.34;

    // 1. Вращающийся светящийся пунктирный контур шлема
    ctx.strokeStyle = "#ffeaa7";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -(now / 40) % 18; // Плавное бегущее вращение пунктира

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Маленький контур антенны сверху для сохранения узнаваемого силуэта
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255, 234, 167, 0.85)";
    ctx.beginPath();
    ctx.arc(x, y - radius - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 3. Небольшой маркер направления взгляда, чтобы знать, куда вы смотрите в кустах
    const dirAngle =
      me.facing === "right"
        ? 0
        : me.facing === "down"
          ? Math.PI / 2
          : me.facing === "left"
            ? Math.PI
            : -Math.PI / 2;

    ctx.strokeStyle = "#ffeaa7";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, dirAngle - 0.35, dirAngle + 0.35);
    ctx.stroke();

    ctx.restore();
  });
}
