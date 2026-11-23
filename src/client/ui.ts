import { ClientGameData } from "./network";
import { sound } from "./sound";

export function setupLoginUI(socket: any): void {
  const loginOverlay = document.getElementById("login-overlay") as HTMLDivElement;
  const loginForm = document.getElementById("login-form") as HTMLFormElement;
  const nicknameInput = document.getElementById("nickname-input") as HTMLInputElement;

  const savedName = localStorage.getItem("bomb_nickname");
  if (savedName) nicknameInput.value = savedName;

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    sound.unlock();

    const nickname = nicknameInput.value.trim();
    if (nickname) {
      localStorage.setItem("bomb_nickname", nickname);
    }

    socket.emit("join", nickname);
    loginOverlay.classList.add("hidden");
    nicknameInput.blur();
  });
}

export function renderHUD(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  gameData: ClientGameData,
  dt: number,
): void {
  const { myId, serverState } = gameData;

  // 1. FPS, общий звук [M] и музыка [B]
  const sfxText = sound.isMuted() ? "OFF" : "ON";
  const bgmText = sound.isMuted() || sound.isMusicMuted() ? "OFF" : "ON";

  ctx.fillStyle = "#00ff88";
  ctx.font = "14px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`FPS: ${Math.round(1 / dt)} | [M] SFX: ${sfxText} | [B] Music: ${bgmText}`, 12, 22);

  // 2. Таймер раунда + динамический темп музыки в последние 15 секунд
  const timeLeft = Math.max(0, serverState.roundTimeLeft || 0);
  sound.setUrgentTempo(timeLeft > 0 && timeLeft <= 15);
  const mins = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const secs = (timeLeft % 60).toString().padStart(2, "0");

  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(canvas.width / 2 - 110, 10, 220, 36);

  ctx.fillStyle = timeLeft <= 10 ? "#ff7675" : "#ffffff";
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${serverState.template.toUpperCase()} | ${mins}:${secs}`, canvas.width / 2, 33);
  ctx.textAlign = "left";

  // 3. Текущие характеристики игрока (левый нижний угол)
  const myServerPlayer = myId ? serverState.players[myId] : null;
  if (myServerPlayer) {
    const kickStatus = myServerPlayer.canKick ? " | KICK: ON" : "";
    const shieldStatus =
      myServerPlayer.shieldTicks > 0
        ? ` | SHIELD: ${Math.ceil(myServerPlayer.shieldTicks / 60)}s`
        : "";
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(10, canvas.height - 44, 460, 34);

    ctx.fillStyle = "#dfe6e9";
    ctx.font = "bold 14px monospace";
    ctx.fillText(
      `Bombs: ${myServerPlayer.maxBombs} | Fire: ${myServerPlayer.range} | Speed: ${myServerPlayer.speed}${kickStatus}${shieldStatus}`,
      20,
      canvas.height - 22,
    );
  }
}
