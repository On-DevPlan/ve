# 🏎️ 双人碰碰车竞技场 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在组件展示系统中添加一个 React + Canvas 2D 双人同屏赛车对战游戏组件。

**Architecture:** 纯 Canvas 2D 渲染，无外部游戏引擎。React 组件负责挂载 Canvas 和 HUD 覆盖层，核心游戏逻辑封装在独立的引擎模块中。双玩家使用不同键盘区域（WASD vs 方向键）同屏竞技。

**Tech Stack:** React 19, Canvas 2D API, TypeScript, Vite

## Global Constraints

- 所有文件放在 `packages/react-components/src/car-battle/` 目录下
- 组件配置用 TypeScript 文件: `component.config.ts` (遵循已有 `gaussian-splat-viewer` 模式)
- id 必须是 `car-battle`，与目录名一致 (kebab-case)
- mount.kind = `react`, isolation.mode = `shadow-dom`
- 游戏引擎必须是纯 TypeScript，不依赖任何游戏库
- 组件显示时全屏，游戏 Canvas 填满视口

---

## 文件结构

```
packages/react-components/src/car-battle/
├── component.config.ts          # 组件配置
├── index.tsx                    # React 入口 (挂载 Canvas + HUD)
├── index.css                    # 页面样式 (暗色背景 + 布局)
└── src/
    ├── types.ts                 # 共享类型定义
    ├── GameEngine.ts            # 游戏主循环 (requestAnimationFrame)
    ├── Car.ts                   # 赛车实体
    ├── Arena.ts                 # 竞技场边界管理
    ├── Physics.ts               # 物理引擎 (碰撞检测/碰撞响应)
    ├── InputManager.ts          # 双人键盘输入管理
    ├── Renderer.ts              # Canvas 2D 渲染器
    └── particle.ts              # 粒子效果系统
```

---

### Task 1: 创建组件配置文件 + 类型定义

**Files:**
- Create: `packages/react-components/src/car-battle/component.config.ts`
- Create: `packages/react-components/src/car-battle/src/types.ts`

**Interfaces:**
- Config: 遵循 `ComponentConfig` 契约，注册 id=car-battle 的 react 组件
- Types: 导出游戏中所有共享类型

- [ ] **Step 1: 创建 `component.config.ts`**

```typescript
import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'car-battle',
  name: 'CarBattle',
  title: '🏎️ 双人碰碰车',
  description: '双人同屏竞技游戏 — WASD vs 方向键，在竞技场内互相撞击得分！',
  version: '1.0.0',
  framework: 'react',
  entry: './index.tsx',
  group: '游戏娱乐',
  category: '双人竞技',
  tags: ['game', 'racing', 'multiplayer', 'canvas', 'car-battle', '2d'],
  status: 'stable',
  route: { path: '/components/car-battle', title: '🏎️ 双人碰碰车' },
  mount: { kind: 'react', propsMode: 'none' },
  isolation: { mode: 'shadow-dom' },
  capabilities: { fullscreen: true, fullscreenMode: 'viewport' },
} satisfies ComponentConfig;
```

- [ ] **Step 2: 创建 `src/types.ts`**

```typescript
/** 2D 向量 */
export interface Vec2 {
  x: number;
  y: number;
}

/** 赛车状态 */
export interface CarState {
  position: Vec2;
  velocity: Vec2;
  angle: number;           // 车头朝向（弧度）
  hitStunTimer: number;    // 眩晕计时（秒）
  score: number;
  color: 'blue' | 'red';
  playerIndex: 0 | 1;      // 0=玩家1(蓝), 1=玩家2(红)
}

/** 有效撞击记录 */
export interface HitEvent {
  time: number;             // 游戏时间
  from: 0 | 1;             // 撞击方
  force: number;            // 撞击力度
}

/** 游戏阶段 */
export type GamePhase = 'countdown' | 'playing' | 'finished';

/** 游戏状态快照 */
export interface GameState {
  cars: [CarState, CarState];
  timeRemaining: number;    // 剩余秒数
  phase: GamePhase;
  countdownTimer: number;   // 倒计时 3..2..1
}

/** 键盘输入状态 */
export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}
```

- [ ] **Step 3: 验证**

运行 `pnpm build` 确保无编译错误。

- [ ] **Step 4: 提交**

```bash
git add packages/react-components/src/car-battle/
git commit -m "feat(car-battle): add component config and shared types"
```

---

### Task 2: 实现 InputManager 和 Car 实体

**Files:**
- Create: `packages/react-components/src/car-battle/src/InputManager.ts`
- Create: `packages/react-components/src/car-battle/src/Car.ts`

**Interfaces:**
- `InputManager` 提供 `getState(playerIndex: 0 | 1): InputState` 接口
- `Car` 提供 `update(dt: number, input: InputState, arena: Arena): void` 和 `getState(): CarState`

- [ ] **Step 1: 创建 `src/InputManager.ts`**

```typescript
import type { InputState } from './types';

/**
 * 双人键盘输入管理器。
 * 玩家1: WASD
 * 玩家2: 方向键 ↑↓←→
 * 
 * 使用 Set 追踪当前按下键，每帧轮询。
 */
export class InputManager {
  private keys = new Set<string>();
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.handleKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      // 阻止方向键滚动页面
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.code)) {
        e.preventDefault();
      }
    };
    this.handleKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  /** 根据玩家索引获取当前按键状态 */
  getState(playerIndex: 0 | 1): InputState {
    if (playerIndex === 0) {
      return {
        up: this.keys.has('KeyW'),
        down: this.keys.has('KeyS'),
        left: this.keys.has('KeyA'),
        right: this.keys.has('KeyD'),
      };
    }
    return {
      up: this.keys.has('ArrowUp'),
      down: this.keys.has('ArrowDown'),
      left: this.keys.has('ArrowLeft'),
      right: this.keys.has('ArrowRight'),
    };
  }

  /** 销毁，移除事件监听 */
  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
```

- [ ] **Step 2: 创建 `src/Car.ts`**

```typescript
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
```

- [ ] **Step 3: 创建 `src/Arena.ts`** — 竞速场边界管理

```typescript
import type { Car } from './Car';

const BORDER_WIDTH = 40; // 围栏宽度

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
```

- [ ] **Step 4: 提交**

```bash
git add packages/react-components/src/car-battle/
git commit -m "feat(car-battle): add InputManager, Car entity, and Arena"
```

---

### Task 3: 实现物理引擎 (碰撞检测 + 响应)

**Files:**
- Create: `packages/react-components/src/car-battle/src/Physics.ts`

**Interfaces:**
- `Physics.checkCollision(a: Car, b: Car): HitEvent | null` — 检测两车是否碰撞，返回撞击事件

- [ ] **Step 1: 创建 `src/Physics.ts`**

```typescript
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
    const minDist = CAR_RADIUS * 2;

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
```

- [ ] **Step 2: 提交**

```bash
git add packages/react-components/src/car-battle/
git commit -m "feat(car-battle): add Physics engine with collision detection"
```

---

### Task 4: 实现粒子效果系统

**Files:**
- Create: `packages/react-components/src/car-battle/src/particle.ts`

**Interfaces:**
- `ParticleSystem` — 管理粒子生命周期
- `emitCollision(x, y, color): void` — 在指定位置生成碰撞粒子
- `emitExhaust(x, y, angle, color): void` — 生成尾气粒子
- `update(dt): void` / `draw(ctx): void` — 更新+渲染

- [ ] **Step 1: 创建 `src/particle.ts`**

```typescript
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
```

- [ ] **Step 2: 提交**

```bash
git add packages/react-components/src/car-battle/
git commit -m "feat(car-battle): add particle effects system"
```

---

### Task 5: 实现 Renderer (Canvas 2D 绘制)

**Files:**
- Create: `packages/react-components/src/car-battle/src/Renderer.ts`

**Interfaces:**
- `Renderer` 接收 `GameState`, 在 Canvas 上绘制竞技场、赛车、粒子、HUD

- [ ] **Step 1: 创建 `src/Renderer.ts`**

```typescript
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

    // 边界围栏 (发光红线)
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#e94560';
    ctx.shadowBlur = 10;
    ctx.strokeRect(left - 2, top - 2, arena.width + 4, arena.height + 4);
    ctx.shadowBlur = 0;
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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 120px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = 20;
    ctx.fillText(String(Math.ceil(number)), canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/react-components/src/car-battle/
git commit -m "feat(car-battle): add Canvas 2D Renderer"
```

---

### Task 6: 实现 GameEngine (游戏主循环)

**Files:**
- Create: `packages/react-components/src/car-battle/src/GameEngine.ts`

**Interfaces:**
- `GameEngine` 管理所有子模块的生命周期和帧循环
- `start(canvas): void` — 初始化并启动游戏
- `stop(): void` — 停止游戏循环
- `onStateChange(cb): void` — React HUD 通过回调订阅状态
- `onHit(cb): void` — 撞击事件回调

- [ ] **Step 1: 创建 `src/GameEngine.ts`**

```typescript
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
```

- [ ] **Step 2: 提交**

```bash
git add packages/react-components/src/car-battle/
git commit -m "feat(car-battle): add GameEngine main loop"
```

---

### Task 7: 实现 React 入口组件 (index.tsx + CSS)

**Files:**
- Create: `packages/react-components/src/car-battle/index.tsx`
- Create: `packages/react-components/src/car-battle/index.css`

**Interfaces:**
- `export default function CarBattle(): JSX.Element` — 唯一导出
- 包含 Canvas、HUD (React overlay)、结果面板

- [ ] **Step 1: 创建 `index.css`**

```css
/* car-battle — 双人碰碰车竞技场样式 */

.sl-cb-root {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background: #0f0f23;
  overflow: hidden;
  font-family: 'Courier New', monospace;
}

.sl-cb-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* ---- HUD ---- */

.sl-cb-hud {
  position: fixed;
  top: 20px;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 10;
}

.sl-cb-score {
  position: absolute;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.sl-cb-score--blue {
  left: 30px;
  color: #4361ee;
}

.sl-cb-score--red {
  right: 30px;
  color: #e63946;
}

.sl-cb-score__value {
  font-size: 48px;
  font-weight: bold;
  text-shadow: 0 0 20px currentColor;
}

.sl-cb-score__label {
  font-size: 12px;
  opacity: 0.7;
  letter-spacing: 1px;
}

.sl-cb-timer {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  font-size: 32px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
}

.sl-cb-timer--warning {
  color: #e94560;
  animation: sl-cb-pulse 0.5s ease-in-out infinite alternate;
}

@keyframes sl-cb-pulse {
  from { opacity: 0.6; transform: translateX(-50%) scale(1); }
  to   { opacity: 1;   transform: translateX(-50%) scale(1.1); }
}

/* ---- Hit 动画 ---- */

.sl-cb-hit {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 60px;
  font-weight: bold;
  pointer-events: none;
  z-index: 20;
  animation: sl-cb-hit-anim 0.8s ease-out forwards;
}

.sl-cb-hit--blue { color: #4361ee; }
.sl-cb-hit--red  { color: #e63946; }

@keyframes sl-cb-hit-anim {
  0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
  50%  { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
  100% { opacity: 0; transform: translate(-50%, -60%) scale(1); }
}

/* ---- 结果面板 ---- */

.sl-cb-result-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 30;
  animation: sl-cb-fade-in 0.3s ease;
}

@keyframes sl-cb-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.sl-cb-result {
  background: #1a1a2e;
  border: 2px solid #e94560;
  border-radius: 16px;
  padding: 40px 60px;
  text-align: center;
  box-shadow: 0 0 40px rgba(233, 69, 96, 0.3);
}

.sl-cb-result__title {
  font-size: 36px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 20px;
}

.sl-cb-result__scores {
  display: flex;
  gap: 60px;
  justify-content: center;
  margin-bottom: 30px;
}

.sl-cb-result__player {
  text-align: center;
}

.sl-cb-result__player-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
}

.sl-cb-result__player-score {
  font-size: 48px;
  font-weight: bold;
}

.sl-cb-result__btn {
  padding: 12px 36px;
  font-size: 18px;
  font-family: inherit;
  background: #e94560;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  pointer-events: auto;
}

.sl-cb-result__btn:hover {
  background: #ff6b6b;
}

.sl-cb-result__winner {
  font-size: 24px;
  color: #ffd93d;
  margin-bottom: 20px;
  text-shadow: 0 0 10px rgba(255, 217, 61, 0.5);
}

.sl-cb-result__draw {
  font-size: 24px;
  color: #aaa;
  margin-bottom: 20px;
}

/* ---- 赛事说明 ---- */

.sl-cb-instructions {
  position: fixed;
  bottom: 15px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 40px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  z-index: 10;
  pointer-events: none;
  letter-spacing: 1px;
}

.sl-cb-instructions span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sl-cb-key {
  display: inline-block;
  padding: 2px 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  font-size: 10px;
}
```

- [ ] **Step 2: 创建 `index.tsx`**

```tsx
import './index.css';
import { useRef, useEffect, useState, useCallback } from 'react';
import type { JSX } from 'react';
import { GameEngine } from './src/GameEngine';
import type { GameState, HitEvent } from './src/types';

export default function CarBattle(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [hitFlash, setHitFlash] = useState<{ from: 0 | 1; key: number } | null>(null);

  const handleState = useCallback((state: GameState) => {
    setGameState(state);
  }, []);

  const handleHit = useCallback((_event: HitEvent) => {
    const key = Date.now();
    setHitFlash({ from: _event.from, key });
    // 动画结束后清除
    setTimeout(() => setHitFlash(null), 800);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine();
    engineRef.current = engine;

    const unsubState = engine.onStateChange(handleState);
    const unsubHit = engine.onHit(handleHit);

    engine.start(canvas);

    return () => {
      unsubState();
      unsubHit();
      engine.stop();
    };
  }, [handleState, handleHit]);

  const handleRestart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const old = engineRef.current;
    old?.stop();

    const engine = new GameEngine();
    engineRef.current = engine;

    const unsubState = engine.onStateChange(handleState);
    const unsubHit = engine.onHit(handleHit);

    engine.start(canvas);

    // 无法在回调中 unsubscribe, 但旧 engine 已 stop
    // 这里 cleanup return 不会执行, 所以忽略
    unsubState;
    unsubHit;
  }, [handleState, handleHit]);

  const isFinished = gameState?.phase === 'finished';
  const isCountdown = gameState?.phase === 'countdown';
  const timerWarning = gameState && !isCountdown && gameState.timeRemaining <= 10;

  return (
    <div className="sl-cb-root">
      <canvas ref={canvasRef} className="sl-cb-canvas" />

      {/* HUD */}
      {gameState && !isFinished && (
        <div className="sl-cb-hud">
          {/* 蓝方分数 */}
          <div className="sl-cb-score sl-cb-score--blue">
            <div className="sl-cb-score__value">{gameState.cars[0].score}</div>
            <div className="sl-cb-score__label">玩家1 [W A S D]</div>
          </div>

          {/* 计时器 */}
          {!isCountdown && (
            <div className={`sl-cb-timer ${timerWarning ? 'sl-cb-timer--warning' : ''}`}>
              {Math.ceil(gameState.timeRemaining)}s
            </div>
          )}

          {/* 红方分数 */}
          <div className="sl-cb-score sl-cb-score--red">
            <div className="sl-cb-score__value">{gameState.cars[1].score}</div>
            <div className="sl-cb-score__label">玩家2 [↑ ↓ ← →]</div>
          </div>
        </div>
      )}

      {/* 撞击闪字 */}
      {hitFlash && (
        <div
          key={hitFlash.key}
          className={`sl-cb-hit ${hitFlash.from === 0 ? 'sl-cb-hit--blue' : 'sl-cb-hit--red'}`}
        >
          +1
        </div>
      )}

      {/* 结果面板 */}
      {isFinished && (
        <div className="sl-cb-result-overlay">
          <div className="sl-cb-result">
            {gameState.cars[0].score > gameState.cars[1].score ? (
              <div className="sl-cb-result__winner">🏆 玩家1 获胜！</div>
            ) : gameState.cars[1].score > gameState.cars[0].score ? (
              <div className="sl-cb-result__winner">🏆 玩家2 获胜！</div>
            ) : (
              <div className="sl-cb-result__draw">🤝 平局！</div>
            )}
            <div className="sl-cb-result__scores">
              <div className="sl-cb-result__player">
                <div className="sl-cb-result__player-name" style={{ color: '#4361ee' }}>玩家1</div>
                <div className="sl-cb-result__player-score" style={{ color: '#4361ee' }}>
                  {gameState.cars[0].score}
                </div>
              </div>
              <div className="sl-cb-result__player">
                <div className="sl-cb-result__player-name" style={{ color: '#e63946' }}>玩家2</div>
                <div className="sl-cb-result__player-score" style={{ color: '#e63946' }}>
                  {gameState.cars[1].score}
                </div>
              </div>
            </div>
            <button className="sl-cb-result__btn" onClick={handleRestart}>
              再来一局
            </button>
          </div>
        </div>
      )}

      {/* 底部按键提示 */}
      {!isFinished && (
        <div className="sl-cb-instructions">
          <span>
            <span className="sl-cb-key">W</span>
            <span className="sl-cb-key">A</span>
            <span className="sl-cb-key">S</span>
            <span className="sl-cb-key">D</span>
            &nbsp;玩家1
          </span>
          <span>
            <span className="sl-cb-key">↑</span>
            <span className="sl-cb-key">←</span>
            <span className="sl-cb-key">↓</span>
            <span className="sl-cb-key">→</span>
            &nbsp;玩家2
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 构建测试**

```bash
pnpm build
```

检查 `apps/showcase` 构建是否成功，确认新组件被 glob 自动发现。

- [ ] **Step 4: 提交**

```bash
git add packages/react-components/src/car-battle/
git commit -m "feat(car-battle): add React entry component with HUD and result panel"
```

---

### Task 8: spec 自检 + 最终验证

**Files:** (无新增文件)

- [ ] **Step 1: Spec 覆盖检查**

对照 spec 逐条检查:
- ✅ 双键盘输入 (WASD/方向键)
- ✅ Canvas 2D 渲染
- ✅ 自由场地封闭竞技场
- ✅ 加速度+摩擦力物理模型
- ✅ 撞击得分 (阈值 200px/s)
- ✅ 60 秒计时
- ✅ 碰撞粒子效果
- ✅ 眩晕机制 (0.5s)
- ✅ 结束面板 + 再来一局

- [ ] **Step 2: 最终构建验证**

```bash
pnpm build
```

确认 `apps/showcase` 构建成功，无类型错误，无 lint 警告。

- [ ] **Step 3: 推送到 GitHub**

```bash
git push origin {当前分支}
```

---

## 执行方式

**Plan complete and saved to `docs/superpowers/plans/2026-07-26-car-battle-plan.md`.**

我建议采用 **Subagent-Driven** 方式执行——为每个 Task 启动独立子代理，完成代码后自动 review，效率最高。

要开始执行吗？
