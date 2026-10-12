// __tests__/github-show-github-stats.test.ts —— 提交统计引擎纯函数单测(v1.6.18)。
// 覆盖:commitLocalDate 时区归天 / computeStreaks 当前+最长连续 / shiftDay /
// buildHeatmapWeeks 网格对齐与分档 / monthLabels / mergeDays / 缓存读写与 TTL。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildHeatmapWeeks,
  commitLocalDate,
  computeStreaks,
  mergeDays,
  monthLabels,
  readCachedStats,
  shiftDay,
  todayKey,
  writeCachedStats,
  type RepoStats,
} from '../src/github-show/src/engine/githubStats';

describe('commitLocalDate', () => {
  it('按提交自身偏移归天(东八区早上 8 点仍算当天)', () => {
    expect(commitLocalDate('2024-01-01T08:00:00+08:00')).toBe('2024-01-01');
  });
  it('负偏移跨天(美东 23:00 归当天,UTC 已是次日)', () => {
    // 2024-01-01T23:00:00-05:00 的 UTC 是 2024-01-02T04:00Z,按偏移应归 01-01
    expect(commitLocalDate('2024-01-01T23:00:00-05:00')).toBe('2024-01-01');
  });
  it('Z 时间直接取 UTC 日期', () => {
    expect(commitLocalDate('2024-06-15T12:00:00Z')).toBe('2024-06-15');
  });
  it('畸形输入返回空串', () => {
    expect(commitLocalDate('not-a-date')).toBe('');
    expect(commitLocalDate('')).toBe('');
  });
});

describe('shiftDay', () => {
  it('同月加减', () => {
    expect(shiftDay('2024-03-15', 1)).toBe('2024-03-16');
    expect(shiftDay('2024-03-15', -1)).toBe('2024-03-14');
  });
  it('跨月/跨年', () => {
    expect(shiftDay('2024-03-01', -1)).toBe('2024-02-29'); // 闰年
    expect(shiftDay('2025-01-01', -1)).toBe('2024-12-31');
    expect(shiftDay('2024-12-31', 1)).toBe('2025-01-01');
  });
});

describe('computeStreaks', () => {
  const today = '2024-06-10'; // 周一
  it('空日期 → 全 0', () => {
    expect(computeStreaks([], today)).toEqual({ currentStreak: 0, longestStreak: 0 });
  });
  it('今天有提交:current 从今天往回数', () => {
    const dates = ['2024-06-08', '2024-06-09', '2024-06-10'];
    expect(computeStreaks(dates, today)).toEqual({ currentStreak: 3, longestStreak: 3 });
  });
  it('今天没提交但从昨天接上:current 允许(GitHub 同款)', () => {
    const dates = ['2024-06-07', '2024-06-08', '2024-06-09'];
    expect(computeStreaks(dates, today)).toEqual({ currentStreak: 3, longestStreak: 3 });
  });
  it('今天昨天都空:current=0,longest 仍统计', () => {
    const dates = ['2024-06-01', '2024-06-02', '2024-06-03'];
    expect(computeStreaks(dates, today)).toEqual({ currentStreak: 0, longestStreak: 3 });
  });
  it('最长段在中段', () => {
    const dates = ['2024-05-01', '2024-05-02', '2024-05-03', '2024-05-04', '2024-06-09', '2024-06-10'];
    expect(computeStreaks(dates, today)).toEqual({ currentStreak: 2, longestStreak: 4 });
  });
  it('乱序输入也能算(内部去重排序)', () => {
    const dates = ['2024-06-10', '2024-06-08', '2024-06-09', '2024-06-08'];
    expect(computeStreaks(dates, today)).toEqual({ currentStreak: 3, longestStreak: 3 });
  });
});

describe('buildHeatmapWeeks', () => {
  it('53 列 × 7 行,末列末格 = today', () => {
    const weeks = buildHeatmapWeeks({}, '2024-06-10');
    expect(weeks).toHaveLength(53);
    for (const w of weeks) expect(w).toHaveLength(7);
    // 2024-06-10 是周一 → 末列周日..周六,末格(周六)应为 null(未来)
    const last = weeks[52];
    expect(last?.[1]?.date).toBe('2024-06-10'); // dow=1 周一
    expect(last?.[2]).toBeNull();
  });
  it('计数与分档:0 → level0,非零按相对最大值四分位', () => {
    const data = { '2024-06-08': 1, '2024-06-07': 8 };
    const weeks = buildHeatmapWeeks(data, '2024-06-10');
    // 找到对应格子
    let c1: { level: number } | null = null;
    let c8: { level: number } | null = null;
    for (const w of weeks) {
      for (const c of w) {
        if (c?.date === '2024-06-08') c1 = c;
        if (c?.date === '2024-06-07') c8 = c;
      }
    }
    expect(c1?.level).toBe(1); // 1/8 = 0.125 → level1
    expect(c8?.level).toBe(4); // max → level4
  });
  it('无数据日期 level=0', () => {
    const weeks = buildHeatmapWeeks({}, '2024-06-10');
    const cell = weeks[0].find((c) => c !== null);
    expect(cell?.level).toBe(0);
  });
});

describe('monthLabels', () => {
  it('月份变化处标名,同月留空', () => {
    const weeks = buildHeatmapWeeks({}, '2024-06-10');
    const labels = monthLabels(weeks);
    expect(labels).toHaveLength(53);
    const named = labels.filter(Boolean);
    // 53 周覆盖约 12-13 个月,每个月至多标一次 → 命名数 11~13
    expect(named.length).toBeGreaterThanOrEqual(11);
    expect(named.length).toBeLessThanOrEqual(13);
  });
});

describe('mergeDays', () => {
  it('同键相加', () => {
    expect(mergeDays([{ '2024-01-01': 2 }, { '2024-01-01': 3, '2024-01-02': 1 }])).toEqual({
      '2024-01-01': 5,
      '2024-01-02': 1,
    });
  });
});

describe('缓存读写', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });
  const stats: RepoStats = {
    full: 'a/b',
    yearCount: 5,
    currentStreak: 2,
    longestStreak: 3,
    days: { '2024-06-09': 2, '2024-06-10': 3 },
    fetchedAt: Date.now(),
    truncated: false,
  };
  it('写入后可读回', () => {
    writeCachedStats(stats);
    expect(readCachedStats('a/b')?.yearCount).toBe(5);
  });
  it('超过 TTL(30min)视为失效', () => {
    writeCachedStats({ ...stats, fetchedAt: Date.now() - 31 * 60 * 1000 });
    expect(readCachedStats('a/b')).toBeNull();
  });
  it('未写入/畸形数据返回 null', () => {
    expect(readCachedStats('x/y')).toBeNull();
    localStorage.setItem('sl-github-show:ghstats:v1:bad', '{oops');
    expect(readCachedStats('bad')).toBeNull();
  });
});

describe('todayKey', () => {
  it('与本地日期一致', () => {
    const n = new Date();
    const expectKey = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    expect(todayKey(n)).toBe(expectKey);
  });
});

// ── v1.6.20:KV 快照存储(statsKeyOf / parseStatsBlob / 新鲜度 / 退避) ──

import {
  epochToUtcDateKey,
  fetchRepoStats,
  GithubAggregatingError,
  GithubNetworkError,
  GithubRateLimitError,
  GithubRepoGoneError,
  type RepoStats as EngineRepoStats,
} from '../src/github-show/src/engine/githubStats';
import {
  STATS_FRESH_MS,
  STATS_RETRY_BACKOFF_MS,
  STATS_RETRY_BACKOFF_GONE_MS,
  STATS_RETRY_BACKOFF_SHORT_MS,
  isFreshEntry,
  needsFetch,
  isSessionBackoff,
  parseStatsBlob,
  pickSeedEntry,
  probeEditorAccess,
  reasonOfError,
  retryBackoffMs,
  statsKeyOf,
  type GithubStatsBlob,
  type GithubStatsEntry,
} from '../src/github-show/src/storage/StatsStore';

function okEntry(full: string, fetchedAt: number): GithubStatsEntry {
  const stats: EngineRepoStats = {
    full,
    yearCount: 5,
    currentStreak: 2,
    longestStreak: 3,
    days: { '2024-06-09': 2, '2024-06-10': 3 },
    fetchedAt,
    truncated: false,
  };
  return { ok: true, ...stats };
}

describe('statsKeyOf', () => {
  it('默认文档 key 派生 github-show-stats;自定义 key 加 -stats 后缀', () => {
    expect(statsKeyOf('github-show')).toBe('github-show-stats');
    expect(statsKeyOf('my-cover')).toBe('my-cover-stats');
  });
});

describe('epochToUtcDateKey', () => {
  it('按 UTC 日历日归天(days map 的基准)', () => {
    // 2024-06-09T17:00Z 落在 UTC 日历日 2024-06-09
    expect(epochToUtcDateKey(Date.UTC(2024, 5, 9, 17, 0, 0))).toBe('2024-06-09');
    expect(epochToUtcDateKey(0)).toBe('1970-01-01');
  });
});

describe('parseStatsBlob', () => {
  it('合法 blob 原样通过', () => {
    const blob: GithubStatsBlob = {
      version: 1,
      repos: { 'a/b': okEntry('a/b', 1000) },
    };
    const parsed = parseStatsBlob(JSON.parse(JSON.stringify(blob)));
    expect(parsed).not.toBeNull();
    expect(parsed!.repos['a/b']?.ok).toBe(true);
  });
  it('坏结构 / 非 v1 / 条目字段缺失 → null 或剔除该条目', () => {
    expect(parseStatsBlob(null)).toBeNull();
    expect(parseStatsBlob('x')).toBeNull();
    expect(parseStatsBlob({ version: 2, repos: {} })).toBeNull();
    const partial = parseStatsBlob({
      version: 1,
      repos: {
        'ok/repo': { ok: true, full: 'ok/repo', fetchedAt: 5, days: {} },
        'bad/repo': { ok: true, full: 'mismatch', fetchedAt: 5, days: {} },
        'fail/repo': { ok: false, full: 'fail/repo', attemptedAt: 7, error: 'boom' },
        'junk/repo': 'not-an-object',
      },
    });
    expect(partial).not.toBeNull();
    expect(Object.keys(partial!.repos).sort()).toEqual(['fail/repo', 'ok/repo']);
  });
});

describe('新鲜度与退避(isFreshEntry / needsFetch)', () => {
  const now = 1_000_000_000_000;
  it('成功条目 24h 内新鲜,超时过期', () => {
    const fresh = okEntry('a/b', now - STATS_FRESH_MS + 1000);
    const stale = okEntry('a/b', now - STATS_FRESH_MS - 1000);
    expect(isFreshEntry(fresh, now)).toBe(true);
    expect(isFreshEntry(stale, now)).toBe(false);
  });
  it('缺失 → 需要拉', () => {
    expect(needsFetch('x/y', { version: 1, repos: {} }, now)).toBe(true);
    expect(needsFetch('x/y', null, now)).toBe(true);
  });
  it('过期成功条目 → 需要拉;新鲜 → 不需要', () => {
    const staleBlob: GithubStatsBlob = {
      version: 1,
      repos: { 'a/b': okEntry('a/b', now - STATS_FRESH_MS - 1) },
    };
    const freshBlob: GithubStatsBlob = {
      version: 1,
      repos: { 'a/b': okEntry('a/b', now - 1000) },
    };
    expect(needsFetch('a/b', staleBlob, now)).toBe(true);
    expect(needsFetch('a/b', freshBlob, now)).toBe(false);
  });
  it('失败条目:退避期内不重试,期满后重试', () => {
    const recentFail: GithubStatsBlob = {
      version: 1,
      repos: { 'a/b': { ok: false, full: 'a/b', attemptedAt: now - STATS_RETRY_BACKOFF_MS + 1000, error: 'rate' } },
    };
    const oldFail: GithubStatsBlob = {
      version: 1,
      repos: { 'a/b': { ok: false, full: 'a/b', attemptedAt: now - STATS_RETRY_BACKOFF_MS - 1000, error: 'rate' } },
    };
    expect(needsFetch('a/b', recentFail, now)).toBe(false);
    expect(needsFetch('a/b', oldFail, now)).toBe(true);
  });
});

// ── v1.6.34:失败原因分类 + 分档退避 ──

describe('失败原因 → 退避档位(retryBackoffMs)', () => {
  it('仓库不存在/已私有(404):7 天(近永久,别反复烧配额)', () => {
    expect(retryBackoffMs('gone')).toBe(STATS_RETRY_BACKOFF_GONE_MS);
  });
  it('网络抖动 / GitHub 聚合中:30min(过一会儿就好,值得很快再试)', () => {
    expect(retryBackoffMs('network')).toBe(STATS_RETRY_BACKOFF_SHORT_MS);
    expect(retryBackoffMs('aggregating')).toBe(STATS_RETRY_BACKOFF_SHORT_MS);
  });
  it('配额耗尽 / 未知原因:6h(保守)', () => {
    expect(retryBackoffMs('rate-limit')).toBe(STATS_RETRY_BACKOFF_MS);
    expect(retryBackoffMs('unknown')).toBe(STATS_RETRY_BACKOFF_MS);
    expect(retryBackoffMs(undefined)).toBe(STATS_RETRY_BACKOFF_MS);
  });
});

describe('needsFetch 按失败原因分档(v1.6.34)', () => {
  const now = 1_000_000_000_000;
  const failBlob = (attemptedAgoMs: number, reason: 'gone' | 'network' | 'rate-limit' | 'aggregating') =>
    ({
      version: 1 as const,
      repos: {
        'a/b': { ok: false as const, full: 'a/b', attemptedAt: now - attemptedAgoMs, error: 'x', reason },
      },
    });

  it('网络失败:30min 内不重试,过了就重试(不必等 6h)', () => {
    expect(needsFetch('a/b', failBlob(5 * 60 * 1000, 'network'), now)).toBe(false);
    expect(needsFetch('a/b', failBlob(40 * 60 * 1000, 'network'), now)).toBe(true);
  });
  it('聚合中:同网络档(30min)', () => {
    expect(needsFetch('a/b', failBlob(20 * 60 * 1000, 'aggregating'), now)).toBe(false);
    expect(needsFetch('a/b', failBlob(31 * 60 * 1000, 'aggregating'), now)).toBe(true);
  });
  it('404:一天内不重试,8 天后才再试一次', () => {
    expect(needsFetch('a/b', failBlob(24 * 60 * 60 * 1000, 'gone'), now)).toBe(false);
    expect(needsFetch('a/b', failBlob(8 * 24 * 60 * 60 * 1000, 'gone'), now)).toBe(true);
  });
  it('配额:5h 内不重试,7h 后重试', () => {
    expect(needsFetch('a/b', failBlob(5 * 60 * 60 * 1000, 'rate-limit'), now)).toBe(false);
    expect(needsFetch('a/b', failBlob(7 * 60 * 60 * 1000, 'rate-limit'), now)).toBe(true);
  });
});

describe('错误 → 原因分类(reasonOfError,v1.6.34)', () => {
  it('各类错误映射到对应原因', () => {
    expect(reasonOfError(new GithubRepoGoneError())).toBe('gone');
    expect(reasonOfError(new GithubRateLimitError())).toBe('rate-limit');
    expect(reasonOfError(new GithubNetworkError({ code: 'ECONNRESET' }))).toBe('network');
    expect(reasonOfError(new GithubAggregatingError())).toBe('aggregating');
    expect(reasonOfError(new Error('GitHub API 500'))).toBe('unknown');
    expect(reasonOfError('boom')).toBe('unknown');
  });
});

describe('fetchRepoStats 请求契约 / 错误分类 / 超时(v1.6.34,v1.6.42)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('成功路径:每仓库恒定 1 次请求(v1.6.42 起不再发 commits?per_page=1)', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(String(url));
      // 2024-06-09 是周日 → days[0] 就是那天
      return new Response(
        JSON.stringify([{ week: Date.UTC(2024, 5, 9) / 1000, days: [1, 0, 0, 0, 0, 0, 0] }]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const stats = await fetchRepoStats('a/b', new Date(Date.UTC(2024, 5, 10, 12)));
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('/stats/commit_activity');
    expect(urls[0]).not.toContain('/commits');
    expect(stats.yearCount).toBe(1);
    expect(stats.days).toEqual({ '2024-06-09': 1 });
    expect(stats).not.toHaveProperty('totalCount'); // 字段已整体移除
  });

  it('404 → GithubRepoGoneError,且只发 1 次请求(不再当配额类反复重试)', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls += 1;
      return new Response(null, { status: 404 });
    });
    await expect(fetchRepoStats('gone/repo')).rejects.toBeInstanceOf(GithubRepoGoneError);
    expect(calls).toBe(1);
  });

  it('202 → 立刻 GithubAggregatingError 且只试一次(v1.6.42:删掉 2×sleep(2000) 白等)', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls += 1;
      return new Response('{}', { status: 202 });
    });
    await expect(fetchRepoStats('slow/repo')).rejects.toBeInstanceOf(GithubAggregatingError);
    expect(calls).toBe(1); // 旧实现:3 次尝试 + 2×2s 等待(202 也计配额)
  });

  it('连接挂死 → 超时抛 GithubNetworkError(不再是永远「统计中」)', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      (_url: string, init?: RequestInit) =>
        new Promise((_res, rej) => {
          init?.signal?.addEventListener('abort', () => {
            rej(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        }),
    );
    const p = fetchRepoStats('hang/repo');
    const assertion = expect(p).rejects.toBeInstanceOf(GithubNetworkError);
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});

describe('会话内尝试登记(isSessionBackoff,v1.6.28)', () => {
  const now = 1_000_000_000_000;
  it('未尝试过(undefined)→ 不在退避', () => {
    expect(isSessionBackoff(undefined, now)).toBe(false);
  });
  it('退避窗口内 → 跳过;窗口已过 → 允许再试', () => {
    expect(isSessionBackoff(now - STATS_RETRY_BACKOFF_MS + 1000, now)).toBe(true);
    expect(isSessionBackoff(now - STATS_RETRY_BACKOFF_MS - 1000, now)).toBe(false);
  });
});

describe('双缓存播种时间戳核对(pickSeedEntry,v1.6.25)', () => {
  const now = 1_000_000_000_000;
  const l1Stats = (fetchedAt: number): EngineRepoStats => ({
    full: 'a/b',
    yearCount: 5,
    currentStreak: 2,
    longestStreak: 3,
    days: { '2024-06-09': 2 },
    fetchedAt,
    truncated: false,
  });

  it('L1 与 KV 同时命中:取时间戳新的一方', () => {
    const kvNew = okEntry('a/b', now - 1000);
    const l1Old = l1Stats(now - 20 * 60 * 1000);
    expect(pickSeedEntry(l1Old, kvNew)).toBe(kvNew); // KV 更新 → 编辑者直接吃 KV,不重算

    const kvOld = okEntry('a/b', now - 10 * 60 * 60 * 1000);
    const l1New = l1Stats(now - 1000);
    expect(pickSeedEntry(l1New, kvOld)).toEqual({ ok: true, ...l1New }); // 本机副本更新 → 用 L1

    const tie = okEntry('a/b', now - 5000);
    expect(pickSeedEntry(l1Stats(now - 5000), tie)).toBe(tie); // 相等时 KV 优先(KV 是共享事实源)
  });

  it('单边命中:各自原样返回', () => {
    const l1 = l1Stats(now);
    const kv = okEntry('a/b', now);
    expect(pickSeedEntry(l1, undefined)).toEqual({ ok: true, ...l1 });
    expect(pickSeedEntry(null, kv)).toBe(kv);
    expect(pickSeedEntry(null, undefined)).toBeNull();
  });

  it('KV 是失败条目而 L1 有成功数据:L1 优先(有数据总比失败标记强)', () => {
    const fail: GithubStatsEntry = { ok: false, full: 'a/b', attemptedAt: now, error: 'rate limited' };
    expect(pickSeedEntry(l1Stats(now), fail)).toEqual({ ok: true, ...l1Stats(now) });
    expect(pickSeedEntry(null, fail)).toBe(fail); // 无 L1 时失败条目照常摆出来(驱动退避展示)
  });
});

describe('probeEditorAccess', () => {
  it('KV 请求抛错(未登录/无权限)→ false,不向外抛异常', async () => {
    const result = await probeEditorAccess('github-show', 24);
    expect(result).toBe(false);
  });
});
