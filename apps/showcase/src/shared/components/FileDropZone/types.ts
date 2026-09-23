// types.ts —— FileDropZone 的 props 契约。
//
// 契约必须框架无关（见 ../README.md 硬约定 2）：这里只出现原始类型、数组、
// 纯对象与回调函数，不出现 Ref / Slots / ReactNode —— 因为 island 边界上
// 只过得了 JSON-ish 值与函数。

/** 文件被拒绝的原因。 */
export type RejectReason =
  /** 类型不在 accept 允许范围内 */
  | 'type'
  /** 超过 maxSizeMb */
  | 'size'
  /** 拖进来的是目录而非文件 */
  | 'directory';

export interface RejectInfo {
  readonly file: File;
  readonly reason: RejectReason;
}

/** 呈现形态。 */
export type FileDropZoneVariant =
  /** 按钮 + 下方提示行。适合弹窗、工具条。 */
  | 'button'
  /**
   * 方格。整格即触发区，内容居中，用于网格格子。
   * 与 imageUrl 组合可做「图片预览格」，与 text 组合可做「文件名格」。
   * 方格的边框 / 背景 / 尺寸由消费方的类名覆盖（消费方选择器优先级更高）。
   */
  | 'tile'
  /**
   * 裸按钮。只渲染「一个按钮 + 隐藏 input」，外层容器不做任何装饰
   * （无虚线框、无内边距、无自动提示行），拖拽照常接管。
   * 按钮外观完全由 buttonClass 提供 —— 用于消费方已有自己的按钮设计系统时
   * （如 color-studio 的 Btn、github-show 的 .sl-gh-btn）。
   */
  | 'bare'
  /**
   * 虚线拖放区。整块区域本身即点击区与拖放目标，框内只有文字（主文案 + 副文案），
   * 不再套一颗按钮 —— 用于「选文件」就是该区域主动作的场景（导入弹窗的文件页）。
   *
   * 框的外观是共享层的一部分（见 style.css），消费方只需 `variant: 'zone'`，
   * 不要再自己画虚线框，否则会出现「框套框」或边框粗细不一。
   * 外间距由消费方容器给（组件不假设自己周围留多少白）。
   */
  | 'zone';

export interface FileDropZoneProps {
  /** 呈现形态，默认 'button'。 */
  variant?: FileDropZoneVariant;
  /**
   * bare 形态：内部按钮的类名。
   *
   * 给了它之后，内部按钮**只**带这个类名 —— 内置的 `.sl-file-drop__btn` 不再应用，
   * 于是不会有「两套样式抢同一批属性、谁后注入谁赢」的不确定性。
   *
   * 注意：若消费方组件用 SFC `<style scoped>`，这个类名要写在**非 scoped** 的样式块里 ——
   * 按钮不是消费方组件的根节点，拿不到 scoped 的 data-v 属性。
   */
  buttonClass?: string;
  /** 允许的扩展名 / MIME 列表，格式同原生 input 的 accept，如 '.toml,.json'。 */
  accept?: string;
  /** 是否允许一次选 / 拖多个文件。默认 false。 */
  multiple?: boolean;
  /** 单文件体积上限（MB）。不传则不限制。 */
  maxSizeMb?: number;
  /**
   * 文案。
   * button / bare 形态是按钮文字；
   * tile 形态不显示文字，只作为无障碍名称的兜底；
   * zone 形态是框内的主文案，不传则为「点击或拖拽文件到此处」。
   */
  label?: string;
  /**
   * 次要提示文案。
   * button 形态：按钮下方的提示行，不传则按 accept / maxSizeMb 自动生成；
   * tile 形态：格子底部的覆盖条（hover / 拖拽时淡入），不传则**不渲染**；
   * bare 形态：同 button，但**不传就不渲染**（裸形态要的是「只有一个按钮」）；
   * zone 形态：框内的副文案，不传则由 accept 生成（如「支持 .toml」），无 accept 则不渲染。
   */
  hint?: string;
  /** tile 形态：格内主文本（已选文件名 / 期望文件名）。有 imageUrl 时优先显示图片。 */
  text?: string;
  /** tile 形态：预览图 URL。为空则不渲染 img（避免 src="" 的破图）。 */
  imageUrl?: string;
  /** 禁用整个交互。 */
  disabled?: boolean;
  /** 全部文件通过校验时回调（已按 multiple 截取）。 */
  onSelect?: (files: File[]) => void;
  /** 有文件被拒绝时逐个回调，便于调用点给出提示。 */
  onReject?: (info: RejectInfo) => void;
}
