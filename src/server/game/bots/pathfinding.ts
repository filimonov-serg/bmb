import { wrap } from "../../../shared/utils";
import { MAP_COLS, MAP_ROWS, TILE } from "../constants";
import { ServerGameState } from "../bombs";

export interface VirtualBomb {
  c: number;
  r: number;
  range: number;
  vx?: number;
  vy?: number;
}

// Строит множество координат "c,r", куда скоро ударит или уже бьет огонь
export function getDangerSet(state: ServerGameState, virtualBomb?: VirtualBomb): Set<string> {
  const danger = new Set<string>();
  const dirs = [
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: 0, dr: -1 },
  ];

  for (const exp of state.explosions) {
    for (const t of exp.tiles) danger.add(`${t.c},${t.r}`);
  }

  const allBombs = virtualBomb ? [...state.bombs, virtualBomb] : state.bombs;

  for (const b of allBombs) {
    danger.add(`${b.c},${b.r}`);

    // Если бомба катится — добавляем в зону опасности весь коридор ее полета
    const vx = b.vx ?? 0;
    const vy = b.vy ?? 0;
    if (vx !== 0 || vy !== 0) {
      let slideC = b.c;
      let slideR = b.r;
      for (let step = 1; step <= 12; step++) {
        slideC = wrap(slideC + vx, MAP_COLS);
        slideR = wrap(slideR + vy, MAP_ROWS);
        const tile = state.map[slideR][slideC];
        if (tile === TILE.WALL || tile === TILE.CRATE || tile === TILE.CHEST) break;
        danger.add(`${slideC},${slideR}`);
      }
    }

    // Классический крест будущего взрыва
    for (const d of dirs) {
      for (let i = 1; i <= b.range; i++) {
        const nc = wrap(b.c + d.dc * i, MAP_COLS);
        const nr = wrap(b.r + d.dr * i, MAP_ROWS);
        if (state.map[nr][nc] === TILE.WALL || state.map[nr][nc] === TILE.CHEST) break;
        danger.add(`${nc},${nr}`);
        if (state.map[nr][nc] === TILE.CRATE) break;
      }
    }
  }
  return danger;
}

export function isWalkableForBot(
  c: number,
  r: number,
  state: ServerGameState,
  botId: string,
): boolean {
  const tile = state.map[r][c];
  if (tile === TILE.WALL || tile === TILE.CRATE) return false;
  const bomb = state.bombs.find((b) => b.c === c && b.r === r);
  if (bomb && !bomb.passableBy.includes(botId)) return false;
  return true;
}

// Поиск в ширину (BFS) до ближайшей клетки, удовлетворяющей условию isGoal
export function findStepTowards(
  startC: number,
  startR: number,
  isGoal: (c: number, r: number) => boolean,
  avoidDanger: Set<string> | null,
  state: ServerGameState,
  botId: string,
  maxDepth: number = 14,
): { dc: number; dr: number } | null {
  const dirs = [
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: 0, dr: -1 },
  ];
  const visited = new Set<string>([`${startC},${startR}`]);
  const queue: {
    c: number;
    r: number;
    firstDir: { dc: number; dr: number } | null;
    depth: number;
  }[] = [{ c: startC, r: startR, firstDir: null, depth: 0 }];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.depth > 0 && isGoal(curr.c, curr.r)) {
      return curr.firstDir;
    }
    if (curr.depth >= maxDepth) continue;

    for (const d of dirs) {
      const nc = wrap(curr.c + d.dc, MAP_COLS);
      const nr = wrap(curr.r + d.dr, MAP_ROWS);
      const key = `${nc},${nr}`;

      if (visited.has(key)) continue;
      if (!isWalkableForBot(nc, nr, state, botId)) continue;
      if (avoidDanger && avoidDanger.has(key)) continue;

      visited.add(key);
      queue.push({
        c: nc,
        r: nr,
        firstDir: curr.firstDir || d,
        depth: curr.depth + 1,
      });
    }
  }
  return null;
}
