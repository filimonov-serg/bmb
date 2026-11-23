import { Explosion } from "../shared/types";
import { wrap } from "../shared/utils";

const MAX_EXPLOSION_TICKS = 30; // Должно совпадать с длительностью взрыва на сервере

export function renderExplosions(
  ctx: CanvasRenderingContext2D,
  explosions: Explosion[],
  tileSize: number,
  cols: number,
  rows: number,
  now: number,
  drawWrapped: (worldX: number, worldY: number, fn: (x: number, y: number) => void) => void,
): void {
  if (explosions.length === 0) return;

  ctx.save();

  for (const exp of explosions) {
    if (exp.tiles.length === 0) continue;

    // Прогресс жизни взрыва от 1.0 (свежий) до 0.0 (почти погас)
    const lifeRatio = Math.max(0, Math.min(1, exp.timer / MAX_EXPLOSION_TICKS));
    // Плавное сдувание ширины луча к концу взрыва + высокочастотная вибрация жара
    const flicker = Math.sin(now / 28) * 1.5;
    const thicknessRatio = 0.45 + 0.55 * Math.sin(lifeRatio * Math.PI * 0.75);

    // Собираем быстрый Set координат этого взрыва, чтобы склеивать соседние клетки в единый луч
    const tileSet = new Set<string>();
    for (const t of exp.tiles) {
      tileSet.add(`${t.c},${t.r}`);
    }

    const centerTile = exp.tiles[0]; // Первая клетка всегда является эпицентром

    // Проходим в 3 прохода (слоя), чтобы внешнее красное пламя не перекрывало внутреннее белое ядро
    const layers = [
      { color: "rgba(255, 71, 87, 0.35)", widthScale: 1.18, alpha: lifeRatio * 0.6 }, // Мягкий ореол света
      { color: "#ff4757", widthScale: 0.88, alpha: Math.min(1, lifeRatio * 1.4) }, // Внешний красный жар
      { color: "#ffa502", widthScale: 0.58, alpha: Math.min(1, lifeRatio * 1.5) }, // Средний оранжевый поток
      { color: "#fff9c4", widthScale: 0.28, alpha: Math.min(1, lifeRatio * 1.6) }, // Раскаленное бело-желтое ядро
    ];

    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx];
      ctx.globalAlpha = layer.alpha;
      ctx.fillStyle = layer.color;

      // Для первого слоя (ореол света) включаем режим сложения цветов
      ctx.globalCompositeOperation = layerIdx === 0 ? "lighter" : "source-over";

      const beamWidth = Math.max(
        2,
        tileSize * thicknessRatio * layer.widthScale + (layerIdx > 0 ? flicker : 0),
      );
      const halfBeam = beamWidth / 2;
      const halfTile = tileSize / 2;

      for (const t of exp.tiles) {
        const hasLeft = tileSet.has(`${wrap(t.c - 1, cols)},${t.r}`);
        const hasRight = tileSet.has(`${wrap(t.c + 1, cols)},${t.r}`);
        const hasUp = tileSet.has(`${t.c},${wrap(t.r - 1, rows)}`);
        const hasDown = tileSet.has(`${t.c},${wrap(t.r + 1, rows)}`);

        drawWrapped(t.c * tileSize, t.r * tileSize, (x, y) => {
          const cx = x + halfTile;
          const cy = y + halfTile;

          // 1. Центральный узел клетки (круглое скругление на концах лучей и поворотах)
          ctx.beginPath();
          ctx.arc(cx, cy, halfBeam, 0, Math.PI * 2);
          ctx.fill();

          // 2. Соединительные «мосты» к соседним клеткам огня (убирают разрывы между тайлами)
          if (hasLeft) ctx.fillRect(x, cy - halfBeam, halfTile, beamWidth);
          if (hasRight) ctx.fillRect(cx, cy - halfBeam, halfTile, beamWidth);
          if (hasUp) ctx.fillRect(cx - halfBeam, y, beamWidth, halfTile);
          if (hasDown) ctx.fillRect(cx - halfBeam, cy, beamWidth, halfTile);

          // 3. Дополнительная вспышка в самом эпицентре бомбы
          if (t.c === centerTile.c && t.r === centerTile.r && layerIdx >= 1) {
            ctx.beginPath();
            ctx.arc(cx, cy, halfBeam * 1.25, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }
    }
  }

  ctx.restore();
}
