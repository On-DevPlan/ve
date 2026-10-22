// src/components/GithubTokenModal.tsx —— GitHub Token 设置弹窗(v1.6.50)。
//
// 为什么需要:提交统计走 api.github.com,匿名配额 60 次/小时/IP —— 每个仓库
// 恒定 1 次 commit_activity 请求(v1.6.42 起),十几个仓库就撞限流。编辑者放
// 自己的 PAT,配额升到 5000 次/小时/用户,统计才刷得动。
//
// token 存哪:本账号的 **private** KV key('github-show-token'),不放文档 blob
// 也不放统计快照 —— 那两个在公开分享模式下是 public 可见,放进去等于把 PAT
// 送给所有拿到分享链接的人。private key 只有带 JWT 的本人能读,公开读端点
// 只放行 public 行。
//
// 传输:浏览器直连 api.github.com(Authorization 头)—— GitHub 的 CORS 预检
// 实测放行 Authorization,不存在跨域问题;token 不经过后端代理,也不落进
// 分享出去的快照。
//
// 权限建议:只要公开仓库的提交统计,classic PAT **不给任何 scope** 即可
// (公开读);要统计私有仓库才需要 repo scope,风险显著上升。

import { useEffect, useState } from 'react';
import {
  clearGithubToken,
  loadGithubToken,
  saveGithubToken,
} from '@api/components/github-show/githubToken';

export interface GithubTokenModalProps {
  onClose: () => void;
  /** 保存/清除成功后回调(host 用它触发统计重跑 + 刷新按钮文案) */
  onChanged: (configured: boolean) => void;
}

export default function GithubTokenModal({ onClose, onChanged }: GithubTokenModalProps) {
  const [value, setValue] = useState('');
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开时读一次:拿当前是否已配置(不把 token 明文回填到输入框,只给"已配置")
  useEffect(() => {
    void loadGithubToken().then((t) => setConfigured(!!t));
  }, []);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await saveGithubToken(value);
      setConfigured(true);
      onChanged(true);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    setError(null);
    try {
      await clearGithubToken();
      setConfigured(false);
      onChanged(false);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '清除失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="sl-gh-modal__backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sl-gh-modal sl-gh-token" role="dialog" aria-label="GitHub Token 设置">
        <div className="sl-gh-modal__head">
          <h3 className="sl-gh-modal__title">GitHub Token</h3>
          <button type="button" className="sl-gh-modal__close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="sl-gh-token__status">
          {configured ? (
            <>
              已配置 token(本账号 private key)。统计请求会带鉴权头,
              配额 5000 次/小时,不再受匿名 60 次/小时限制。
            </>
          ) : (
            <>
              未配置 token —— 统计走匿名请求(60 次/小时/IP),仓库一多就会限流。
            </>
          )}
        </p>

        <label className="sl-gh-token__label" htmlFor="sl-gh-token-input">
          Personal Access Token
        </label>
        <input
          id="sl-gh-token-input"
          className="sl-gh-input sl-gh-token__input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={configured ? '已配置 —— 留空并保存表示不改' : 'ghp_…(只需公开读权限,无需任何 scope)'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />

        <p className="sl-gh-token__hint">
          只统计<b>公开</b>仓库时,classic PAT 不给任何 scope 即可;需要私有仓库才给 repo scope。
          token 存在你账号的 private key 里,不随公开分享链接泄露;浏览器直连 GitHub,
          不经过后端。
        </p>

        {error ? <p className="sl-gh-token__error">{error}</p> : null}

        <div className="sl-gh-token__actions">
          {configured ? (
            <button
              type="button"
              className="sl-gh-btn sl-gh-btn--ghost"
              disabled={busy}
              onClick={() => void handleClear()}
            >
              清除 token
            </button>
          ) : null}
          <button
            type="button"
            className="sl-gh-btn sl-gh-btn--primary"
            disabled={busy || value.trim() === ''}
            onClick={() => void handleSave()}
          >
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
