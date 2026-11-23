"use strict";
(() => {
  // src/shared/utils.ts
  function wrap(value, max) {
    return (value % max + max) % max;
  }
  function wrappedDelta(from, to, max) {
    let diff = to - from;
    if (diff > max / 2)
      diff -= max;
    if (diff < -max / 2)
      diff += max;
    return diff;
  }

  // src/client/sound.ts
  var SoundManager = class {
    ctx = null;
    muted = false;
    musicMuted = false;
    noiseBuffer = null;
    // Параметры секвенсора фоновой музыки
    musicTimer = null;
    stepIndex = 0;
    isUrgent = false;
    // Ускоренный темп на последних 15 секундах раунда
    unlock() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
        this.createNoiseBuffer();
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      this.startMusic();
    }
    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    }
    isMuted() {
      return this.muted;
    }
    toggleMusic() {
      this.musicMuted = !this.musicMuted;
      return this.musicMuted;
    }
    isMusicMuted() {
      return this.musicMuted;
    }
    setUrgentTempo(urgent) {
      if (this.isUrgent === urgent)
        return;
      this.isUrgent = urgent;
      if (this.musicTimer !== null) {
        this.stopMusic();
        this.startMusic();
      }
    }
    // Запуск зацикленного чиптюн-трека
    startMusic() {
      if (this.musicTimer !== null)
        return;
      const stepMs = this.isUrgent ? 165 : 215;
      this.musicTimer = window.setInterval(() => {
        this.playMusicStep();
      }, stepMs);
    }
    stopMusic() {
      if (this.musicTimer !== null) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
    }
    // Отрисовка/синтез одного шага мелодии и баса
    playMusicStep() {
      if (this.muted || this.musicMuted || !this.ctx || this.ctx.state !== "running")
        return;
      const now = this.ctx.currentTime;
      const step = this.stepIndex % 32;
      this.stepIndex++;
      const bassPattern = [
        110,
        0,
        110,
        164.81,
        110,
        0,
        130.81,
        110,
        // Такт 1: Am
        87.31,
        0,
        87.31,
        130.81,
        87.31,
        0,
        98,
        87.31,
        // Такт 2: F
        130.81,
        0,
        130.81,
        196,
        130.81,
        0,
        146.83,
        130.81,
        // Такт 3: C
        98,
        0,
        98,
        146.83,
        98,
        110,
        123.47,
        98
        // Такт 4: G
      ];
      const bassFreq = bassPattern[step];
      if (bassFreq > 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = "triangle";
        bassOsc.frequency.setValueAtTime(bassFreq, now);
        bassGain.gain.setValueAtTime(0.08, now);
        bassGain.gain.exponentialRampToValueAtTime(1e-3, now + 0.16);
        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 0.16);
      }
      const leadPattern = [
        440,
        0,
        523.25,
        659.25,
        0,
        587.33,
        523.25,
        493.88,
        349.23,
        0,
        440,
        523.25,
        0,
        493.88,
        440,
        392,
        523.25,
        0,
        659.25,
        783.99,
        0,
        698.46,
        659.25,
        587.33,
        587.33,
        493.88,
        392,
        0,
        493.88,
        523.25,
        587.33,
        493.88
      ];
      const leadFreq = leadPattern[step];
      if (leadFreq > 0) {
        const leadOsc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const leadGain = this.ctx.createGain();
        leadOsc.type = "square";
        leadOsc.frequency.setValueAtTime(this.isUrgent ? leadFreq * 1.059 : leadFreq, now);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1400, now);
        leadGain.gain.setValueAtTime(0.035, now);
        leadGain.gain.exponentialRampToValueAtTime(1e-3, now + 0.15);
        leadOsc.connect(filter);
        filter.connect(leadGain);
        leadGain.connect(this.ctx.destination);
        leadOsc.start(now);
        leadOsc.stop(now + 0.15);
      }
    }
    // Генерируем буфер белого шума один раз для звуков взрыва
    createNoiseBuffer() {
      if (!this.ctx)
        return;
      const bufferSize = this.ctx.sampleRate * 1;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    // 1. Звук установки бомбы
    playPlaceBomb() {
      if (this.muted || !this.ctx)
        return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }
    // 2. Звук взрыва (volume от 0.1 до 1.0 в зависимости от дистанции до игрока)
    playExplosion(volume = 1) {
      if (this.muted || !this.ctx || !this.noiseBuffer || volume <= 0.05)
        return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.35);
      oscGain.gain.setValueAtTime(0.45 * volume, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + 0.45);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4 * volume, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.45);
    }
    // 3. Звук подбора бонуса (восходящий 3-нотный аккорд)
    playPowerup() {
      if (this.muted || !this.ctx)
        return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        if (!this.ctx)
          return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, now + idx * 0.055);
        gain.gain.setValueAtTime(0.12, now + idx * 0.055);
        gain.gain.exponentialRampToValueAtTime(5e-3, now + idx * 0.055 + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.055);
        osc.stop(now + idx * 0.055 + 0.14);
      });
    }
    // 4. Звук пинка бомбы
    playKick() {
      if (this.muted || !this.ctx)
        return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.09);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    }
    // 5. Звук гибели игрока
    playDeath() {
      if (this.muted || !this.ctx)
        return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.linearRampToValueAtTime(85, now + 0.45);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    }
  };
  var sound = new SoundManager();

  // src/client/input.ts
  function setupInput(socket2) {
    const input = { up: false, down: false, left: false, right: false };
    function updateKey(code, isPressed) {
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
      if (changed)
        socket2.emit("input", input);
    }
    window.addEventListener("keydown", (e) => {
      if (e.repeat)
        return;
      if (document.activeElement?.tagName === "INPUT")
        return;
      if (e.code === "KeyM")
        sound.toggleMute();
      if (e.code === "KeyB")
        sound.toggleMusic();
      updateKey(e.code, true);
      if (e.code === "Space")
        socket2.emit("placeBomb");
    });
    window.addEventListener("keyup", (e) => {
      updateKey(e.code, false);
    });
  }

  // src/client/particles.ts
  var ParticleSystem = class {
    particles = [];
    MAX_PARTICLES = 600;
    // Защита от просадки FPS при массовых цепных взрывах
    add(p) {
      if (this.particles.length >= this.MAX_PARTICLES) {
        this.particles.shift();
      }
      this.particles.push(p);
    }
    // 1. Разлет деревянных щепок при разрушении ящика
    spawnCrateDebris(worldX, worldY) {
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
          shape: "square"
        });
      }
    }
    // 2. Искры и дым при взрыве бомбы
    spawnExplosionSparks(worldX, worldY) {
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
          shape: "circle"
        });
      }
    }
    // 3. Цветной салют при подборе бонуса
    spawnPowerupPickup(worldX, worldY, type) {
      const colorMap = {
        bomb: "#74b9ff",
        fire: "#ff7675",
        speed: "#55efc4",
        kick: "#a29bfe",
        shield: "#00d2d3"
      };
      const baseColor = colorMap[type];
      for (let i = 0; i < 16; i++) {
        const angle = Math.PI * 2 * i / 16;
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
          shape: "circle"
        });
      }
    }
    // 4. Легкий след пыли за скользящей бомбой
    spawnSlideDust(worldX, worldY) {
      if (Math.random() > 0.45)
        return;
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
        shape: "circle"
      });
    }
    // 5. Легкие облачка пыли из-под ног при беге
    spawnFootstepDust(worldX, worldY, speed) {
      const chance = speed > 3.2 ? 0.32 : 0.14;
      if (Math.random() > chance)
        return;
      const life = 0.22 + Math.random() * 0.12;
      this.add({
        x: worldX + (Math.random() - 0.5) * 10,
        y: worldY + 11,
        // Спавним у самых ботинок персонажа
        vx: (Math.random() - 0.5) * 18,
        vy: -8 - Math.random() * 12,
        // Пыль слегка поднимается вверх
        size: 2.5 + Math.random() * 2,
        color: "rgba(223, 230, 233, 0.55)",
        life,
        maxLife: life,
        rotation: 0,
        vRot: 0,
        shape: "circle"
      });
    }
    clear() {
      this.particles = [];
    }
    // Обновление физики частиц с учетом бесшовных границ мира
    update(dt, worldW, worldH) {
      if (worldW === 0 || worldH === 0)
        return;
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        p.vx *= Math.pow(0.08, dt);
        p.vy *= Math.pow(0.08, dt);
        p.x = wrap(p.x + p.vx * dt, worldW);
        p.y = wrap(p.y + p.vy * dt, worldH);
        p.rotation += p.vRot * dt;
      }
    }
    // Отрисовка частиц через переданный хелпер бесшовной камеры drawWrapped
    render(ctx2, drawWrapped) {
      for (const p of this.particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        drawWrapped(p.x, p.y, (x, y) => {
          ctx2.save();
          ctx2.globalAlpha = alpha;
          ctx2.fillStyle = p.color;
          if (p.shape === "square") {
            ctx2.translate(x, y);
            ctx2.rotate(p.rotation);
            ctx2.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          } else {
            ctx2.beginPath();
            ctx2.arc(x, y, p.size * alpha, 0, Math.PI * 2);
            ctx2.fill();
          }
          ctx2.restore();
        });
      }
    }
  };
  var particles = new ParticleSystem();

  // src/client/camera.ts
  var CameraShake = class {
    trauma = 0;
    // Уровень тряски от 0 до 1
    // Добавить импульс тряски (intensity от 0.1 до 1.0)
    add(intensity) {
      this.trauma = Math.min(1, this.trauma + intensity * 0.7);
    }
    reset() {
      this.trauma = 0;
    }
    // Обновление затухания тряски (вызывается в каждом кадре render)
    update(dt) {
      if (this.trauma > 0) {
        this.trauma = Math.max(0, this.trauma - dt * 2.8);
      }
    }
    // Возвращает текущее смещение камеры в пикселях
    getOffset() {
      if (this.trauma <= 0.01)
        return { x: 0, y: 0 };
      const shake = this.trauma * this.trauma * 14;
      return {
        x: (Math.random() * 2 - 1) * shake,
        y: (Math.random() * 2 - 1) * shake
      };
    }
  };
  var cameraShake = new CameraShake();

  // src/client/worldRenderer.ts
  var SCORCH_DURATION_MS = 14e3;
  var MAX_SCORCH_MARKS = 250;
  var scorchMarks = [];
  function renderWorldBase(ctx2, map, tileSize, bounds, sprites2, chestHp) {
    const rows = map.length;
    const cols = map[0].length;
    for (let r = bounds.startRow; r <= bounds.endRow; r++) {
      const wrappedR = wrap(r, rows);
      for (let c = bounds.startCol; c <= bounds.endCol; c++) {
        const wrappedC = wrap(c, cols);
        const cell = map[wrappedR][wrappedC];
        const x = c * tileSize;
        const y = r * tileSize;
        const floorSprite = (wrappedR * 7 + wrappedC * 13) % 5 === 0 ? sprites2.floors[1] : sprites2.floors[0];
        const sprite = cell === 1 ? sprites2.wall : cell === 2 ? sprites2.crate : floorSprite;
        ctx2.drawImage(sprite, x, y);
        if (cell === 0 || cell === 3) {
          const topCell = map[wrap(r - 1, rows)][wrappedC];
          const leftCell = map[wrappedR][wrap(c - 1, cols)];
          const topLeftCell = map[wrap(r - 1, rows)][wrap(c - 1, cols)];
          const topShadow = topCell === 1 ? 10 : topCell === 2 || topCell === 4 ? 7 : 0;
          const leftShadow = leftCell === 1 ? 10 : leftCell === 2 || leftCell === 4 ? 7 : 0;
          ctx2.fillStyle = "rgba(0, 0, 0, 0.32)";
          if (topShadow > 0) {
            ctx2.fillRect(x, y, tileSize, topShadow);
          }
          if (leftShadow > 0) {
            ctx2.fillRect(x, y + topShadow, leftShadow, tileSize - topShadow);
          }
          if (topShadow === 0 && leftShadow === 0 && topLeftCell !== 0 && topLeftCell !== 3) {
            const diagShadow = topLeftCell === 1 ? 10 : 7;
            ctx2.fillRect(x, y, diagShadow, diagShadow);
          }
        }
        if (cell === 4) {
          ctx2.drawImage(sprites2.chest, x, y);
          const hp = chestHp[`${wrappedC},${wrappedR}`] ?? 4;
          if (hp < 4) {
            ctx2.strokeStyle = "#1e272e";
            ctx2.lineWidth = 2;
            ctx2.beginPath();
            ctx2.moveTo(x + 8, y + 8);
            ctx2.lineTo(x + 16, y + 18);
            if (hp <= 2) {
              ctx2.lineTo(x + 12, y + 28);
              ctx2.moveTo(x + 28, y + 10);
              ctx2.lineTo(x + 22, y + 20);
            }
            if (hp === 1) {
              ctx2.lineTo(x + 30, y + 32);
            }
            ctx2.stroke();
            ctx2.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx2.fillRect(x + 6, y - 6, tileSize - 12, 4);
            ctx2.fillStyle = hp === 1 ? "#ff4757" : "#f1c40f";
            ctx2.fillRect(x + 6, y - 6, (tileSize - 12) * hp / 4, 4);
          }
        }
      }
    }
  }
  function renderCrateWarnings(ctx2, warnings, tileSize, now, drawWrapped) {
    for (const w of warnings) {
      drawWrapped(w.c * tileSize, w.r * tileSize, (x, y) => {
        const progress = 1 - Math.min(1, w.ticksLeft / 120);
        const pulse = 0.25 + 0.35 * Math.sin(now / 80) * progress;
        ctx2.fillStyle = `rgba(211, 84, 0, ${Math.max(0.15, pulse)})`;
        ctx2.fillRect(x + 4, y + 4, tileSize - 8, tileSize - 8);
        ctx2.strokeStyle = "rgba(230, 126, 34, 0.85)";
        ctx2.lineWidth = 2;
        ctx2.setLineDash([4, 4]);
        ctx2.strokeRect(x + 4, y + 4, tileSize - 8, tileSize - 8);
        ctx2.setLineDash([]);
      });
    }
  }
  function renderForestCanopy(ctx2, map, tileSize, bounds, sprites2) {
    const rows = map.length;
    const cols = map[0].length;
    for (let r = bounds.startRow; r <= bounds.endRow; r++) {
      const wrappedR = wrap(r, rows);
      for (let c = bounds.startCol; c <= bounds.endCol; c++) {
        const wrappedC = wrap(c, cols);
        if (map[wrappedR][wrappedC] === 3) {
          ctx2.drawImage(sprites2.forest, c * tileSize, r * tileSize);
        }
      }
    }
  }
  function addScorchMarks(tiles) {
    const now = performance.now();
    for (const t of tiles) {
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
        radiusRatio: 0.34 + Math.random() * 0.12
      });
    }
  }
  function clearScorchMarks() {
    scorchMarks.length = 0;
  }
  function renderScorchMarks(ctx2, map, tileSize, now, drawWrapped) {
    for (let i = scorchMarks.length - 1; i >= 0; i--) {
      const s = scorchMarks[i];
      const age = now - s.createdAt;
      if (age >= SCORCH_DURATION_MS) {
        scorchMarks.splice(i, 1);
        continue;
      }
      const cell = map[s.r]?.[s.c];
      if (cell !== 0 && cell !== 3)
        continue;
      const alpha = (1 - age / SCORCH_DURATION_MS) * 0.42;
      drawWrapped(s.c * tileSize, s.r * tileSize, (x, y) => {
        const cx = x + tileSize / 2;
        const cy = y + tileSize / 2;
        const r = tileSize * s.radiusRatio;
        ctx2.save();
        ctx2.globalAlpha = alpha;
        ctx2.fillStyle = "#181a1d";
        ctx2.beginPath();
        ctx2.arc(cx, cy, r, 0, Math.PI * 2);
        ctx2.arc(cx - r * 0.45, cy + r * 0.3, r * 0.5, 0, Math.PI * 2);
        ctx2.arc(cx + r * 0.4, cy - r * 0.35, r * 0.45, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.restore();
      });
    }
  }

  // src/client/floatingText.ts
  var FloatingTextManager = class {
    labels = [];
    spawn(worldX, worldY, text, color) {
      this.labels.push({
        x: worldX,
        y: worldY - 18,
        // Стартуем чуть выше головы персонажа
        text,
        color,
        life: 1,
        maxLife: 1
      });
    }
    spawnPowerupText(worldX, worldY, type) {
      const config = {
        bomb: { text: "+1 BOMB", color: "#74b9ff" },
        fire: { text: "+1 FIRE", color: "#ff7675" },
        speed: { text: "+SPEED", color: "#55efc4" },
        kick: { text: "KICK!", color: "#a29bfe" },
        shield: { text: "SHIELD (15s)!", color: "#00d2d3" }
      };
      const item = config[type];
      this.spawn(worldX, worldY, item.text, item.color);
    }
    clear() {
      this.labels = [];
    }
    update(dt) {
      for (let i = this.labels.length - 1; i >= 0; i--) {
        const item = this.labels[i];
        item.life -= dt;
        if (item.life <= 0) {
          this.labels.splice(i, 1);
          continue;
        }
        item.y -= 32 * dt * (item.life / item.maxLife);
      }
    }
    render(ctx2, drawWrapped) {
      for (const item of this.labels) {
        const alpha = Math.min(1, item.life / item.maxLife * 1.4);
        drawWrapped(item.x, item.y, (x, y) => {
          ctx2.save();
          ctx2.globalAlpha = alpha;
          ctx2.font = "bold 14px monospace";
          ctx2.textAlign = "center";
          ctx2.strokeStyle = "#111111";
          ctx2.lineWidth = 3.5;
          ctx2.lineJoin = "round";
          ctx2.strokeText(item.text, x, y);
          ctx2.fillStyle = item.color;
          ctx2.fillText(item.text, x, y);
          ctx2.restore();
        });
      }
    }
  };
  var floatingText = new FloatingTextManager();

  // src/client/network.ts
  function setupNetwork(socket2, gameData2) {
    let prevStats = null;
    socket2.on("init", (data) => {
      gameData2.myId = data.id;
      gameData2.map = data.map;
      gameData2.tileSize = data.tileSize;
      gameData2.template = data.template;
    });
    socket2.on("roundStart", ({ map, template }) => {
      gameData2.map = map;
      gameData2.template = template;
      particles.clear();
      clearScorchMarks();
      floatingText.clear();
      cameraShake.reset();
    });
    socket2.on("mapUpdate", ({ c, r, val }) => {
      if (gameData2.map[r]) {
        const oldVal = gameData2.map[r][c];
        gameData2.map[r][c] = val;
        if ((oldVal === 2 || oldVal === 4) && val === 0) {
          const wx = c * gameData2.tileSize + gameData2.tileSize / 2;
          const wy = r * gameData2.tileSize + gameData2.tileSize / 2;
          particles.spawnCrateDebris(wx, wy);
        }
      }
    });
    socket2.on("state", (newState) => {
      const myId = gameData2.myId;
      const me = myId ? newState.players[myId] : null;
      const rows = gameData2.map.length;
      const cols = rows > 0 ? gameData2.map.length : 0;
      const worldW = cols * gameData2.tileSize;
      const worldH = rows * gameData2.tileSize;
      if (me) {
        if (prevStats) {
          if (me.maxBombs > prevStats.maxBombs) {
            sound.playPowerup();
            floatingText.spawnPowerupText(me.x, me.y, "bomb");
          } else if (me.range > prevStats.range) {
            sound.playPowerup();
            floatingText.spawnPowerupText(me.x, me.y, "fire");
          } else if (me.speed > prevStats.speed) {
            sound.playPowerup();
            floatingText.spawnPowerupText(me.x, me.y, "speed");
          } else if (me.canKick && !prevStats.canKick) {
            sound.playPowerup();
            floatingText.spawnPowerupText(me.x, me.y, "kick");
          } else if (me.shieldTicks > prevStats.shieldTicks) {
            sound.playPowerup();
            floatingText.spawnPowerupText(me.x, me.y, "shield");
          }
          if (me.kills > prevStats.kills) {
            floatingText.spawn(me.x, me.y - 12, "+1 KILL!", "#ffeaa7");
          }
          if (prevStats.alive && !me.alive) {
            sound.playDeath();
            cameraShake.add(1);
          }
        }
        prevStats = {
          maxBombs: me.maxBombs,
          range: me.range,
          speed: me.speed,
          canKick: me.canKick,
          kills: me.kills,
          alive: me.alive,
          shieldTicks: me.shieldTicks
        };
      }
      const newPowerupIds = new Set(newState.powerups.map((p) => p.id));
      for (const oldPw of gameData2.serverState.powerups || []) {
        if (!newPowerupIds.has(oldPw.id)) {
          const inFire = newState.explosions.some(
            (exp) => exp.tiles.some((t) => t.c === oldPw.c && t.r === oldPw.r)
          );
          if (!inFire) {
            const px = oldPw.c * gameData2.tileSize + gameData2.tileSize / 2;
            const py = oldPw.r * gameData2.tileSize + gameData2.tileSize / 2;
            particles.spawnPowerupPickup(px, py, oldPw.type);
          }
        }
      }
      for (const exp of newState.explosions) {
        if (exp.timer === 29) {
          addScorchMarks(exp.tiles);
          for (const t of exp.tiles) {
            const tx = t.c * gameData2.tileSize + gameData2.tileSize / 2;
            const ty = t.r * gameData2.tileSize + gameData2.tileSize / 2;
            particles.spawnExplosionSparks(tx, ty);
          }
          const centerTile = exp.tiles[0];
          if (centerTile && me && worldW > 0) {
            const expX = centerTile.c * gameData2.tileSize + gameData2.tileSize / 2;
            const expY = centerTile.r * gameData2.tileSize + gameData2.tileSize / 2;
            const dist = Math.hypot(
              wrappedDelta(me.x, expX, worldW),
              wrappedDelta(me.y, expY, worldH)
            );
            const maxHearingDist = gameData2.tileSize * 18;
            const volume = Math.max(0, 1 - dist / maxHearingDist);
            sound.playExplosion(volume);
            const maxShakeDist = gameData2.tileSize * 10;
            const shakeIntensity = Math.max(0, 1 - dist / maxShakeDist);
            if (shakeIntensity > 0) {
              cameraShake.add(shakeIntensity);
            }
          }
        }
      }
      gameData2.serverState = newState;
      for (const id in newState.players) {
        const sp = newState.players[id];
        if (!gameData2.renderPlayers[id]) {
          gameData2.renderPlayers[id] = {
            name: sp.name,
            x: sp.x,
            y: sp.y,
            color: sp.color,
            alive: sp.alive,
            facing: "down",
            walkTime: 0
          };
        } else {
          gameData2.renderPlayers[id].name = sp.name;
          gameData2.renderPlayers[id].color = sp.color;
          gameData2.renderPlayers[id].alive = sp.alive;
        }
      }
      for (const id in gameData2.renderPlayers) {
        if (!newState.players[id]) {
          delete gameData2.renderPlayers[id];
        }
      }
      const activeBombIds = /* @__PURE__ */ new Set();
      for (const sb of newState.bombs) {
        activeBombIds.add(sb.id);
        const isMoving = sb.vx !== 0 || sb.vy !== 0;
        if (!gameData2.renderBombs[sb.id]) {
          gameData2.renderBombs[sb.id] = { x: sb.x, y: sb.y, wasMoving: isMoving };
          if (me && worldW > 0) {
            const dist = Math.hypot(
              wrappedDelta(me.x, sb.x, worldW),
              wrappedDelta(me.y, sb.y, worldH)
            );
            if (dist < gameData2.tileSize * 12) {
              sound.playPlaceBomb();
            }
          }
        } else {
          if (!gameData2.renderBombs[sb.id].wasMoving && isMoving) {
            sound.playKick();
          }
          gameData2.renderBombs[sb.id].wasMoving = isMoving;
        }
      }
      for (const id in gameData2.renderBombs) {
        if (!activeBombIds.has(id)) {
          delete gameData2.renderBombs[id];
        }
      }
    });
  }

  // src/client/minimap.ts
  var MINI_TILE = 4;
  var PADDING = 14;
  function renderMinimap(ctx2, canvas2, gameData2) {
    const { myId, map, tileSize, serverState, renderPlayers: renderPlayers2 } = gameData2;
    if (!map || map.length === 0)
      return;
    const rows = map.length;
    const cols = map[0].length;
    const mapWidth = cols * MINI_TILE;
    const mapHeight = rows * MINI_TILE;
    const startX = canvas2.width - mapWidth - PADDING;
    const startY = PADDING;
    ctx2.save();
    ctx2.translate(startX, startY);
    ctx2.fillStyle = "rgba(15, 15, 20, 0.8)";
    ctx2.fillRect(-3, -3, mapWidth + 6, mapHeight + 6);
    ctx2.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx2.lineWidth = 1.5;
    ctx2.strokeRect(-3, -3, mapWidth + 6, mapHeight + 6);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = map[r][c];
        if (cell === 0)
          continue;
        if (cell === 1)
          ctx2.fillStyle = "#9aa5b1";
        else if (cell === 2)
          ctx2.fillStyle = "#e09145";
        else if (cell === 3)
          ctx2.fillStyle = "#1e8449";
        ctx2.fillRect(c * MINI_TILE, r * MINI_TILE, MINI_TILE, MINI_TILE);
      }
    }
    for (const pw of serverState.powerups || []) {
      if (pw.type === "bomb")
        ctx2.fillStyle = "#74b9ff";
      else if (pw.type === "fire")
        ctx2.fillStyle = "#ff7675";
      else
        ctx2.fillStyle = "#55efc4";
      ctx2.fillRect(pw.c * MINI_TILE + 1, pw.r * MINI_TILE + 1, MINI_TILE - 2, MINI_TILE - 2);
    }
    for (const id in renderPlayers2) {
      const p = renderPlayers2[id];
      if (!p.alive)
        continue;
      const mx = p.x / tileSize * MINI_TILE;
      const my = p.y / tileSize * MINI_TILE;
      const pCol = wrap(Math.floor(p.x / tileSize), cols);
      const pRow = wrap(Math.floor(p.y / tileSize), rows);
      const inForest = map[pRow]?.[pCol] === 3;
      if (inForest && id !== myId)
        continue;
      const isMe = id === myId;
      ctx2.fillStyle = isMe ? "#ffffff" : p.color;
      ctx2.beginPath();
      ctx2.arc(mx, my, isMe ? 3.5 : 2.8, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.strokeStyle = "#000000";
      ctx2.lineWidth = 1;
      ctx2.stroke();
    }
    const me = myId ? renderPlayers2[myId] : null;
    if (me) {
      const viewW = canvas2.width / tileSize * MINI_TILE;
      const viewH = canvas2.height / tileSize * MINI_TILE;
      const viewX = me.x / tileSize * MINI_TILE - viewW / 2;
      const viewY = me.y / tileSize * MINI_TILE - viewH / 2;
      ctx2.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx2.lineWidth = 1;
      ctx2.strokeRect(
        Math.max(0, viewX),
        Math.max(0, viewY),
        Math.min(mapWidth, viewW),
        Math.min(mapHeight, viewH)
      );
    }
    ctx2.restore();
  }

  // src/client/leaderboard.ts
  function renderLeaderboard(ctx2, gameData2) {
    const { myId, serverState } = gameData2;
    const playersList = Object.values(serverState.players);
    if (playersList.length === 0)
      return;
    const sorted = [...playersList].sort((a, b) => {
      if (b.kills !== a.kills)
        return b.kills - a.kills;
      return a.deaths - b.deaths;
    });
    const topPlayers = sorted.slice(0, 6);
    const startX = 12;
    const startY = 36;
    const width = 210;
    const rowHeight = 22;
    const headerHeight = 26;
    const totalHeight = headerHeight + topPlayers.length * rowHeight + 6;
    ctx2.save();
    ctx2.fillStyle = "rgba(15, 15, 20, 0.72)";
    ctx2.fillRect(startX, startY, width, totalHeight);
    ctx2.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx2.lineWidth = 1;
    ctx2.strokeRect(startX, startY, width, totalHeight);
    ctx2.fillStyle = "#dfe6e9";
    ctx2.font = "bold 12px monospace";
    ctx2.textAlign = "left";
    ctx2.fillText("PLAYER", startX + 10, startY + 17);
    ctx2.textAlign = "right";
    ctx2.fillText("K / D", startX + width - 10, startY + 17);
    ctx2.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx2.beginPath();
    ctx2.moveTo(startX + 6, startY + headerHeight);
    ctx2.lineTo(startX + width - 6, startY + headerHeight);
    ctx2.stroke();
    topPlayers.forEach((p, index) => {
      const y = startY + headerHeight + index * rowHeight + 16;
      const isMe = p.id === myId;
      if (isMe) {
        ctx2.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx2.fillRect(startX + 4, y - 13, width - 8, rowHeight - 2);
      }
      ctx2.fillStyle = p.color;
      ctx2.beginPath();
      ctx2.arc(startX + 14, y - 4, 4.5, 0, Math.PI * 2);
      ctx2.fill();
      const displayName = `${p.name}${isMe ? " (\u0412\u044B)" : ""}`;
      ctx2.fillStyle = isMe ? "#ffeaa7" : "#ffffff";
      ctx2.font = isMe ? "bold 12px monospace" : "12px monospace";
      ctx2.textAlign = "left";
      ctx2.fillText(displayName, startX + 25, y);
      ctx2.fillStyle = "#00ff88";
      ctx2.textAlign = "right";
      ctx2.fillText(`${p.kills} / ${p.deaths}`, startX + width - 10, y);
    });
    ctx2.restore();
  }

  // src/client/sprites.ts
  function createOffscreen(size, draw) {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx2 = c.getContext("2d");
    ctx2.imageSmoothingEnabled = false;
    draw(ctx2, size);
    return c;
  }
  function createSprites(tileSize) {
    const floorBase = createOffscreen(tileSize, (ctx2, s) => {
      ctx2.fillStyle = "#5c6670";
      ctx2.fillRect(0, 0, s, s);
      ctx2.fillStyle = "#6c7782";
      ctx2.fillRect(0, 0, s, 2);
      ctx2.fillRect(0, 0, 2, s);
      ctx2.fillStyle = "#4b545d";
      ctx2.fillRect(0, s - 1, s, 1);
      ctx2.fillRect(s - 1, 0, 1, s);
      ctx2.fillStyle = "#525b64";
      ctx2.fillRect(7, 9, 2, 2);
      ctx2.fillRect(s - 11, 14, 2, 2);
      ctx2.fillRect(14, s - 9, 2, 2);
    });
    const floorCracked = createOffscreen(tileSize, (ctx2, s) => {
      ctx2.drawImage(floorBase, 0, 0);
      ctx2.strokeStyle = "#485059";
      ctx2.lineWidth = 1.2;
      ctx2.beginPath();
      ctx2.moveTo(s * 0.25, s * 0.3);
      ctx2.lineTo(s * 0.42, s * 0.45);
      ctx2.lineTo(s * 0.38, s * 0.62);
      ctx2.stroke();
      ctx2.fillStyle = "#737f8b";
      ctx2.fillRect(s * 0.65, s * 0.28, 3, 2);
    });
    const floors = [floorBase, floorCracked];
    const wall = createOffscreen(tileSize, (ctx2, s) => {
      ctx2.fillStyle = "#9aa5b1";
      ctx2.fillRect(0, 0, s, s);
      ctx2.fillStyle = "#cbd2d9";
      ctx2.fillRect(0, 0, s, 4);
      ctx2.fillRect(0, 0, 4, s);
      ctx2.fillStyle = "#616e7c";
      ctx2.fillRect(0, s - 4, s, 4);
      ctx2.fillRect(s - 4, 0, 4, s);
      ctx2.strokeStyle = "#7b8794";
      ctx2.lineWidth = 1.5;
      ctx2.strokeRect(5.5, 5.5, s - 11, s - 11);
      const rivets = [
        [7, 7],
        [s - 10, 7],
        [7, s - 10],
        [s - 10, s - 10]
      ];
      for (const [rx, ry] of rivets) {
        ctx2.fillStyle = "#52606d";
        ctx2.fillRect(rx, ry, 3, 3);
        ctx2.fillStyle = "#e4e7eb";
        ctx2.fillRect(rx, ry, 1, 1);
      }
    });
    const crate = createOffscreen(tileSize, (ctx2, s) => {
      ctx2.fillStyle = "#e09145";
      ctx2.fillRect(1, 1, s - 2, s - 2);
      ctx2.fillStyle = "#f3b36b";
      ctx2.fillRect(2, 2, s - 4, 4);
      ctx2.fillStyle = "#a35d1e";
      ctx2.fillRect(3, Math.floor(s * 0.34), s - 6, 2);
      ctx2.fillRect(3, Math.floor(s * 0.67), s - 6, 2);
      ctx2.strokeStyle = "#8c4a12";
      ctx2.lineWidth = 5;
      ctx2.beginPath();
      ctx2.moveTo(5, 5);
      ctx2.lineTo(s - 5, s - 5);
      ctx2.stroke();
      ctx2.strokeStyle = "#eba157";
      ctx2.lineWidth = 3;
      ctx2.beginPath();
      ctx2.moveTo(5, 5);
      ctx2.lineTo(s - 5, s - 5);
      ctx2.stroke();
      ctx2.strokeStyle = "#8c4a12";
      ctx2.lineWidth = 3;
      ctx2.strokeRect(2.5, 2.5, s - 5, s - 5);
      ctx2.fillStyle = "#4a2506";
      ctx2.fillRect(4, 4, 2, 2);
      ctx2.fillRect(s - 6, 4, 2, 2);
      ctx2.fillRect(4, s - 6, 2, 2);
      ctx2.fillRect(s - 6, s - 6, 2, 2);
    });
    const bomb = createOffscreen(tileSize, (ctx2, s) => {
      const cx = s / 2;
      const cy = s / 2 + 2;
      const r = s * 0.36;
      ctx2.fillStyle = "#7f8fa6";
      ctx2.fillRect(cx - 4, cy - r - 4, 8, 5);
      ctx2.fillStyle = "#1e272e";
      ctx2.beginPath();
      ctx2.arc(cx, cy, r, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.strokeStyle = "#000000";
      ctx2.lineWidth = 2;
      ctx2.stroke();
      ctx2.fillStyle = "#808e9b";
      ctx2.beginPath();
      ctx2.arc(cx - r * 0.35, cy - r * 0.35, r * 0.22, 0, Math.PI * 2);
      ctx2.fill();
    });
    const explosion = createOffscreen(tileSize, (ctx2, s) => {
      ctx2.fillStyle = "#ff4757";
      ctx2.fillRect(0, 0, s, s);
      ctx2.fillStyle = "#ffa502";
      ctx2.fillRect(4, 4, s - 8, s - 8);
      ctx2.fillStyle = "#fff200";
      ctx2.fillRect(10, 10, s - 20, s - 20);
    });
    const makePowerupTile = (bg, border, drawIcon) => createOffscreen(tileSize, (ctx2, s) => {
      const pad = 4;
      ctx2.fillStyle = bg;
      ctx2.fillRect(pad, pad, s - pad * 2, s - pad * 2);
      ctx2.strokeStyle = border;
      ctx2.lineWidth = 2.5;
      ctx2.strokeRect(pad, pad, s - pad * 2, s - pad * 2);
      drawIcon(ctx2, s);
    });
    const powerups = {
      // Бонус доп. бомбы — иконка черной бомбы с фитилем и искрой
      bomb: makePowerupTile("#0984e3", "#74b9ff", (ctx2, s) => {
        const cx = s / 2 - 1;
        const cy = s / 2 + 2;
        const r = s * 0.21;
        ctx2.fillStyle = "#1e272e";
        ctx2.beginPath();
        ctx2.arc(cx, cy, r, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.strokeStyle = "#ffffff";
        ctx2.lineWidth = 1.5;
        ctx2.stroke();
        ctx2.strokeStyle = "#dfe6e9";
        ctx2.lineWidth = 2;
        ctx2.beginPath();
        ctx2.moveTo(cx + r * 0.5, cy - r * 0.6);
        ctx2.lineTo(cx + r * 1.1, cy - r * 1.2);
        ctx2.stroke();
        ctx2.fillStyle = "#ffeaa7";
        ctx2.beginPath();
        ctx2.arc(cx + r * 1.15, cy - r * 1.25, 2.5, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.fillStyle = "#ffffff";
        ctx2.beginPath();
        ctx2.arc(cx - r * 0.35, cy - r * 0.35, r * 0.22, 0, Math.PI * 2);
        ctx2.fill();
      }),
      // Бонус радиуса взрыва — двухслойный язычок пламени
      fire: makePowerupTile("#d63031", "#ff7675", (ctx2, s) => {
        const cx = s / 2;
        const bottomY = s * 0.76;
        const topY = s * 0.22;
        ctx2.fillStyle = "#fdcb6e";
        ctx2.beginPath();
        ctx2.moveTo(cx, topY);
        ctx2.quadraticCurveTo(cx + s * 0.28, s * 0.48, cx + s * 0.18, bottomY - 3);
        ctx2.quadraticCurveTo(cx, bottomY + 3, cx - s * 0.18, bottomY - 3);
        ctx2.quadraticCurveTo(cx - s * 0.28, s * 0.48, cx, topY);
        ctx2.fill();
        ctx2.strokeStyle = "#ffffff";
        ctx2.lineWidth = 1.2;
        ctx2.stroke();
        ctx2.fillStyle = "#ffffff";
        ctx2.beginPath();
        ctx2.moveTo(cx, s * 0.42);
        ctx2.quadraticCurveTo(cx + s * 0.12, s * 0.56, cx + s * 0.08, bottomY - 4);
        ctx2.quadraticCurveTo(cx, bottomY, cx - s * 0.08, bottomY - 4);
        ctx2.quadraticCurveTo(cx - s * 0.12, s * 0.56, cx, s * 0.42);
        ctx2.fill();
      }),
      // Бонус скорости — ярко-желтая молния с белой обводкой
      speed: makePowerupTile("#00b894", "#55efc4", (ctx2, s) => {
        ctx2.fillStyle = "#ffeaa7";
        ctx2.beginPath();
        ctx2.moveTo(s * 0.56, s * 0.2);
        ctx2.lineTo(s * 0.3, s * 0.52);
        ctx2.lineTo(s * 0.48, s * 0.52);
        ctx2.lineTo(s * 0.42, s * 0.8);
        ctx2.lineTo(s * 0.7, s * 0.46);
        ctx2.lineTo(s * 0.52, s * 0.46);
        ctx2.closePath();
        ctx2.fill();
        ctx2.strokeStyle = "#ffffff";
        ctx2.lineWidth = 1.4;
        ctx2.stroke();
      }),
      // Бонус пинка бомб — стилизованный ботинок с шевроном ускорения
      kick: makePowerupTile("#6c5ce7", "#a29bfe", (ctx2, s) => {
        ctx2.fillStyle = "#ffffff";
        ctx2.beginPath();
        ctx2.moveTo(s * 0.24, s * 0.3);
        ctx2.lineTo(s * 0.44, s * 0.3);
        ctx2.lineTo(s * 0.44, s * 0.52);
        ctx2.lineTo(s * 0.64, s * 0.54);
        ctx2.quadraticCurveTo(s * 0.68, s * 0.68, s * 0.62, s * 0.72);
        ctx2.lineTo(s * 0.24, s * 0.72);
        ctx2.closePath();
        ctx2.fill();
        ctx2.fillStyle = "#2d3436";
        ctx2.fillRect(s * 0.24, s * 0.67, s * 0.39, s * 0.05);
        ctx2.strokeStyle = "#ffeaa7";
        ctx2.lineWidth = 2.2;
        ctx2.lineCap = "round";
        ctx2.lineJoin = "round";
        ctx2.beginPath();
        ctx2.moveTo(s * 0.71, s * 0.44);
        ctx2.lineTo(s * 0.8, s * 0.55);
        ctx2.lineTo(s * 0.71, s * 0.66);
        ctx2.stroke();
      }),
      shield: makePowerupTile("#0097e6", "#7ed6df", (ctx2, s) => {
        const cx = s / 2;
        ctx2.fillStyle = "#ffffff";
        ctx2.beginPath();
        ctx2.moveTo(cx - 8, s * 0.25);
        ctx2.lineTo(cx + 8, s * 0.25);
        ctx2.lineTo(cx + 8, s * 0.52);
        ctx2.quadraticCurveTo(cx + 6, s * 0.72, cx, s * 0.78);
        ctx2.quadraticCurveTo(cx - 6, s * 0.72, cx - 8, s * 0.52);
        ctx2.closePath();
        ctx2.fill();
        ctx2.fillStyle = "#00a8ff";
        ctx2.beginPath();
        ctx2.moveTo(cx - 5, s * 0.3);
        ctx2.lineTo(cx + 5, s * 0.3);
        ctx2.lineTo(cx + 5, s * 0.5);
        ctx2.quadraticCurveTo(cx + 4, s * 0.65, cx, s * 0.7);
        ctx2.quadraticCurveTo(cx - 4, s * 0.65, cx - 5, s * 0.5);
        ctx2.closePath();
        ctx2.fill();
      })
    };
    const playerCache = /* @__PURE__ */ new Map();
    const getPlayerSprite = (color, facing, step) => {
      const key = `${color}_${facing}_${step}`;
      if (playerCache.has(key))
        return playerCache.get(key);
      const sprite = createOffscreen(tileSize, (ctx2, s) => {
        const cx = s / 2;
        const cy = s / 2;
        const r = s * 0.34;
        const bounceY = step === 0 ? 0 : -1.5;
        ctx2.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx2.beginPath();
        ctx2.ellipse(cx, cy + r * 0.95, r * 0.85, r * 0.32, 0, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.fillStyle = "#2d3436";
        const leftFootOffset = step === 1 ? -3 : step === 2 ? 3 : 0;
        const rightFootOffset = step === 1 ? 3 : step === 2 ? -3 : 0;
        if (facing === "left" || facing === "right") {
          ctx2.beginPath();
          ctx2.ellipse(cx + leftFootOffset, cy + r * 0.82, 4.5, 3, 0, 0, Math.PI * 2);
          ctx2.ellipse(cx + rightFootOffset, cy + r * 0.82, 4.5, 3, 0, 0, Math.PI * 2);
          ctx2.fill();
        } else {
          ctx2.beginPath();
          ctx2.ellipse(cx - r * 0.42, cy + r * 0.82 + leftFootOffset * 0.6, 4, 3, 0, 0, Math.PI * 2);
          ctx2.ellipse(cx + r * 0.42, cy + r * 0.82 + rightFootOffset * 0.6, 4, 3, 0, 0, Math.PI * 2);
          ctx2.fill();
        }
        const bodyY = cy + bounceY;
        ctx2.fillStyle = color;
        ctx2.beginPath();
        ctx2.arc(cx, bodyY, r, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.strokeStyle = "#111111";
        ctx2.lineWidth = 2;
        ctx2.stroke();
        if (facing === "down") {
          ctx2.fillStyle = "#ffeaa7";
          ctx2.fillRect(cx - r * 0.55, bodyY - r * 0.22, r * 1.1, r * 0.65);
          ctx2.fillStyle = "#111111";
          ctx2.fillRect(cx - r * 0.32, bodyY - r * 0.1, 2.5, 4.5);
          ctx2.fillRect(cx + r * 0.16, bodyY - r * 0.1, 2.5, 4.5);
        } else if (facing === "left") {
          ctx2.fillStyle = "#ffeaa7";
          ctx2.fillRect(cx - r * 0.85, bodyY - r * 0.22, r * 0.85, r * 0.65);
          ctx2.fillStyle = "#111111";
          ctx2.fillRect(cx - r * 0.68, bodyY - r * 0.1, 2.5, 4.5);
          ctx2.fillRect(cx - r * 0.3, bodyY - r * 0.1, 2.5, 4.5);
        } else if (facing === "right") {
          ctx2.fillStyle = "#ffeaa7";
          ctx2.fillRect(cx, bodyY - r * 0.22, r * 0.85, r * 0.65);
          ctx2.fillStyle = "#111111";
          ctx2.fillRect(cx + r * 0.18, bodyY - r * 0.1, 2.5, 4.5);
          ctx2.fillRect(cx + r * 0.56, bodyY - r * 0.1, 2.5, 4.5);
        } else if (facing === "up") {
          ctx2.fillStyle = "rgba(0, 0, 0, 0.25)";
          ctx2.fillRect(cx - r * 0.4, bodyY - r * 0.1, r * 0.8, r * 0.5);
        }
        const antOffsetX = facing === "left" ? 2 : facing === "right" ? -2 : 0;
        ctx2.fillStyle = "#ffffff";
        ctx2.beginPath();
        ctx2.arc(cx + antOffsetX, bodyY - r - 2, 3, 0, Math.PI * 2);
        ctx2.fill();
      });
      playerCache.set(key, sprite);
      return sprite;
    };
    const forest = createOffscreen(tileSize, (ctx2, s) => {
      const cx = s / 2;
      const cy = s / 2;
      ctx2.fillStyle = "#1e8449";
      ctx2.beginPath();
      ctx2.arc(cx - 5, cy - 3, s * 0.32, 0, Math.PI * 2);
      ctx2.arc(cx + 6, cy - 2, s * 0.3, 0, Math.PI * 2);
      ctx2.arc(cx, cy + 5, s * 0.34, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.fillStyle = "#2ecc71";
      ctx2.beginPath();
      ctx2.arc(cx - 4, cy - 5, s * 0.25, 0, Math.PI * 2);
      ctx2.arc(cx + 5, cy - 4, s * 0.23, 0, Math.PI * 2);
      ctx2.arc(cx, cy + 2, s * 0.26, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.fillStyle = "#82e0aa";
      ctx2.fillRect(cx - 7, cy - 8, 4, 3);
      ctx2.fillRect(cx + 4, cy - 6, 3, 3);
    });
    const chest = createOffscreen(tileSize, (ctx2, s) => {
      ctx2.fillStyle = "#6e3b1e";
      ctx2.fillRect(2, 3, s - 4, s - 6);
      ctx2.strokeStyle = "#f1c40f";
      ctx2.lineWidth = 3;
      ctx2.strokeRect(3.5, 4.5, s - 7, s - 9);
      ctx2.fillStyle = "#d4ac0d";
      ctx2.fillRect(2, Math.floor(s * 0.45), s - 4, 3);
      ctx2.fillStyle = "#f9e79f";
      ctx2.fillRect(s / 2 - 4, s / 2 - 5, 8, 10);
      ctx2.fillStyle = "#1e272e";
      ctx2.fillRect(s / 2 - 1.5, s / 2 - 2, 3, 5);
    });
    return { floors, wall, crate, bomb, explosion, powerups, getPlayerSprite, forest, chest };
  }

  // src/client/fireRenderer.ts
  var MAX_EXPLOSION_TICKS = 30;
  function renderExplosions(ctx2, explosions, tileSize, cols, rows, now, drawWrapped) {
    if (explosions.length === 0)
      return;
    ctx2.save();
    for (const exp of explosions) {
      if (exp.tiles.length === 0)
        continue;
      const lifeRatio = Math.max(0, Math.min(1, exp.timer / MAX_EXPLOSION_TICKS));
      const flicker = Math.sin(now / 28) * 1.5;
      const thicknessRatio = 0.45 + 0.55 * Math.sin(lifeRatio * Math.PI * 0.75);
      const tileSet = /* @__PURE__ */ new Set();
      for (const t of exp.tiles) {
        tileSet.add(`${t.c},${t.r}`);
      }
      const centerTile = exp.tiles[0];
      const layers = [
        { color: "rgba(255, 71, 87, 0.35)", widthScale: 1.18, alpha: lifeRatio * 0.6 },
        // Мягкий ореол света
        { color: "#ff4757", widthScale: 0.88, alpha: Math.min(1, lifeRatio * 1.4) },
        // Внешний красный жар
        { color: "#ffa502", widthScale: 0.58, alpha: Math.min(1, lifeRatio * 1.5) },
        // Средний оранжевый поток
        { color: "#fff9c4", widthScale: 0.28, alpha: Math.min(1, lifeRatio * 1.6) }
        // Раскаленное бело-желтое ядро
      ];
      for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
        const layer = layers[layerIdx];
        ctx2.globalAlpha = layer.alpha;
        ctx2.fillStyle = layer.color;
        ctx2.globalCompositeOperation = layerIdx === 0 ? "lighter" : "source-over";
        const beamWidth = Math.max(
          2,
          tileSize * thicknessRatio * layer.widthScale + (layerIdx > 0 ? flicker : 0)
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
            ctx2.beginPath();
            ctx2.arc(cx, cy, halfBeam, 0, Math.PI * 2);
            ctx2.fill();
            if (hasLeft)
              ctx2.fillRect(x, cy - halfBeam, halfTile, beamWidth);
            if (hasRight)
              ctx2.fillRect(cx, cy - halfBeam, halfTile, beamWidth);
            if (hasUp)
              ctx2.fillRect(cx - halfBeam, y, beamWidth, halfTile);
            if (hasDown)
              ctx2.fillRect(cx - halfBeam, cy, beamWidth, halfTile);
            if (t.c === centerTile.c && t.r === centerTile.r && layerIdx >= 1) {
              ctx2.beginPath();
              ctx2.arc(cx, cy, halfBeam * 1.25, 0, Math.PI * 2);
              ctx2.fill();
            }
          });
        }
      }
    }
    ctx2.restore();
  }

  // src/client/ui.ts
  function setupLoginUI(socket2) {
    const loginOverlay = document.getElementById("login-overlay");
    const loginForm = document.getElementById("login-form");
    const nicknameInput = document.getElementById("nickname-input");
    const savedName = localStorage.getItem("bomb_nickname");
    if (savedName)
      nicknameInput.value = savedName;
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sound.unlock();
      const nickname = nicknameInput.value.trim();
      if (nickname) {
        localStorage.setItem("bomb_nickname", nickname);
      }
      socket2.emit("join", nickname);
      loginOverlay.classList.add("hidden");
      nicknameInput.blur();
    });
  }
  function renderHUD(ctx2, canvas2, gameData2, dt) {
    const { myId, serverState } = gameData2;
    const sfxText = sound.isMuted() ? "OFF" : "ON";
    const bgmText = sound.isMuted() || sound.isMusicMuted() ? "OFF" : "ON";
    ctx2.fillStyle = "#00ff88";
    ctx2.font = "14px monospace";
    ctx2.textAlign = "left";
    ctx2.fillText(`FPS: ${Math.round(1 / dt)} | [M] SFX: ${sfxText} | [B] Music: ${bgmText}`, 12, 22);
    const timeLeft = Math.max(0, serverState.roundTimeLeft || 0);
    sound.setUrgentTempo(timeLeft > 0 && timeLeft <= 15);
    const mins = Math.floor(timeLeft / 60).toString().padStart(2, "0");
    const secs = (timeLeft % 60).toString().padStart(2, "0");
    ctx2.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx2.fillRect(canvas2.width / 2 - 110, 10, 220, 36);
    ctx2.fillStyle = timeLeft <= 10 ? "#ff7675" : "#ffffff";
    ctx2.font = "bold 16px monospace";
    ctx2.textAlign = "center";
    ctx2.fillText(`${serverState.template.toUpperCase()} | ${mins}:${secs}`, canvas2.width / 2, 33);
    ctx2.textAlign = "left";
    const myServerPlayer = myId ? serverState.players[myId] : null;
    if (myServerPlayer) {
      const kickStatus = myServerPlayer.canKick ? " | KICK: ON" : "";
      const shieldStatus = myServerPlayer.shieldTicks > 0 ? ` | SHIELD: ${Math.ceil(myServerPlayer.shieldTicks / 60)}s` : "";
      ctx2.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx2.fillRect(10, canvas2.height - 44, 460, 34);
      ctx2.fillStyle = "#dfe6e9";
      ctx2.font = "bold 14px monospace";
      ctx2.fillText(
        `Bombs: ${myServerPlayer.maxBombs} | Fire: ${myServerPlayer.range} | Speed: ${myServerPlayer.speed}${kickStatus}${shieldStatus}`,
        20,
        canvas2.height - 22
      );
    }
  }

  // src/shared/types.ts
  var POWERUP_LIMITS = {
    MAX_BOMBS: 8,
    MAX_RANGE: 8,
    MAX_SPEED: 4.5
  };

  // src/client/entityRenderer.ts
  function renderPowerups(ctx2, gameData2, sprites2, now, drawWrapped) {
    const { myId, tileSize, serverState } = gameData2;
    const myServerPlayer = myId ? serverState.players[myId] : null;
    const isMaxedOut = (type) => {
      if (!myServerPlayer)
        return false;
      if (type === "bomb")
        return myServerPlayer.maxBombs >= POWERUP_LIMITS.MAX_BOMBS;
      if (type === "fire")
        return myServerPlayer.range >= POWERUP_LIMITS.MAX_RANGE;
      if (type === "speed")
        return myServerPlayer.speed >= POWERUP_LIMITS.MAX_SPEED;
      if (type === "kick")
        return myServerPlayer.canKick;
      return false;
    };
    const bobOffset = Math.sin(now / 180) * 2;
    for (const pw of serverState.powerups || []) {
      drawWrapped(pw.c * tileSize, pw.r * tileSize, (x, y) => {
        const maxed = isMaxedOut(pw.type);
        ctx2.save();
        if (maxed) {
          ctx2.globalAlpha = 0.35;
        }
        ctx2.drawImage(sprites2.powerups[pw.type], x, y + (maxed ? 0 : bobOffset));
        ctx2.restore();
      });
    }
  }
  function renderBombs(ctx2, gameData2, sprites2, now, drawWrapped) {
    const { tileSize, serverState, renderBombs: bombsMap } = gameData2;
    const MAX_TIMER = 150;
    for (const sb of serverState.bombs) {
      const rb = bombsMap[sb.id] || sb;
      drawWrapped(rb.x, rb.y, (x, y) => {
        const progress = 1 - Math.max(0, Math.min(1, sb.timer / MAX_TIMER));
        const pulseAngle = progress * progress * Math.PI * 16;
        const pulseWave = Math.abs(Math.sin(pulseAngle));
        const scale = 0.96 + pulseWave * (0.1 + progress * 0.12);
        const drawSize = tileSize * scale;
        ctx2.drawImage(sprites2.bomb, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
        if (progress > 0.65) {
          const dangerAlpha = (progress - 0.65) / 0.35 * pulseWave * 0.65;
          ctx2.save();
          ctx2.fillStyle = `rgba(255, 71, 87, ${dangerAlpha})`;
          ctx2.beginPath();
          ctx2.arc(x, y + 2 * scale, drawSize * 0.35, 0, Math.PI * 2);
          ctx2.fill();
          ctx2.restore();
        }
        const sparkBlink = Math.sin(pulseAngle * 2) > 0;
        ctx2.fillStyle = sparkBlink ? "#fff200" : "#ff4757";
        ctx2.beginPath();
        ctx2.arc(x, y - drawSize * 0.42, sparkBlink ? 3.5 : 2, 0, Math.PI * 2);
        ctx2.fill();
      });
    }
  }
  function renderPlayers(ctx2, gameData2, sprites2, drawWrapped) {
    const { myId, map, tileSize, renderPlayers: playersMap } = gameData2;
    const rows = map.length;
    if (rows === 0)
      return;
    const cols = map[0].length;
    const walkCycle = [1, 0, 2, 0];
    const me = myId ? playersMap[myId] : null;
    const myCol = me ? wrap(Math.floor(me.x / tileSize), cols) : -1;
    const myRow = me ? wrap(Math.floor(me.y / tileSize), rows) : -1;
    for (const id in playersMap) {
      const p = playersMap[id];
      if (!p.alive)
        continue;
      const pCol = wrap(Math.floor(p.x / tileSize), cols);
      const pRow = wrap(Math.floor(p.y / tileSize), rows);
      const inForest = map[pRow]?.[pCol] === 3;
      const isMe = id === myId;
      if (inForest && !isMe && (pCol !== myCol || pRow !== myRow)) {
        continue;
      }
      drawWrapped(p.x, p.y, (x, y) => {
        ctx2.save();
        if (inForest) {
          ctx2.globalAlpha = 0.5;
        }
        const step = p.walkTime > 0 ? walkCycle[Math.floor(p.walkTime) % 4] : 0;
        const playerSprite = sprites2.getPlayerSprite(p.color, p.facing, step);
        ctx2.drawImage(playerSprite, x - tileSize / 2, y - tileSize / 2);
        const sp = gameData2.serverState.players[id];
        if (sp && sp.shieldTicks > 0) {
          const pulse = Math.sin(performance.now() / 80) * 2;
          ctx2.strokeStyle = sp.shieldTicks < 180 ? "#ff7675" : "#00d2d3";
          ctx2.lineWidth = 2.5;
          ctx2.beginPath();
          ctx2.arc(x, y, tileSize * 0.46 + pulse, 0, Math.PI * 2);
          ctx2.stroke();
          ctx2.fillStyle = "rgba(0, 210, 211, 0.18)";
          ctx2.fill();
        }
        ctx2.font = isMe ? "bold 12px monospace" : "12px monospace";
        ctx2.textAlign = "center";
        const textWidth = ctx2.measureText(p.name).width;
        const labelY = y - tileSize * 0.58;
        ctx2.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx2.fillRect(x - textWidth / 2 - 4, labelY - 11, textWidth + 8, 14);
        ctx2.fillStyle = isMe ? "#ffeaa7" : "#ffffff";
        ctx2.fillText(p.name, x, labelY);
        ctx2.restore();
      });
    }
    ctx2.textAlign = "left";
  }
  function renderPlayerForestOutline(ctx2, gameData2, now, drawWrapped) {
    const { myId, map, tileSize, renderPlayers: playersMap } = gameData2;
    const me = myId ? playersMap[myId] : null;
    if (!me || !me.alive || map.length === 0)
      return;
    const rows = map.length;
    const cols = map[0].length;
    const myCol = wrap(Math.floor(me.x / tileSize), cols);
    const myRow = wrap(Math.floor(me.y / tileSize), rows);
    if (map[myRow]?.[myCol] !== 3)
      return;
    drawWrapped(me.x, me.y, (x, y) => {
      ctx2.save();
      const radius = tileSize * 0.34;
      ctx2.strokeStyle = "#ffeaa7";
      ctx2.lineWidth = 2;
      ctx2.setLineDash([5, 4]);
      ctx2.lineDashOffset = -(now / 40) % 18;
      ctx2.beginPath();
      ctx2.arc(x, y, radius, 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.setLineDash([]);
      ctx2.fillStyle = "rgba(255, 234, 167, 0.85)";
      ctx2.beginPath();
      ctx2.arc(x, y - radius - 2, 2.5, 0, Math.PI * 2);
      ctx2.fill();
      const dirAngle = me.facing === "right" ? 0 : me.facing === "down" ? Math.PI / 2 : me.facing === "left" ? Math.PI : -Math.PI / 2;
      ctx2.strokeStyle = "#ffeaa7";
      ctx2.lineWidth = 2.5;
      ctx2.beginPath();
      ctx2.arc(x, y, radius + 3, dirAngle - 0.35, dirAngle + 0.35);
      ctx2.stroke();
      ctx2.restore();
    });
  }

  // src/client/client.ts
  var socket = io();
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var gameData = {
    myId: null,
    map: [],
    tileSize: 40,
    template: "classic",
    serverState: {
      players: {},
      bombs: [],
      explosions: [],
      powerups: [],
      crateWarnings: [],
      roundTimeLeft: 180,
      template: "classic",
      chestHp: {}
    },
    renderPlayers: {},
    renderBombs: {}
  };
  var sprites = createSprites(gameData.tileSize);
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();
  setupInput(socket);
  setupNetwork(socket, gameData);
  setupLoginUI(socket);
  var lastTime = performance.now();
  function updateInterpolation(dt, worldW, worldH) {
    if (worldW === 0 || worldH === 0)
      return;
    const smoothFactor = 1 - Math.exp(-25 * dt);
    const { tileSize, serverState, renderPlayers: renderPlayers2, renderBombs: renderBombs2 } = gameData;
    for (const id in renderPlayers2) {
      const rp = renderPlayers2[id];
      const sp = serverState.players[id];
      if (!sp)
        continue;
      const dx = wrappedDelta(rp.x, sp.x, worldW);
      const dy = wrappedDelta(rp.y, sp.y, worldH);
      const dist = Math.hypot(dx, dy);
      if (dist > tileSize * 3) {
        rp.x = sp.x;
        rp.y = sp.y;
        rp.walkTime = 0;
      } else {
        if (dist > 0.4) {
          rp.walkTime += dt * 11;
          if (sp.alive) {
            particles.spawnFootstepDust(rp.x, rp.y, sp.speed);
          }
          if (Math.abs(dx) > Math.abs(dy)) {
            rp.facing = dx > 0 ? "right" : "left";
          } else {
            rp.facing = dy > 0 ? "down" : "up";
          }
        } else {
          rp.walkTime = 0;
        }
        rp.x = wrap(rp.x + dx * smoothFactor, worldW);
        rp.y = wrap(rp.y + dy * smoothFactor, worldH);
      }
    }
    for (const sb of serverState.bombs) {
      const rb = renderBombs2[sb.id];
      if (!rb)
        continue;
      const dx = wrappedDelta(rb.x, sb.x, worldW);
      const dy = wrappedDelta(rb.y, sb.y, worldH);
      const dist = Math.hypot(dx, dy);
      if (dist > tileSize * 3) {
        rb.x = sb.x;
        rb.y = sb.y;
      } else {
        rb.x = wrap(rb.x + dx * smoothFactor, worldW);
        rb.y = wrap(rb.y + dy * smoothFactor, worldH);
      }
      if (sb.vx !== 0 || sb.vy !== 0) {
        particles.spawnSlideDust(rb.x, rb.y);
      }
    }
  }
  function render(now) {
    const dt = Math.min((now - lastTime) / 1e3, 0.1);
    lastTime = now;
    const { myId, map, tileSize, serverState, renderPlayers: playersMap } = gameData;
    const rows = map.length;
    const cols = rows > 0 ? map[0].length : 0;
    const worldW = cols * tileSize;
    const worldH = rows * tileSize;
    updateInterpolation(dt, worldW, worldH);
    particles.update(dt, worldW, worldH);
    floatingText.update(dt);
    cameraShake.update(dt);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const me = myId ? playersMap[myId] : null;
    const camTarget = me || (rows > 0 ? { x: worldW / 2, y: worldH / 2 } : null);
    if (camTarget && rows > 0) {
      ctx.save();
      const shakeOffset = cameraShake.getOffset();
      const camX = Math.round(canvas.width / 2 - camTarget.x + shakeOffset.x);
      const camY = Math.round(canvas.height / 2 - camTarget.y + shakeOffset.y);
      ctx.translate(camX, camY);
      const bounds = {
        startCol: Math.floor((camTarget.x - canvas.width / 2) / tileSize) - 1,
        endCol: Math.ceil((camTarget.x + canvas.width / 2) / tileSize) + 1,
        startRow: Math.floor((camTarget.y - canvas.height / 2) / tileSize) - 1,
        endRow: Math.ceil((camTarget.y + canvas.height / 2) / tileSize) + 1
      };
      const drawWrapped = (worldX, worldY, drawFn) => {
        const relX = camTarget.x + wrappedDelta(camTarget.x, worldX, worldW);
        const relY = camTarget.y + wrappedDelta(camTarget.y, worldY, worldH);
        if (Math.abs(relX - camTarget.x) <= canvas.width / 2 + tileSize && Math.abs(relY - camTarget.y) <= canvas.height / 2 + tileSize) {
          drawFn(relX, relY);
        }
      };
      renderWorldBase(ctx, map, tileSize, bounds, sprites, serverState.chestHp || {});
      renderScorchMarks(ctx, map, tileSize, now, drawWrapped);
      renderCrateWarnings(ctx, serverState.crateWarnings || [], tileSize, now, drawWrapped);
      renderPowerups(ctx, gameData, sprites, now, drawWrapped);
      renderBombs(ctx, gameData, sprites, now, drawWrapped);
      renderExplosions(ctx, serverState.explosions, tileSize, cols, rows, now, drawWrapped);
      renderPlayers(ctx, gameData, sprites, drawWrapped);
      renderForestCanopy(ctx, map, tileSize, bounds, sprites);
      renderPlayerForestOutline(ctx, gameData, now, drawWrapped);
      particles.render(ctx, drawWrapped);
      floatingText.render(ctx, drawWrapped);
      ctx.restore();
    }
    renderHUD(ctx, canvas, gameData, dt);
    renderLeaderboard(ctx, gameData);
    renderMinimap(ctx, canvas, gameData);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
//# sourceMappingURL=bundle.js.map
