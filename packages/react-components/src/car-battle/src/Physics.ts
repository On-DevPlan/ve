import type { Car } from './Car';
import type { HitEvent } from './types';

const CAR_RADIUS = 18;         // 赛车碰撞圆半径
const HIT_THRESHOLD = 200;     // 最小相对速度阈值 (px/s) 才算有效撞击
const BOUNCE_FACTOR = 0.6;     // 碰撞弹开系数
const MIN_SEPARATION = CAR_RADIUS * 2; // 最小分离距离

export class Physics {
  /**
   * 检测两车碰撞，若碰撞则更新两车状态并返回撞击事件。
   * 使用圆-圆碰撞检测。
   */
  static resolveCollision(a: Car, b: Car): HitEvent | null {
    const dx = b.position.x - a.position.x;
    const dy = b.position.y - a.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = MIN_SEPARATION;

    if (dist >= minDist || dist === 0) return null;

    // 碰撞法线方向 (从 a 指向 b)
    const nx = dx / dist;
    const ny = dy / dist;

    // 相对速度
    const relVx = b.velocity.x - a.velocity.x;
    const relVy = b.velocity.y - a.velocity.y;
    const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);

    // 沿法线的相对速度
    const relVn = relVx * nx + relVy * ny;

    // 如果正在分离，不处理
    if (relVn > 0) return null;

    // 分离重叠
    const overlap = minDist - dist;
    a.position.x -= nx * overlap / 2;
    a.position.y -= ny * overlap / 2;
    b.position.x += nx * overlap / 2;
    b.position.y += ny * overlap / 2;

    // 交换法线方向速度分量 (弹性碰撞 + 阻尼)
    const impulse = relVn * BOUNCE_FACTOR;
    a.velocity.x += impulse * nx;
    a.velocity.y += impulse * ny;
    b.velocity.x -= impulse * nx;
    b.velocity.y -= impulse * ny;

    // 判断是否有效撞击
    if (relSpeed >= HIT_THRESHOLD) {
      // 撞击方向: 如果 a 的 velocity 方向靠近 b，则 a 是撞击方
      const aSpeedTowardB = (a.velocity.x * nx + a.velocity.y * ny);
      const bSpeedTowardA = -(b.velocity.x * nx + b.velocity.y * ny);
      const from = aSpeedTowardB > bSpeedTowardA ? 0 : 1;

      return {
        time: performance.now() / 1000,
        from,
        force: relSpeed,
      };
    }

    return null; // 力度不够不算有效撞击
  }
}
