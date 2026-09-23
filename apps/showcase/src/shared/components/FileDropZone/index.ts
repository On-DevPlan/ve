// FileDropZone/index.ts —— 组件目录的唯一入口（descriptor）。
//
// 消费方只 import 本文件，不直接 import FileDropZone.vue —— 绕过 SharedMount 壳
// 会让 descriptor.css 无人注入，组件以裸样式渲染。
//
//   import FileDropZone from '@/shared/components/FileDropZone';
//   <SharedMount :module="FileDropZone" :component-props="{ accept: '.toml' }" />

import FileDropZone from './FileDropZone.vue';
// ?inline 让 Vite 把 CSS 当字符串导出（且经过完整 CSS 管线：postcss / url() 重写 /
// @import 内联 / minify），而不是注入 document。这里必须是字符串 ——
// 注入的时机与落点由 SharedMount 的 host-env 策略决定。
import css from './style.css?inline';
import { defineSharedModule } from '../runtime/descriptor';

export default defineSharedModule({
  Component: FileDropZone,
  css,
  meta: { name: 'FileDropZone', host: 'vue' },
});

export type {
  FileDropZoneProps,
  FileDropZoneVariant,
  RejectInfo,
  RejectReason,
} from './types';
// 拒绝提示的统一文案。放在共享组件里，避免每个调用点各写一份映射表。
export { REJECT_REASON_TEXT, formatRejectInfo } from './messages';
