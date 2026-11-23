// Корректное зацикливание числа в диапазоне [0, max) даже для отрицательных значений
export function wrap(value: number, max: number): number {
  return ((value % max) + max) % max;
}

// Кратчайшая разница между двумя координатами на зацикленной оси (от -max/2 до +max/2)
export function wrappedDelta(from: number, to: number, max: number): number {
  let diff = to - from;
  if (diff > max / 2) diff -= max;
  if (diff < -max / 2) diff += max;
  return diff;
}
