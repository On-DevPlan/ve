// src/components/CommitStats.tsx —— 提交统计表(v1.6.20,KV 快照版)。
//
// 需求演进(v1.6.18 → v1.6.19 → v1.6.20):
//   v1.6.19 每个访客浏览器直连 GitHub API —— 匿名 60 req/h/IP 被十几个仓库
//   轻松打光,分享页经常整片限流。v1.6.20 改为「编辑者拉一次存 KV,访客白嫖」:
//
//   - L2(共享):KV 独立 key '<docKey>-stats'(visibility=public),每仓库
//     独立 fetchedAt,24h 新鲜窗口;失败记 attemptedAt,退避 6h(v1.6.24)。
//   - L1(本浏览器):localStorage 30min(沿用 v1.6.18 缓存),省 KV 读。
//   - 谁能拉 GitHub(续期):
//       1. 编辑自己的文档(登录 + 非公开模式)—— 总是可以;
//       2. 公开分享页:带 JWT 试读文档 key,读得到(属主/组内成员)→ 可以;
//       3. 匿名访客 —— 永远不拉,只读 KV 快照(0 次 GitHub 请求)。
//   - 续期永远后台增量:只拉缺失/过期/退避期满的仓库,逐个写回 KV;
//     单次访问有预算上限(v1.6.24),拉不完的下次访问继续。
//
// 快照语义:「当前连续天数」按各仓库最近一次统计日计算(days 数据只到
// fetchedAt),热力图网格也以快照日为末端;编辑者一访问,数据自动续上。
//
// v1.6.21 渲染改版:汇总表 → GitHub 主页同款贡献热力图(53 周 × 7 天小方格,
// 多仓库逐日合并 + 月份/星期标尺 + 少/多图例 + 连续天数),引擎的
// buildHeatmapWeeks / monthLabels 复用(v1.6.18 遗产)。
//
// v1.6.23 可靠性修复(实测:stats KV key 从未建立,每次访问都白烧配额):
//   a. 编辑模式未登录不再拉取 —— 没有 JWT 时 store.save 必然 401,数据只能
//      活 30min 的 L1,每次访问重烧 2×N 个 GitHub 请求,纯浪费(L1 命中仍照常展示);
//   b. 配额耗尽(GithubRateLimitError)快速终止队列:剩余仓库不再逐个撞 403,
//      统一补记失败条目(attemptedAt=now)让退避窗口覆盖它们;
//   c. store.save 失败不再完全静默:console.warn 带上错误,便于诊断。
//
// v1.6.24 请求节流(用户实测:失败仓库每轮全量重试,配额每小时被打光一次):
//   a. 失败退避 1h → 6h(StatsStore.STATS_RETRY_BACKOFF_MS);
//   b. 单次访问拉取预算:每次页面加载最多尝试 STATS_FETCH_BUDGET 个仓库
//      (每仓库 2 个请求),其余顺延到后续访问 —— 一次访问最多花 ~16 个配额;
//   c. 移除页面内自动重试定时器:页面挂着不再轮询重试,失败仓库等到
//      「下次访问」且退避期满才续(成功数据本来就 24h 才过期, KV 即缓存)。
//
// v1.6.25 播种时间戳核对(用户要求:未过期就吃 KV 缓存,不重算):
//   a. 续期队列侧 v1.6.24 起已由 needsFetch 保证 —— fetchedAt 未过 24h / 失败
//      attemptedAt 未过 6h 退避的条目一律不进队列,编辑者与访客同样白嫖 KV;
//   b. 展示播种侧补齐:L1 与 KV 同时命中时按时间戳取新的一方(pickSeedEntry),
//      不再让 30min 的本机副本无条件压过更新的共享 KV 快照。
//
// v1.6.28 会话内尝试登记(用户实测:KV 快照出现 13 连发 403,疑似旧页面 +
// 退避时间戳被覆盖后反复重试):
//   a. 模块级 sessionAttemptedAt 登记:每仓库一个退避窗口内,本页面会话
//      至多真正请求一次 —— effect 因编辑(doc 变更)/tab 切换重跑时,
//      不因 KV 写回失败把刚试过的仓库重新排队(isSessionBackoff);
//   b. 注意:快照里「N 个请求挤在几秒内、各带独立 attemptedAt」的模式
//      在 v1.6.23+ 下不可能产生(首个 403 即快速终止,后续仓库不发请求),
//      看到它 = 页面在跑修复前的旧代码,请刷新所有 github-show 标签页。
//
// v1.6.34 失败可读化(用户反馈「仍然报错:1 个仓库上次拉取失败」但看不出是谁、
// 为什么;实测网络层 CONNECT_TIMEOUT 才是常见主因,文案却一律甩锅配额):
//   a. 失败条目按原因分类入库(reason),文案按原因区分:网络/聚合中 30min 退避,
//      配额 6h,仓库不存在/已私有(404)7 天;
//   b. 提示语点名仓库(最多 3 个,超出折叠)+ 一句话原因,不再是黑盒计数;
//   c. 新增「立即重试」:编辑者点一下即清掉这些仓库的本会话 + KV 退避并重排队,
//      不必等「下次访问」。
//
// v1.6.35 提示显示条目化(用户反馈长句一行挤不下、看不出结构):
//   失败仓库改为逐条列表 —— 每仓库一行,仓库名居左(墨色)、原因居右(浅灰),
//   状态点区分类型:gone 空心(需人工修链接) / 可重试实心(自动恢复);
//   列表底部发丝线 footer 放自动重试时刻 + 「立即重试」;>4 条列表内滚。
//
// v1.6.36 热力图固定占位(用户反馈数据加载前后页面高度跳动):
//   空态/加载态渲染与数据态同构的 53×7 骨架(月份/星期标尺 + 图例全保留,
//   状态文案放 foot),三态等高 —— 页面不再浮动。
//
// v1.6.38 消除「从无到有」跳变(用户反馈骨架→数据一次大跳变太明显):
//   a. 同步预播种:entries 用 useState 惰性初始化直接读 L1(localStorage),
//      首帧即数据;KV 返回后仍走 pickSeedEntry 按时间戳对齐(内容相同 = 无感)。
//      注意 L1 存的是裸 RepoStats,必须经 pickSeedEntry 补 ok:true 才进 doneList;
//   b. repos 变化时补种:惰性初始化只在挂载跑一次,doc 编辑新增的行由
//      一个 [repos] effect 同步补 L1 种子,不闪骨架;
//   c. 热力图改单一渲染路径:骨架与数据态合并成一棵树(months 53 列 / grid
//      371 格 / foot 结构、格子 key 与索引全一致),React 才会**原地复用**
//      同一批 span 节点;两棵独立子树时实测节点被整体替换(打过标记的骨架格
//      在数据态剩 0 个),CSS 过渡根本不会触发;
//   d. CSS:格子 background-color 加 0.45s 过渡 —— 骨架 is-ph → is-lN 是渐变色
//      而非瞬变,续期逐仓库点亮同样柔和。
//
// v1.6.39 owner 级变化探测(30 仓库场景的两件事一起解):
//   问题:① 同场会话填充使各仓库 fetchedAt 几乎同刻 → 24h 后集体过期(惊群),
//         单次访问预算 8 个根本刷不完 30 个;
//         ② summary.asOf = max(fetchedAt) 被少数刚刷新的仓库推着前进,其余
//         陈旧仓库在最近这几天 days 为空 → 被 `?? 0` 画成 0 → 右端假性断崖。
//   做法:续期前先花「owner 数」次请求探测(pushedAt 一次覆盖该 owner 下最多
//         100 个仓库),把待拉集合分成两半 ——
//         · 没变(pushed_at ≤ 上次统计时刻)→ **跳过**,只把 confirmedAt 推到
//           当前。这是可信判断而非猜测:没新推送就说明这几天确实 0 次提交,
//           所以 asOf 前移之后热力图右端是诚实的;
//         · 变了 → 照常拉。
//         探测失败 / 覆盖不到 / 不划算(owner 太分散)→ fail-open 回退直拉。
//   收益:次日首次访问从「16 请求只刷 8/30」变成「2 探测 + 3 拉取 = 30/30」。
//
// v1.6.40 覆盖诚实化(乙:兜住甲覆盖不到的残留断崖):
//   甲让「跳过」成为可信判断,但三类仓库走不到探测 —— 探测回退的(owner 太
//   分散)、拉取失败的,以及「还没到 24h 所以压根没进续期队列」的。它们的
//   checkedAt 停在旧值,而 asOf = max 被别的仓库推着前进 → 最近这几天它们的
//   days 键缺席,被 `?? 0` 画成 0,右端仍有假性断崖(只是比甲之前窄)。
//   做法:算一条覆盖边界 coverageFrom = min(entryCheckedAt)(只取有数据的
//   仓库),date > coverageFrom 的格子加 is-partial(浅斜纹)—— 底色照旧
//   (提交量信息不丢),只叠一层「这段不全」的纹理;脚注量化成
//   「最近 N 天仅 M/K 个仓库覆盖到当天」。既显示最新,又不假装那几天是 0。
//
// v1.6.41 续期编排抽离(纯重构,行为不变):
//   原「读 KV → 播种 → 续期判定 → owner 探测 → 跳过写回 → 逐个拉取 → 配额
//   快速终止」七件事塞在一个 ~200 行 useEffect 里,每个阶段各带自己的
//   `if (cancelled) return`,局部变量反复重建,整条链**没法单测**(只能渲染
//   组件 + mock 掉 KV/GitHub 通路,断言落在 DOM 上)。
//   现拆到 engine/renewal.ts:
//     · loadStatsSeed(store, repos, publicParams, isLoggedIn) → { blob, seeded, fetchable }
//     · runRenewal({ store, repos, seedBlob, baseBlob, forced, sessionAttempted,
//                    hooks, isCancelled }) → Promise<void>
//   effect 只剩「构造 store → 两段调用 → cleanup 置 cancelled」。
//   行为等价的两处顺带清理:配额耗尽从「继续遍历但每条 continue」改成
//   `break` + `queue.slice(cursor)` 收集剩余,阶段边界成为真的早退。

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GithubShowDoc } from '@api/components/github-show/types';
import { parseRepoUrl } from '../utils/repo';
import { useJwtAuth } from '../hooks/useAuth';
import {
  buildHeatmapWeeks,
  computeStreaks,
  epochToUtcDateKey,
  mergeDays,
  monthLabels,
  readCachedStats,
  type HeatCell,
} from '../engine/githubStats';
import { loadStatsSeed, runRenewal } from '../engine/renewal';
import {
  FAIL_REASON_LABEL,
  GithubShowStatsStore,
  STATS_FRESH_MS,
  entryCheckedAt,
  pickSeedEntry,
  retryBackoffMs,
  type GithubStatsEntry,
  type StatsFailReason,
} from '../storage/StatsStore';

/** 会话内尝试登记(v1.6.28):full → 本页面会话上次真实尝试时刻。
 * 不依赖 KV 写回成败 —— 写回失败时 KV 里没有退避记录,没有这层登记,
 * effect 每次重跑(编辑/tab 切换)都会把刚试过的仓库重新排队。
 * v1.6.41 起由 runRenewal 透传使用(见 engine/renewal.ts)。 */
const sessionAttemptedAt = new Map<string, number>();

interface CommitStatsProps {
  doc: GithubShowDoc;
  /** 公开分享模式参数(?groupId=&key=);null = 编辑自己的文档 */
  publicParams: { key: string; groupId: number } | null;
}

/** v1.6.38 热力图槽位:数据格(引擎 HeatCell)/ 'future' 快照日之后的未来格 /
 *  'ph' 骨架占位。骨架与数据态产出等长同 key 的槽位序列,React 才能复用
 *  同一批 span 节点,让 background-color 过渡真正生效(而不是整体替换 DOM)。 */
type HeatSlot = HeatCell | 'future' | 'ph';

/** v1.6.40 两个 UTC 日期 key('YYYY-MM-DD')相差的天数(b - a)。 */
function dayDiffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function extractRepos(doc: GithubShowDoc): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of doc.rows) {
    const p = parseRepoUrl(row.repoUrl);
    if (p && !seen.has(p.full)) {
      seen.add(p.full);
      out.push(p.full);
    }
  }
  return out;
}

export default function CommitStats({ doc, publicParams }: CommitStatsProps) {
  // 去重后的仓库列表(按行序);doc 变更(导入/编辑行)→ 重新对齐
  const repos = useMemo(() => extractRepos(doc), [doc]);

  const auth = useJwtAuth();
  const isLoggedIn = auth.jwtAuthState === 'logged-in' && !!auth.token;

  // v1.6.38 同步预播种:L1(localStorage,同步可读)在首帧就位,不再等
  // KV 网络往返 —— 之前 effect 里先 await store.loadPublic()/loadAuthed()
  // 再读 L1,有本机缓存也要干等 KV 回来才显示,热力图骨架期 = 网络延迟,
  // 数据到位时整块灰格→绿格「从无到有」一次大跳变。
  // 必须走 pickSeedEntry 归一化:L1 存的是裸 RepoStats,要补 ok:true 才进
  // doneList(直接塞裸值会被 `e?.ok === true` 过滤掉,等于没播种)。
  const [entries, setEntries] = useState<Record<string, GithubStatsEntry>>(() => {
    const seeded: Record<string, GithubStatsEntry> = {};
    for (const full of repos) {
      const e = pickSeedEntry(readCachedStats(full), undefined);
      if (e) seeded[full] = e;
    }
    return seeded;
  });
  const [mayFetch, setMayFetch] = useState(false);
  const [renewing, setRenewing] = useState<string[]>([]);
  // v1.6.34「立即重试」:用户点一次就无视会话/KV 退避,把失败仓库重新排队
  const [retryTick, setRetryTick] = useState(0);
  const forcedReposRef = useRef<Set<string>>(new Set());

  // 上面的惰性初始化只在挂载时跑一次;doc 编辑(导入行/改 URL)导致 repos
  // 增删时,给尚无条目的仓库同步补一次 L1 种子(有则立即显示,不闪骨架)。
  // 主 effect 稍后仍会用 pickSeedEntry(L1, KV) 整体对齐,这里只是提前量。
  useEffect(() => {
    setEntries((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const full of repos) {
        if (next[full]) continue;
        const e = pickSeedEntry(readCachedStats(full), undefined);
        if (e) {
          next[full] = e;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [repos]);

  // 挂载/doc 变更:读 KV 快照 → 渲染 → (编辑者身份)后台增量续期。
  // v1.6.24:没有页面内重试定时器 —— 失败仓库等下次访问退避期满再续,
  // 页面开着不轮询,不让一个标签页持续烧配额。
  // v1.6.41:链条本体搬去了 engine/renewal.ts,这里只管生命周期接线。
  useEffect(() => {
    let cancelled = false;
    const store = publicParams
      ? new GithubShowStatsStore(publicParams)
      : new GithubShowStatsStore({ key: 'github-show' });

    (async () => {
      // 1) 读 KV 快照 + 合并 L1 播种 + 续期资格判定(纯读,不发 GitHub 请求)
      const { blob, seeded, fetchable } = await loadStatsSeed({
        store,
        repos,
        publicParams,
        isLoggedIn,
      });
      if (cancelled) return;
      setEntries(seeded);
      setMayFetch(fetchable);

      // 2) 编辑者:后台增量续期(owner 探测 → 跳过 / 逐个拉取 → 写回 KV)。
      //    访客(fetchable=false)到此为止 —— 永远 0 次 GitHub 请求。
      if (!fetchable) return;
      await runRenewal({
        store,
        repos,
        seedBlob: { version: 1, repos: seeded },
        baseBlob: blob,
        forced: forcedReposRef.current,
        sessionAttempted: sessionAttemptedAt,
        isCancelled: () => cancelled,
        hooks: {
          onEntries: (patch) => setEntries((prev) => ({ ...prev, ...patch })),
          onRenewing: (next) => setRenewing(next),
        },
      });
    })();

    return () => {
      cancelled = true;
    };
    // repos 由 doc 派生;publicParams/isLoggedIn 变化重新对齐;retryTick = 手动重试
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, publicParams, isLoggedIn, retryTick]);

  // 注:repos 是 'owner/repo' 字符串数组(extractRepos 已去重),不是对象
  const doneList = repos.map((full) => entries[full]).filter((e): e is Extract<GithubStatsEntry, { ok: true }> => e?.ok === true);

  // 汇总:合并已成功仓库的每日数据;「当前连续」锚定最近一次统计日(快照语义)
  const summary = useMemo(() => {
    if (doneList.length === 0) return null;
    const days = mergeDays(doneList.map((e) => e.days));
    // v1.6.39 末端用「核对时刻」而不是 fetchedAt:被 owner 探测确认过
    // 「没有新提交」的仓库,那几天确实该画成 0 —— 末端不跟着前移的话,
    // 右端会停在旧拉取日,「当前连续」也会锚在过期的一天上。
    const asOf = epochToUtcDateKey(Math.max(...doneList.map((e) => entryCheckedAt(e))));
    const { currentStreak, longestStreak } = computeStreaks(Object.keys(days), asOf);
    return {
      days,
      asOf,
      currentStreak,
      longestStreak,
      yearCount: doneList.reduce((a, e) => a + e.yearCount, 0),
      covered: doneList.length,
    };
    // doneList 由 entries/repos 派生
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, repos]);

  // v1.6.40 覆盖边界(乙):所有「有数据」的仓库都核对到的最后一天。
  // 晚于它的格子只有一部分仓库是确定的,其余仍停在快照期(它们的 days 缺这几
  // 天的键 → 会被 `?? 0` 画成 0)—— 用 is-partial 标记,不假装那是「零提交」。
  // 只有当边界早于 asOf 时才成立;全部核对到同一天时右端本就诚实,不标记。
  const coverage = useMemo(() => {
    if (!summary || doneList.length === 0) return null;
    const keys = doneList.map((e) => epochToUtcDateKey(entryCheckedAt(e)));
    const fromKey = keys.reduce((a, b) => (a < b ? a : b));
    if (fromKey >= summary.asOf) return null;
    // 「覆盖到当天」= 核对日不早于 asOf 的仓库数(其余仓库这几天是快照期)
    const covered = keys.filter((k) => k >= summary.asOf).length;
    return { fromKey, days: dayDiffDays(fromKey, summary.asOf), covered, total: repos.length };
    // doneList 由 entries/repos 派生
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, repos, summary]);

  // 热力图网格:53 周 × 7 天,多仓库逐日合并。以快照日/核对日(asOf)为末端 ——
  // days 数据只到 fetchedAt,末端之后的格子留空而不是误画成 0。
  const weeks = useMemo(() => (summary ? buildHeatmapWeeks(summary.days, summary.asOf) : []), [summary]);
  const months = useMemo(
    () => (summary ? monthLabels(weeks) : Array.from({ length: 53 }, () => '\u00A0')),
    [weeks, summary],
  );

  // v1.6.38 扁平格子列表:骨架态与数据态产出**等长、同 key**的 371 个格子 ——
  // React 按 key 复用同一批 span(实测:两棵独立子树时节点会被整体替换,
  // class 切换不经过 CSS 过渡,跳变依旧)。'ph' = 骨架占位,'future' = 快照日
  // 之后的未来格(留空),对象 = 有数据的格。
  const heatCells = useMemo<HeatSlot[]>(() => {
    if (!summary) return Array.from({ length: 53 * 7 }, () => 'ph' as const);
    const flat: HeatSlot[] = [];
    for (const week of weeks) {
      for (const c of week) flat.push(c ?? 'future');
    }
    return flat;
  }, [weeks, summary]);

  if (repos.length === 0) return null; // 没有 GitHub 链接就不渲染这块

  const now = Date.now();
  const missingCount = repos.length - doneList.length;
  // v1.6.39:同样按「核对时刻」算 —— 探测确认过无新提交的仓库不算过期快照
  const staleOkCount = doneList.filter((e) => now - entryCheckedAt(e) > STATS_FRESH_MS).length;

  // ── 失败条目分组(v1.6.34):区分「仓库不存在/已私有」(近永久,降频重试)
  //    与「可重试」(网络抖动 / 配额 / 聚合中),后者给「立即重试」按钮。 ──
  const failedEntries = repos
    .map((full) => entries[full])
    .filter((e): e is { ok: false; full: string; attemptedAt: number; error: string; reason?: StatsFailReason } => e?.ok === false);
  const goneList = failedEntries.filter((e) => e.reason === 'gone');
  const retryList = failedEntries.filter((e) => e.reason !== 'gone');
  // 下一次自动重试时刻 = 各失败条目「尝试时刻 + 其退避时长」里最早的一个
  const nextRetryMs = retryList.length
    ? Math.min(...retryList.map((e) => e.attemptedAt + retryBackoffMs(e.reason)))
    : 0;
  const nextRetryText = nextRetryMs > now
    ? `最早 ${new Date(nextRetryMs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 自动重试`
    : '';

  /** 「立即重试」:清掉这些仓库的会话退避并强制重新入队(不等下次访问)。 */
  function handleRetryFailed() {
    for (const e of failedEntries) {
      forcedReposRef.current.add(e.full);
      sessionAttemptedAt.delete(e.full);
    }
    setRetryTick((t) => t + 1);
  }

  return (
    <div className="sl-gh-gstat">
      <div className="sl-gh-gstat__head">
        <span className="sl-gh-gstat__title">
          {summary ? (
            <>
              过去一年 <b>{summary.yearCount}</b> 次提交
              <span className="sl-gh-gstat__cover">
                （{summary.covered}/{repos.length} 个仓库合并）
              </span>
            </>
          ) : (
            '提交统计'
          )}
        </span>
        {summary ? <span className="sl-gh-gstat__asof">统计于 {summary.asOf}</span> : null}
      </div>
      {/* v1.6.38 单一渲染路径:骨架与数据不再各写一棵子树 —— 两棵树时 React 会
          整体替换掉 371 个格子节点(class 切换不经过 CSS 过渡,「从无到有」依旧
          是硬跳变,实测节点复用数为 0)。现在 months/grid/foot 结构、格子数、
          key 在两种状态下完全一致,React 原地改 class → 背景色渐变。
          v1.6.36:骨架与数据态等高,页面不浮动。 */}
      <div
        className="sl-gh-heat"
        role="img"
        aria-label={summary ? 'GitHub 提交热力图' : '提交热力图(占位)'}
        aria-busy={summary ? undefined : true}
      >
        <div className="sl-gh-heat__months" aria-hidden="true">
          {months.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
        <div className="sl-gh-heat__weekdays" aria-hidden="true">
          <span style={{ gridRow: '2' }}>一</span>
          <span style={{ gridRow: '4' }}>三</span>
          <span style={{ gridRow: '6' }}>五</span>
        </div>
        <div className="sl-gh-heat__grid" aria-hidden={summary ? undefined : true}>
          {heatCells.map((cell, i) => {
            // 列 = 周,行 = 周日起的第几天;扁平索引按「周优先」展开
            const wi = Math.floor(i / 7);
            const di = i % 7;
            // v1.6.40:晚于覆盖边界的格子 = 这几天有仓库仍停在快照期(数据不全)
            const partial = coverage !== null && typeof cell === 'object' && cell.date > coverage.fromKey;
            const cls =
              cell === 'ph'
                ? 'sl-gh-heat__cell is-ph'
                : cell === 'future'
                  ? 'sl-gh-heat__cell is-empty'
                  : `sl-gh-heat__cell is-l${cell.level}${partial ? ' is-partial' : ''}`;
            return (
              <span
                key={`${wi}-${di}`}
                className={cls}
                style={{ gridColumn: wi + 1, gridRow: di + 1 }}
                title={
                  typeof cell === 'object'
                    ? `${cell.date} · ${cell.count} 次提交${partial ? '(部分仓库为快照期,此数可能偏低)' : ''}`
                    : undefined
                }
              />
            );
          })}
        </div>
        <div className="sl-gh-heat__foot">
          <span className="sl-gh-heat__streaks">
            {summary ? (
              `当前连续 ${summary.currentStreak} 天 · 最长连续 ${summary.longestStreak} 天`
            ) : renewing.length > 0 ? (
              `统计中(${doneList.length}/${repos.length})…`
            ) : mayFetch ? (
              '暂无统计数据,将分批自动续期'
            ) : (
              '未统计(编辑者访问本页时自动生成)'
            )}
          </span>
          <span className="sl-gh-heat__legend">
            少
            {[0, 1, 2, 3, 4].map((l) => (
              <i key={l} className={`sl-gh-heat__cell is-l${l}`} />
            ))}
            多
          </span>
        </div>
      </div>
      {renewing.length > 0 ? (
        <div className="sl-gh-gstat__note">统计更新中(剩余 {renewing.length} 个仓库)…</div>
      ) : null}
      {/* v1.6.40 覆盖诚实化:浅纹格的量化说明 —— 把「哪几天不全、差多少」
          直接写出来,而不是让读者自己怀疑右端是不是少了提交。 */}
      {coverage ? (
        <div className="sl-gh-gstat__note sl-gh-gstat__note--partial">
          {`最近 ${coverage.days} 天仅 ${coverage.covered}/${coverage.total} 个仓库覆盖到当天,浅纹格为快照期(数值可能偏低)。`}
        </div>
      ) : null}
      {staleOkCount > 0 ? (
        <div className="sl-gh-gstat__note">
          {staleOkCount} 个仓库数据已超 24h,为上传时快照;编辑者访问本页会自动刷新。
        </div>
      ) : null}
      {failedEntries.length > 0 ? (
        <div className="sl-gh-gstat__note sl-gh-gstat__note--fails">
          {/* v1.6.35 条目化:每仓库一行(名左 · 原因右),替代揉成一行的长句 */}
          <ul className="sl-gh-gstat__fails">
            {goneList.map((e) => (
              <li key={e.full} className="sl-gh-gstat__fail is-gone">
                <i className="sl-gh-gstat__fail-dot" aria-hidden="true" />
                <span className="sl-gh-gstat__fail-repo">{e.full}</span>
                <span className="sl-gh-gstat__fail-why">{FAIL_REASON_LABEL[e.reason ?? 'unknown']},请检查链接</span>
              </li>
            ))}
            {retryList.map((e) => (
              <li key={e.full} className="sl-gh-gstat__fail is-retry">
                <i className="sl-gh-gstat__fail-dot" aria-hidden="true" />
                <span className="sl-gh-gstat__fail-repo">{e.full}</span>
                <span className="sl-gh-gstat__fail-why">{FAIL_REASON_LABEL[e.reason ?? 'unknown']}</span>
              </li>
            ))}
          </ul>
          <div className="sl-gh-gstat__fail-foot">
            <span className="sl-gh-gstat__fail-hint">
              {retryList.length > 0 && nextRetryText ? nextRetryText : retryList.length > 0 ? '失败项稍后自动重试' : ''}
              {retryList.length > 0 && goneList.length > 0 ? ' · ' : ''}
              {goneList.length > 0 ? '无效链接每 7 天复查一次' : ''}
            </span>
            {mayFetch ? (
              <button
                type="button"
                className="sl-gh-gstat__retry"
                onClick={handleRetryFailed}
                disabled={renewing.length > 0}
              >
                {renewing.length > 0 ? '重试中…' : '立即重试'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {missingCount > 0 && failedEntries.length === 0 && renewing.length === 0 && !mayFetch ? (
        <div className="sl-gh-gstat__note">{missingCount} 个仓库未统计 —— 编辑者访问本页时自动生成。</div>
      ) : null}
    </div>
  );
}
