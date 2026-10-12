// @vitest-environment jsdom
// __tests__/github-show-coverage-partial.test.tsx —— 覆盖诚实化契约(v1.6.40)。
//
// 背景:owner 探测(甲/v1.6.39)让「跳过重拉」成为可信判断 —— 没变就说明这几天
// 确实 0 次提交,所以 asOf 前移是诚实的。但三类仓库走不到探测:
//   · 探测回退的(owner 太分散,shouldProbeOwners 守卫拦下);
//   · 拉取失败的(404 / 网络 / 配额);
//   · 单纯「还没到 24h 所以压根没进续期队列」的。
// 它们的 checkedAt 停在旧值,而 asOf = max(checkedAt) 被别的仓库推着前进,于是
// 最近这几天它们的 days 键缺席 → 被 `?? 0` 画成 0 → 右端仍有假性断崖。
// 本测试锁三件事:
//   a. 晚于「最旧核对日」的格子必须带 is-partial(浅斜纹),不裸画成 0;
//   b. 脚注量化「最近 N 天仅 M/K 个仓库覆盖到当天」;
//   c. 全部仓库核对在同一天时不出现浅纹(别无中生有)。
//
// 挂载方式:未登录 + 公开分享模式 —— 匿名读者视角(只读 KV 快照、0 次 GitHub
// 请求),这正是浅纹断崖最容易被看见的场景。

// @ts-expect-error - React 19 act 环境标记(与 github-show-dom.test.tsx 同)
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// vi.mock 会被提升到文件顶部,工厂里只能用 vi.hoisted 里定义的变量。
// 日期用固定 epoch(2026-09-20 / 往前 3 天 = 2026-09-17),不用 Date.now() 偏移
// —— 「相差几天」必须与运行时刻无关,否则测试会随执行时间飘。
const { fetchMock, served, mixedBlob, sameDayBlob } = vi.hoisted(() => {
  const mk = (full: string, fetchedAt: number, days: Record<string, number>) => ({
    ok: true as const,
    full,
    yearCount: Object.values(days).reduce((a, b) => a + b, 0),
    currentStreak: 0,
    longestStreak: 1,
    days,
    fetchedAt,
    truncated: false,
  });
  const D0 = Date.UTC(2026, 8, 20, 12);
  const D3 = Date.UTC(2026, 8, 17, 12);
  return {
    fetchMock: vi.fn(),
    // 当前被 KV 返回的快照(mount 时切换)—— 放在 hoisted 里,避免 mock 工厂
    // 在模块体之前执行时读到 TDZ 的模块级 let
    served: { blob: null as unknown },
    // a/b 今天核对;c 停在 3 天前(还是新鲜数据,没进续期队列)
    mixedBlob: {
      version: 1,
      repos: {
        'a/repo': mk('a/repo', D0, { '2026-09-20': 2 }),
        'b/repo': mk('b/repo', D0, { '2026-09-19': 1 }),
        'c/repo': mk('c/repo', D3, { '2026-09-17': 3 }),
      },
    },
    // 三个仓库同一天核对 → 右端本就诚实,不该出现任何浅纹
    sameDayBlob: {
      version: 1,
      repos: {
        'a/repo': mk('a/repo', D0, { '2026-09-20': 2 }),
        'b/repo': mk('b/repo', D0, { '2026-09-19': 1 }),
        'c/repo': mk('c/repo', D0, { '2026-09-17': 3 }),
      },
    },
  };
});

// 匿名读者:未登录 → 永远不会触发任何 GitHub 请求(也就不会覆盖 fixture)
vi.mock('@/api/http/auth-store', () => ({
  useJwtAuth: () => ({ jwtAuthState: 'logged-out', token: null }),
  getJwtAuthSnapshot: () => ({ jwtAuthState: 'logged-out', token: null }),
  jwtAuth: {},
}));

vi.mock('@api/services', () => ({
  kvV1Service: {
    get: vi.fn(async () => ({ key: 'github-show-stats', value: JSON.stringify(served.blob) })),
    getPublic: vi.fn(async () => ({ key: 'github-show-stats', value: JSON.stringify(served.blob) })),
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
  meta: { schemaVersion: '1.5.0', createdAt: 1, updatedAt: 1, authorEmail: 'test@example.com' },
  columns: [],
  widths: {},
  rows: [
    { id: 'r1', repoUrl: 'https://github.com/a/repo', name: 'a', highlights: '', insights: '', output: '', values: {}, createdAt: 1, updatedAt: 1 },
    { id: 'r2', repoUrl: 'https://github.com/b/repo', name: 'b', highlights: '', insights: '', output: '', values: {}, createdAt: 1, updatedAt: 1 },
    { id: 'r3', repoUrl: 'https://github.com/c/repo', name: 'c', highlights: '', insights: '', output: '', values: {}, createdAt: 1, updatedAt: 1 },
  ],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockRejectedValue(new Error('读者视角不应发任何 GitHub 请求'));
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
});

async function mount(blob: unknown): Promise<HTMLElement> {
  served.blob = blob;
  await act(async () => {
    root.render(<CommitStats doc={doc} publicParams={{ key: 'demo', groupId: 1 }} />);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return container;
}

/** 读格子的 title 首段(日期),用于定位特定日。 */
function cellOfDate(el: HTMLElement, date: string): Element | undefined {
  return Array.from(el.querySelectorAll('.sl-gh-heat__cell')).find((n) =>
    n.getAttribute('title')?.startsWith(date),
  );
}

describe('CommitStats 覆盖诚实化(v1.6.40)', () => {
  it('晚于「最旧核对日」的格子打浅纹,不裸画成 0', async () => {
    const el = await mount(mixedBlob);
    const partial = Array.from(el.querySelectorAll('.sl-gh-heat__cell.is-partial'));
    // 边界 = 2026-09-17(asOf 2026-09-20 往前 3 天),故 18/19/20 三天为浅纹
    expect(partial.map((n) => n.getAttribute('title')?.split(' ')[0]).sort()).toEqual([
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ]);
    // 悬停文案要说明「此数可能偏低」,而不是让读者以为真的只有这么点提交
    expect(partial[0].getAttribute('title')).toContain('快照期');
  });

  it('边界当天的格子不算浅纹(严格大于才标)', async () => {
    const el = await mount(mixedBlob);
    expect(cellOfDate(el, '2026-09-17')?.classList.contains('is-partial')).toBe(false);
    expect(cellOfDate(el, '2026-09-18')?.classList.contains('is-partial')).toBe(true);
  });

  it('脚注量化:最近 N 天仅 M/K 个仓库覆盖到当天', async () => {
    const el = await mount(mixedBlob);
    const note = el.querySelector('.sl-gh-gstat__note--partial')?.textContent ?? '';
    expect(note).toContain('最近 3 天');
    expect(note).toContain('2/3'); // a、b 覆盖到当天;c 停在快照期
    expect(note).toContain('浅纹');
  });

  it('全部仓库核对在同一天时不出浅纹(别无中生有)', async () => {
    const el = await mount(sameDayBlob);
    expect(el.querySelectorAll('.sl-gh-heat__cell.is-partial').length).toBe(0);
    expect(el.querySelector('.sl-gh-gstat__note--partial')).toBeNull();
  });

  it('匿名读者不因浅纹逻辑发出任何 GitHub 请求', async () => {
    await mount(mixedBlob);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
