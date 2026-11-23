class CameraShake {
  private trauma: number = 0; // Уровень тряски от 0 до 1

  // Добавить импульс тряски (intensity от 0.1 до 1.0)
  public add(intensity: number): void {
    // Ограничиваем максимум 1.0, но складываем импульсы при цепной реакции
    this.trauma = Math.min(1, this.trauma + intensity * 0.7);
  }

  public reset(): void {
    this.trauma = 0;
  }

  // Обновление затухания тряски (вызывается в каждом кадре render)
  public update(dt: number): void {
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 2.8); // Полное затухание за ~0.35 сек
    }
  }

  // Возвращает текущее смещение камеры в пикселях
  public getOffset(): { x: number; y: number } {
    if (this.trauma <= 0.01) return { x: 0, y: 0 };

    // Квадрат trauma (trauma * trauma) дает гораздо более естественное и «упругое» затухание
    const shake = this.trauma * this.trauma * 14; // Максимум 14 пикселей отклонения
    return {
      x: (Math.random() * 2 - 1) * shake,
      y: (Math.random() * 2 - 1) * shake,
    };
  }
}

export const cameraShake = new CameraShake();
