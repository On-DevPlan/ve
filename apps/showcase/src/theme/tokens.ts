// theme/tokens.ts —— 仓库默认主题 token 集。
//
// 职责:
//   1) 在 showcase 启动时作为"基线主题"使用 —— 没有外部主题时落回这一组
//   2) 与 spec §4.4 主题 contract 对齐:全部走 CSS 变量,组件不感知具体值
//   3) 单文件常量 + Record<string, string>,方便直接灌进 applyThemeToDocument
//
// 注意:
//   - 这里只有默认值;真实生产主题通常来自外部主题包(design tokens JSON)
//     或站点品牌配置。此文件只保证"不传主题也能用"。
//   - key 必须是 CSS 自定义属性格式(`--xxx`),否则 setProperty 会失败。
//   - 这里集中硬编码;后续如需主题切换或主题包接入,在此处抽接口即可。

export const defaultTokens: Record<string, string> = {
  // 品牌主色 —— 按钮、链接、强调态
  '--sl-color-primary': '#2563eb',
  '--sl-color-on-primary': '#ffffff',
  // 表面色 —— 卡片、面板背景
  '--sl-color-surface': '#ffffff',
  '--sl-color-surface-alt': '#f3f4f6',
  // 文本色 —— 正文与次要文本
  '--sl-color-text': '#111827',
  '--sl-color-text-muted': '#6b7280',
  // 边框色 —— 分隔线、卡片描边
  '--sl-color-border': '#d1d5db',
  // 圆角 —— 通用中等半径
  '--sl-radius-md': '8px',
  // 间距 —— 4/8/12/16 阶梯
  '--sl-space-1': '4px',
  '--sl-space-2': '8px',
  '--sl-space-3': '12px',
  '--sl-space-4': '16px',
  // 字体栈 —— 优先系统字体,避免联网拉远程字体阻塞首屏
  '--sl-font-family': 'system-ui, -apple-system, "Segoe UI", sans-serif',
};
