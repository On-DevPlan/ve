// @vitest-environment jsdom
// __tests__/github-show-commit-stats-card.test.tsx —— 统计卡(v1.6.51 收缩后)契约。
//
// v1.6.51 按用户要求移除了两块 UI:
//   · 热力图脚注(.sl-gh-heat__foot:连续天数 + 少/多色阶图例)
//   · 失败明细块(.sl-gh-gstat__note--fails:汇总行 + 明细 + 「立即重试」)
// 本测试锁住"移除后不再回来"以及统计卡的既有边界:
//   a. 即便存在失败条目,也不再渲染失败明细块(失败信息只体现为标题里的
//      「(已覆盖/总数 个仓库合并)」);
//   b. 统计卡不承载 GitHub Token 入口 —— 设置入口在编辑视图的顶栏操作行,
//      展示视图是给别人看的,不出现任何 token 控件。

// @ts-expect-error - React 19 act 环境标记(与 github-show-dom.test.tsx 同)
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// vi.mock 会被提升到文件顶部,工厂里只能用 vi.hoisted 里定义的变量
const { fetchMock, statsBlob } = vi.hoisted(() => {
  const now = Date.now();
  return {
    fetchMock: vi.fn(),
    statsBlob: {
      version: 1,
      repos: {
        // 成功且新鲜:不进续期队列
        'ok/repo': {
          ok: true,
          full: 'ok/repo',
          yearCount: 6,
          currentStreak: 1,
          longestStreak: 2,
          days: { '2026-09-20': 3 },
          fetchedAt: now - 60_000,
          truncated: false,
        },
        // 网络失败(刚试过 → 退避中,不会自动重跑)
        'net/repo': {
          ok: false,
          full: 'net/repo',
          attemptedAt: now - 60_000,
          error: '无法连接 api.github.com(UND_ERR_CONNECT_TIMEOUT)',
          reason: 'network',
        },
        // 仓库不存在/已私有
        'gone/repo': {
          ok: false,
          full: 'gone/repo',
          attemptedAt: now - 60_000,
          error: '仓库不存在、已改名或已转为私有,请检查链接',
          reason: 'gone',
        },
        // v1.6.45:配额耗尽的批量失败(用来验证「>3 条收起成一行汇总」)
        'rl/one': { ok: false, full: 'rl/one', attemptedAt: now - 60_000, error: '匿名配额已用尽', reason: 'rate-limit' },
        'rl/two': { ok: false, full: 'rl/two', attemptedAt: now - 60_000, error: '匿名配额已用尽', reason: 'rate-limit' },
        'rl/three': { ok: false, full: 'rl/three', attemptedAt: now - 60_000, error: '匿名配额已用尽', reason: 'rate-limit' },
        'rl/four': { ok: false, full: 'rl/four', attemptedAt: now - 60_000, error: '匿名配额已用尽', reason: 'rate-limit' },
      },
    },
  };
});

vi.mock('@/api/http/auth-store', () => ({
  useJwtAuth: () => ({ jwtAuthState: 'logged-in', token: 'test-token' }),
  getJwtAuthSnapshot: () => ({ jwtAuthState: 'logged-in', token: 'test-token' }),
  jwtAuth: {},
}));

vi.mock('@api/services', () => ({
  kvV1Service: {
    // 按 key 分流:统计快照返回 blob,token key 返回空串(否则统计 blob 会被
    // 当成 token 读进缓存,「无 token」用例就假阳性了)
    get: vi.fn(async ({ key }: { key: string }) =>
      key === 'github-show-token'
        ? { key, value: '' }
        : { key, value: JSON.stringify(statsBlob) },
    ),
    getPublic: vi.fn(async () => ({ key: 'github-show-stats', value: JSON.stringify(statsBlob) })),
    set: vi.fn(async () => ({ key: 'github-show-stats' })),
    getPublicUrl: () => '',
  },
}));

vi.mock('../src/github-show/src/engine/githubStats', async (orig) => {
  const actual = await orig<typeof import('../src/github-show/src/engine/githubStats')>();
  return { ...actual, fetchRepoStatsDedup: fetchMock };
});

import CommitStats from '../src/github-show/src/components/CommitStats';
import { setCachedGithubToken } from '@api/components/github-show/githubToken';
import type { GithubShowDoc } from '@api/components/github-show/types';

const doc: GithubShowDoc = {
  version: 1,
  rows: [
    { id: 'r1', repoUrl: 'https://github.com/ok/repo', name: 'ok', highlights: '', insights: '', output: '', values: {} },
    { id: 'r2', repoUrl: 'https://github.com/net/repo', name: 'net', highlights: '', insights: '', output: '', values: {} },
    { id: 'r3', repoUrl: 'https://github.com/gone/repo', name: 'gone', highlights: '', insights: '', output: '', values: {} },
  ],
  columns: [],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockRejectedValue(new Error('不应自动重跑'));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
});

async function mount(): Promise<HTMLElement> {
  await act(async () => {
    root.render(<CommitStats doc={doc} publicParams={null} />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return container;
}

// v1.6.50 GitHub Token 入口的归属:设置是**编辑期**的事,入口放在编辑视图的
// 顶栏操作行(组件根 index.tsx);展示视图的统计卡是给别人看的 —— 不出现任何
// token 控件,公开访客更不该看到。
describe('CommitStats 统计卡不承载 Token 入口(v1.6.50)', () => {
  it('编辑者(登录 + publicParams=null)→ 统计卡内没有 Token 入口', async () => {
    const el = await mount();
    expect(el.querySelector('.sl-gh-tokenbtn')).toBeNull();
    expect(el.textContent).not.toContain('Token');
  });

  it('公开分享模式(publicParams 传入)→ 同样没有 Token 入口', async () => {
    await act(async () => {
      root.render(<CommitStats doc={doc} publicParams={{ key: 'github-show', groupId: 7 }} />);
    });
    expect(container.querySelector('.sl-gh-tokenbtn')).toBeNull();
  });
});

// v1.6.51 按用户要求移除:热力图脚注(连续天数 + 少/多色阶图例)与失败明细块
// (汇总行 + 明细 + 「立即重试」)。这里锁住"移除后不再回来",并确认失败信号
// 仍以标题里的覆盖计数体现(已覆盖/总数)。
describe('脚注与失败明细块已移除(v1.6.51)', () => {
  it('热力图不再渲染脚注(连续天数 / 色阶图例)', async () => {
    const el = await mount();
    expect(el.querySelector('.sl-gh-heat__foot')).toBeNull();
    expect(el.querySelector('.sl-gh-heat__legend')).toBeNull();
    expect(el.querySelector('.sl-gh-heat__streaks')).toBeNull();
  });

  it('存在失败条目时也不渲染失败明细块与「立即重试」', async () => {
    const el = await mount();
    expect(el.querySelector('.sl-gh-gstat__note--fails')).toBeNull();
    expect(el.querySelector('.sl-gh-gstat__failbox')).toBeNull();
    expect(el.querySelector('.sl-gh-gstat__retry')).toBeNull();
    // 失败信号仍在:标题里的覆盖计数(已覆盖/总数)
    expect(el.textContent).toContain('个仓库合并');
  });
});

// v1.6.51 分享页(公开访客)不渲染任何运维 note —— 那些是给编辑者的提示
// (未统计/数据过期/覆盖口径/更新进度),公开访客只看数据本身。
describe('分享页不渲染运维 note(v1.6.51)', () => {
  it('publicParams 传入 → 无任何 sl-gh-gstat__note', async () => {
    await act(async () => {
      root.render(<CommitStats doc={doc} publicParams={{ key: 'github-show', groupId: 7 }} />);
    });
    expect(container.querySelector('.sl-gh-gstat__note')).toBeNull();
    // 状态段同样不出现
    expect(container.querySelector('.sl-gh-gstat__status')).toBeNull();
  });
});

// v1.6.51:配了 token 就不该再受「匿名时代」的省请求限制 ——
//   · 限流类失败(6h 退避)直接视为需要重拉
//   · token 保存/清除的事件 → 清会话退避 + 全部强制入队 + 续期重跑
describe('配了 token 后豁免省请求限制(v1.6.51)', () => {
  // 文档里必须真的有「限流失败」的仓库 —— 退避判定是按仓库走的
  const docRl: GithubShowDoc = {
    version: 1,
    rows: [
      { id: 'rl1', repoUrl: 'https://github.com/rl/one', name: 'rl/one', highlights: '', insights: '', output: '', values: {} },
    ],
    columns: [],
  };

  const okStats = {
    full: 'rl/one',
    yearCount: 1,
    currentStreak: 0,
    longestStreak: 0,
    days: {},
    fetchedAt: Date.now(),
    truncated: false,
  };

  afterEach(() => {
    setCachedGithubToken('');
  });

  async function mountRl(): Promise<void> {
    await act(async () => {
      root.render(<CommitStats doc={docRl} publicParams={null} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
  }

  it('无 token:限流失败仍在 6h 退避内 → 本次不重拉', async () => {
    setCachedGithubToken('');
    await mountRl();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('有 token:限流失败立即重拉(退避豁免)', async () => {
    setCachedGithubToken('ghp_test');
    fetchMock.mockResolvedValue(okStats);
    await mountRl();
    expect(fetchMock).toHaveBeenCalledWith('rl/one');
  });

  it('token 变更事件 → 清退避并强制全部重拉', async () => {
    setCachedGithubToken('');
    await mountRl();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(okStats);
    await act(async () => {
      window.dispatchEvent(new CustomEvent('sl-gh:github-token-changed', { detail: { configured: true } }));
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(fetchMock).toHaveBeenCalledWith('rl/one');
  });
});
