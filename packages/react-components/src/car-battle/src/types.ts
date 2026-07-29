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
