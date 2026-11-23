import { ClientGameData } from "./network";

export function renderLeaderboard(ctx: CanvasRenderingContext2D, gameData: ClientGameData): void {
  const { myId, serverState } = gameData;
  const playersList = Object.values(serverState.players);
  if (playersList.length === 0) return;

  // Сортируем: больше фрагов -> выше; при равных фрагах меньше смертей -> выше
  const sorted = [...playersList].sort((a, b) => {
    if (b.kills !== a.kills) return b.kills - a.kills;
    return a.deaths - b.deaths;
  });

  const topPlayers = sorted.slice(0, 6); // Показываем топ-6 игроков
  const startX = 12;
  const startY = 36; // Сразу под счетчиком FPS
  const width = 210;
  const rowHeight = 22;
  const headerHeight = 26;
  const totalHeight = headerHeight + topPlayers.length * rowHeight + 6;

  ctx.save();

  // Полупрозрачный фон таблицы
  ctx.fillStyle = "rgba(15, 15, 20, 0.72)";
  ctx.fillRect(startX, startY, width, totalHeight);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.strokeRect(startX, startY, width, totalHeight);

  // Заголовок таблицы
  ctx.fillStyle = "#dfe6e9";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "left";
  ctx.fillText("PLAYER", startX + 10, startY + 17);
  ctx.textAlign = "right";
  ctx.fillText("K / D", startX + width - 10, startY + 17);

  // Разделительная линия под заголовком
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.beginPath();
  ctx.moveTo(startX + 6, startY + headerHeight);
  ctx.lineTo(startX + width - 6, startY + headerHeight);
  ctx.stroke();

  // Строки игроков
  topPlayers.forEach((p, index) => {
    const y = startY + headerHeight + index * rowHeight + 16;
    const isMe = p.id === myId;

    // Подсветка вашей строки
    if (isMe) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(startX + 4, y - 13, width - 8, rowHeight - 2);
    }

    // Цветной кружок (индикатор цвета персонажа)
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(startX + 14, y - 4, 4.5, 0, Math.PI * 2);
    ctx.fill();

    const displayName = `${p.name}${isMe ? " (Вы)" : ""}`;
    ctx.fillStyle = isMe ? "#ffeaa7" : "#ffffff";
    ctx.font = isMe ? "bold 12px monospace" : "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(displayName, startX + 25, y);

    // Счет K / D
    ctx.fillStyle = "#00ff88";
    ctx.textAlign = "right";
    ctx.fillText(`${p.kills} / ${p.deaths}`, startX + width - 10, y);
  });

  ctx.restore();
}
