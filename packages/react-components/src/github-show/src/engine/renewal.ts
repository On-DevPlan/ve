// src/engine/renewal.ts —— 统计续期编排(v1.6.41)。
//
// 为什么单独成模块:这段逻辑(读 KV 快照 → 合并 L1 播种 → owner 探测 →
// 跳过 / 逐个拉取 → 写回)原本整块塞在 CommitStats 的一个 ~200 行 useEffect 里,
// 七件事混在一起 —— ① L2 读 ② 播种 ③ 续期队列判定 ④ owner 探测 ⑤ 跳过写回
// ⑥ 逐个拉取 ⑦ 配额快速终止;而且每个阶段各带自己的 `if (cancelled) return`,
// 局部变量(seedBlob / local / due / queue / blocked / forced)在同一个作用域里
// 反复重建。后果是**整条链没法单测** —— 测试只能渲染组件 + mock 掉 KV/GitHub
// 整条通路,断言落在 DOM 上,链条本身对不对看不出来。
//
// 拆成两个独立函数之后:
//   · 组件侧只剩「构造 store → 调 loadStatsSeed → 调 runRenewal → cleanup」;
//   · 入参出参显式(store / hooks / isCancelled),用假 store + 假 fetch 就能把
//     整条链跑起来断言(见 __tests__/github-show-renewal.test.ts);
//   · 阶段边界变成真正的「早退」:配额耗尽用 break 跳出,不再靠
//     「继续遍历但每条都 continue」来收集剩余仓库。

import {
  GithubRateLimitError,
  fetchRepoStatsDedup,
  probeOwnerPushedAt,
  readCachedStats,
  writeCachedStats,
} from './githubStats';
import {
  GithubShowStatsStore,
  OWNER_PROBE_SKIP_MAX_MS,
  canSkipByProbe,
  groupReposByOwner,
  isSessionBackoff,
  needsFetch,
  pickSeedEntry,
  probeEditorAccess,
  reasonOfError,
  shouldProbeOwners,
  type GithubStatsBlob,
  type GithubStatsEntry,
} from '../storage/StatsStore';

/** 单次页面访问的拉取预算(仓库数;每仓库 2 个 GitHub 请求)。
 * 30 个仓库全过期一次要 60 个请求 ≈ 一个小时的匿名配额 —— 分摊到多次访问,
 * 保证「一次访问最多烧 ~16 个配额」,配额耗尽也不会刷新页面连环撞。
 * v1.6.39 起 owner 探测通常已把 toFetch 压到个位数,这个上限很少被摸到。 */
export const STATS_FETCH_BUDGET = 8;

export interface StatsSeedResult {
  /** KV 原样快照(null = 无缓存 / 未登录 / 读失败) */
  blob: GithubStatsBlob | null;
  /** L1 与 KV 取新之后的播种视图(判定与展示都用它,不是 blob) */
  seeded: Record<string, GithubStatsEntry>;
  /** 本次访问是否具备续期资格(编辑者 / 组内成员) */
  fetchable: boolean;
}

/**
 * 阶段一:读 KV 快照 → 合并 L1 播种 → 续期资格判定。
 * 纯读取,不写 KV、不发 GitHub 请求。
 */
export async function loadStatsSeed(opts: {
  store: GithubShowStatsStore;
  repos: string[];
  publicParams: { key: string; groupId: number } | null;
  isLoggedIn: boolean;
}): Promise<StatsSeedResult> {
  const { store, repos, publicParams, isLoggedIn } = opts;

  let blob: GithubStatsBlob | null = null;
  let fetchable: boolean;
  if (publicParams) {
    blob = await store.loadPublic();
    // 公开页的「编辑者身份探测」:带 JWT 试读文档 key —— 读得到 = 属主/组内成员。
    fetchable = isLoggedIn && (await probeEditorAccess(publicParams.key, publicParams.groupId));
  } else {
    // 编辑模式:v1.6.23 起要求登录 —— 未登录时 store.save 必然 401,拉了也只活
    // 30min 的 L1,每次访问都重烧 GitHub 配额(L1 命中仍照常展示)。
    blob = isLoggedIn ? await store.loadAuthed() : null;
    fetchable = isLoggedIn;
  }

  // 播种(v1.6.25):L1 / KV 同时命中时核对时间戳取新的一方 —— KV 快照未过期就是
  // 事实源,编辑者同样优先吃缓存而不是重算;只有 L1 存在且比 KV 新(或 KV 缺失)
  // 时才用本机副本。
  const seeded: Record<string, GithubStatsEntry> = {};
  for (const full of repos) {
    const e = pickSeedEntry(readCachedStats(full), blob?.repos[full]);
    if (e) seeded[full] = e;
  }
  return { blob, seeded, fetchable };
}

/** 组件侧的状态回写口(runRenewal 不持有 React state)。 */
export interface RenewalHooks {
  /** 一批条目变化:跳过批 / 单个拉取结果 / 配额退避批 */
  onEntries: (patch: Record<string, GithubStatsEntry>) => void;
  /** 「正在拉取」列表变化 */
  onRenewing: (renewing: string[]) => void;
}

export interface RenewalOptions {
  store: GithubShowStatsStore;
  /** 本次渲染去重后的仓库列表(按行序) */
  repos: string[];
  /** loadStatsSeed 的播种视图 —— 判定「要不要拉」看它 */
  seedBlob: GithubStatsBlob;
  /** 写回起底(KV 原样),不传则从空表起底 */
  baseBlob: GithubStatsBlob | null;
  /** v1.6.34「立即重试」:置入的仓库无视新鲜度/会话退避强制入队;消费后清空 */
  forced: Set<string>;
  /** v1.6.28 会话内尝试登记(模块级,跨 effect 重跑保留) */
  sessionAttempted: Map<string, number>;
  hooks: RenewalHooks;
  /** 取消检查(effect cleanup / doc 变更)→ true 时尽快早退,不再写 KV */
  isCancelled: () => boolean;
  /** 注入「现在」以便单测(pickSeed / 退避判定都依赖它) */
  now?: number;
}

/** 写回 KV,失败只留痕不抛出(v1.6.23:完全静默会让「KV 建不起来」只能靠猜)。 */
async function saveQuietly(
  store: GithubShowStatsStore,
  blob: GithubStatsBlob,
  label: string,
): Promise<void> {
  try {
    await store.save(blob);
  } catch (e) {
    console.warn(`[github-show] stats KV 写回失败(${label})`, e);
  }
}

/**
 * 阶段二:owner 级变化探测(v1.6.39)。先花「owner 数」次请求问「谁真的变了」,
 * 没变的直接跳过(0 次仓库拉取)—— 把 30 仓库的次日全量续期从「30 次拉取、
 * 预算内只够做 8 个」压成「几次探测 + 真正变化的几个」。
 *
 * 只探测「已有成功数据、且没到跳过天花板(OWNER_PROBE_SKIP_MAX_MS)」的仓库:
 * 缺失的仓库无论如何都得拉,探测它们纯属浪费配额。
 *
 * fail-open 铁律:任一 owner 探不到(网络/403/翻页超限)或探测不划算(owner 太
 * 分散)→ 整批回退直拉。宁可多花请求,也绝不用「没出现」推断「没变化」。
 *
 * @returns null = 已取消(调用方直接早退)
 */
async function probeSkips(opts: {
  due: string[];
  seedBlob: GithubStatsBlob;
  isCancelled: () => boolean;
  now: number;
}): Promise<{ skipped: string[]; toFetch: string[]; checkedAt: number } | null> {
  const { due, seedBlob, isCancelled, now } = opts;
  const fallback = { skipped: [] as string[], toFetch: due, checkedAt: 0 };

  const candidates = due.filter((full) => {
    const e = seedBlob.repos[full];
    return e?.ok === true && now - e.fetchedAt <= OWNER_PROBE_SKIP_MAX_MS;
  });
  if (candidates.length === 0 || !shouldProbeOwners(candidates)) return fallback;

  const probed = new Map<string, number>(); // 小写 full → pushed_at(ms)
  for (const owner of groupReposByOwner(candidates).keys()) {
    const m = await probeOwnerPushedAt(owner);
    if (isCancelled()) return null;
    if (!m) return fallback;
    for (const [key, ms] of m) if (!probed.has(key)) probed.set(key, ms);
  }

  const checkedAt = Date.now();
  const skipped: string[] = [];
  const toFetch: string[] = [];
  for (const full of due) {
    const pushedAt = probed.get(full.toLowerCase());
    // 「跳过」= 确定没有新提交(不是「不知道」):pushed_at 不晚于该仓库上次
    // 统计时刻,所以 days 缺这几天的键、读出来是 0 是事实而非猜测。
    if (pushedAt !== undefined && canSkipByProbe(seedBlob.repos[full], pushedAt, checkedAt)) {
      skipped.push(full);
    } else {
      toFetch.push(full);
    }
  }
  return { skipped, toFetch, checkedAt };
}

/**
 * 阶段三:后台增量续期。串行执行「探测 → 跳过批写回 → 逐个拉取 → 配额退避批」,
 * 每个条目落定就通过 hooks 回吐给组件(流式渲染),并尽可能落 KV。
 * 不挂页面内重试定时器(v1.6.24):没轮到的 / 退避中的仓库都等下次访问继续。
 */
export async function runRenewal(opts: RenewalOptions): Promise<void> {
  const { store, repos, seedBlob, baseBlob, forced, sessionAttempted, hooks, isCancelled } = opts;
  const now = opts.now ?? Date.now();

  // ── 续期队列:缺失 / 过期 / 失败退避期满,且不在本会话退避窗口内 ──────────
  // 截断到单次访问预算,剩余顺延下次访问(不加 attemptedAt,保持原状,下次优先续)。
  const due = repos.filter((full) => {
    if (forced.has(full)) return true;
    if (!needsFetch(full, seedBlob, now)) return false;
    return !isSessionBackoff(sessionAttempted.get(full), now);
  });
  for (const full of forced) forced.delete(full);
  if (due.length === 0) return;

  let local: GithubStatsBlob = baseBlob ?? { version: 1, repos: {} };

  // ── 阶段 A:谁真的变了 ────────────────────────────────────────────────
  const probe = await probeSkips({ due, seedBlob, isCancelled, now });
  if (!probe) return; // 已取消

  // ── 阶段 B:确认「没有新提交」的仓库只前移 confirmedAt ──────────────────
  // 注意写的是 confirmedAt 而**不是** fetchedAt:数据本身还是上次拉的,只是
  // 「自那以后确实没有新提交」已被证实。写回 KV 后匿名访客的热力图右端也会
  // 随之前进到今天,而不是停在上次拉取日。
  // 整批一次写回:跳过可能有几十个,逐个写会把 ~96KB 的 blob 写几十遍。
  if (probe.skipped.length > 0) {
    const patch: Record<string, GithubStatsEntry> = {};
    for (const full of probe.skipped) {
      const base = seedBlob.repos[full];
      if (!base || !base.ok) continue;
      const next: GithubStatsEntry = { ...base, confirmedAt: probe.checkedAt };
      local = { version: 1, repos: { ...local.repos, [full]: next } };
      patch[full] = next;
    }
    if (isCancelled()) return;
    hooks.onEntries(patch);
    await saveQuietly(store, local, '探测续期');
  }

  // ── 阶段 C:真正变化的按预算逐个拉 ────────────────────────────────────
  const queue = probe.toFetch.slice(0, STATS_FETCH_BUDGET);
  if (queue.length === 0) return;
  let renewing = [...queue];
  hooks.onRenewing(renewing);

  let rateLimited = false;
  let cursor = 0;
  for (; cursor < queue.length; cursor += 1) {
    // 配额耗尽即跳出(v1.6.23):后续请求注定 403,逐个撞只是白烧。
    if (rateLimited) break;
    const full = queue[cursor];
    // 无论后续成功/失败/写回成败,本会话的退避窗口从请求发出即起算
    sessionAttempted.set(full, Date.now());
    let entry: GithubStatsEntry;
    try {
      const stats = await fetchRepoStatsDedup(full);
      writeCachedStats(stats);
      entry = { ok: true, ...stats };
    } catch (e) {
      if (e instanceof GithubRateLimitError) rateLimited = true;
      entry = {
        ok: false,
        full,
        attemptedAt: Date.now(),
        error: e instanceof Error ? e.message : '拉取失败',
        reason: reasonOfError(e),
      };
    }
    local = { version: 1, repos: { ...local.repos, [full]: entry } };
    if (isCancelled()) return;
    hooks.onEntries({ [full]: entry });
    renewing = renewing.filter((f) => f !== full);
    hooks.onRenewing(renewing);
    // 逐个写回:中途失败/关页,已完成的仓库也已落 KV。
    await saveQuietly(store, local, '本仓库数据仅存本机');
  }

  // ── 阶段 D:配额耗尽,本轮没碰到的整批补记退避 ────────────────────────
  const blocked = queue.slice(cursor);
  if (blocked.length === 0) return;
  const attemptedAt = Date.now();
  const patch: Record<string, GithubStatsEntry> = {};
  for (const full of blocked) {
    sessionAttempted.set(full, attemptedAt);
    const entry: GithubStatsEntry = {
      ok: false,
      full,
      attemptedAt,
      error: 'GitHub 匿名配额已用尽,本轮未尝试(退避中)',
      reason: 'rate-limit',
    };
    local = { version: 1, repos: { ...local.repos, [full]: entry } };
    patch[full] = entry;
  }
  if (isCancelled()) return;
  hooks.onEntries(patch);
  hooks.onRenewing(renewing.filter((f) => !blocked.includes(f)));
  await saveQuietly(store, local, '配额退避批');
}
