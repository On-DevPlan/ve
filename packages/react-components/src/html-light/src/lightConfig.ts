// html-light 的灯光 / 表单配置常量。
// LightingSettings 与 COLOR_PRESETS 对齐 HTML-Light-Demo 的物理灯光模型,
// 让 three.js SpotLight 的 power / angle / color 直接消费。

/** 灯光状态:控制 three.js SpotLight + 灯泡自发光。 */
export type LightingSettings = {
  enabled: boolean;
  angle: number; // 聚光锥半角(度),16-58
  brightness: number; // 光通量(流明),映射到 SpotLight.power
  color: string; // CSS 颜色,同时驱动 --lamp-color 与所有发光材质
};

/** 预设灯色(RMB 单击循环;也作为表单里的色板)。 */
export const COLOR_PRESETS = [
  '#ffb36b',
  '#ffd9a3',
  '#8fdcff',
  '#c79cff',
  '#ff5f7f',
] as const;

/** 表单下拉的"今日心情"选项——纯演示数据。 */
export const MOOD_OPTIONS = [
  'Curious',
  'Focused',
  'Playful',
  'Serene',
  'Inspired',
] as const;

/** 初始灯光:暖琥珀色、34° 锥角、1450lm。 */
export const INITIAL_LIGHT: LightingSettings = {
  enabled: true,
  angle: 34,
  brightness: 1450,
  color: '#ffb36b',
};
