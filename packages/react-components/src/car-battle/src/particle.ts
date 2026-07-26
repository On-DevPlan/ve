interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;       // 当前生命
  maxLife: number;    // 最大生命
  size: number;
  color: string;
  alpha: number;
}

export class ParticleSystem {
  particles: Particle[] = [];

  /** 碰撞爆炸效果 */
  emitCollision(x: number, y: number): void {
    const count = 15;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 80 + Math.random() * 120;
      const life = 0.4 + Math.random() * 0.4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: 3 + Math.random() * 4,
        color: Math.random() > 0.5 ? '#ff6b6b' : '#ffd93d',
        alpha: 1,
      });
    }
  }

  /** 尾气粒子 */
  emitExhaust(x: number, y: number, angle: number, color: string): void {
    const count = 2;
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.0;
      const speed = 30 + Math.random() * 40;
      const life = 0.3 + Math.random() * 0.3;
      this.particles.push({
        x: x - Math.cos(angle) * 25,
        y: y - Math.sin(angle) * 25,
        vx: -Math.cos(angle + spread) * speed + (Math.random() - 0.5) * 20,
        vy: -Math.sin(angle + spread) * speed + (Math.random() - 0.5) * 20,
        life,
        maxLife: life,
        size: 2 + Math.random() * 3,
        color,
        alpha: 0.6,
      });
    }
  }

  /** 每帧更新 */
  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }
  }

  /** 渲染所有粒子 */
  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.particles.length = 0;
  }
}
