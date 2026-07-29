import type { GameState, CarState } from './types';
import type { Arena } from './Arena';
import type { ParticleSystem } from './particle';

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** 调整 Canvas 尺寸 */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /** 绘制完整一帧 */
  draw(state: GameState, arena: Arena, particles: ParticleSystem): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    // 清屏
    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, w, h);

    // 绘制竞技场
    this.drawArena(arena);

    // 绘制粒子
    particles.draw(ctx);

    // 绘制赛车
    for (const car of state.cars) {
      this.drawCar(car);
    }
  }

  private drawArena(arena: Arena): void {
    const { ctx } = this;
    const left = arena.centerX - arena.width / 2;
    const top = arena.centerY - arena.height / 2;
    const right = arena.centerX + arena.width / 2;
    const bottom = arena.centerY + arena.height / 2;

    // 背景
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(left, top, arena.width, arena.height);

    // 网格线
    ctx.strokeStyle = '#16213e';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = left; x <= right; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    for (let y = top; y <= bottom; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }

    ctx.save();
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#e94560';
    ctx.shadowBlur = 10;
    ctx.strokeRect(left - 2, top - 2, arena.width + 4, arena.height + 4);
    ctx.restore();
  }

  private drawCar(car: CarState): void {
    const { ctx } = this;
    const { x, y } = car.position;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);

    // 眩晕时闪烁
    if (car.hitStunTimer > 0 && Math.floor(car.hitStunTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // 车身 (梯形)
    const bodyColor = car.color === 'blue' ? '#4361ee' : '#e63946';
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(22, 0);       // 车头
    ctx.lineTo(18, -12);     // 右上
    ctx.lineTo(-18, -14);    // 左上
    ctx.lineTo(-22, -10);    // 左后
    ctx.lineTo(-22, 10);     // 左后下
    ctx.lineTo(-18, 14);     // 左下
    ctx.lineTo(18, 12);      // 右下
    ctx.closePath();
    ctx.fill();

    // 车身边框
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 车头标志 (三角箭头)
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(18, -5);
    ctx.lineTo(18, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /** 绘制倒计时数字 */
  drawCountdown(number: number): void {
    const { ctx, canvas } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 120px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = 20;
    ctx.fillText(String(Math.ceil(number)), canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }
}
