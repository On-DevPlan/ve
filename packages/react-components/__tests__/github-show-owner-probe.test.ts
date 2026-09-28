// __tests__/github-show-owner-probe.test.ts —— owner 级变化探测(v1.6.39)。
//
// 背景:30 仓库场景下,一轮全量续期 = 30 请求 = 匿名配额(60/h/IP)的 50%;
// 且同一场会话填充使各仓库 fetchedAt 几乎同刻 → 24h 后集体过期(惊群),
// 单次访问预算(8)刷不完 → 少数仓库推着 summary.asOf 前进,其余在最近几天
// days 为空被画成 0 → 热力图右端「假性断崖」。
// 本测试锁四件事:
//   a. probeOwnerPushedAt 只在 200 + JSON 数组时可用;任何异常一律 null
//      (fail-open —— 绝不许用「探测不到」推断「没有变化」);
//   b. 翻页守卫:owner 的仓库多到翻页上限之外 → 放弃探测,交回逐仓库直拉;
//   c. shouldProbeOwners 的性价比守卫(owner 太分散时不许探测,否则负优化);
//   d. canSkipByProbe 只在「确实没有新推送」且未到天花板时放行。

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OWNER_PROBE_MAX_OWNERS,
  OWNER_PROBE_SKIP_MAX_MS,
  STATS_FRESH_MS,
  canSkipByProbe,
  entryCheckedAt,
  groupReposByOwner,
  needsFetch,
  parseStatsBlob,
  shouldProbeOwners,
  type GithubStatsBlob,
  type GithubStatsEntry,
} from '../src/github-show/src/storage/StatsStore';
import {
  OWNER_PROBE_MAX_PAGES,
  OWNER_PROBE_PAGE_SIZE,
  probeOwnerPushedAt,
  type RepoStats,
} from '../src/github-show/src/engine/githubStats';

const HOUR = 60 * 60 * 1000;

function rawStats(full: string, fetchedAt: number): RepoStats {
  return {
    full,
    yearCount: 5,
    currentStreak: 1,
    longestStreak: 2,
    days: { '2026-09-20': 3 },
    fetchedAt,
    truncated: false,
  };
}
function okEntry(full: string, fetchedAt: number, confirmedAt?: number): GithubStatsEntry {
  const base = { ok: true as const, ...rawStats(full, fetchedAt) };
  return confirmedAt === undefined ? base : { ...base, confirmedAt };
}
function blob(repos: Record<string, GithubStatsEntry>): GithubStatsBlob {
  return { version: 1, repos };
}
function repoList(
  items: Array<{ full_name: string; pushed_at: string | null }>,
  link?: string,
): Response {
  const headers = new Headers();
  if (link) headers.set('Link', link);
  return new Response(JSON.stringify(items), { status: 200, headers });
}

describe('probeOwnerPushedAt(engine)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('200:返回 小写 full_name → pushed_at 毫秒', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(String(url));
      return repoList([
        { full_name: 'Alice/RepoOne', pushed_at: '2026-09-27T10:00:00Z' },
        { full_name: 'alice/RepoTwo', pushed_at: '2026-09-26T00:00:00Z' },
      ]);
    });
    const m = await probeOwnerPushedAt('alice');
    expect(m).not.toBeNull();
    expect(m!.get('alice/repoone')).toBe(Date.parse('2026-09-27T10:00:00Z'));
    expect(m!.get('alice/repotwo')).toBe(Date.parse('2026-09-26T00:00:00Z'));
    expect(urls[0]).toContain('/users/alice/repos');
    expect(urls[0]).toContain(`per_page=${OWNER_PROBE_PAGE_SIZE}`);
  });

  it('pushed_at 为 null(空仓库)按 0 处理', async () => {
    vi.stubGlobal('fetch', async () => repoList([{ full_name: 'a/empty', pushed_at: null }]));
    const m = await probeOwnerPushedAt('a');
    expect(m!.get('a/empty')).toBe(0);
  });

  it('分页:首页满页 → 继续翻页并合并', async () => {
    const item = (i: number) => ({ full_name: `a/r${i}`, pushed_at: '2026-09-27T00:00:00Z' });
    vi.stubGlobal('fetch', async (url: string) => {
      const page = Number(/[?&]page=(\d+)/.exec(String(url))?.[1] ?? '1');
      return page === 1
        ? repoList(Array.from({ length: OWNER_PROBE_PAGE_SIZE }, (_v, i) => item(i)))
        : repoList([item(999)]);
    });
    const m = await probeOwnerPushedAt('a');
    expect(m!.size).toBe(OWNER_PROBE_PAGE_SIZE + 1);
    expect(m!.get('a/r999')).toBe(Date.parse('2026-09-27T00:00:00Z'));
  });

  it('403/404/429/500 一律 null(调用方据此回退直拉)', async () => {
    for (const status of [403, 404, 429, 500]) {
      vi.stubGlobal('fetch', async () => new Response(null, { status }));
      expect(await probeOwnerPushedAt('a')).toBeNull();
    }
  });

  it('网络异常 / 结构异常 → null', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('ECONNRESET');
    });
    expect(await probeOwnerPushedAt('a')).toBeNull();

    vi.stubGlobal('fetch', async () => new Response('{"not":"array"}', { status: 200 }));
    expect(await probeOwnerPushedAt('a')).toBeNull();

    vi.stubGlobal('fetch', async () => new Response('oops', { status: 200 }));
    expect(await probeOwnerPushedAt('a')).toBeNull();
  });

  it('仓库数超出翻页上限 → 首页即判定不可用,不再翻页浪费配额', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(String(url));
      return repoList(
        [{ full_name: 'a/r', pushed_at: null }],
        `<https://api.github.com/x?per_page=100&page=${OWNER_PROBE_MAX_PAGES + 1}>; rel="last"`,
      );
    });
    expect(await probeOwnerPushedAt('a')).toBeNull();
    expect(urls).toHaveLength(1);
  });
});

describe('groupReposByOwner', () => {
  it('按 owner 分组,owner 大小写归一,保持行序', () => {
    const g = groupReposByOwner(['Alice/a', 'alice/b', 'bob/c']);
    expect(Array.from(g.keys())).toEqual(['alice', 'bob']);
    expect(g.get('alice')).toEqual(['Alice/a', 'alice/b']);
    expect(g.get('bob')).toEqual(['bob/c']);
  });
  it('没有斜杠的脏值直接忽略', () => {
    expect(groupReposByOwner(['noslash', 'a/b']).size).toBe(1);
  });
});

describe('shouldProbeOwners(性价比守卫)', () => {
  it('仓库集中在少数 owner → 收益明确,启用探测', () => {
    expect(shouldProbeOwners(['a/1', 'a/2', 'a/3', 'b/4', 'b/5', 'b/6'])).toBe(true); // 6/2 = 3
  });
  it('比值恰好 2 → 启用(最坏打平,多数仓库没变时净赚)', () => {
    expect(shouldProbeOwners(['a/1', 'a/2'])).toBe(true);
  });
  it('比值不足 2 → 不探测(1 次探测最多换来 1 次省下,不赚)', () => {
    expect(shouldProbeOwners(['a/1', 'b/2'])).toBe(false);
    expect(shouldProbeOwners(['a/1', 'b/2', 'c/3'])).toBe(false);
  });
  it('空数组 → 不探测', () => {
    expect(shouldProbeOwners([])).toBe(false);
  });
  it('owner 数超过上限 → 不探测(即便比值够,探测请求本身就能吃掉配额)', () => {
    const many: string[] = [];
    for (let i = 0; i <= OWNER_PROBE_MAX_OWNERS; i += 1) {
      many.push(`o${i}/r1`, `o${i}/r2`, `o${i}/r3`);
    }
    expect(many.length / (OWNER_PROBE_MAX_OWNERS + 1)).toBeGreaterThanOrEqual(2);
    expect(shouldProbeOwners(many)).toBe(false);
  });
});

describe('canSkipByProbe(跳过重拉的判定)', () => {
  const now = Date.now();
  it('pushed_at 不晚于上次统计时刻 → 可跳过', () => {
    const e = okEntry('a/b', now - 2 * HOUR);
    expect(canSkipByProbe(e, now - 2 * HOUR, now)).toBe(true); // 相等 = 没有更新
    expect(canSkipByProbe(e, now - 3 * HOUR, now)).toBe(true);
  });
  it('pushed_at 晚于上次统计时刻 → 必须拉', () => {
    const e = okEntry('a/b', now - 2 * HOUR);
    expect(canSkipByProbe(e, now - HOUR, now)).toBe(false);
  });
  it('失败条目 / 缺失条目 → 必须拉(它们还没有数据)', () => {
    const fail: GithubStatsEntry = {
      ok: false,
      full: 'a/b',
      attemptedAt: now,
      error: 'x',
      reason: 'network',
    };
    expect(canSkipByProbe(fail, 0, now)).toBe(false);
    expect(canSkipByProbe(undefined, 0, now)).toBe(false);
  });
  it('超过跳过天花板(7 天)→ 强制重拉', () => {
    const e = okEntry('a/b', now - OWNER_PROBE_SKIP_MAX_MS - HOUR);
    expect(canSkipByProbe(e, 0, now)).toBe(false);
  });
});

describe('entryCheckedAt / needsFetch 与 confirmedAt(v1.6.39)', () => {
  const now = Date.now();
  it('成功条目取 fetchedAt 与 confirmedAt 的较大者;失败取 attemptedAt;缺失 0', () => {
    expect(entryCheckedAt(okEntry('a/b', now - 30 * HOUR))).toBe(now - 30 * HOUR);
    expect(entryCheckedAt(okEntry('a/b', now - 30 * HOUR, now - HOUR))).toBe(now - HOUR);
    const fail: GithubStatsEntry = {
      ok: false,
      full: 'a/b',
      attemptedAt: now - 5,
      error: 'x',
    };
    expect(entryCheckedAt(fail)).toBe(now - 5);
    expect(entryCheckedAt(undefined)).toBe(0);
  });

  it('探测确认过「没有新提交」→ 24h 内不再排进续期队列,确认也过期后重新排队', () => {
    expect(needsFetch('a/b', blob({ 'a/b': okEntry('a/b', now - 30 * HOUR) }), now)).toBe(true);
    expect(
      needsFetch('a/b', blob({ 'a/b': okEntry('a/b', now - 30 * HOUR, now - HOUR) }), now),
    ).toBe(false);
    expect(
      needsFetch(
        'a/b',
        blob({ 'a/b': okEntry('a/b', now - 30 * HOUR, now - STATS_FRESH_MS - HOUR) }),
        now,
      ),
    ).toBe(true);
  });

  it('parseStatsBlob 保留合法的 confirmedAt,清掉脏值', () => {
    const parsed = parseStatsBlob({
      version: 1,
      repos: {
        'a/b': { ok: true, full: 'a/b', fetchedAt: 5, days: {}, confirmedAt: 9 },
        'c/d': { ok: true, full: 'c/d', fetchedAt: 5, days: {}, confirmedAt: 'later' },
      },
    });
    expect(parsed).not.toBeNull();
    const ab = parsed!.repos['a/b'];
    const cd = parsed!.repos['c/d'];
    expect(ab?.ok === true ? ab.confirmedAt : null).toBe(9);
    expect(cd?.ok === true ? cd.confirmedAt : null).toBeUndefined();
  });
});
