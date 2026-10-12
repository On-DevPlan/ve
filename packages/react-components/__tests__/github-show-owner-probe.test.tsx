// @vitest-environment jsdom
// __tests__/github-show-owner-probe.test.tsx —— CommitStats 的 owner 探测接线(v1.6.39)。
//
// 锁的是「调度接线」而不是算法(算法在 github-show-owner-probe.test.ts):
//   a. 探测说「都没变」→ 一个仓库都不拉,只把 confirmedAt 写回 KV(热力图右端前移);
//   b. 探测说「有新提交」→ 照常拉;
//   c. 任一 owner 探测失败 → 整体 fail-open(一个都不许跳过);
//   d. owner 太分散(比值 < 2)→ 根本不做探测,回退逐仓库拉。

// @ts-expect-error - React 19 act 环境标记(与 github-show-dom.test.tsx 同)
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const HOUR = 60 * 60 * 1000;

// vi.mock 会被提升到文件顶部,工厂里只能引用 vi.hoisted 的东西
const { fetchMock, probeMock, kvSetMock, state } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  probeMock: vi.fn(),
  kvSetMock: vi.fn(),
  state: { blob: { version: 1, repos: {} } as unknown },
}));

vi.mock('@/api/http/auth-store', () => ({
  useJwtAuth: () => ({ jwtAuthState: 'logged-in', token: 'test-token' }),
  getJwtAuthSnapshot: () => ({ jwtAuthState: 'logged-in', token: 'test-token' }),
  jwtAuth: {},
}));

vi.mock('@api/services', () => ({
  kvV1Service: {
    get: vi.fn(async () => ({ key: 'github-show-stats', value: JSON.stringify(state.blob) })),
    getPublic: vi.fn(async () => ({ key: 'github-show-stats', value: JSON.stringify(state.blob) })),
    set: kvSetMock,
    getPublicUrl: () => '',
  },
}));

vi.mock('../src/github-show/src/engine/githubStats', async (orig) => {
  const actual = await orig<typeof import('../src/github-show/src/engine/githubStats')>();
  return { ...actual, fetchRepoStatsDedup: fetchMock, probeOwnerPushedAt: probeMock };
});

import CommitStats from '../src/github-show/src/components/CommitStats';
import type { GithubShowDoc, GithubShowRow } from '@api/components/github-show/types';

/** 'prefix' + 'alpha' + 'r1' → 'prefixalpha/r1' —— owner 便于按前缀区分测试 */
function full(prefix: string, owner: string, i: number): string {
  return `${prefix}${owner}/r${i}`;
}

/** 全是「成功但已过 24h」的快照:拿它做「次日首次访问」的场景。 */
function staleBlob(prefix: string, owners: string[], perOwner: number): unknown {
  const repos: Record<string, unknown> = {};
  for (const owner of owners) {
    for (let i = 1; i <= perOwner; i += 1) {
      const key = full(prefix, owner, i);
      repos[key] = {
        ok: true,
        full: key,
        yearCount: 3,
        currentStreak: 1,
        longestStreak: 2,
        days: { '2026-09-20': 1 },
        fetchedAt: Date.now() - 25 * HOUR,
        truncated: false,
      };
    }
  }
  return { version: 1, repos };
}

function makeDoc(prefix: string, owners: string[], perOwner: number): GithubShowDoc {
  const rows: GithubShowRow[] = [];
  let n = 0;
  for (const owner of owners) {
    for (let i = 1; i <= perOwner; i += 1) {
      n += 1;
      rows.push({
        id: `${prefix}-row-${n}`,
        repoUrl: `https://github.com/${full(prefix, owner, i)}`,
        name: '',
        highlights: '',
        insights: '',
        output: '',
        values: {},
        createdAt: 1,
        updatedAt: 1,
      });
    }
  }
  return {
    meta: { schemaVersion: '1.5.0', createdAt: 1, updatedAt: 1, authorEmail: 'a@b.c' },
    columns: [],
    rows,
    widths: {},
  };
}

function fakeStats(name: string) {
  return {
    full: name,
    yearCount: 4,
    currentStreak: 1,
    longestStreak: 1,
    days: { '2026-09-27': 4 },
    fetchedAt: Date.now(),
    truncated: false,
  };
}

/** 取最近一次写回 KV 前的 blob。 */
function lastSavedBlob(): { repos: Record<string, { confirmedAt?: unknown }> } {
  const calls = kvSetMock.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const arg = calls[calls.length - 1]![0] as { value: string };
  return JSON.parse(arg.value) as { repos: Record<string, { confirmedAt?: unknown }> };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  probeMock.mockReset();
  kvSetMock.mockReset();
  fetchMock.mockImplementation(async (name: string) => fakeStats(name));
  probeMock.mockResolvedValue(new Map<string, number>());
  kvSetMock.mockResolvedValue({ key: 'github-show-stats' });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
});

async function mount(doc: GithubShowDoc): Promise<HTMLElement> {
  await act(async () => {
    root.render(<CommitStats doc={doc} publicParams={null} />);
  });
  // 探测 → 判定 → 写回 是一条多段 await 链,多刷几轮微任务把它跑完
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  return container;
}

/** 探测结果:每个仓库的 pushed_at 统一取 ago(相对 now)。 */
function probeAllUnchanged(ago: number) {
  probeMock.mockImplementation(async (owner: string) => {
    const m = new Map<string, number>();
    for (let i = 1; i <= 3; i += 1) m.set(`${owner}/r${i}`, Date.now() - ago);
    return m;
  });
}

describe('CommitStats owner 探测接线(v1.6.39)', () => {
  it('探测确认「都没变」→ 0 次仓库拉取,6 个条目写回 confirmedAt', async () => {
    const prefix = 'skipok';
    state.blob = staleBlob(prefix, ['alpha', 'beta'], 3);
    probeAllUnchanged(26 * HOUR); // 比 fetchedAt(25h 前)更旧 → 没有新提交

    const el = await mount(makeDoc(prefix, ['alpha', 'beta'], 3));

    // 每 owner 一次探测,共 2 次;一个仓库都不拉
    expect(probeMock.mock.calls.map((c) => c[0]).sort()).toEqual([
      `${prefix}alpha`,
      `${prefix}beta`,
    ]);
    expect(fetchMock).not.toHaveBeenCalled();

    const saved = lastSavedBlob();
    const entries = Object.values(saved.repos);
    expect(entries).toHaveLength(6);
    for (const e of entries) expect(typeof e.confirmedAt).toBe('number');

    // confirmedAt 前移 → 不再提示「数据已超 24h」
    const note = el.querySelector('.sl-gh-gstat__note')?.textContent ?? '';
    expect(note).not.toContain('已超 24h');
  });

  it('探测发现「有新提交」→ 照常拉取', async () => {
    const prefix = 'changed';
    state.blob = staleBlob(prefix, ['alpha', 'beta'], 3);
    probeAllUnchanged(0); // pushed_at = now,晚于 25h 前的 fetchedAt

    await mount(makeDoc(prefix, ['alpha', 'beta'], 3));

    expect(probeMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('任一 owner 探测失败 → 整体 fail-open,6 个全部照拉', async () => {
    const prefix = 'failopen';
    state.blob = staleBlob(prefix, ['alpha', 'beta'], 3);
    probeMock.mockImplementation(async (owner: string) =>
      owner.endsWith('alpha') ? null : new Map<string, number>(),
    );

    await mount(makeDoc(prefix, ['alpha', 'beta'], 3));

    expect(fetchMock).toHaveBeenCalledTimes(6);
    // 没有任何条目被标记「已确认无新增」
    const calls = kvSetMock.mock.calls;
    const arg = calls[calls.length - 1]![0] as { value: string };
    const saved = JSON.parse(arg.value) as { repos: Record<string, { confirmedAt?: unknown }> };
    for (const e of Object.values(saved.repos)) expect(e.confirmedAt).toBeUndefined();
  });

  it('owner 太分散(比值 1)→ 不做探测,回退逐仓库拉', async () => {
    const prefix = 'spread';
    state.blob = staleBlob(prefix, ['a', 'b', 'c'], 1);

    await mount(makeDoc(prefix, ['a', 'b', 'c'], 1));

    expect(probeMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('首次填充(没有成功数据可跳过)→ 不做探测,直接拉', async () => {
    const prefix = 'cold';
    state.blob = { version: 1, repos: {} };

    await mount(makeDoc(prefix, ['alpha', 'beta'], 3));

    expect(probeMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
