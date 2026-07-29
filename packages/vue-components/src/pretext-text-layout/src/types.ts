// 跨子模块共享的类型定义,仅在本组件内部使用。

/** 可拖拽的"浮动图形":文字绕流场景下被文字避让的区域。坐标相对内容区左上角。 */
export interface FlowShape {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 一行经过 pretext 排版后的渲染描述:文本 + 在内容区里的左偏移 / 可用宽 / 纵坐标。 */
export interface LineRow {
  text: string;
  x: number;
  width: number;
  y: number;
}

/** 多语言样例文本,用来展示 pretext 对 CJK / RTL / Emoji 的支持。 */
export interface SampleText {
  id: string;
  label: string;
  note: string;
  text: string;
}

/** 字体加载状态。primary=true 表示成功用上首选字体(Inter),否则为兜底(system-ui)。 */
export interface FontStatus {
  family: string;
  ready: boolean;
  primary: boolean;
}

/** 性能基准结果。 */
export interface BenchResult {
  iterations: number;
  /** pretext prepare() 一次性预处理耗时(ms)。 */
  prepareMs: number;
  /** pretext layout() 重复 N 次耗时(ms)。 */
  layoutMs: number;
  /** DOM appendChild + offsetHeight 重复 N 次耗时(ms,每次触发真实重排)。 */
  domMs: number;
  /** DOM 耗时 / pretext layout 耗时 的倍率。 */
  speedup: number;
  /** 基准中 DOM 实测的单段高度(px),用于证明 offsetHeight 眮的被读取(也防 DCE)。 */
  sampleHeight: number;
}
