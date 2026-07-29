// components/virtual-grid.ts —— 虚拟网格的纯计算核心。
//
// 职责:
//   给定容器宽高、卡片尺寸、gap、当前 scrollTop 与总条目数,
//   算出「这一帧应该渲染哪一段卡片、往下偏移多少、总高多少」。
//
// 为什么抽成纯函数:
//   - 不碰 DOM,可在 node/jsdom 下直接单测,覆盖列数推导与边界;
//   - CardGrid.vue 只负责测量(ResizeObserver)与滚动(rAF),把算术交给这里,
//     职责单一,回归风险低。
//
// 关键假设:
//   - 卡片行高固定(cardHeight),这是虚拟化的前提;ComponentCard 用
//     line-clamp + 固定高度保证这一点。
//   - 列内每张卡等宽,列数按容器宽度整除推导,至少 1 列。

// 单帧输入 —— 全是标量,方便测试构造。
export interface VirtualWindowInput {
  /** 条目总数 */
  total: number;
  /** 当前竖向滚动位置(px) */
  scrollTop: number;
  /** 可视容器内容宽度(px),用来推导列数 */
  containerWidth: number;
  /** 可视容器高度(px),用来推导可见行数 */
  viewportHeight: number;
  /** 单卡宽度(px) */
  cardWidth: number;
  /** 单卡高度(px) */
  cardHeight: number;
  /** 卡片间距(px),横竖一致 */
  gap: number;
  /** 上下额外多渲染的行数,减少快速滚动露白 */
  overscan: number;
}

// 单帧输出 —— CardGrid 直接照此渲染。
export interface VirtualWindow {
  /** 列数 */
  columns: number;
  /** 撑开滚动条用的总高度(px) */
  totalHeight: number;
  /** 可见切片起始索引(含) */
  startIndex: number;
  /** 可见切片结束索引(不含) */
  endIndex: number;
  /** 可见切片相对顶部的竖向偏移(px),= 起始行 * 行距 */
  offsetY: number;
}

// 卡片布局常量 —— CardGrid.vue(测量+切片)与 ComponentCard.vue(固定高度 CSS)
// 必须共用同一套数值,否则虚拟窗口的行距与真实卡高不符,滚动会错位。
// 改这里即改全局;ComponentCard 的高度/网格列宽都以此为准。
export const CARD_WIDTH = 280;
export const CARD_HEIGHT = 150;
export const CARD_GAP = 16;
export const OVERSCAN_ROWS = 2;

// 纯计算:无副作用,同输入同输出。
export function computeVirtualWindow(input: VirtualWindowInput): VirtualWindow {
  const {
    total,
    scrollTop,
    containerWidth,
    viewportHeight,
    cardWidth,
    cardHeight,
    gap,
    overscan,
  } = input;

  // 空列表:所有量归零,避免除零与负区间
  if (total <= 0) {
    return { columns: 1, totalHeight: 0, startIndex: 0, endIndex: 0, offsetY: 0 };
  }

  // 列数:(容器宽 + gap) / (卡宽 + gap),向下取整,至少 1 列
  //   +gap 是因为 N 列之间只有 N-1 个 gap,数学上等价于给容器补一个 gap
  const columns = Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)));

  // 行距 = 卡高 + gap;总行数向上取整
  const rowStride = cardHeight + gap;
  const totalRows = Math.ceil(total / columns);
  // 总高:最后一行不需要尾部 gap,减掉一次让滚动条更精确
  const totalHeight = totalRows * rowStride - gap;

  // 当前滚动到第几行(向下取整),再向上减去 overscan 缓冲,夹到 [0, totalRows]
  const firstVisibleRow = Math.floor(scrollTop / rowStride);
  const startRow = Math.max(0, firstVisibleRow - overscan);

  // 视口能装下几行(向上取整),两侧各留 overscan 行
  const visibleRows = Math.ceil(viewportHeight / rowStride);
  const endRow = Math.min(totalRows, firstVisibleRow + visibleRows + overscan);

  // 行 -> 索引:起始索引不超过 total;结束索引夹到 total
  const startIndex = Math.min(total, startRow * columns);
  const endIndex = Math.min(total, endRow * columns);

  // 偏移:起始行 * 行距,让渲染出的切片贴合真实位置
  const offsetY = startRow * rowStride;

  return { columns, totalHeight, startIndex, endIndex, offsetY };
}
