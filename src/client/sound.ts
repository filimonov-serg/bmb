class SoundManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private musicMuted: boolean = false;
  private noiseBuffer: AudioBuffer | null = null;

  // Параметры секвенсора фоновой музыки
  private musicTimer: number | null = null;
  private stepIndex: number = 0;
  private isUrgent: boolean = false; // Ускоренный темп на последних 15 секундах раунда

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.createNoiseBuffer();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    this.startMusic();
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMusic(): boolean {
    this.musicMuted = !this.musicMuted;
    return this.musicMuted;
  }

  public isMusicMuted(): boolean {
    return this.musicMuted;
  }

  public setUrgentTempo(urgent: boolean): void {
    if (this.isUrgent === urgent) return;
    this.isUrgent = urgent;
    // Перезапускаем таймер секвенсора с новым темпом
    if (this.musicTimer !== null) {
      this.stopMusic();
      this.startMusic();
    }
  }

  // Запуск зацикленного чиптюн-трека
  public startMusic(): void {
    if (this.musicTimer !== null) return;
    // Обычный темп: 135 BPM (шаг 1/8 = ~220мс), ускоренный: 175 BPM (~170мс)
    const stepMs = this.isUrgent ? 165 : 215;

    this.musicTimer = window.setInterval(() => {
      this.playMusicStep();
    }, stepMs);
  }

  public stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  // Отрисовка/синтез одного шага мелодии и баса
  private playMusicStep(): void {
    if (this.muted || this.musicMuted || !this.ctx || this.ctx.state !== "running") return;

    const now = this.ctx.currentTime;
    const step = this.stepIndex % 32; // 32 шага = 4 такта в цикле
    this.stepIndex++;

    // 1. Басовая партия (треугольная волна, мягкий кач)
    // Частоты нот: A2=110, F2=87.31, C3=130.81, G2=98.00
    const bassPattern = [
      110,
      0,
      110,
      164.81,
      110,
      0,
      130.81,
      110, // Такт 1: Am
      87.31,
      0,
      87.31,
      130.81,
      87.31,
      0,
      98.0,
      87.31, // Такт 2: F
      130.81,
      0,
      130.81,
      196.0,
      130.81,
      0,
      146.83,
      130.81, // Такт 3: C
      98.0,
      0,
      98.0,
      146.83,
      98.0,
      110,
      123.47,
      98.0, // Такт 4: G
    ];

    const bassFreq = bassPattern[step];
    if (bassFreq > 0) {
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = "triangle";
      bassOsc.frequency.setValueAtTime(bassFreq, now);

      bassGain.gain.setValueAtTime(0.08, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      bassOsc.connect(bassGain);
      bassGain.connect(this.ctx.destination);
      bassOsc.start(now);
      bassOsc.stop(now + 0.16);
    }

    // 2. Аркадная ведущая мелодия (мягкий квадрат через фильтр, чтобы не резала уши)
    const leadPattern = [
      440, 0, 523.25, 659.25, 0, 587.33, 523.25, 493.88, 349.23, 0, 440, 523.25, 0, 493.88, 440,
      392.0, 523.25, 0, 659.25, 783.99, 0, 698.46, 659.25, 587.33, 587.33, 493.88, 392.0, 0, 493.88,
      523.25, 587.33, 493.88,
    ];

    const leadFreq = leadPattern[step];
    if (leadFreq > 0) {
      const leadOsc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const leadGain = this.ctx.createGain();

      leadOsc.type = "square";
      // В ускоренном режиме поднимаем мелодию на полутон выше для напряжения!
      leadOsc.frequency.setValueAtTime(this.isUrgent ? leadFreq * 1.059 : leadFreq, now);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1400, now);

      leadGain.gain.setValueAtTime(0.035, now);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      leadOsc.connect(filter);
      filter.connect(leadGain);
      leadGain.connect(this.ctx.destination);

      leadOsc.start(now);
      leadOsc.stop(now + 0.15);
    }
  }

  // Генерируем буфер белого шума один раз для звуков взрыва
  private createNoiseBuffer(): void {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 1.0; // 1 секунда шума
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  // 1. Звук установки бомбы
  public playPlaceBomb(): void {
    if (this.muted || !this.ctx) return;
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
  public playExplosion(volume: number = 1): void {
    if (this.muted || !this.ctx || !this.noiseBuffer || volume <= 0.05) return;
    const now = this.ctx.currentTime;

    // Слой А: Низкочастотный «удар» басом
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

    // Слой Б: Грохот пламени из белого шума через Lowpass-фильтр
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
  public playPowerup(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // До, Ми, Соль (C5, E5, G5)

    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);

      gain.gain.setValueAtTime(0.12, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.055 + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.14);
    });
  }

  // 4. Звук пинка бомбы
  public playKick(): void {
    if (this.muted || !this.ctx) return;
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
  public playDeath(): void {
    if (this.muted || !this.ctx) return;
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
}

export const sound = new SoundManager();
