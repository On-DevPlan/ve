// src/storage/StatsStore.ts —— GitHub 提交统计的 KV 二级缓存(v1.6.20)。
//
// 动机(v1.6.18 实测教训):统计原本由每个访客的浏览器直连 GitHub API,
// 匿名配额 60 req/h/IP,十几个仓库轻松打光 —— 分享页经常整片限流。
// 改为「编辑者拉一次,存 KV,所有访客白嫖」:
//   - stats 存独立 KV key('<docKey>-stats',与文档同 groupId,visibility=public),
//     绝不嵌进文档 blob —— 分享页里的续期是"写",嵌进文档会造成
//     read-modify-write 竞态,把编辑视图刚保存的行冲掉。
//   - 每仓库独立 fetchedAt:过期只补过期的那几个,不用整表重拉。
//   - 失败也记录(attemptedAt + error + reason):按原因分档退避(v1.6.34)——
//     配额 6h / 网络抖动与 GitHub 聚合中 30min / 仓库 404(近永久)7 天,
//     避免编辑者每刷新一次就烧 28 个请求越试越没配额。
//
// 新鲜度语义:currentStreak 等数字是「统计日快照」—— days 数据只到 fetchedAt,
// 查看端展示时要标注统计日期(CommitStats 负责)。
//
// v1.6.39 owner 级变化探测:30 仓库场景的续期是「惊群 + 预算不够」——
//   a. 同场会话填充使各仓库 fetchedAt 几乎同刻,24h 后集体过期,单次访问
//      预算(8)只够刷其中几个,其余留在旧快照;
//   b. 于是 summary.asOf = max(fetchedAt) 被少数新仓库推着前进,而陈旧仓库
//      在最近这几天 days 为空 → 被 `?? 0` 画成 0 → 热力图右端**假性断崖**。
// 解法是用 owner 探测(engine.probeOwnerPushedAt)先问「谁真的变了」:
//   - 没变的仓库**跳过重拉**,只把 confirmedAt 推到当前 —— 这一步是可信的,
//     因为「pushed_at 不晚于上次统计时刻」本身就证明了这几天确实没有提交,
//     所以 days 缺这几天的键读作 0 是事实而非猜测;asOf 因此重新变得诚实;
//   - 变化的仓库照常拉;探测失败/覆盖不到 → fail-open 回退直拉。
// 探测只在「有净收益」时启用(见 shouldProbeOwners),否则回退逐仓库 needsFetch。

import { kvV1Service } from '@api/services';
import {
  GithubAggregatingError,
  GithubNetworkError,
  GithubRateLimitError,
  GithubRepoGoneError,
  type RepoStats,
} from '../engine/githubStats';

/** 失败原因(决定退避档位与文案,见 RETRY_BACKOFF_BY_REASON)。 */
export type StatsFailReason = 'gone' | 'rate-limit' | 'aggregating' | 'network' | 'unknown';

/**
 * 成功条目:完整统计 + v1.6.39 的「探测确认」时刻。
 * confirmedAt 与 fetchedAt 分工必须分清 —— fetchedAt 永远是**数据本身的观测
 * 时间**(喂 summary.asOf 的右端、以及滚动窗口漂移的天花板),confirmedAt 只喂
 * 新鲜度判定。这样「凭探测跳过重拉」能推迟过期时刻,又不假装数据是刚拉的。
 */
export type GithubStatsOkEntry = { ok: true } & RepoStats & {
  /** v1.6.39:最近一次经 owner 探测确认「自 fetchedAt 起确实没有新推送」的时刻。 */
  confirmedAt?: number;
};

/** 单仓库条目:成功(含完整每日数据)或失败(退避元数据)。key = 'owner/repo' */
export type GithubStatsEntry =
  | GithubStatsOkEntry
  | { ok: false; full: string; attemptedAt: number; error: string; reason?: StatsFailReason };

/** stats KV value 整体结构 */
export interface GithubStatsBlob {
  version: 1;
  /** key = 'owner/repo' */
  repos: Record<string, GithubStatsEntry>;
}

/** 数据新鲜窗口:超过则视为过期(展示时标注统计日期;编辑者访问会自动续) */
export const STATS_FRESH_MS = 24 * 60 * 60 * 1000;
/** 失败退避(配额类):匿名配额 60 次/h/IP 是全局共享的,连着重试只是白烧。 */
export const STATS_RETRY_BACKOFF_MS = 6 * 60 * 60 * 1000;
/**
 * 网络/聚合类退避:30min。实测(2026-09-28)公司网到 api.github.com 会
 * CONNECT_TIMEOUT/ECONNRESET 抖动、且自家仓库常回 202 需要现场聚合 ——
 * 这两类「过一会儿就好」的失败按 6h 退避等于用户整天看不到数据。
 */
export const STATS_RETRY_BACKOFF_SHORT_MS = 30 * 60 * 1000;
/** 仓库不存在/已私有(404):匿名 API 永远不会成功,7 天才试一次(留给改名恢复)。 */
export const STATS_RETRY_BACKOFF_GONE_MS = 7 * 24 * 60 * 60 * 1000;

/** 原因 → 退避时长。缺省(unknown)沿用 6h,保守不放开重试。 */
export function retryBackoffMs(reason: StatsFailReason | undefined): number {
  switch (reason) {
    case 'gone':
      return STATS_RETRY_BACKOFF_GONE_MS;
    case 'rate-limit':
      return STATS_RETRY_BACKOFF_MS;
    case 'network':
    case 'aggregating':
      return STATS_RETRY_BACKOFF_SHORT_MS;
    default:
      return STATS_RETRY_BACKOFF_MS;
  }
}

/** 抛出的错误 → 失败原因(纯函数,便于单测)。 */
export function reasonOfError(e: unknown): StatsFailReason {
  if (e instanceof GithubRepoGoneError) return 'gone';
  if (e instanceof GithubRateLimitError) return 'rate-limit';
  if (e instanceof GithubNetworkError) return 'network';
  if (e instanceof GithubAggregatingError) return 'aggregating';
  return 'unknown';
}

/** 失败原因的展示名(给用户看的一句话)。 */
export const FAIL_REASON_LABEL: Record<StatsFailReason, string> = {
  gone: '仓库不存在或已私有',
  'rate-limit': '匿名配额已用尽',
  aggregating: 'GitHub 正在聚合',
  network: '网络连接失败',
  unknown: '未知错误',
};

/** 文档 key → stats key。默认文档 key 'github-show' → 'github-show-stats'。 */
export function statsKeyOf(docKey: string): string {
  return `${docKey}-stats`;
}

/** stats KV 的 tag(用户空间 tag facet 里与文档区分开) */
export const STATS_TAG = 'github-show-stats';

/** 防御性解析:任何结构不对都返回 null(调用方按「无缓存」处理,不崩)。 */
export function parseStatsBlob(raw: unknown): GithubStatsBlob | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { version?: unknown; repos?: unknown };
  if (obj.version !== 1 || !obj.repos || typeof obj.repos !== 'object') return null;
  const repos: Record<string, GithubStatsEntry> = {};
  for (const [full, e] of Object.entries(obj.repos as Record<string, unknown>)) {
    if (!e || typeof e !== 'object') continue;
    const entry = e as Record<string, unknown>;
    if (entry.ok === true) {
      // 成功条目:days/fetchedAt 必须在,其余字段宽校验(渲染端都有 ?? 兜底)
      if (
        entry.days && typeof entry.days === 'object' && typeof entry.fetchedAt === 'number' &&
        entry.full === full
      ) {
        const okEntry = entry as unknown as GithubStatsOkEntry;
        // confirmedAt(v1.6.39)非数值时显式清掉,脏值不许污染新鲜度判定
        repos[full] =
          typeof entry.confirmedAt === 'number' ? okEntry : { ...okEntry, confirmedAt: undefined };
      }
    } else if (entry.ok === false) {
      if (typeof entry.attemptedAt === 'number' && entry.full === full) {
        repos[full] = {
          ok: false,
          full,
          attemptedAt: entry.attemptedAt,
          error: typeof entry.error === 'string' ? entry.error : '拉取失败',
          // 历史条目(≤v1.6.33)没有 reason,按 unknown 处理(退避仍 6h)
          reason: isFailReason(entry.reason) ? entry.reason : undefined,
        };
      }
    }
  }
  return { version: 1, repos };
}

function isFailReason(v: unknown): v is StatsFailReason {
  return (
    v === 'gone' || v === 'rate-limit' || v === 'aggregating' || v === 'network' || v === 'unknown'
  );
}

/**
 * 条目「上次核对时刻」:成功条目取 fetchedAt 与 confirmedAt 的较大者
 * (v1.6.39 —— 探测确认过一次「没有新提交」同样算核对过),失败条目取 attemptedAt。
 * 新鲜度判定一律走这里,别再直接看 fetchedAt:「数据是何时拉的」是另一件事,
 * 那个还要供电给 summary.asOf。
 */
export function entryCheckedAt(e: GithubStatsEntry | undefined): number {
  if (!e) return 0;
  return e.ok ? Math.max(e.fetchedAt, e.confirmedAt ?? 0) : e.attemptedAt;
}

/** 成功条目是否仍在新鲜窗口内。 */
export function isFreshEntry(e: GithubStatsEntry | undefined, now = Date.now()): boolean {
  return !!e && e.ok && now - entryCheckedAt(e) <= STATS_FRESH_MS;
}

/**
 * 该仓库是否需要(编辑者身份)拉取:
 * 缺失 / 成功但过期 / 失败且按「失败原因」对应的退避窗口已过
 * (网络抖动与 GitHub 聚合中只等 30min;404 等 7 天;配额 6h)。
 * 「过期」按 entryCheckedAt 判定 —— 被 owner 探测确认过「没有新提交」的仓库,
 * 24h 内不再排队(它确实不需要重拉)。
 */
export function needsFetch(full: string, blob: GithubStatsBlob | null, now = Date.now()): boolean {
  const e = blob?.repos[full];
  if (!e) return true;
  if (e.ok) return now - entryCheckedAt(e) > STATS_FRESH_MS;
  return now - e.attemptedAt > retryBackoffMs(e.reason);
}

/**
 * 会话内退避判定(v1.6.28):本页面会话登记的上次尝试时间仍处退避窗口 → 跳过。
 * KV 是唯一持久退避源,写回失败(401/网络)时条目留在 KV 外 —— effect 会因
 * 编辑(doc 变更)/tab 切换重跑,没有这层登记就会把刚试过的仓库立即重新排队;
 * 同时也挡住「旧快照整体写回覆盖退避时间戳」后同会话内的立刻重试。
 */
export function isSessionBackoff(lastAttempt: number | undefined, now = Date.now()): boolean {
  return lastAttempt !== undefined && now - lastAttempt < STATS_RETRY_BACKOFF_MS;
}

/**
 * 双缓存播种:同一仓库 L1(本机 localStorage,≤30min)与 L2(KV 快照)同时命中时,
 * 核对时间戳取新的一方 —— v1.6.25 前是 L1 无条件压过 KV,两份缓存各写各的时,
 * 编辑者可能拿着更旧的本机副本,违背「KV 即共享缓存」的语义。
 * KV 条目是失败(ok:false)时 L1 成功数据仍然优先(有数据总比失败标记强)。
 */
export function pickSeedEntry(
  l1: RepoStats | null,
  kv: GithubStatsEntry | undefined,
): GithubStatsEntry | null {
  if (l1 && kv?.ok) return l1.fetchedAt > kv.fetchedAt ? ({ ok: true, ...l1 } as GithubStatsEntry) : kv;
  if (l1) return { ok: true, ...l1 } as GithubStatsEntry;
  return kv ?? null;
}

// ── v1.6.39 owner 探测的调度策略(纯函数,便于单测) ──────────────────────

/**
 * 探测的启用阈值:待拉仓库数 / owner 数 的比值下限。
 * 探测成本 = owner 数(每 owner 1 次请求),收益 = 可跳过的仓库数(每仓库
 * 省 1 次)。比值 < 2 时探测至少不赚(1 次探测最多换来 1 次省下),所以
 * 宁可回退逐仓库 needsFetch —— 这条守卫是防止「30 个 owner 各 1 个仓库」
 * 时把 30 次直拉变成 30 次探测,变成负优化。
 */
export const OWNER_PROBE_MIN_RATIO = 2;
/** 探测的 owner 数上限:owner 太分散时探测请求本身就能吃掉配额。 */
export const OWNER_PROBE_MAX_OWNERS = 12;
/**
 * 「跳过重拉」的最长时长:超过则强制重拉。
 * 两个作用:① 纠正 pushed_at 的盲区(force-push 改写历史、GitHub 未更新
 * pushed_at 等极端情况);② 兜住滚动窗口漂移 —— commit_activity 是 52 周
 * 滑动窗口,跳过期间「365 天前那天」本该滑出去却仍被算进 yearCount。
 */
export const OWNER_PROBE_SKIP_MAX_MS = 7 * 24 * 60 * 60 * 1000;

/** 按 owner 分组(小写 owner → 原样 full 列表,保持行序)。 */
export function groupReposByOwner(repos: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const full of repos) {
    const slash = full.indexOf('/');
    if (slash <= 0) continue;
    const owner = full.slice(0, slash).toLowerCase();
    const list = out.get(owner);
    if (list) list.push(full);
    else out.set(owner, [full]);
  }
  return out;
}

/** 是否值得走 owner 探测(入参应为「待拉取」的那批仓库,不是全部仓库)。 */
export function shouldProbeOwners(dueRepos: string[]): boolean {
  const owners = groupReposByOwner(dueRepos).size;
  if (owners === 0 || owners > OWNER_PROBE_MAX_OWNERS) return false;
  return dueRepos.length / owners >= OWNER_PROBE_MIN_RATIO;
}

/**
 * 能否凭探测结果跳过重拉:pushed_at 不晚于该仓库上次统计时刻 → 自那时起
 * 确实没有新提交,days 缺这几天的键读作 0 是事实而非猜测。
 * 只对成功条目生效(失败条目还没有数据,必须真拉);并且受
 * OWNER_PROBE_SKIP_MAX_MS 天花板约束。
 */
export function canSkipByProbe(
  e: GithubStatsEntry | undefined,
  pushedAtMs: number,
  now = Date.now(),
): boolean {
  if (!e || !e.ok) return false;
  if (now - e.fetchedAt > OWNER_PROBE_SKIP_MAX_MS) return false;
  return pushedAtMs <= e.fetchedAt;
}

/**
 * github-show 统计 KV 封装。key/groupId 与文档对齐:
 *  - 公开分享模式:文档在 `?groupId=N&key=K` 指向的组里 → stats 同组同 key 派生;
 *  - 编辑模式:文档存 caller 默认组(不传 groupId,同 createGithubShowStore 范式)。
 */
export class GithubShowStatsStore {
  readonly statsKey: string;

  constructor(private readonly args: { key: string; groupId?: number }) {
    this.statsKey = statsKeyOf(args.key);
  }

  /** 匿名公开读。缺失 / 非 public / 网络错 → null(调用方按「无缓存」渲染)。 */
  async loadPublic(): Promise<GithubStatsBlob | null> {
    try {
      const item = await kvV1Service.getPublic({
        key: this.statsKey,
        groupId: this.args.groupId ?? 0,
      });
      return parseStatsBlob(JSON.parse(item.value));
    } catch {
      return null;
    }
  }

  /**
   * JWT 鉴权读(caller 自己命名空间 + 指定组)。三种用途:
   *  - 编辑模式读自己的 stats;
   *  - 公开模式下兼作「编辑者身份探测」—— 读得到 = 对该组有权限(属主/成员)。
   * 失败(未登录 / 无权限 / 不存在)一律 null,不区分原因(调用方只关心能否写)。
   */
  async loadAuthed(): Promise<GithubStatsBlob | null> {
    try {
      const item = await kvV1Service.get({
        key: this.statsKey,
        groupId: this.args.groupId,
      });
      return parseStatsBlob(JSON.parse(item.value));
    } catch {
      return null;
    }
  }

  /** JWT 写(visibility=public,匿名访客才能公开读)。失败由调用方兜底(不影响展示)。 */
  async save(blob: GithubStatsBlob): Promise<void> {
    await kvV1Service.set({
      key: this.statsKey,
      value: JSON.stringify(blob),
      tags: [STATS_TAG],
      ttl: 0,
      ...(this.args.groupId !== undefined ? { groupId: this.args.groupId } : {}),
      visibility: 'public',
    });
  }
}

/**
 * 公开模式下的编辑者探测:带 JWT 读文档 key 本身 ——
 * 读得到 = caller 是属主(或组内有权成员),可以续期 stats。
 * 统计 key 可能尚不存在,所以探测文档 key(正在被分享,必然存在)。
 */
export async function probeEditorAccess(docKey: string, groupId: number): Promise<boolean> {
  try {
    await kvV1Service.get({ key: docKey, groupId });
    return true;
  } catch {
    // 401/403/404/50 一律视为「不是编辑者(或无写权限)」,静默拒绝
    return false;
  }
}
