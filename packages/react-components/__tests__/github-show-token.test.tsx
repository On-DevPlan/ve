// @vitest-environment jsdom
// __tests__/github-show-token.test.tsx —— GitHub Token(v1.6.50)契约。
//
// 背景:提交统计走 api.github.com,匿名配额 60 次/小时/IP —— 每仓库恒定 1 次
// commit_activity 请求,十几个仓库就限流。编辑者放自己的 PAT(存本账号 private
// KV key),配额升到 5000 次/小时。
//
// 本测试锁三件事:
//   a. 引擎行为:注册 token provider 后请求带 Authorization 头;未注册(默认)
//      仍是无鉴权头 —— 今天的行为不能被改坏;
//   b. 带 token 时 401(过期/撤销/填错)抛 GithubAuthError —— 与"配额耗尽"区分,
//      否则 UI 会让用户干等重试;
//   c. 弹窗交互:保存 → 写 KV + 回调 onChanged(true);清除 → 删 key +
//      回调 onChanged(false);已配置态不把 token 明文回填到输入框。

// @ts-expect-error - React 19 act 环境标记(与 github-show-commit-stats-note.test.tsx 同)
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const { saveMock, clearMock, loadMock, cache } = vi.hoisted(() => {
  const cache = { token: '' as string };
  return {
    cache,
    saveMock: vi.fn(async (t: string) => {
      cache.token = t;
    }),
    clearMock: vi.fn(async () => {
      cache.token = '';
    }),
    loadMock: vi.fn(async () => cache.token),
  };
});

vi.mock('@api/components/github-show/githubToken', () => ({
  loadGithubToken: loadMock,
  saveGithubToken: saveMock,
  clearGithubToken: clearMock,
  getCachedGithubToken: () => cache.token,
  setCachedGithubToken: (t: string | null) => {
    cache.token = (t ?? '').trim();
  },
  GITHUB_TOKEN_KV_KEY: 'github-show-token',
}));

import {
  GithubAuthError,
  fetchRepoStats,
  setGithubTokenProvider,
} from '../src/github-show/src/engine/githubStats';
import GithubTokenModal from '../src/github-show/src/components/GithubTokenModal';

describe('GitHub token —— 引擎鉴权头(v1.6.50)', () => {
  beforeEach(() => {
    setGithubTokenProvider(() => '');
    localStorage.clear();
  });
  afterEach(() => {
    setGithubTokenProvider(() => '');
    vi.unstubAllGlobals();
  });

  it('未注册 token provider → 请求不带 Authorization(保持匿名行为)', async () => {
    const headers: Array<Record<string, string>> = [];
    vi.stubGlobal('fetch', async (_url: string, init?: { headers?: Record<string, string> }) => {
      headers.push(init?.headers ?? {});
      return new Response(JSON.stringify([{ week: 0, days: [] }]), { status: 200 });
    });
    await fetchRepoStats('owner/repo');
    expect(headers[0].Authorization).toBeUndefined();
    expect(headers[0].Accept).toBe('application/vnd.github+json');
  });

  it('注册 provider 且有 token → 请求带 Authorization: Bearer <token>', async () => {
    const headers: Array<Record<string, string>> = [];
    vi.stubGlobal('fetch', async (_url: string, init?: { headers?: Record<string, string> }) => {
      headers.push(init?.headers ?? {});
      return new Response(JSON.stringify([{ week: 0, days: [] }]), { status: 200 });
    });
    setGithubTokenProvider(() => 'ghp_testtoken');
    await fetchRepoStats('owner/repo');
    expect(headers[0].Authorization).toBe('Bearer ghp_testtoken');
  });

  it('带 token 时 401 → GithubAuthError(与配额耗尽区分,重试无用)', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 401 }));
    setGithubTokenProvider(() => 'ghp_expired');
    await expect(fetchRepoStats('owner/repo')).rejects.toBeInstanceOf(GithubAuthError);
  });
});

describe('GithubTokenModal —— 弹窗交互(v1.6.50)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    cache.token = '';
    saveMock.mockClear();
    clearMock.mockClear();
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(props: { onChanged: (c: boolean) => void; onClose: () => void }) {
    await act(async () => {
      root.render(<GithubTokenModal {...props} />);
    });
  }

  it('未配置 → 提示匿名配额限制;输入并保存 → 写 KV + onChanged(true) + 关闭', async () => {
    const onChanged = vi.fn();
    const onClose = vi.fn();
    await render({ onChanged, onClose });

    expect(container.textContent).toContain('未配置 token');
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('password');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'ghp_abc');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      const btn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === '保存',
      ) as HTMLButtonElement;
      btn.click();
    });

    expect(saveMock).toHaveBeenCalledWith('ghp_abc');
    expect(onChanged).toHaveBeenCalledWith(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('已配置 → 显示「清除 token」;点击 → 删 key + onChanged(false)', async () => {
    cache.token = 'ghp_existing';
    const onChanged = vi.fn();
    const onClose = vi.fn();
    await render({ onChanged, onClose });

    expect(container.textContent).toContain('已配置 token');
    // 不把 token 明文回填到输入框
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('');

    await act(async () => {
      const btn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === '清除 token',
      ) as HTMLButtonElement;
      btn.click();
    });

    expect(clearMock).toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalled();
  });
});
