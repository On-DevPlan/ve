// architecture-intro —— 合成级常量。
//
// 为什么把调色板 / 时长抽成常量而不是全部内联:
//   Remotion 官方的"全部内联"建议服务于 Studio 的可视化编辑(Studio 只能把
//   字面量写回代码)。本组件是通过 <Player> 内嵌在 showcase 详情页里的,没有
//   Studio 写回链路,而这些值跨 9 个场景/子组件复用 —— 复制 9 份十六进制色值
//   的维护成本远大于内联带来的(此处并不存在的)可编辑性收益。
//
// 仍然遵守的部分:所有 interpolate() 调用保持写在 style 里内联,
// 因为那是"动画曲线可读、可逐帧对照"的关键。

/** 合成尺寸与帧率。SCENE_* 时长以此 fps 为基准。 */
export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
} as const;

/**
 * 各幕时长(帧)。总时长 = 各幕之和 - 各过渡之和:
 *   90 + 130 + 120 + 130 + 90 = 560
 *   4 段过渡 × 20 帧 = 80
 *   → 合成总长 480 帧 = 16s @ 30fps
 * 改任何一个值都要同步改 TOTAL_DURATION,否则末幕会被截断。
 */
export const SCENE = {
  title: 90,
  architecture: 130,
  microFrontend: 120,
  discovery: 130,
  outro: 90,
} as const;

/** 单段过渡时长(帧)。4 段全部用同一值,便于口算总长。 */
export const TRANSITION_FRAMES = 20;

/** 合成总长。= sum(SCENE) - 4 * TRANSITION_FRAMES */
export const TOTAL_DURATION = 480;

/**
 * 调色板 —— 深空蓝底 + 双色强调(Vue 绿 / React 蓝)。
 * 视频内部不走 --sl-* token:主题切换会让精心调过的对比度失效,
 * 而视频是"成品画面"而非需要跟随宿主主题的 UI。
 */
export const PALETTE = {
  /** 画布底色,近黑的深空蓝 */
  bg: '#05070f',
  /** 次级底色,用于卡片/面板 */
  surface: '#0d1425',
  /** 面板描边 */
  border: 'rgba(148, 178, 255, 0.22)',
  /** 主文字 */
  text: '#f2f6ff',
  /** 次级文字 */
  muted: '#8fa3cc',
  /** 品牌主色(青) */
  accent: '#39e0d0',
  /** Vue 绿 */
  vue: '#42d392',
  /** React 蓝 */
  react: '#61dafb',
  /** 强调紫,用于"自动发现"一幕 */
  violet: '#a78bfa',
} as const;

/** 等宽字体栈 —— 代码片段与文件树用 */
export const MONO_FONT =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** 无衬线字体栈 —— 标题与正文用。含中文回退,标题里有中文。 */
export const SANS_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Roboto, sans-serif';
