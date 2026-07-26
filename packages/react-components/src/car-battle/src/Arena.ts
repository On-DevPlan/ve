import type { Car } from './Car';

export class Arena {
  readonly width: number;
  readonly height: number;
  readonly centerX: number;
  readonly centerY: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    const margin = 60;
    this.width = canvasWidth - margin * 2;
    this.height = canvasHeight - margin * 2;
    this.centerX = canvasWidth / 2;
    this.centerY = canvasHeight / 2;
  }

  /** 将赛车限制在竞技场边界内 */
  clamp(car: Car): void {
    const halfSize = 20; // 赛车半宽
    const left = this.centerX - this.width / 2 + halfSize;
    const right = this.centerX + this.width / 2 - halfSize;
    const top = this.centerY - this.height / 2 + halfSize;
    const bottom = this.centerY + this.height / 2 - halfSize;

    if (car.position.x < left) {
      car.position.x = left;
      car.velocity.x = -car.velocity.x * 0.5;
    }
    if (car.position.x > right) {
      car.position.x = right;
      car.velocity.x = -car.velocity.x * 0.5;
    }
    if (car.position.y < top) {
      car.position.y = top;
      car.velocity.y = -car.velocity.y * 0.5;
    }
    if (car.position.y > bottom) {
      car.position.y = bottom;
      car.velocity.y = -car.velocity.y * 0.5;
    }
  }
}
