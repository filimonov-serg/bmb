import { PowerupType } from "../shared/types";
import { DrawWrappedFn } from "./worldRenderer";

interface FloatingLabel {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

class FloatingTextManager {
  private labels: FloatingLabel[] = [];

  public spawn(worldX: number, worldY: number, text: string, color: string): void {
    this.labels.push({
      x: worldX,
      y: worldY - 18, // Стартуем чуть выше головы персонажа
      text,
      color,
      life: 1.0,
      maxLife: 1.0,
    });
  }

  public spawnPowerupText(worldX: number, worldY: number, type: PowerupType): void {
    const config: Record<PowerupType, { text: string; color: string }> = {
      bomb: { text: "+1 BOMB", color: "#74b9ff" },
      fire: { text: "+1 FIRE", color: "#ff7675" },
      speed: { text: "+SPEED", color: "#55efc4" },
      kick: { text: "KICK!", color: "#a29bfe" },
      shield: { text: "SHIELD (15s)!", color: "#00d2d3" },
    };
    const item = config[type];
    this.spawn(worldX, worldY, item.text, item.color);
  }

  public clear(): void {
    this.labels = [];
  }

  public update(dt: number): void {
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const item = this.labels[i];
      item.life -= dt;
      if (item.life <= 0) {
        this.labels.splice(i, 1);
        continue;
      }
      // Плавный подъем вверх с замедлением
      item.y -= 32 * dt * (item.life / item.maxLife);
    }
  }

  public render(ctx: CanvasRenderingContext2D, drawWrapped: DrawWrappedFn): void {
    for (const item of this.labels) {
      const alpha = Math.min(1, (item.life / item.maxLife) * 1.4);

      drawWrapped(item.x, item.y, (x, y) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";

        // Четкая черная обводка текста для читаемости на любом фоне
        ctx.strokeStyle = "#111111";
        ctx.lineWidth = 3.5;
        ctx.lineJoin = "round";
        ctx.strokeText(item.text, x, y);

        ctx.fillStyle = item.color;
        ctx.fillText(item.text, x, y);

        ctx.restore();
      });
    }
  }
}

export const floatingText = new FloatingTextManager();
