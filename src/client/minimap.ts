import { wrap } from "../shared/utils";
import { ClientGameData } from "./network";

const MINI_TILE = 4; // Размер одной клетки на миникарте в пикселях (30 * 5 = 150px)
const PADDING = 14; // Отступ от краев экрана

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  gameData: ClientGameData,
): void {
  const { myId, map, tileSize, serverState, renderPlayers } = gameData;
  if (!map || map.length === 0) return;

  const rows = map.length;
  const cols = map[0].length;
  const mapWidth = cols * MINI_TILE;
  const mapHeight = rows * MINI_TILE;

  // Позиция в правом верхнем углу экрана
  const startX = canvas.width - mapWidth - PADDING;
  const startY = PADDING;

  ctx.save();
  ctx.translate(startX, startY);

  // 1. Полупрозрачная подложка и рамка миникарты
  ctx.fillStyle = "rgba(15, 15, 20, 0.8)";
  ctx.fillRect(-3, -3, mapWidth + 6, mapHeight + 6);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-3, -3, mapWidth + 6, mapHeight + 6);

  // 2. Отрисовка клеток карты (бетон и ящики)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = map[r][c];
      if (cell === 0) continue; // Пустой пол пропускаем для экономии отрисовки

      if (cell === 1)
        ctx.fillStyle = "#9aa5b1"; // Нерушимые стены
      else if (cell === 2)
        ctx.fillStyle = "#e09145"; // Разрушаемые ящики
      else if (cell === 3) ctx.fillStyle = "#1e8449";

      ctx.fillRect(c * MINI_TILE, r * MINI_TILE, MINI_TILE, MINI_TILE);
    }
  }

  // 3. Отрисовка лежащих бонусов (яркие точки, чтобы видеть скопления лута)
  for (const pw of serverState.powerups || []) {
    if (pw.type === "bomb") ctx.fillStyle = "#74b9ff";
    else if (pw.type === "fire") ctx.fillStyle = "#ff7675";
    else ctx.fillStyle = "#55efc4";

    ctx.fillRect(pw.c * MINI_TILE + 1, pw.r * MINI_TILE + 1, MINI_TILE - 2, MINI_TILE - 2);
  }

  // 4. Отрисовка игроков
  for (const id in renderPlayers) {
    const p = renderPlayers[id];
    if (!p.alive) continue;

    // Переводим пиксельные координаты мира в координаты миникарты
    const mx = (p.x / tileSize) * MINI_TILE;
    const my = (p.y / tileSize) * MINI_TILE;

    const pCol = wrap(Math.floor(p.x / tileSize), cols);
    const pRow = wrap(Math.floor(p.y / tileSize), rows);
    const inForest = map[pRow]?.[pCol] === 3;
    if (inForest && id !== myId) continue;

    const isMe = id === myId;
    ctx.fillStyle = isMe ? "#ffffff" : p.color;

    ctx.beginPath();
    ctx.arc(mx, my, isMe ? 3.5 : 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Черная обводка вокруг маркера игрока для контраста
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 5. Рамка текущей области обзора камеры (Viewport)
  const me = myId ? renderPlayers[myId] : null;
  if (me) {
    const viewW = (canvas.width / tileSize) * MINI_TILE;
    const viewH = (canvas.height / tileSize) * MINI_TILE;
    const viewX = (me.x / tileSize) * MINI_TILE - viewW / 2;
    const viewY = (me.y / tileSize) * MINI_TILE - viewH / 2;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.max(0, viewX),
      Math.max(0, viewY),
      Math.min(mapWidth, viewW),
      Math.min(mapHeight, viewH),
    );
  }

  ctx.restore();
}
