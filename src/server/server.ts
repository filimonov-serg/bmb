import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";

import { InputState, MapTemplate } from "../shared/types";
import { BASE_STATS, TILE_SIZE, TICK_RATE } from "./game/constants";
import { createMap, getSpawnPoint, spawnChests, updateCrateRegeneration } from "./game/map";
import { updatePlayersMovement } from "./game/physics";
import { placeBomb, updateBombsAndExplosions, ServerGameState } from "./game/bombs";
import { updatePowerups } from "./game/powerups";
import { updateBots } from "./game/bots"; // Подключаем папку bots/ (автоматически берет index.ts)

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "../../public")));

const TEMPLATES: MapTemplate[] = ["classic", "arena", "maze"];
const ROUND_DURATION_SEC = 180; // 3 минуты на раунд
let templateIndex = 0;

const initialMap = createMap(TEMPLATES[0]);
const state: ServerGameState = {
  map: initialMap,
  players: {},
  bombs: [],
  explosions: [],
  powerups: [],
  crateWarnings: [],
  roundId: 1,
  roundTicksLeft: ROUND_DURATION_SEC * TICK_RATE,
  template: TEMPLATES[0],
  chestHp: spawnChests(initialMap, 4),
};

function startNextRound(): void {
  // Выводим лидера прошедшего раунда в консоль перед сбросом счета
  const allPlayers = Object.values(state.players);
  if (allPlayers.length > 0) {
    const winner = [...allPlayers].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)[0];
    console.log(
      `Победитель раунда #${state.roundId}: ${winner.name} (${winner.kills} K / ${winner.deaths} D)`,
    );
  }

  state.roundId++;
  templateIndex = (templateIndex + 1) % TEMPLATES.length;
  state.template = TEMPLATES[templateIndex];

  state.map = createMap(state.template);
  state.bombs = [];
  state.explosions = [];
  state.powerups = [];
  state.crateWarnings = [];
  state.roundTicksLeft = ROUND_DURATION_SEC * TICK_RATE;
  state.chestHp = spawnChests(state.map, 4);

  // Переспавниваем всех игроков (и людей, и ботов) на новой арене
  for (const id in state.players) {
    const p = state.players[id];
    const sp = getSpawnPoint(state.map, state.bombs, state.explosions, io);
    p.x = sp.x;
    p.y = sp.y;
    p.alive = true;
    p.activeBombs = 0;
    p.speed = BASE_STATS.SPEED;
    p.maxBombs = BASE_STATS.MAX_BOMBS;
    p.range = BASE_STATS.RANGE;
    p.canKick = false;
    p.shieldTicks = 0;
    p.kills = 0;
    p.deaths = 0;
  }

  console.log(`Раунд #${state.roundId} начался! Карта: ${state.template}`);

  io.emit("roundStart", {
    map: state.map,
    template: state.template,
  });
}

io.on("connection", (socket) => {
  socket.emit("init", {
    id: socket.id,
    map: state.map,
    tileSize: TILE_SIZE,
    template: state.template,
  });

  socket.on("join", (rawName: unknown) => {
    if (state.players[socket.id]) return;

    const cleanName = typeof rawName === "string" ? rawName.trim().slice(0, 16) : "";
    const playerName = cleanName || `Bomber-${socket.id.slice(0, 4)}`;

    const spawn = getSpawnPoint(state.map, state.bombs, state.explosions, io);
    state.players[socket.id] = {
      id: socket.id,
      name: playerName,
      x: spawn.x,
      y: spawn.y,
      color: `hsl(${Math.random() * 360}, 75%, 55%)`,
      speed: BASE_STATS.SPEED,
      maxBombs: BASE_STATS.MAX_BOMBS,
      activeBombs: 0,
      range: BASE_STATS.RANGE,
      canKick: false,
      kills: 0,
      deaths: 0,
      shieldTicks: 0,
      alive: true,
      input: { up: false, down: false, left: false, right: false },
    };
  });

  socket.on("input", (data: InputState) => {
    if (state.players[socket.id]) state.players[socket.id].input = data;
  });

  socket.on("placeBomb", () => {
    placeBomb(state.players[socket.id], socket.id, state.players, state.bombs);
  });

  socket.on("disconnect", () => {
    delete state.players[socket.id];
  });
});

// Главный игровой цикл (60 тиков в секунду)
setInterval(() => {
  state.roundTicksLeft--;
  if (state.roundTicksLeft <= 0) {
    startNextRound();
  }

  // 1. Боты принимают решения и обновляют свои кнопки input
  updateBots(state, io);

  // 2. Физика движения всех игроков и ботов
  updatePlayersMovement(state.players, state.map, state.bombs);

  // 3. Таймеры бомб, скольжение и взрывы
  updateBombsAndExplosions(state, io);

  // 4. Подбор и сбивание бонусов
  updatePowerups(state.players, state.bombs, state.powerups, state.explosions);

  // 5. Регенерация ящиков
  updateCrateRegeneration(
    state.map,
    state.players,
    state.bombs,
    state.explosions,
    state.powerups,
    state.crateWarnings,
    io,
  );

  // 6. Рассылка актуального состояния клиентам
  io.emit("state", {
    players: state.players,
    bombs: state.bombs,
    explosions: state.explosions,
    powerups: state.powerups,
    crateWarnings: state.crateWarnings,
    roundTimeLeft: Math.ceil(state.roundTicksLeft / TICK_RATE),
    template: state.template,
    chestHp: state.chestHp,
  });
}, 1000 / TICK_RATE);

server.listen(3010, () => console.log("TS Сервер запущен: http://localhost:3010"));
