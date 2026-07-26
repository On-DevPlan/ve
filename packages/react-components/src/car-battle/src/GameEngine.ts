import type { GameState, GamePhase, HitEvent } from './types';
import { InputManager } from './InputManager';
import { Car } from './Car';
import { Arena } from './Arena';
import { Physics } from './Physics';
import { Renderer } from './Renderer';
import { ParticleSystem } from './particle';

const GAME_DURATION = 60;    // 总时长（秒）
const COUNTDOWN_DURATION = 3; // 倒计时秒数

type StateCallback = (state: GameState) => void;
type HitCallback = (event: HitEvent) => void;

export class GameEngine {
  private input!: InputManager;
  private cars!: [Car, Car];
  private arena!: Arena;
  private renderer!: Renderer;
  private particles!: ParticleSystem;

  private phase: GamePhase = 'countdown';
  private gameTime = 0;       // 游戏经过时间
  private countdownTimer = COUNTDOWN_DURATION;
  private animFrameId = 0;
  private lastTime = 0;
  private running = false;

  private stateCallbacks: StateCallback[] = [];
  private hitCallbacks: HitCallback[] = [];

  /** 初始化游戏 */
  start(canvas: HTMLCanvasElement): void {
    const w = canvas.parentElement?.clientWidth ?? window.innerWidth;
    const h = canvas.parentElement?.clientHeight ?? window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    this.input = new InputManager();
    this.arena = new Arena(w, h);
    this.renderer = new Renderer(canvas);
    this.particles = new ParticleSystem();

    // 初始化两辆赛车
    const car1 = new Car(0, { x: this.arena.centerX - 80, y: this.arena.centerY }, 0);
    const car2 = new Car(1, { x: this.arena.centerX + 80, y: this.arena.centerY }, Math.PI);
    this.cars = [car1, car2];

    this.phase = 'countdown';
    this.countdownTimer = COUNTDOWN_DURATION;
    this.gameTime = 0;
    this.lastTime = performance.now();
    this.running = true;
    this.emitState(); // 立即发出初始状态，避免 React 在 rAF 之前显示旧 UI

    this.loop(performance.now());
  }

  /** 停止游戏 */
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.animFrameId);
    this.input?.destroy();
  }

  /** 订阅状态变更 */
  onStateChange(cb: StateCallback): () => void {
    this.stateCallbacks.push(cb);
    return () => {
      this.stateCallbacks = this.stateCallbacks.filter(c => c !== cb);
    };
  }

  /** 订阅撞击事件 */
  onHit(cb: HitCallback): () => void {
    this.hitCallbacks.push(cb);
    return () => {
      this.hitCallbacks = this.hitCallbacks.filter(c => c !== cb);
    };
  }

  /** 重置游戏 */
  reset(): void {
    this.stop();
    this.input = new InputManager();
    // 其他状态在 start 中重置
  }

  private loop = (now: number): void => {
    if (!this.running) return;

    const dt = Math.min((now - this.lastTime) / 1000, 0.05); // 最大 50ms 防止跳帧
    this.lastTime = now;

    this.update(dt);
    this.emitState();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    if (this.phase === 'countdown') {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        this.phase = 'playing';
        this.countdownTimer = 0;
      }
      // 倒计时时仍然渲染但不更新物理
      this.renderer.draw(this.getState(), this.arena, this.particles);
      this.renderer.drawCountdown(this.countdownTimer);
      return;
    }

    if (this.phase === 'playing') {
      this.gameTime += dt;
      if (this.gameTime >= GAME_DURATION) {
        this.phase = 'finished';
        return;
      }

      // 读取输入
      const input0 = this.input.getState(0);
      const input1 = this.input.getState(1);

      // 更新赛车
      this.cars[0].update(dt, input0, this.arena);
      this.cars[1].update(dt, input1, this.arena);

      // 碰撞检测
      const hit = Physics.resolveCollision(this.cars[0], this.cars[1]);
      if (hit) {
        // 撞击方得分
        this.cars[hit.from].score += 1;
        // 被撞方眩晕
        this.cars[hit.from === 0 ? 1 : 0].applyHitStun();
        // 粒子效果
        const midX = (this.cars[0].position.x + this.cars[1].position.x) / 2;
        const midY = (this.cars[0].position.y + this.cars[1].position.y) / 2;
        this.particles.emitCollision(midX, midY);
        // 触发回调
        this.hitCallbacks.forEach(cb => cb(hit));
      }

      // 尾气粒子
      for (const car of this.cars) {
        if (Math.sqrt(car.velocity.x ** 2 + car.velocity.y ** 2) > 50) {
          this.particles.emitExhaust(
            car.position.x, car.position.y, car.angle,
            car.playerIndex === 0 ? '#4361ee' : '#e63946'
          );
        }
      }

      // 更新粒子
      this.particles.update(dt);

      // 渲染
      this.renderer.draw(this.getState(), this.arena, this.particles);
    }
  }

  private getState(): GameState {
    return {
      cars: [this.cars[0].getState(), this.cars[1].getState()],
      timeRemaining: Math.max(0, GAME_DURATION - this.gameTime),
      phase: this.phase,
      countdownTimer: this.countdownTimer,
    };
  }

  private emitState(): void {
    const state = this.getState();
    this.stateCallbacks.forEach(cb => cb(state));
  }
}
