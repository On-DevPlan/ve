// @vitest-environment jsdom
// __tests__/github-show-commit-stats-note.test.tsx —— 提交统计「失败提示」契约(v1.6.34)。
//
// 背景:用户反馈只看到「1 个仓库上次拉取失败(常见原因:GitHub 匿名配额…)」,
// 既不知道是哪个仓库、也看不出真实原因,文案却把所有失败都归因到配额。
// 本测试锁三件事:
//   a. 提示必须点名仓库 + 一句话原因(网络失败 / GitHub 正在聚合 / 仓库不存在或已私有);
//   b. 「仓库不存在或已私有」(404)单独成句,不再混进"稍后自动重试"的配额话术;
//   c. 「立即重试」按钮:点击后强制把失败仓库重新入队(无视会话/KV 退避)。

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
    get: vi.fn(async () => ({ key: 'github-show-stats', value: JSON.stringify(statsBlob) })),
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

// v1.6.45:7 行里 6 个失败(1 网络 + 1 链接无效 + 4 配额)—— 超过阈值,应折叠。
const docMany: GithubShowDoc = {
  version: 1,
  rows: ['ok/repo', 'net/repo', 'gone/repo', 'rl/one', 'rl/two', 'rl/three', 'rl/four'].map((full, i) => ({
    id: `m${i}`,
    repoUrl: `https://github.com/${full}`,
    name: full,
    highlights: '',
    insights: '',
    output: '',
    values: {},
  })),
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

/** v1.6.45:用指定文档挂载(折叠阈值要换一份「失败更多」的输入)。 */
async function mountDoc(d: GithubShowDoc): Promise<HTMLElement> {
  await act(async () => {
    root.render(<CommitStats doc={d} publicParams={null} />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return container;
}

describe('CommitStats 失败提示(v1.6.34)', () => {
  it('点名失败仓库与真实原因,不把网络失败甩锅给配额', async () => {
    const el = await mount();
    const note = el.querySelector('.sl-gh-gstat__note')?.textContent ?? '';
    expect(note).toContain('net/repo');
    expect(note).toContain('网络连接失败'); // 真实原因,而不是「配额 60 次/小时」
    expect(note).not.toContain('配额 60 次/小时');
  });

  it('404(仓库不存在/已私有)单独成条目,并提示检查链接', async () => {
    const el = await mount();
    const note = el.querySelector('.sl-gh-gstat__note')?.textContent ?? '';
    expect(note).toContain('gone/repo');
    expect(note).toContain('仓库不存在或已私有');
    expect(note).toContain('请检查链接');
    expect(note).toContain('每 7 天复查'); // 降频复查说明仍在
  });

  it('成功仓库不进提示;退避期内不会自动重跑', async () => {
    const el = await mount();
    const note = el.querySelector('.sl-gh-gstat__note')?.textContent ?? '';
    expect(note).not.toContain('ok/repo');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('「立即重试」:点击后强制把失败仓库重新入队(无视退避)', async () => {
    const el = await mount();
    const btn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('立即重试'),
    );
    expect(btn).toBeTruthy();

    await act(async () => {
      btn!.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const called = fetchMock.mock.calls.map((c) => c[0]);
    expect(called.sort()).toEqual(['gone/repo', 'net/repo']);
  });

  // v1.6.45:失败一多只留一行汇总,明细收进默认关闭的 <details>
  it('失败 >3:显示一行汇总(数量 + 原因分布),明细默认收起', async () => {
    const el = await mountDoc(docMany);

    const sum = el.querySelector('.sl-gh-gstat__failsum')?.textContent ?? '';
    expect(sum).toContain('6 个仓库未统计');
    expect(sum).toContain('1 个链接无效');
    expect(sum).toContain('1 个网络连接失败');
    expect(sum).toContain('4 个匿名配额已用尽');

    const box = el.querySelector<HTMLDetailsElement>('details.sl-gh-gstat__failbox');
    expect(box).not.toBeNull();
    expect(box!.open).toBe(false); // 收起 = 不占高度

    // 明细仍在 DOM(展开即见),v1.6.34 的「点名仓库 + 原因」契约没丢
    expect(box!.textContent).toContain('net/repo');
    expect(box!.textContent).toContain('gone/repo');
    expect(box!.textContent).toContain('匿名配额已用尽');
  });

  it('失败 ≤3:同样收成一行汇总(默认关闭),不直接展开占高', async () => {
    const el = await mount();
    const box = el.querySelector<HTMLDetailsElement>('details.sl-gh-gstat__failbox');
    expect(box).not.toBeNull();
    expect(box!.open).toBe(false);
    expect(el.querySelector('.sl-gh-gstat__failsum-lead')?.textContent).toContain('2 个仓库未统计');
    // 明细仍在 DOM
    expect(box!.querySelector('.sl-gh-gstat__fails')).not.toBeNull();
    expect(box!.textContent).toContain('net/repo');
  });
});

// v1.6.50 GitHub Token 入口:只对编辑者显示(登录 + 非公开分享)。
// 公开访客既不读 token 也不发 GitHub 请求,不该看到设置入口。
describe('CommitStats 的 Token 入口(v1.6.50)', () => {
  it('编辑者(登录 + publicParams=null)→ 出现 Token 入口', async () => {
    const el = await mount();
    const btn = el.querySelector('.sl-gh-gstat__tokenbtn');
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toContain('Token');
  });

  it('公开分享模式(publicParams 传入)→ 不出现 Token 入口', async () => {
    await act(async () => {
      root.render(<CommitStats doc={doc} publicParams={{ key: 'github-show', groupId: 7 }} />);
    });
    const el = container;
    expect(el.querySelector('.sl-gh-gstat__tokenbtn')).toBeNull();
  });
});
