import { InputState } from "../shared/types";
import { sound } from "./sound";

export function setupInput(socket: any): void {
  const input: InputState = { up: false, down: false, left: false, right: false };

  function updateKey(code: string, isPressed: boolean): void {
    let changed = false;
    if ((code === "KeyW" || code === "ArrowUp") && input.up !== isPressed) {
      input.up = isPressed;
      changed = true;
    }
    if ((code === "KeyS" || code === "ArrowDown") && input.down !== isPressed) {
      input.down = isPressed;
      changed = true;
    }
    if ((code === "KeyA" || code === "ArrowLeft") && input.left !== isPressed) {
      input.left = isPressed;
      changed = true;
    }
    if ((code === "KeyD" || code === "ArrowRight") && input.right !== isPressed) {
      input.right = isPressed;
      changed = true;
    }

    if (changed) socket.emit("input", input);
  }

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.repeat) return;
    // Игнорируем игровые клавиши, пока фокус находится в поле ввода никнейма
    if (document.activeElement?.tagName === "INPUT") return;

    if (e.code === "KeyM") sound.toggleMute();
    if (e.code === "KeyB") sound.toggleMusic();

    updateKey(e.code, true);
    if (e.code === "Space") socket.emit("placeBomb");
  });

  window.addEventListener("keyup", (e: KeyboardEvent) => {
    updateKey(e.code, false);
  });
}
