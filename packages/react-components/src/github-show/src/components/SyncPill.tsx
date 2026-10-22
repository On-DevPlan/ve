// src/components/SyncPill.tsx —— 顶部同步状态条。
// 三种场景:游客(本机保存 + 登录入口)、云端(加载中 / 保存中 / 已同步 / 保存失败重试)。

import type { GithubShowStatus, SyncStatus } from '../hooks/useGithubShow';

interface SyncPillProps {
  status: GithubShowStatus;
  syncStatus: SyncStatus;
  isLoggedIn: boolean;
  onLogin: () => void;
  onRetry: () => void;
}

export default function SyncPill({ status, syncStatus, isLoggedIn, onLogin, onRetry }: SyncPillProps) {
  if (status === 'loading') {
    return <span className="sl-gh-pill">加载中…</span>;
  }
  if (!isLoggedIn) {
    return (
      <span className="sl-gh-pill sl-gh-pill--guest">
        {/* v1.6.49 移动端短标签:窄屏工具栏一行要放下全部控件,「游客模式 ·
            本机保存」占 120px 挤不下 —— ≤768px 换「游客」,完整说明仍在
            本地存储语义与登录入口里。 */}
        <span className="sl-gh-pill__label-long">游客模式 · 本机保存</span>
        <span className="sl-gh-pill__label-short">游客</span>
        <button type="button" className="sl-gh-pill__btn" onClick={onLogin}>
          登录
        </button>
      </span>
    );
  }
  if (syncStatus === 'saving') {
    return <span className="sl-gh-pill">保存中…</span>;
  }
  if (syncStatus === 'error') {
    return (
      <button type="button" className="sl-gh-pill sl-gh-pill--error" onClick={onRetry}>
        保存失败 · 点击重试
      </button>
    );
  }
  return <span className="sl-gh-pill sl-gh-pill--ok">已同步</span>;
}
