import { PowerupType } from "../shared/types";
import { wrap } from "../shared/utils";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  rotation: number;
  vRot: number;
  shape: "square" | "circle";
}

class ParticleSystem {
  private particles: Particle[] = [];
  private readonly MAX_PARTICLES = 600; // Защита от просадки FPS при массовых цепных взрывах

  private add(p: Particle): void {
    if (this.particles.length >= this.MAX_PARTICLES) {
      this.particles.shift(); // Удаляем самую старую частицу
    }
    this.particles.push(p);
  }

  // 1. Разлет деревянных щепок при разрушении ящика
  public spawnCrateDebris(worldX: number, worldY: number): void {
    const colors = ["#b86b28", "#7c4212", "#d35400", "#e67e22"];
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 140;
      const life = 0.35 + Math.random() * 0.25;

      this.add({
        x: worldX + (Math.random() - 0.5) * 20,
        y: worldY + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life,
        maxLife: life,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 14,
        shape: "square",
      });
    }
  }

  // 2. Искры и дым при взрыве бомбы
  public spawnExplosionSparks(worldX: number, worldY: number): void {
    const colors = ["#fff200", "#ffa502", "#ff4757", "#636e72"];
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 160;
      const life = 0.25 + Math.random() * 0.3;

      this.add({
        x: worldX + (Math.random() - 0.5) * 16,
        y: worldY + (Math.random() - 0.5) * 16,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 3.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life,
        maxLife: life,
        rotation: 0,
        vRot: 0,
        shape: "circle",
      });
    }
  }

  // 3. Цветной салют при подборе бонуса
  public spawnPowerupPickup(worldX: number, worldY: number, type: PowerupType): void {
    const colorMap: Record<PowerupType, string> = {
      bomb: "#74b9ff",
      fire: "#ff7675",
      speed: "#55efc4",
      kick: "#a29bfe",
      shield: "#00d2d3",
    };
    const baseColor = colorMap[type];

    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const speed = 70 + Math.random() * 60;
      const life = 0.35 + Math.random() * 0.15;

      this.add({
        x: worldX,
        y: worldY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3.5,
        color: i % 2 === 0 ? baseColor : "#ffffff",
        life,
        maxLife: life,
        rotation: 0,
        vRot: 0,
        shape: "circle",
      });
    }
  }

  // 4. Легкий след пыли за скользящей бомбой
  public spawnSlideDust(worldX: number, worldY: number): void {
    if (Math.random() > 0.45) return; // Не спамим в каждом кадре
    const life = 0.2 + Math.random() * 0.15;
    this.add({
      x: worldX + (Math.random() - 0.5) * 12,
      y: worldY + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      size: 3 + Math.random() * 3,
      color: "rgba(200, 210, 220, 0.5)",
      life,
      maxLife: life,
      rotation: 0,
      vRot: 0,
      shape: "circle",
    });
  }

  // 5. Легкие облачка пыли из-под ног при беге
  public spawnFootstepDust(worldX: number, worldY: number, speed: number): void {
    // Чем выше скорость игрока (от 2.5 до 4.5), тем чаще вылетает пыль из-под ног
    const chance = speed > 3.2 ? 0.32 : 0.14;
    if (Math.random() > chance) return;

    const life = 0.22 + Math.random() * 0.12;
    this.add({
      x: worldX + (Math.random() - 0.5) * 10,
      y: worldY + 11, // Спавним у самых ботинок персонажа
      vx: (Math.random() - 0.5) * 18,
      vy: -8 - Math.random() * 12, // Пыль слегка поднимается вверх
      size: 2.5 + Math.random() * 2,
      color: "rgba(223, 230, 233, 0.55)",
      life,
      maxLife: life,
      rotation: 0,
      vRot: 0,
      shape: "circle",
    });
  }

  public clear(): void {
    this.particles = [];
  }

  // Обновление физики частиц с учетом бесшовных границ мира
  public update(dt: number, worldW: number, worldH: number): void {
    if (worldW === 0 || worldH === 0) return;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Плавное торможение частиц в воздухе (сопротивление)
      p.vx *= Math.pow(0.08, dt);
      p.vy *= Math.pow(0.08, dt);

      p.x = wrap(p.x + p.vx * dt, worldW);
      p.y = wrap(p.y + p.vy * dt, worldH);
      p.rotation += p.vRot * dt;
    }
  }

  // Отрисовка частиц через переданный хелпер бесшовной камеры drawWrapped
  public render(
    ctx: CanvasRenderingContext2D,
    drawWrapped: (worldX: number, worldY: number, fn: (x: number, y: number) => void) => void,
  ): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      drawWrapped(p.x, p.y, (x, y) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;

        if (p.shape === "square") {
          ctx.translate(x, y);
          ctx.rotate(p.rotation);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, p.size * alpha, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });
    }
  }
}

export const particles = new ParticleSystem();
