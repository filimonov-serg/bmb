import { CrateSpawnWarning, TileCoord } from "../shared/types";
import { wrap } from "../shared/utils";
import { SpriteSheet } from "./sprites";

export type DrawWrappedFn = (
  worldX: number,
  worldY: number,
  fn: (x: number, y: number) => void,
) => void;

export interface VisibleBounds {
  startCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
}

interface ScorchMark {
  c: number;
  r: number;
  createdAt: number;
  radiusRatio: number;
}

const SCORCH_DURATION_MS = 14000; // Следы гари держатся 14 секунд и плавно исчезают
const MAX_SCORCH_MARKS = 250; // Ограничитель для стабильного FPS
const scorchMarks: ScorchMark[] = [];

// Нижний слой: пол, 2.5D-тени, бетонные стены и деревянные ящики
export function renderWorldBase(
  ctx: CanvasRenderingContext2D,
  map: number[][],
  tileSize: number,
  bounds: VisibleBounds,
  sprites: SpriteSheet,
  chestHp: Record<string, number>,
): void {
  const rows = map.length;
  const cols = map[0].length;

  for (let r = bounds.startRow; r <= bounds.endRow; r++) {
    const wrappedR = wrap(r, rows);
    for (let c = bounds.startCol; c <= bounds.endCol; c++) {
      const wrappedC = wrap(c, cols);
      const cell = map[wrappedR][wrappedC];

      const x = c * tileSize;
      const y = r * tileSize;

      const floorSprite =
        (wrappedR * 7 + wrappedC * 13) % 5 === 0 ? sprites.floors[1] : sprites.floors[0];

      const sprite = cell === 1 ? sprites.wall : cell === 2 ? sprites.crate : floorSprite;
      ctx.drawImage(sprite, x, y);

      // 2.5D-тени на проходимом полу и под лесом
      if (cell === 0 || cell === 3) {
        const topCell = map[wrap(r - 1, rows)][wrappedC];
        const leftCell = map[wrappedR][wrap(c - 1, cols)];
        const topLeftCell = map[wrap(r - 1, rows)][wrap(c - 1, cols)];

        const topShadow = topCell === 1 ? 10 : topCell === 2 ? 7 : 0;
        const leftShadow = leftCell === 1 ? 10 : leftCell === 2 ? 7 : 0;

        ctx.fillStyle = "rgba(0, 0, 0, 0.32)";

        if (topShadow > 0) {
          ctx.fillRect(x, y, tileSize, topShadow);
        }
        if (leftShadow > 0) {
          ctx.fillRect(x, y + topShadow, leftShadow, tileSize - topShadow);
        }
        if (topShadow === 0 && leftShadow === 0 && topLeftCell !== 0 && topLeftCell !== 3) {
          const diagShadow = topLeftCell === 1 ? 10 : 7;
          ctx.fillRect(x, y, diagShadow, diagShadow);
        }
      }
      if (cell === 4) {
        ctx.drawImage(sprites.chest, x, y);
        const hp = chestHp[`${wrappedC},${wrappedR}`] ?? 4;

        // Визуальные трещины при получении урона
        if (hp < 4) {
          ctx.strokeStyle = "#1e272e";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 8, y + 8);
          ctx.lineTo(x + 16, y + 18);
          if (hp <= 2) {
            ctx.lineTo(x + 12, y + 28);
            ctx.moveTo(x + 28, y + 10);
            ctx.lineTo(x + 22, y + 20);
          }
          if (hp === 1) {
            ctx.lineTo(x + 30, y + 32);
          }
          ctx.stroke();

          // Мини-индикатор оставшихся ударов над сундуком
          ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
          ctx.fillRect(x + 6, y - 6, tileSize - 12, 4);
          ctx.fillStyle = hp === 1 ? "#ff4757" : "#f1c40f";
          ctx.fillRect(x + 6, y - 6, ((tileSize - 12) * hp) / 4, 4);
        }
      }
    }
  }
}

// Предупреждения о скором появлении новых ящиков
export function renderCrateWarnings(
  ctx: CanvasRenderingContext2D,
  warnings: CrateSpawnWarning[],
  tileSize: number,
  now: number,
  drawWrapped: DrawWrappedFn,
): void {
  for (const w of warnings) {
    drawWrapped(w.c * tileSize, w.r * tileSize, (x, y) => {
      const progress = 1 - Math.min(1, w.ticksLeft / 120);
      const pulse = 0.25 + 0.35 * Math.sin(now / 80) * progress;

      ctx.fillStyle = `rgba(211, 84, 0, ${Math.max(0.15, pulse)})`;
      ctx.fillRect(x + 4, y + 4, tileSize - 8, tileSize - 8);

      ctx.strokeStyle = "rgba(230, 126, 34, 0.85)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x + 4, y + 4, tileSize - 8, tileSize - 8);
      ctx.setLineDash([]);
    });
  }
}

// Верхний слой: кроны деревьев (рисуются поверх игроков, чтобы скрывать их в листве)
export function renderForestCanopy(
  ctx: CanvasRenderingContext2D,
  map: number[][],
  tileSize: number,
  bounds: VisibleBounds,
  sprites: SpriteSheet,
): void {
  const rows = map.length;
  const cols = map[0].length;

  for (let r = bounds.startRow; r <= bounds.endRow; r++) {
    const wrappedR = wrap(r, rows);
    for (let c = bounds.startCol; c <= bounds.endCol; c++) {
      const wrappedC = wrap(c, cols);
      if (map[wrappedR][wrappedC] === 3) {
        ctx.drawImage(sprites.forest, c * tileSize, r * tileSize);
      }
    }
  }
}

export function addScorchMarks(tiles: TileCoord[]): void {
  const now = performance.now();
  for (const t of tiles) {
    // Если на этой клетке уже есть след — просто обновляем его таймер, не плодя дубликаты
    const existing = scorchMarks.find((s) => s.c === t.c && s.r === t.r);
    if (existing) {
      existing.createdAt = now;
      continue;
    }

    if (scorchMarks.length >= MAX_SCORCH_MARKS) {
      scorchMarks.shift();
    }
    scorchMarks.push({
      c: t.c,
      r: t.r,
      createdAt: now,
      radiusRatio: 0.34 + Math.random() * 0.12,
    });
  }
}

export function clearScorchMarks(): void {
  scorchMarks.length = 0;
}

export function renderScorchMarks(
  ctx: CanvasRenderingContext2D,
  map: number[][],
  tileSize: number,
  now: number,
  drawWrapped: DrawWrappedFn,
): void {
  for (let i = scorchMarks.length - 1; i >= 0; i--) {
    const s = scorchMarks[i];
    const age = now - s.createdAt;
    if (age >= SCORCH_DURATION_MS) {
      scorchMarks.splice(i, 1);
      continue;
    }

    // Рисуем копоть только на открытом полу (если сверху вырос новый ящик — пятно скрыто под ним)
    const cell = map[s.r]?.[s.c];
    if (cell !== 0 && cell !== 3) continue;

    const alpha = (1 - age / SCORCH_DURATION_MS) * 0.42;
    drawWrapped(s.c * tileSize, s.r * tileSize, (x, y) => {
      const cx = x + tileSize / 2;
      const cy = y + tileSize / 2;
      const r = tileSize * s.radiusRatio;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#181a1d";

      // Основное пятно гари + пара мелких подпалин вокруг для естественной формы
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx - r * 0.45, cy + r * 0.3, r * 0.5, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.4, cy - r * 0.35, r * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }
}
