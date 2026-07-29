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
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
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
