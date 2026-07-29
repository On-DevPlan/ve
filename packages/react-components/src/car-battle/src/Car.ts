import type { CarState, InputState, Vec2 } from './types';
import type { Arena } from './Arena';

/** 赛车物理常量 */
const ACCELERATION = 600;       // px/s²
const FRICTION = 0.98;          // 每帧速度衰减系数
const MAX_SPEED = 400;          // px/s 最大速度
const TURN_SPEED = 3.0;         // rad/s 转向速度
const HIT_STUN_DURATION = 0.5;  // 眩晕秒数

export class Car {
  position: Vec2 = { x: 0, y: 0 };
  velocity: Vec2 = { x: 0, y: 0 };
  angle = 0;                    // 朝向弧度
  hitStunTimer = 0;
  score = 0;
  readonly playerIndex: 0 | 1;
  readonly color: 'blue' | 'red';

  constructor(playerIndex: 0 | 1, startPos: Vec2, startAngle: number) {
    this.playerIndex = playerIndex;
    this.color = playerIndex === 0 ? 'blue' : 'red';
    this.position = { ...startPos };
    this.angle = startAngle;
  }

  /** 每帧更新 */
  update(dt: number, input: InputState, arena: Arena): void {
    // 眩晕时不可控制
    if (this.hitStunTimer > 0) {
      this.hitStunTimer -= dt;
      // 减速（滑行）
      this.velocity.x *= FRICTION;
      this.velocity.y *= FRICTION;
    } else {
      // 转向
      if (input.left) this.angle -= TURN_SPEED * dt;
      if (input.right) this.angle += TURN_SPEED * dt;

      // 加速/刹车
      if (input.up) {
        this.velocity.x += Math.cos(this.angle) * ACCELERATION * dt;
        this.velocity.y += Math.sin(this.angle) * ACCELERATION * dt;
      }
      if (input.down) {
        this.velocity.x -= Math.cos(this.angle) * ACCELERATION * dt * 0.5;
        this.velocity.y -= Math.sin(this.angle) * ACCELERATION * dt * 0.5;
      }

      // 摩擦力
      this.velocity.x *= FRICTION;
      this.velocity.y *= FRICTION;
    }

    // 限制速度
    const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    if (speed > MAX_SPEED) {
      const scale = MAX_SPEED / speed;
      this.velocity.x *= scale;
      this.velocity.y *= scale;
    }

    // 更新位置
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // 边界碰撞
    arena.clamp(this);
  }

  /** 应用撞击眩晕 */
  applyHitStun(): void {
    this.hitStunTimer = HIT_STUN_DURATION;
  }

  /** 获取当前快照 */
  getState(): CarState {
    return {
      position: { ...this.position },
      velocity: { ...this.velocity },
      angle: this.angle,
      hitStunTimer: this.hitStunTimer,
      score: this.score,
      color: this.color,
      playerIndex: this.playerIndex,
    };
  }
}
