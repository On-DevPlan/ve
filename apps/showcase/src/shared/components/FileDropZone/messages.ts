// messages.ts —— 拒绝提示的统一文案。
//
// 放在共享组件里而不是各调用点各写一份：拒绝原因只有这三种，文案不该有
// 三份实现（改造前 game-skin-admin 与 gis 各自写过一遍）。调用点若需要更
// 具体的措辞，自行拼 info.reason 即可，这里只是默认值。

import type { RejectInfo, RejectReason } from './types';

export const REJECT_REASON_TEXT: Record<RejectReason, string> = {
  type: '类型不在允许范围内',
  size: '超过体积上限',
  directory: '不能拖入文件夹',
};

/** 把 RejectInfo 拼成一句可直接展示的提示。 */
export function formatRejectInfo(info: RejectInfo): string {
  return `已忽略「${info.file.name}」：${REJECT_REASON_TEXT[info.reason]}`;
}
