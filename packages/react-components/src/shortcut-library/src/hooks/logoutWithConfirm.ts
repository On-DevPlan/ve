// src/hooks/logoutWithConfirm.ts —— 退出前的「未保存改动」确认 + flush 流程。
//
// banner 退出按钮(index.tsx)与设置面板退出按钮(SettingsPanel.tsx)共用:
//   - manual 模式 + dirty + warnOnDirtyExit 开 → 先弹 confirm,选「先保存」就 flush
//   - 其余情况 → 直接 jwtAuth.logout()
//
// 组件传入自己的 saveMode / dirty / warnOnDirtyExit / flushDirty,
// 避免 helper 依赖 useShortcuts 的返回结构(两个调用方上下文不同)。

import { jwtAuth } from './useAuth';

export interface LogoutContext {
  saveMode: 'auto' | 'manual';
  dirty: boolean;
  warnOnDirtyExit: boolean;
  flushDirty: () => void | Promise<void>;
}

export async function logoutWithConfirm(ctx: LogoutContext): Promise<void> {
  if (ctx.saveMode === 'manual' && ctx.dirty && ctx.warnOnDirtyExit) {
    const save = window.confirm(
      '有未保存的本地改动。\n\n点「确定」= 先保存到云端再退出\n点「取消」= 直接退出(丢失改动)',
    );
    if (save) {
      try {
        await ctx.flushDirty();
      } catch (e) {
        window.alert('保存失败:' + (e instanceof Error ? e.message : String(e)));
        return; // 失败不退出
      }
    } else {
      const ok = window.confirm('确认丢失未保存的改动并退出?');
      if (!ok) return;
    }
  }
  jwtAuth.logout();
}
