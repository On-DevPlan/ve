# 双人碰碰车竞技场 — 设计规格

## 概述

在组件展示系统中添加一个 React + Canvas 2D 的双人同屏竞技游戏组件。两名玩家在同一台电脑上用不同键盘区域操控赛车，在封闭竞技场内互相撞击得分。

## 技术栈

- **框架**: React 19 (遵循 `@style-library/react-components` 规范)
- **渲染**: Canvas 2D API (纯浏览器 API, 无额外游戏引擎依赖)
- **构建**: Vite + esbuild (复用 monorepo 现有配置)

## 组件信息

| 字段 | 值 |
|------|-----|
| id | `car-battle` |
| name | `CarBattle` |
| title | 🏎️ 双人碰碰车 |
| framework | `react` |
| group | 游戏娱乐 |
| category | 双人竞技 |
| mount.kind | `react` |
| isolation.mode | `shadow-dom` |

## 游戏机制

### 基本规则

- 2D 俯视角封闭竞技场
- 蓝车 (玩家1) 用 WASD 控制, 红车 (玩家2) 用方向键控制
- 计时 60 秒, 猛烈撞击对方得分
- 倒计时结束, 得分高者获胜

### 物理模型

- **运动**: 加速度 + 摩擦力模型, 按键施加加速度, 摩擦力使速度衰减
- **转向**: 左右键改变车头朝向, 沿车头方向加速
- **碰撞**: 两车碰撞后按动量交换弹开, 碰撞速度超过阈值计为一次"有效撞击"
- **边界**: 竞技场边缘有弹性围栏, 撞墙反弹并损失部分速度
- **眩晕**: 有效撞击后, 被撞方短暂眩晕 (0.5秒不可控)

### 计分系统

- 撞击力度 `|相对速度| > 阈值(200px/s)` 记为一次有效撞击
- 每次有效撞击, 撞击方得 1 分
- 计分时屏幕中央弹出 `+1` 动画

## 架构设计

### 文件结构

```
packages/react-components/src/car-battle/
├── component.config.ts          # 组件配置
├── index.tsx                    # React 入口 (挂载 Canvas + UI)
├── index.css                    # 宿主样式
└── src/
    ├── engine/
    │   ├── GameEngine.ts        # 游戏主循环 (requestAnimationFrame)
    │   └── Physics.ts           # 物理引擎 (碰撞检测/响应)
    ├── entities/
    │   ├── Car.ts               # 赛车实体
    │   └── Arena.ts             # 竞技场实体
    ├── input/
    │   └── InputManager.ts      # 双人键盘输入管理
    ├── rendering/
    │   └── Renderer.ts          # Canvas 渲染器
    ├── ui/
    │   ├── HUD.tsx              # 计分板 + 计时器 (React overlay)
    │   └── ResultPanel.tsx      # 结束结果面板
    └── types.ts                 # 共享类型定义
```

### 数据流

```
InputManager (键盘事件)
    ↓ 按键状态
GameEngine (每帧 update)
    ├── 读取 InputManager 按键状态
    ├── 更新 Car 位置/速度 (Physics)
    ├── 碰撞检测 → 计分
    └── 更新游戏状态 (分数/计时/眩晕)
    ↓ 状态快照
Renderer (每帧 draw)
    └── 绘制 Canvas (竞技场/赛车/特效)

React UI (HUD)
    ↑ 从 GameEngine 读取状态 (useEffect + 轮询/回调)
```

### 核心类型

```typescript
interface Vec2 { x: number; y: number }

interface CarState {
  position: Vec2;
  velocity: Vec2;
  angle: number;        // 车头朝向 (弧度)
  hitStunTimer: number; // 眩晕计时 (秒)
  score: number;
  color: 'blue' | 'red';
}

interface GameState {
  cars: [CarState, CarState]; // [0]=蓝车(玩家1), [1]=红车(玩家2)
  timeRemaining: number;      // 剩余秒数
  phase: 'playing' | 'finished';
}

interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}
```

## 渲染设计

### 竞技场 (Arena)

- 深色背景 (`#1a1a2e`) + 网格线 (`#16213e`)
- 边界围栏: 红色发光线条 (`#e94560`)
- 竞技场尺寸: Canvas 宽高的 80%, 居中

### 赛车 (Car)

- 用带方向指示的梯形/箭头绘制
- 蓝车: `#4361ee` / 红车: `#e63946`
- 尾部有尾气粒子效果 (小圆点逐渐消失)
- 眩晕时闪烁提示

### 碰撞效果

- 撞击瞬间产生白色闪光圈
- 粒子爆炸: 10-20 个彩色小点向外扩散

### HUD

- 左上: 蓝车分数 + 玩家提示 "WASD"
- 右上: 红车分数 + 玩家提示 "方向键"
- 顶部中央: 倒计时
- 底部: 单局胜负历史记录 (可选)

## 实现优先级

### v1.0 (本次实现)

1. 基本 Canvas 渲染 + 游戏循环
2. 双人键盘输入
3. 赛车物理 (加速/转向/摩擦力)
4. 碰撞检测 + 弹开
5. 计分 + 计时 + 结束面板
6. 碰撞粒子效果

### 未来可扩展 (不做)

- 音效
- 道具系统
- 自定义场地
- 联网对战
- AI 对手

## 组件配置

```typescript
// component.config.ts
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
