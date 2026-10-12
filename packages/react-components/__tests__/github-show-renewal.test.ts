// @vitest-environment jsdom
// __tests__/github-show-renewal.test.ts —— 续期编排整条链的单测(v1.6.41)。
//
// 为什么有这个文件:续期逻辑原本整块塞在 CommitStats 的 ~200 行 useEffect 里,
// 想验证「先探测 → 没变的跳过 → 变了的才拉 → 配额耗尽整批退避」只能渲染组件、
// mock 掉 KV 与 GitHub 整条通路,断言落在 DOM 文字上 —— 链条本身对不对看不出来。
// 抽成 engine/renewal.ts 的 runRenewal 之后,这里用假 store + 假 fetch/probe
// 直接跑整条链,断言**请求次数、写回内容、退避登记**这三件真正的事。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock, probeMock } = vi.hoisted(() => ({ fetchMock: vi.fn(), probeMock: vi.fn() }));

vi.mock('@api/services', () => ({
  kvV1Service: {
    get: vi.fn(async () => ({ key: 'x-stats', value: 'null' })),
    getPublic: vi.fn(async () => ({ key: 'x-stats', value: 'null' })),
    set: vi.fn(async () => ({ key: 'x-stats' })),
    getPublicUrl: () => '',
  },
}));

vi.mock('../src/github-show/src/engine/githubStats', async (orig) => {
  const actual = await orig<typeof import('../src/github-show/src/engine/githubStats')>();
  return { ...actual, fetchRepoStatsDedup: fetchMock, probeOwnerPushedAt: probeMock };
});

import {
  GithubRateLimitError,
  type RepoStats,
} from '../src/github-show/src/engine/githubStats';
import {
  STATS_FETCH_BUDGET,
  runRenewal,
  type RenewalHooks,
} from '../src/github-show/src/engine/renewal';
import {
  STATS_FRESH_MS,
  type GithubShowStatsStore,
  type GithubStatsBlob,
  type GithubStatsEntry,
  type GithubStatsOkEntry,
} from '../src/github-show/src/storage/StatsStore';

/** 4 个仓库 / 2 个 owner → 比值 2,刚好够触发 owner 探测(守卫阈值 2)。 */
const REPOS = ['o1/a', 'o1/b', 'o2/c', 'o2/d'];
const HOUR = 60 * 60 * 1000;

let now = 0;

function okEntry(full: string, fetchedAt: number): GithubStatsOkEntry {
  return {
    ok: true,
    full,
    yearCount: 5,
    currentStreak: 1,
    longestStreak: 2,
    days: {},
    fetchedAt,
    truncated: false,
  };
}

function statsOf(full: string, fetchedAt: number): RepoStats {
  return {
    full,
    yearCount: 5,
    currentStreak: 1,
    longestStreak: 2,
    days: {},
    fetchedAt,
    truncated: false,
  };
}

function seedBlobOf(entries: Record<string, GithubStatsEntry>): GithubStatsBlob {
  return { version: 1, repos: entries };
}

function fakeStore(blob: GithubStatsBlob | null) {
  return {
    statsKey: 'x-stats',
    loadPublic: vi.fn(async () => blob),
    loadAuthed: vi.fn(async () => blob),
    save: vi.fn(async () => {}),
  } as unknown as GithubShowStatsStore;
}

function collectHooks(): {
  hooks: RenewalHooks;
  patches: Array<Record<string, GithubStatsEntry>>;
  renewing: string[][];
} {
  const patches: Array<Record<string, GithubStatsEntry>> = [];
  const renewing: string[][] = [];
  return {
    patches,
    renewing,
    hooks: {
      onEntries: (p) => patches.push(p),
      onRenewing: (r) => renewing.push([...r]),
    },
  };
}

/** 全部条目停在 25h 前(> STATS_FRESH_MS,且 < 7 天跳过天花板)→ 全部 due。 */
function staleSeed(): GithubStatsBlob {
  return seedBlobOf(Object.fromEntries(REPOS.map((full) => [full, okEntry(full, now - 25 * HOUR)])));
}

beforeEach(() => {
  localStorage.clear();
  now = Date.UTC(2026, 8, 28, 4); // 固定基准,断言不随执行时刻飘
  fetchMock.mockReset();
  probeMock.mockReset();
});

afterEach(() => {
  localStorage.clear();
});

describe('runRenewal 整条链(v1.6.41)', () => {
  it('探测确认「都没变」→ 0 次仓库拉取,只写 confirmedAt(不动 fetchedAt)', async () => {
    const seed = staleSeed();
    const store = fakeStore(seed);
    const { hooks, patches, renewing } = collectHooks();
    // 每仓库的 pushed_at 都早于上次统计时刻 → 确实没有新提交
    probeMock.mockImplementation(async () =>
      new Map(REPOS.map((full) => [full, now - 26 * HOUR])),
    );

    await runRenewal({
      store,
      repos: REPOS,
      seedBlob: seed,
      baseBlob: seed,
      forced: new Set(),
      sessionAttempted: new Map(),
      hooks,
      isCancelled: () => false,
      now,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(probeMock).toHaveBeenCalledTimes(2); // 2 个 owner
    expect(renewing).toEqual([]); // 一条都没进「正在拉取」
    expect(Object.keys(patches[0])).toEqual(REPOS);
    // 关键语义:confirmedAt 前移到 now,fetchedAt 原样 —— 数据没被假装成刚拉的
    for (const full of REPOS) {
      const e = patches[0][full] as GithubStatsOkEntry;
      expect(e.confirmedAt).toBeGreaterThan(now - HOUR);
      expect(e.fetchedAt).toBe(now - 25 * HOUR);
    }
    expect(store.save).toHaveBeenCalledTimes(1); // 整批一次写回
  });

  it('有仓库真的变了 → 只有它被拉,其余跳过', async () => {
    const seed = staleSeed();
    const store = fakeStore(seed);
    const { hooks } = collectHooks();
    probeMock.mockImplementation(
      async () => new Map(REPOS.map((full) => [full, full === 'o1/a' ? now : now - 26 * HOUR])),
    );
    fetchMock.mockImplementation(async (full: string) => statsOf(full, now));

    await runRenewal({
      store,
      repos: REPOS,
      seedBlob: seed,
      baseBlob: seed,
      forced: new Set(),
      sessionAttempted: new Map(),
      hooks,
      isCancelled: () => false,
      now,
    });

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['o1/a']);
    // 跳过批 1 次 + 拉取后 1 次
    expect(store.save).toHaveBeenCalledTimes(2);
  });

  it('探测失败 → fail-open 整批回退直拉(绝不用「没探到」推断「没变化」)', async () => {
    const seed = staleSeed();
    const store = fakeStore(seed);
    const { hooks } = collectHooks();
    probeMock.mockImplementation(async () => null); // 网络/403/翻页超限
    fetchMock.mockImplementation(async (full: string) => statsOf(full, now));

    await runRenewal({
      store,
      repos: REPOS,
      seedBlob: seed,
      baseBlob: seed,
      forced: new Set(),
      sessionAttempted: new Map(),
      hooks,
      isCancelled: () => false,
      now,
    });

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(REPOS);
  });

  it('配额耗尽 → 立即跳出,剩余整批登记退避,不再发请求', async () => {
    const seed = staleSeed();
    const store = fakeStore(seed);
    const { hooks, patches } = collectHooks();
    probeMock.mockImplementation(async () => null); // 强制走直拉
    fetchMock.mockRejectedValue(new GithubRateLimitError());

    await runRenewal({
      store,
      repos: REPOS,
      seedBlob: seed,
      baseBlob: seed,
      forced: new Set(),
      sessionAttempted: new Map(),
      hooks,
      isCancelled: () => false,
      now,
    });

    // 只撞一次,没有把剩下 3 个也逐个撞出去
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const blockedPatch = patches[patches.length - 1];
    for (const full of ['o1/b', 'o2/c', 'o2/d']) {
      const e = blockedPatch[full];
      expect(e.ok).toBe(false);
      expect(e.ok === false && e.reason).toBe('rate-limit');
      expect(e.ok === false && e.error).toContain('配额已用尽');
    }
    expect(blockedPatch['o1/a']).toBeUndefined(); // 触发者已按真实失败记录,不重复
  });

  it('会话退避窗口内的仓库不入队(避免 effect 重跑把刚试过的重排)', async () => {
    const seed = staleSeed();
    const store = fakeStore(seed);
    const { hooks } = collectHooks();
    probeMock.mockImplementation(async () => null);
    fetchMock.mockImplementation(async (full: string) => statsOf(full, now));
    const session = new Map<string, number>([['o1/a', now - 60_000]]); // 1 分钟前刚试过

    await runRenewal({
      store,
      repos: REPOS,
      seedBlob: seed,
      baseBlob: seed,
      forced: new Set(),
      sessionAttempted: session,
      hooks,
      isCancelled: () => false,
      now,
    });

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['o1/b', 'o2/c', 'o2/d']);
    expect(session.has('o1/b')).toBe(true); // 发过请求的都登记了
  });

  it('单次访问预算截断:owner 分散(不探测)时最多拉 STATS_FETCH_BUDGET 个', async () => {
    const many = Array.from({ length: 16 }, (_, i) => `u${i}/r`);
    const seed = seedBlobOf(Object.fromEntries(many.map((f) => [f, okEntry(f, now - 25 * HOUR)])));
    const store = fakeStore(seed);
    const { hooks } = collectHooks();
    fetchMock.mockImplementation(async (full: string) => statsOf(full, now));

    await runRenewal({
      store,
      repos: many,
      seedBlob: seed,
      baseBlob: seed,
      forced: new Set(),
      sessionAttempted: new Map(),
      hooks,
      isCancelled: () => false,
      now,
    });

    // 16 个 owner → 比值 1 < 2,守卫拦下探测,直接逐仓库拉并截断到预算
    expect(probeMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(STATS_FETCH_BUDGET);
  });

  it('「立即重试」标记的仓库无视新鲜度强制入队,且标记消费后清空', async () => {
    const seed = seedBlobOf({ 'o1/a': okEntry('o1/a', now - HOUR) }); // 还新鲜,本不该拉
    const store = fakeStore(seed);
    const { hooks } = collectHooks();
    const forced = new Set(['o1/a']);
    fetchMock.mockImplementation(async (full: string) => statsOf(full, now));

    await runRenewal({
      store,
      repos: ['o1/a'],
      seedBlob: seed,
      baseBlob: seed,
      forced,
      sessionAttempted: new Map(),
      hooks,
      isCancelled: () => false,
      now,
    });

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['o1/a']);
    expect(forced.size).toBe(0);
  });

  it('取消后不再往下走:探测中途取消 → 不写 KV', async () => {
    const seed = staleSeed();
    const store = fakeStore(seed);
    const { hooks, patches } = collectHooks();
    let cancelled = false;
    probeMock.mockImplementation(async () => {
      cancelled = true; // 模拟探测期间组件卸载 / doc 变更
      return new Map(REPOS.map((full) => [full, now - 26 * HOUR]));
    });

    await runRenewal({
      store,
      repos: REPOS,
      seedBlob: seed,
      baseBlob: seed,
      forced: new Set(),
      sessionAttempted: new Map(),
      hooks,
      isCancelled: () => cancelled,
      now,
    });

    expect(patches).toEqual([]);
    expect(store.save).not.toHaveBeenCalled();
  });

  it('新鲜数据不触发任何请求', async () => {
    const seed = seedBlobOf(
      Object.fromEntries(REPOS.map((full) => [full, okEntry(full, now - STATS_FRESH_MS / 2)])),
    );
    const store = fakeStore(seed);
    const { hooks } = collectHooks();

    await runRenewal({
      store,
      repos: REPOS,
      seedBlob: seed,
      baseBlob: seed,
      forced: new Set(),
      sessionAttempted: new Map(),
      hooks,
      isCancelled: () => false,
      now,
    });

    expect(probeMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });
});
