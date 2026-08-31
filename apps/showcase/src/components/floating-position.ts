// components/floating-position.ts —— FloatingBack 位置纯计算核心。
//
// 职责:
//   默认位置(右下角)、clamp(拖出视口拉回)、localStorage 存取。
//
// 为什么抽成纯函数:
//   - 不碰真实 DOM 定位,storage 以参数注入,node/jsdom 下直接单测;
//   - FloatingBack.vue 只负责指针事件与渲染,算术交给这里(同 virtual-grid.ts 模式)。

// 按钮边长(px)—— CSS 的宽高必须与此一致,否则 clamp 会留缝
export const FLOATING_BACK_SIZE = 40;
// 距视口四边的最小留白(px)
export const FLOATING_BACK_MARGIN = 12;
// localStorage key(带命名空间,避免污染)
export const FLOATING_BACK_POS_KEY = 'sl:floating-back:pos';

// 左上角坐标(px)。用 x/y 而不是 left/top,与 CSS 里的 translate 无关,纯逻辑层。
export interface FloatPos {
  x: number;
  y: number;
}

// 默认位置:右下角。viewportW/H 由调用方传(window.innerWidth/Height)。
export function defaultPos(viewportW: number, viewportH: number): FloatPos {
  return {
    x: viewportW - FLOATING_BACK_SIZE - FLOATING_BACK_MARGIN,
    y: viewportH - FLOATING_BACK_SIZE - FLOATING_BACK_MARGIN,
  };
}

// clamp 到视口内(四边各留 margin)。视口比按钮还小时不产生负区间,钉在 margin 处。
export function clampPos(pos: FloatPos, viewportW: number, viewportH: number): FloatPos {
  const maxX = Math.max(FLOATING_BACK_MARGIN, viewportW - FLOATING_BACK_SIZE - FLOATING_BACK_MARGIN);
  const maxY = Math.max(FLOATING_BACK_MARGIN, viewportH - FLOATING_BACK_SIZE - FLOATING_BACK_MARGIN);
  return {
    x: Math.min(Math.max(pos.x, FLOATING_BACK_MARGIN), maxX),
    y: Math.min(Math.max(pos.y, FLOATING_BACK_MARGIN), maxY),
  };
}

// 读取存储的位置;未存 / JSON 损坏 / 结构不对 / storage 异常 → null(调用方回默认位置)。
export function loadPos(storage: Storage | null): FloatPos | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(FLOATING_BACK_POS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' && parsed !== null &&
      typeof (parsed as Record<string, unknown>).x === 'number' &&
      typeof (parsed as Record<string, unknown>).y === 'number'
    ) {
      return { x: (parsed as FloatPos).x, y: (parsed as FloatPos).y };
    }
    return null;
  } catch {
    return null;
  }
}

// 写入存储;storage 异常(隐私模式)静默 —— 位置记忆是锦上添花,不该打断交互。
export function savePos(storage: Storage | null, pos: FloatPos): void {
  if (!storage) return;
  try {
    storage.setItem(FLOATING_BACK_POS_KEY, JSON.stringify(pos));
  } catch {
    /* 位置记忆失败可接受 */
  }
}
