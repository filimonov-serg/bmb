import { PowerupType } from "../shared/types";

export type Direction = "down" | "up" | "left" | "right";

export interface SpriteSheet {
  floors: HTMLCanvasElement[];
  wall: HTMLCanvasElement;
  crate: HTMLCanvasElement;
  bomb: HTMLCanvasElement;
  explosion: HTMLCanvasElement;
  powerups: Record<PowerupType, HTMLCanvasElement>;
  forest: HTMLCanvasElement;
  chest: HTMLCanvasElement;
  getPlayerSprite: (color: string, facing: Direction, step: number) => HTMLCanvasElement;
}

// Хелпер для создания мини-холста нужного размера
function createOffscreen(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, s: number) => void,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx, size);
  return c;
}

export function createSprites(tileSize: number): SpriteSheet {
  // 1. Светлый каменный пол арены (2 варианта плитки для естественной фактуры)
  const floorBase = createOffscreen(tileSize, (ctx, s) => {
    // Светло-серый теплый камень
    ctx.fillStyle = "#5c6670";
    ctx.fillRect(0, 0, s, s);

    // Светлая верхняя и левая кромка плитки (эффект аккуратной фаски)
    ctx.fillStyle = "#6c7782";
    ctx.fillRect(0, 0, s, 2);
    ctx.fillRect(0, 0, 2, s);

    // Мягкий шов между плитками снизу и справа
    ctx.fillStyle = "#4b545d";
    ctx.fillRect(0, s - 1, s, 1);
    ctx.fillRect(s - 1, 0, 1, s);

    // Деликатные каменные вкрапления
    ctx.fillStyle = "#525b64";
    ctx.fillRect(7, 9, 2, 2);
    ctx.fillRect(s - 11, 14, 2, 2);
    ctx.fillRect(14, s - 9, 2, 2);
  });

  const floorCracked = createOffscreen(tileSize, (ctx, s) => {
    ctx.drawImage(floorBase, 0, 0);

    // Тонкая декоративная трещинка на части плиток
    ctx.strokeStyle = "#485059";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s * 0.25, s * 0.3);
    ctx.lineTo(s * 0.42, s * 0.45);
    ctx.lineTo(s * 0.38, s * 0.62);
    ctx.stroke();

    // Светлый блик рядом с трещинкой
    ctx.fillStyle = "#737f8b";
    ctx.fillRect(s * 0.65, s * 0.28, 3, 2);
  });

  const floors = [floorBase, floorCracked];

  // 2. Светлая нерушимая бетонная стена (объемный блок с заклепками и текстурой)
  const wall = createOffscreen(tileSize, (ctx, s) => {
    // Основной светло-стальной бетон
    ctx.fillStyle = "#9aa5b1";
    ctx.fillRect(0, 0, s, s);

    // Яркая верхняя и левая фаска (имитация падающего сверху-слева света)
    ctx.fillStyle = "#cbd2d9";
    ctx.fillRect(0, 0, s, 4);
    ctx.fillRect(0, 0, 4, s);

    // Глубокая нижняя и правая тень блока
    ctx.fillStyle = "#616e7c";
    ctx.fillRect(0, s - 4, s, 4);
    ctx.fillRect(s - 4, 0, 4, s);

    // Внутренняя рамка плиты
    ctx.strokeStyle = "#7b8794";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(5.5, 5.5, s - 11, s - 11);

    // Заклепки по углам с маленькими светлыми бликами
    const rivets = [
      [7, 7],
      [s - 10, 7],
      [7, s - 10],
      [s - 10, s - 10],
    ];
    for (const [rx, ry] of rivets) {
      ctx.fillStyle = "#52606d";
      ctx.fillRect(rx, ry, 3, 3);
      ctx.fillStyle = "#e4e7eb";
      ctx.fillRect(rx, ry, 1, 1);
    }
  });

  // 3. Светлый деревянный ящик (теплое дерево с фактурой досок и гвоздями)
  const crate = createOffscreen(tileSize, (ctx, s) => {
    // Теплый медово-деревянный фон
    ctx.fillStyle = "#e09145";
    ctx.fillRect(1, 1, s - 2, s - 2);

    // Светлый верхний блик на крышке ящика
    ctx.fillStyle = "#f3b36b";
    ctx.fillRect(2, 2, s - 4, 4);

    // Горизонтальные щели между досками
    ctx.fillStyle = "#a35d1e";
    ctx.fillRect(3, Math.floor(s * 0.34), s - 6, 2);
    ctx.fillRect(3, Math.floor(s * 0.67), s - 6, 2);

    // Диагональная перекладина (сначала темная тень, затем сама светлая доска)
    ctx.strokeStyle = "#8c4a12";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(5, 5);
    ctx.lineTo(s - 5, s - 5);
    ctx.stroke();

    ctx.strokeStyle = "#eba157";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(5, 5);
    ctx.lineTo(s - 5, s - 5);
    ctx.stroke();

    // Внешняя деревянная рама ящика
    ctx.strokeStyle = "#8c4a12";
    ctx.lineWidth = 3;
    ctx.strokeRect(2.5, 2.5, s - 5, s - 5);

    // Маленькие гвоздики по углам рамы
    ctx.fillStyle = "#4a2506";
    ctx.fillRect(4, 4, 2, 2);
    ctx.fillRect(s - 6, 4, 2, 2);
    ctx.fillRect(4, s - 6, 2, 2);
    ctx.fillRect(s - 6, s - 6, 2, 2);
  });

  // 4. Бомба (сфера с бликом и металлическим колпачком фитиля)
  const bomb = createOffscreen(tileSize, (ctx, s) => {
    const cx = s / 2;
    const cy = s / 2 + 2;
    const r = s * 0.36;

    // Колпачок фитиля сверху
    ctx.fillStyle = "#7f8fa6";
    ctx.fillRect(cx - 4, cy - r - 4, 8, 5);

    // Корпус бомбы
    ctx.fillStyle = "#1e272e";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Блик на корпусе
    ctx.fillStyle = "#808e9b";
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  });

  // 5. Ячейка пламени взрыва (трехслойный жар)
  const explosion = createOffscreen(tileSize, (ctx, s) => {
    ctx.fillStyle = "#ff4757";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#ffa502";
    ctx.fillRect(4, 4, s - 8, s - 8);
    ctx.fillStyle = "#fff200";
    ctx.fillRect(10, 10, s - 20, s - 20);
  });

  // 6. Плитки бонусов с иконками
  // 6. Плитки бонусов с иконками
  const makePowerupTile = (
    bg: string,
    border: string,
    drawIcon: (ctx: CanvasRenderingContext2D, s: number) => void,
  ) =>
    createOffscreen(tileSize, (ctx, s) => {
      const pad = 4;
      ctx.fillStyle = bg;
      ctx.fillRect(pad, pad, s - pad * 2, s - pad * 2);

      ctx.strokeStyle = border;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(pad, pad, s - pad * 2, s - pad * 2);

      drawIcon(ctx, s);
    });

  const powerups: Record<PowerupType, HTMLCanvasElement> = {
    // Бонус доп. бомбы — иконка черной бомбы с фитилем и искрой
    bomb: makePowerupTile("#0984e3", "#74b9ff", (ctx, s) => {
      const cx = s / 2 - 1;
      const cy = s / 2 + 2;
      const r = s * 0.21;

      // Корпус мини-бомбы
      ctx.fillStyle = "#1e272e";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Фитиль вправо-вверх
      ctx.strokeStyle = "#dfe6e9";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.5, cy - r * 0.6);
      ctx.lineTo(cx + r * 1.1, cy - r * 1.2);
      ctx.stroke();

      // Яркая искра на кончике фитиля
      ctx.fillStyle = "#ffeaa7";
      ctx.beginPath();
      ctx.arc(cx + r * 1.15, cy - r * 1.25, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Блик на корпусе
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }),
    // Бонус радиуса взрыва — двухслойный язычок пламени
    fire: makePowerupTile("#d63031", "#ff7675", (ctx, s) => {
      const cx = s / 2;
      const bottomY = s * 0.76;
      const topY = s * 0.22;

      // Внешний ярко-оранжевый язык пламени
      ctx.fillStyle = "#fdcb6e";
      ctx.beginPath();
      ctx.moveTo(cx, topY);
      ctx.quadraticCurveTo(cx + s * 0.28, s * 0.48, cx + s * 0.18, bottomY - 3);
      ctx.quadraticCurveTo(cx, bottomY + 3, cx - s * 0.18, bottomY - 3);
      ctx.quadraticCurveTo(cx - s * 0.28, s * 0.48, cx, topY);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Внутреннее бело-желтое ядро огня
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(cx, s * 0.42);
      ctx.quadraticCurveTo(cx + s * 0.12, s * 0.56, cx + s * 0.08, bottomY - 4);
      ctx.quadraticCurveTo(cx, bottomY, cx - s * 0.08, bottomY - 4);
      ctx.quadraticCurveTo(cx - s * 0.12, s * 0.56, cx, s * 0.42);
      ctx.fill();
    }),

    // Бонус скорости — ярко-желтая молния с белой обводкой
    speed: makePowerupTile("#00b894", "#55efc4", (ctx, s) => {
      ctx.fillStyle = "#ffeaa7";
      ctx.beginPath();
      ctx.moveTo(s * 0.56, s * 0.2); // Верхний кончик
      ctx.lineTo(s * 0.3, s * 0.52); // Левый выступ
      ctx.lineTo(s * 0.48, s * 0.52); // Внутренний сгиб
      ctx.lineTo(s * 0.42, s * 0.8); // Нижний кончик
      ctx.lineTo(s * 0.7, s * 0.46); // Правый выступ
      ctx.lineTo(s * 0.52, s * 0.46); // Внутренний сгиб
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }),

    // Бонус пинка бомб — стилизованный ботинок с шевроном ускорения
    kick: makePowerupTile("#6c5ce7", "#a29bfe", (ctx, s) => {
      // Силуэт ботинка (голенище + носок вправо)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(s * 0.24, s * 0.3); // Верх голенища (лево)
      ctx.lineTo(s * 0.44, s * 0.3); // Верх голенища (право)
      ctx.lineTo(s * 0.44, s * 0.52); // Подъем стопы
      ctx.lineTo(s * 0.64, s * 0.54); // Носок сверху
      ctx.quadraticCurveTo(s * 0.68, s * 0.68, s * 0.62, s * 0.72); // Закругление носка
      ctx.lineTo(s * 0.24, s * 0.72); // Подошва
      ctx.closePath();
      ctx.fill();

      // Темная подошва для объема
      ctx.fillStyle = "#2d3436";
      ctx.fillRect(s * 0.24, s * 0.67, s * 0.39, s * 0.05);

      // Стрелка-шеврон удара справа от носка
      ctx.strokeStyle = "#ffeaa7";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(s * 0.71, s * 0.44);
      ctx.lineTo(s * 0.8, s * 0.55);
      ctx.lineTo(s * 0.71, s * 0.66);
      ctx.stroke();
    }),
    shield: makePowerupTile("#0097e6", "#7ed6df", (ctx, s) => {
      const cx = s / 2;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(cx - 8, s * 0.25);
      ctx.lineTo(cx + 8, s * 0.25);
      ctx.lineTo(cx + 8, s * 0.52);
      ctx.quadraticCurveTo(cx + 6, s * 0.72, cx, s * 0.78);
      ctx.quadraticCurveTo(cx - 6, s * 0.72, cx - 8, s * 0.52);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#00a8ff";
      ctx.beginPath();
      ctx.moveTo(cx - 5, s * 0.3);
      ctx.lineTo(cx + 5, s * 0.3);
      ctx.lineTo(cx + 5, s * 0.5);
      ctx.quadraticCurveTo(cx + 4, s * 0.65, cx, s * 0.7);
      ctx.quadraticCurveTo(cx - 4, s * 0.65, cx - 5, s * 0.5);
      ctx.closePath();
      ctx.fill();
    }),
  };

  // 7. Кэш спрайтов игроков с учетом цвета, направления взгляда и фазы шага (0, 1, 2)
  const playerCache = new Map<string, HTMLCanvasElement>();
  const getPlayerSprite = (color: string, facing: Direction, step: number): HTMLCanvasElement => {
    const key = `${color}_${facing}_${step}`;
    if (playerCache.has(key)) return playerCache.get(key)!;

    const sprite = createOffscreen(tileSize, (ctx, s) => {
      const cx = s / 2;
      const cy = s / 2;
      const r = s * 0.34;

      // Легкое вертикальное подпрыгивание корпуса при шаге (step 1 или 2)
      const bounceY = step === 0 ? 0 : -1.5;

      // 1. Тень под персонажем (остается на земле, не подпрыгивает)
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.95, r * 0.85, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Ботинки / ножки с анимацией шага
      ctx.fillStyle = "#2d3436";
      const leftFootOffset = step === 1 ? -3 : step === 2 ? 3 : 0;
      const rightFootOffset = step === 1 ? 3 : step === 2 ? -3 : 0;

      if (facing === "left" || facing === "right") {
        // При виде сбоку ноги шагают вперед-назад по оси X
        ctx.beginPath();
        ctx.ellipse(cx + leftFootOffset, cy + r * 0.82, 4.5, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + rightFootOffset, cy + r * 0.82, 4.5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // При виде спереди/сзади ноги попеременно приподнимаются по оси Y
        ctx.beginPath();
        ctx.ellipse(cx - r * 0.42, cy + r * 0.82 + leftFootOffset * 0.6, 4, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + r * 0.42, cy + r * 0.82 + rightFootOffset * 0.6, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Основной шлем / тело персонажа
      const bodyY = cy + bounceY;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, bodyY, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 4. Лицо и глаза в зависимости от направления взгляда
      if (facing === "down") {
        // Лицо по центру
        ctx.fillStyle = "#ffeaa7";
        ctx.fillRect(cx - r * 0.55, bodyY - r * 0.22, r * 1.1, r * 0.65);

        ctx.fillStyle = "#111111";
        ctx.fillRect(cx - r * 0.32, bodyY - r * 0.1, 2.5, 4.5);
        ctx.fillRect(cx + r * 0.16, bodyY - r * 0.1, 2.5, 4.5);
      } else if (facing === "left") {
        // Лицо сдвинуто к левому краю шлема
        ctx.fillStyle = "#ffeaa7";
        ctx.fillRect(cx - r * 0.85, bodyY - r * 0.22, r * 0.85, r * 0.65);

        ctx.fillStyle = "#111111";
        ctx.fillRect(cx - r * 0.68, bodyY - r * 0.1, 2.5, 4.5);
        ctx.fillRect(cx - r * 0.3, bodyY - r * 0.1, 2.5, 4.5);
      } else if (facing === "right") {
        // Лицо сдвинуто к правому краю шлема
        ctx.fillStyle = "#ffeaa7";
        ctx.fillRect(cx, bodyY - r * 0.22, r * 0.85, r * 0.65);

        ctx.fillStyle = "#111111";
        ctx.fillRect(cx + r * 0.18, bodyY - r * 0.1, 2.5, 4.5);
        ctx.fillRect(cx + r * 0.56, bodyY - r * 0.1, 2.5, 4.5);
      } else if (facing === "up") {
        // Вид со спины: лица нет, рисуем небольшой рюкзачок / застежку шлема
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.fillRect(cx - r * 0.4, bodyY - r * 0.1, r * 0.8, r * 0.5);
      }

      // 5. Антенна на макушке шлема (чуть смещается в противоположную от взгляда сторону для инерции)
      const antOffsetX = facing === "left" ? 2 : facing === "right" ? -2 : 0;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx + antOffsetX, bodyY - r - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    playerCache.set(key, sprite);
    return sprite;
  };

  // Крона леса (рисуется поверх пола и поверх спрятавшегося игрока)
  const forest = createOffscreen(tileSize, (ctx, s) => {
    const cx = s / 2;
    const cy = s / 2;

    // Темная подложка листвы
    ctx.fillStyle = "#1e8449";
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 3, s * 0.32, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 2, s * 0.3, 0, Math.PI * 2);
    ctx.arc(cx, cy + 5, s * 0.34, 0, Math.PI * 2);
    ctx.fill();

    // Светлая верхняя крона
    ctx.fillStyle = "#2ecc71";
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 5, s * 0.25, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy - 4, s * 0.23, 0, Math.PI * 2);
    ctx.arc(cx, cy + 2, s * 0.26, 0, Math.PI * 2);
    ctx.fill();

    // Солнечные блики на листьях
    ctx.fillStyle = "#82e0aa";
    ctx.fillRect(cx - 7, cy - 8, 4, 3);
    ctx.fillRect(cx + 4, cy - 6, 3, 3);
  });

  // Кованый сундук (4 HP)
  const chest = createOffscreen(tileSize, (ctx, s) => {
    // Темно-дубовый корпус
    ctx.fillStyle = "#6e3b1e";
    ctx.fillRect(2, 3, s - 4, s - 6);

    // Золотая окантовка и центральный обруч
    ctx.strokeStyle = "#f1c40f";
    ctx.lineWidth = 3;
    ctx.strokeRect(3.5, 4.5, s - 7, s - 9);

    ctx.fillStyle = "#d4ac0d";
    ctx.fillRect(2, Math.floor(s * 0.45), s - 4, 3);

    // Замочная скважина по центру
    ctx.fillStyle = "#f9e79f";
    ctx.fillRect(s / 2 - 4, s / 2 - 5, 8, 10);
    ctx.fillStyle = "#1e272e";
    ctx.fillRect(s / 2 - 1.5, s / 2 - 2, 3, 5);
  });

  return { floors, wall, crate, bomb, explosion, powerups, getPlayerSprite, forest, chest };
}
