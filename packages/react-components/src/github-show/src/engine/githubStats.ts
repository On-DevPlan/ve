// src/engine/githubStats.ts —— GitHub 提交统计引擎(纯函数 + 拉取 + 缓存)。
//
// 需求(v1.6.18):行的 repoUrl 是 github.com 仓库链接,用 GitHub REST API 取
//   - 近一年每天的提交数 → 贡献热力图(GitHub 主页那种 53 周 × 7 天格子)
//   - 当前连续提交天数 / 最长连续提交天数(streak)
// 全部无 token(匿名 60 req/h/IP),逐仓库串行拉取 + localStorage 缓存降频。
//
// v1.6.42:去掉 `commits?per_page=1`(那个请求只为换 Link 尾页号 = 全历史
// 提交总数,而该数字只喂热力图脚注半句话「累计 N 次提交」,还是全有或全无)。
// 每仓库请求数 2 → 1:日常 6 → 4,第 8 天全量波 60 → 30,最坏 120 → 30。
//
// 时区:GitHub 主页贡献图按「用户本地时区」归天。commit.author.date 自带
// 偏移量(如 2024-01-01T08:00:00+08:00),commitLocalDate 按提交自己的偏移
// 归天 —— 作者在哪天提交的就落在哪天,与 GitHub 网页观感一致。

export interface RepoStats {
  /** 'owner/repo' */
  full: string;
  /** 统计窗口(近一年)内的提交数(可能受分页上限截断) */
  yearCount: number;
  currentStreak: number;
  longestStreak: number;
  /** 'YYYY-MM-DD' → 提交数(仅统计窗口内) */
  days: Record<string, number>;
  fetchedAt: number;
  /** 因分页上限截断(仓库太活跃,一年提交超过 MAX_PAGES*100 条) */
  truncated: boolean;
}

// ── 日期纯函数 ─────────────────────────────────────────────────────────────

/** 本地(组件侧)今天 'YYYY-MM-DD'。 */
export function todayKey(now = new Date()): string {
  return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * commit.author.date(ISO8601,自带 Z 或 ±hh:mm 偏移)→ 按提交自身时区归天的
 * 'YYYY-MM-DD'。无偏移(Z 缺失等畸形)按 UTC 兜底。
 */
export function commitLocalDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/.exec(
    iso.trim(),
  );
  if (!m) return '';
  const [, ys, ms, ds, hs, mins, ss] = m;
  const off = m[7];
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  let h = Number(hs);
  let mi = Number(mins);
  const s = Number(ss);
  if (off && off !== 'Z') {
    const sign = off[0] === '-' ? -1 : 1;
    const oh = Number(off.slice(1, 3));
    const om = Number(off.slice(off.length - 2));
    h -= sign * oh;
    mi -= sign * om;
  }
  // 归一(可能借位/进位到前后一天)
  const t = Date.UTC(y, mo - 1, d, h, mi, s);
  const dt = new Date(t);
  return dateKey(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

/**
 * 连续提交天数。dates 是去重升序的 'YYYY-MM-DD'。
 * currentStreak:从 today 往前数(今天没提交则从昨天起算,与 GitHub 一致);
 * longestStreak:窗口内最长连续段。
 */
export function computeStreaks(
  dates: string[],
  today: string,
): { currentStreak: number; longestStreak: number } {
  const set = new Set(dates);
  // longest:排序后线性扫
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev !== null && isNextDay(prev, d) ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }
  // current:today → 往前,今天缺勤允许从昨天接上(GitHub 主页同款规则)
  let cur = 0;
  let anchor = today;
  if (!set.has(anchor)) anchor = shiftDay(anchor, -1);
  while (set.has(anchor)) {
    cur += 1;
    anchor = shiftDay(anchor, -1);
  }
  return { currentStreak: cur, longestStreak: longest };
}

/** 'YYYY-MM-DD' ±n 天。 */
export function shiftDay(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dateKey(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

function isNextDay(prev: string, next: string): boolean {
  return shiftDay(prev, 1) === next;
}

// ── 热力图网格 ─────────────────────────────────────────────────────────────

export interface HeatCell {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}
/** 一列 = 一周,7 格(周日起);null = 未来/超出范围的占位 */
export type HeatWeek = Array<HeatCell | null>;

/**
 * 53 周 × 7 天网格,末周对齐 today(GitHub 主页布局:列=周,行=周日..周六)。
 * level 分档:0 → 0;非零按相对当日最大值的四分位 → 1..4。
 */
export function buildHeatmapWeeks(
  days: Record<string, number>,
  today: string,
): HeatWeek[] {
  const max = Object.values(days).reduce((a, b) => Math.max(a, b), 0);
  const levelOf = (c: number): 0 | 1 | 2 | 3 | 4 => {
    if (c <= 0) return 0;
    if (max <= 0) return 1;
    const q = c / max;
    return q > 0.75 ? 4 : q > 0.5 ? 3 : q > 0.25 ? 2 : 1;
  };
  // today 的星期(0=周日)
  const [ty, tm, td] = today.split('-').map(Number);
  const todayDow = new Date(Date.UTC(ty, tm - 1, td)).getUTCDay();
  // 末列末格 = today;共 53 列,起点是 53 列前那周的周日
  const start = shiftDay(today, -(7 * 52 + todayDow));
  const weeks: HeatWeek[] = [];
  let cursor = start;
  for (let w = 0; w < 53; w += 1) {
    const week: HeatWeek = [];
    for (let dow = 0; dow < 7; dow += 1) {
      if (cursor > today) {
        week.push(null);
      } else {
        const count = days[cursor] ?? 0;
        week.push({ date: cursor, count, level: levelOf(count) });
      }
      cursor = shiftDay(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** 每列(周)顶部的月份标签:该周首格所在月,与上一列同月则留空。 */
export function monthLabels(weeks: HeatWeek[]): string[] {
  const names = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const out: string[] = [];
  let prevMonth = -1;
  for (const week of weeks) {
    const first = week.find((c) => c !== null);
    if (!first) {
      out.push('');
      continue;
    }
    const m = Number(first.date.slice(5, 7)) - 1;
    out.push(m !== prevMonth ? names[m] : '');
    prevMonth = m;
  }
  return out;
}

/** 合并多仓库的每日计数。 */
export function mergeDays(list: Array<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const days of list) {
    for (const [k, v] of Object.entries(days)) {
      out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

/** epoch ms → 'YYYY-MM-DD'(UTC 日历日)。days map 的归天基准就是 UTC 日历日。 */
export function epochToUtcDateKey(ms: number): string {
  const dt = new Date(ms);
  return dateKey(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

// ── 拉取(GitHub REST,匿名) ───────────────────────────────────────────────
//
// 配额账(匿名 60 req/h/IP,v1.6.18 实测教训):十几个仓库若按 commits 列表
// 分页拉一年日期,每仓库最多 1+12 次请求,轻松烧光配额导致整页限流。
// 改用 stats/commit_activity:1 次请求返回 52 周 × 7 天的逐日提交数
// (GitHub 侧聚合、缓存),**每仓库恒定 1 次请求**(v1.6.42 起)。
//
// v1.6.34 失败原因分类(实测 2026-09-28:公司网络到 api.github.com 会
// CONNECT_TIMEOUT/ECONNRESET 抖动,同刻配额仍剩 18/60 —— 失败主因往往是
// 连接层,不是配额):
//   - 每次请求加 AbortController 超时,否则一次挂死的连接会让该仓库永远
//     停在「统计中」,既不失败也不推进队列;
//   - 错误分三类交给 StatsStore 决定退避:仓库不存在/已私有(404,近永久)、
//     配额耗尽(403/429)、网络或聚合未就绪(短退避,值得很快再试)。

const API = 'https://api.github.com';

/** 单次请求超时:GitHub 正常响应 <1s,公司网抖动时常见 connect 超时 10s+。 */
const REQUEST_TIMEOUT_MS = 15_000;

export class GithubRateLimitError extends Error {
  constructor() {
    super('GitHub API 匿名请求配额已用尽(60 次/小时/IP),请稍后重试');
    this.name = 'GithubRateLimitError';
  }
}

/** 404:仓库不存在 / 已改名 / 已转私有 —— 匿名 API 永远拿不到,别按「配额」重试。 */
export class GithubRepoGoneError extends Error {
  constructor() {
    super('仓库不存在、已改名或已转为私有,请检查链接');
    this.name = 'GithubRepoGoneError';
  }
}

/** 连接层失败(超时 / reset / DNS):本机与 api.github.com 之间的网络问题。 */
export class GithubNetworkError extends Error {
  constructor(cause?: unknown) {
    const detail =
      cause && typeof cause === 'object' && 'code' in cause
        ? String((cause as { code?: unknown }).code)
        : '';
    super(`无法连接 api.github.com${detail ? `(${detail})` : ''}`);
    this.name = 'GithubNetworkError';
  }
}

/** commit_activity 仍在 GitHub 侧聚合(连续 202)—— 重试太密没意义,交退避。 */
export class GithubAggregatingError extends Error {
  constructor() {
    super('GitHub 正在聚合该仓库的提交统计,稍后会自动重试');
    this.name = 'GithubAggregatingError';
  }
}

function apiHeaders(): HeadersInit {
  return { Accept: 'application/vnd.github+json' };
}

/**
 * 带超时的 fetch:把「连接超时 / 中断 / DNS」统一抛成 GithubNetworkError,
 * 调用方据此走网络类退避(而不是被当成配额或永久失败)。
 */
async function fetchGithub(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: apiHeaders(), signal: ctrl.signal });
  } catch (e) {
    throw new GithubNetworkError((e as { cause?: unknown })?.cause ?? e);
  } finally {
    clearTimeout(timer);
  }
}

/** commit_activity 返回的周条目:week = 该周周日 0 点(UTC)unix 秒,days[7] 周日起逐日提交数 */
interface CommitActivityWeek {
  week: number;
  days: number[];
}

/**
 * 单仓库统计(恒定 1 次请求,v1.6.42):
 *   stats/commit_activity → 52 周逐日提交数(GitHub 正在聚合时回 202)。
 * 近一年提交数/连续天数/热力图全部从这份逐日数据派生。
 */
export async function fetchRepoStats(full: string, now = new Date()): Promise<RepoStats> {
  const today = todayKey(now);

  // 52 周逐日提交数。202 = GitHub 正在后台算这一年的聚合:v1.6.42 起只试
  // **一次**就把「还没算好」如实抛给上层走短退避(30min)—— 实测 GitHub 聚合
  // 要几十秒到几分钟,v1.6.34 那套 2×sleep(2000) 必然不够,只是白等 4 秒;
  // 而且 202 响应同样计配额,3 次尝试等于把最坏请求数翻倍。40 分钟后再来
  // 必然命中 GitHub 侧聚合缓存。
  const res = await fetchGithub(`${API}/repos/${full}/stats/commit_activity`);
  if (res.status === 403 || res.status === 429) throw new GithubRateLimitError();
  if (res.status === 404) throw new GithubRepoGoneError();
  if (res.status === 202) throw new GithubAggregatingError();
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const raw = (await res.json()) as unknown;
  if (!Array.isArray(raw)) throw new Error('GitHub API 未返回提交统计');
  const weeks = raw as CommitActivityWeek[];

  // 展开为 'YYYY-MM-DD' → count;week 是 UTC 周日 0 点,直接按 UTC 日历日归天
  const days: Record<string, number> = {};
  let yearCount = 0;
  const windowStart = shiftDay(today, -364);
  for (const w of weeks) {
    if (!w || !Array.isArray(w.days)) continue;
    for (let i = 0; i < 7; i += 1) {
      const c = w.days[i] ?? 0;
      if (c <= 0) continue;
      const dt = new Date((w.week + i * 86400) * 1000);
      const key = dateKey(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
      if (key > today || key < windowStart) continue;
      days[key] = (days[key] ?? 0) + c;
      yearCount += c;
    }
  }

  const { currentStreak, longestStreak } = computeStreaks(Object.keys(days), today);
  return { full, yearCount, currentStreak, longestStreak, days, fetchedAt: now.getTime(), truncated: false };
}

// 同仓库并发去重:图表/表格两个 tab 各挂一份 CommitStats,或将来保存钩子
// 与组件同时触发续期时,同一仓库只发一路请求,结果共享。
const inflight = new Map<string, Promise<RepoStats>>();

export function fetchRepoStatsDedup(full: string, now = new Date()): Promise<RepoStats> {
  const existing = inflight.get(full);
  if (existing) return existing;
  const p = fetchRepoStats(full, now).finally(() => {
    inflight.delete(full);
  });
  inflight.set(full, p);
  return p;
}

// ── owner 级变化探测(v1.6.39) ─────────────────────────────────────────────
//
// 动机(30 仓库场景实测,2026-09-28):一轮全量续期 = 30 请求 = 匿名配额
// (60 次/小时/IP)的 50%;且同一场会话填充使各仓库 fetchedAt 几乎同刻 →
// 24h 后集体过期(惊群),而单次访问预算 STATS_FETCH_BUDGET=8 根本刷不完 →
// 只有几个仓库更新,配合 summary.asOf = max(fetchedAt) 在热力图右端画成
// 「假性断崖」。
//
// 突破口:GET /users/{owner}/repos?per_page=100 一次返回该 owner 下最多 100
// 个仓库(本机实测对普通用户与组织都返回 200),每个带 pushed_at,只计 1 次
// 配额 —— 这是匿名配额下唯一能「批量感知变化」的端点。
// 已排除的两条路:① ETag/304 在**匿名**请求下仍计配额(GitHub 文档要求
// 请求带 Authorization 头且通过校验时才免计);② commits?since= 并不比
// commit_activity 少请求(活跃仓库还会翻页更多)。

/** 单次探测请求覆盖的仓库数(GitHub 分页 per_page 上限)。 */
export const OWNER_PROBE_PAGE_SIZE = 100;
/** 最多翻页数:owner 的仓库多到翻不完就整体放弃探测(回退逐仓库直拉)。 */
export const OWNER_PROBE_MAX_PAGES = 3;

interface RepoListItem {
  full_name?: unknown;
  pushed_at?: unknown;
}

/** 从 Link header 里取 rel="last" 的页号;没有 Link(单页)返回 null。 */
function lastPageOf(link: string | null): number | null {
  if (!link) return null;
  const m = /[?&]page=(\d+)>;\s*rel="last"/.exec(link);
  return m ? Number(m[1]) : null;
}

/**
 * 探测一个 owner 下各仓库的最后推送时刻。
 * 返回 Map<小写 full_name, pushed_at 毫秒>;任何一层出问题(网络/超时/
 * 403/404/5xx/结构异常/仓库数超出翻页上限)一律返回 null —— 调用方据此
 * **整体回退直拉**。fail-open 是硬约束:绝不允许用「探测不到」推断「没变化」,
 * 否则会漏掉真实提交。
 */
export async function probeOwnerPushedAt(owner: string): Promise<Map<string, number> | null> {
  const out = new Map<string, number>();
  for (let page = 1; page <= OWNER_PROBE_MAX_PAGES; page += 1) {
    let res: Response;
    try {
      res = await fetchGithub(
        `${API}/users/${encodeURIComponent(owner)}/repos` +
          `?per_page=${OWNER_PROBE_PAGE_SIZE}&sort=pushed&page=${page}`,
      );
    } catch {
      return null;
    }
    if (!res.ok) return null;
    if (page === 1) {
      const last = lastPageOf(res.headers.get('Link'));
      // 仓库多到翻页上限之外 → 无法保证覆盖到目标仓库,交回调用方逐仓库拉
      if (last !== null && last > OWNER_PROBE_MAX_PAGES) return null;
    }
    let list: unknown;
    try {
      list = await res.json();
    } catch {
      return null;
    }
    if (!Array.isArray(list)) return null;
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as RepoListItem;
      if (typeof item.full_name !== 'string') continue;
      const key = item.full_name.toLowerCase();
      if (typeof item.pushed_at === 'string') {
        const ms = Date.parse(item.pushed_at);
        if (Number.isFinite(ms)) out.set(key, ms);
      } else if (item.pushed_at === null) {
        out.set(key, 0); // 空仓库/从未推送:按最旧处理
      }
    }
    if (list.length < OWNER_PROBE_PAGE_SIZE) break; // 已是最后一页
  }
  return out;
}

// ── 缓存(localStorage,TTL 30 分钟) ────────────────────────────────────────

const CACHE_PREFIX = 'sl-github-show:ghstats:v1:';
const CACHE_TTL = 30 * 60 * 1000;

export function readCachedStats(full: string, now = Date.now()): RepoStats | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + full);
    if (!raw) return null;
    const obj = JSON.parse(raw) as RepoStats;
    if (!obj || typeof obj !== 'object' || !obj.days || typeof obj.fetchedAt !== 'number') return null;
    if (now - obj.fetchedAt > CACHE_TTL) return null;
    return obj;
  } catch {
    return null;
  }
}

export function writeCachedStats(stats: RepoStats): void {
  try {
    localStorage.setItem(CACHE_PREFIX + stats.full, JSON.stringify(stats));
  } catch {
    /* 隐私模式 / 容量满:缓存失败不影响主流程 */
  }
}
