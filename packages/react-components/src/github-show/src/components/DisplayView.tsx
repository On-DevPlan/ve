// src/components/DisplayView.tsx —— 展示视图(给面试官看)。
//
// 与编辑视图彻底分开:
//   - 统计卡:项目总数 / 已填亮点 / 已填启发 / 内容完整度
//   - ECharts:项目介绍充实度(分组柱状图)+ 亮点填写率(环形图)
//   - 只读数据库表格:链接可点击跳转,列头可排序
//   - 导出 PDF:展示内容(含图表)直接下载 .pdf(失败降级浏览器打印)
//   - v1.6.9 列宽可拖拽 + 条件填满:原始总宽不足容器时等比放大恰好填满(不出横滚);
//     总宽足够时按自然列宽渲染,超出容器 → wrap overflow-x 出横向滚动条(缩列会
//     加重重折行、行高变高,违背"保持高度不变")。拖拽始终是相邻两列的零和再分配:
//     压缩某列,旁边一列等量拉伸,总宽不变。松手 onCommit 写回 doc.widths。
// 渲染规则:文本列含 http 自动渲染链接;多选列渲染为标签;产出为可选文本列。

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  BUILTIN_COLUMN_IDS,
  type GithubShowDoc,
} from '@api/components/github-show/types';
import { useECharts } from '../hooks/useECharts';
import { useColumnResize } from '../hooks/useColumnResize';
import { computeStats, contentChartData } from '../engine/stats';
import { buildPrintHtml, buildPrintParts } from '../engine/printDoc';
import { exportPdf } from '../engine/exportPdf';
import { printHtml } from '../engine/print';
import { formatAmount, sumNumberColumn } from '../utils/format';
import { deriveRepoName, displayLinkText, splitTextWithLinks, toHref } from '../utils/repo';
import { parseTags } from '../utils/tags';
import PaginationBar from './PaginationBar';
import CommitStats from './CommitStats';

export interface DisplayViewProps {
  doc: GithubShowDoc;
  onGoEdit: () => void;
  /** 列宽持久化(v1.5.0)。无值时该列由 table-layout 自动分配。 */
  widths: Record<string, number>;
  /** 公开分享模式(readOnly)下不可调列宽 */
  readOnly?: boolean;
  /** 公开分享参数(?groupId=&key=);null = 编辑自己的文档。提交统计用它决定 KV 读法与续期资格 */
  publicParams?: { key: string; groupId: number } | null;
  /** 列宽变更回调(松手后调用一次) */
  onSetColumnWidth?: (colId: string, widthPx: number) => void;
}

type SortKey = 'order' | 'name' | 'highlights' | 'insights' | string;

interface SortState {
  key: SortKey;
  dir: 1 | -1;
}

// 墨线色板(v1.6.32):全页只有黑白灰 + 4 处绿 ——
//   主序列用绿(唯一强调),次序列转中性灰(原柠黄点缀已移除),
//   环形图主体走墨色(与设计稿「墨线·列格」一致),网格/空档用冷灰。
const PRIMARY = '#177F37';
const SECONDARY = '#B9BFC7';
const MUTED = '#EEF0F3';
const INK = '#111214';

/** 列最小渲染宽(px),与 useColumnResize 的 minWidth 一致 */
const MIN_COL_W = 80;

/** 数字列比较:按数值大小;空值视为 0(未填排前)。 */
function compareNumber(a: string, b: string): number {
  const an = a.trim() === '' ? 0 : Number(a);
  const bn = b.trim() === '' ? 0 : Number(b);
  if (Number.isNaN(an) && Number.isNaN(bn)) return 0;
  if (Number.isNaN(an)) return 1;
  if (Number.isNaN(bn)) return -1;
  return an - bn;
}

function sortRows(doc: GithubShowDoc, sort: SortState): typeof doc.rows {
  if (sort.key === 'order') return doc.rows;
  const dir = sort.dir;
  const col = doc.columns.find((c) => c.id === sort.key);
  return [...doc.rows].sort((a, b) => {
    if (sort.key === 'name') return a.name.localeCompare(b.name, 'zh') * dir;
    if (sort.key === 'highlights' || sort.key === 'insights') {
      const av = a[sort.key].length;
      const bv = b[sort.key].length;
      return (av - bv) * dir || a.name.localeCompare(b.name, 'zh');
    }
    // 自定义列:数字列按数值,文本/多选列按字符串
    if (col) {
      const av = a.values[col.id] ?? '';
      const bv = b.values[col.id] ?? '';
      const cmp = col.type === 'number' ? compareNumber(av, bv) : av.localeCompare(bv, 'zh');
      return cmp * dir || a.name.localeCompare(b.name, 'zh');
    }
    return 0;
  });
}

function RepoLink({ url, name }: { url: string; name: string }) {
  const href = toHref(url);
  const text = name.trim() || deriveRepoName(url) || displayLinkText(url);
  if (!href) return <span className="sl-gh-dim">{text || '—'}</span>;
  return (
    <a className="sl-gh-dlink" href={href} target="_blank" rel="noreferrer" title={url}>
      {text}
    </a>
  );
}

/** 文本渲染:含 http(s) 自动切成可点击链接,其余保留原文(支持说明文字)。 */
function RichText({ value }: { value: string }) {
  const parts = splitTextWithLinks(value);
  if (parts.length === 0) return <span className="sl-gh-dim">—</span>;
  return (
    <>
      {parts.map((p, i) =>
        p.url ? (
          <a
            key={i}
            className="sl-gh-dlink"
            href={toHref(p.url)}
            target="_blank"
            rel="noreferrer"
            title={p.url}
          >
            {displayLinkText(p.url)}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** 多选渲染:解析 JSON 数组并渲染为标签。 */
function TagList({ value }: { value: string }) {
  const tags = parseTags(value);
  if (tags.length === 0) return <span className="sl-gh-dim">—</span>;
  return (
    <span className="sl-gh-dtags">
      {tags.map((t) => (
        <span className="sl-gh-dtag" key={t}>
          {t}
        </span>
      ))}
    </span>
  );
}

// 列宽规格节点表:<col> 元素按 colId 索引。
// 为什么拖拽写 <col> 而不是 th:table-layout: fixed 下 col.style.width 直接、立即、
// 唯一决定整列宽度,th/td 必须跟随;改 th.width 会被 thead sticky + 浏览器列宽
// 缓存牵制,观感不可靠(实测)。
type ColRefMap = Record<string, HTMLTableColElement | null>;


export default function DisplayView(props: DisplayViewProps) {
  // readOnly 解构略过:v1.6.6 起公开分享模式(readOnly)也开放拖拽(会话级宽度),
  // 组件内不再读这个 prop;字段留在 props 接口里以免调用方(index.tsx)改动
  const { doc, onGoEdit, widths, onSetColumnWidth, publicParams } = props;
  const [sort, setSort] = useState<SortState>({ key: 'order', dir: 1 });
  const [exporting, setExporting] = useState(false);
  // ── 工具栏 tab(v1.6.3):表格(只读数据库表)/ 图表(统计卡 + ECharts),LS 记忆;
  //    v1.6.22 默认表格(用户偏好:表格优先,图表次之) ──
  const [tab, setTab] = useState<'chart' | 'table'>(() => {
    try {
      return localStorage.getItem('sl-github-show:display-tab') === 'chart' ? 'chart' : 'table';
    } catch {
      return 'table';
    }
  });
  function switchTab(next: 'chart' | 'table') {
    setTab(next);
    try {
      localStorage.setItem('sl-github-show:display-tab', next);
    } catch {
      /* 忽略:隐私模式等场景 */
    }
  }

  // ── 分页(v1.6.0):展示视图内部持有(无外部加行入口)──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const stats = useMemo(() => computeStats(doc), [doc]);
  const chartData = useMemo(() => contentChartData(doc, 12), [doc]);
  // 展示页只渲染 hiddenInDisplay=false 的自定义列(编辑页始终显示全部列)
  const visibleColumns = useMemo(() => doc.columns.filter((c) => !c.hiddenInDisplay), [doc.columns]);
  const sortedRows = useMemo(() => sortRows(doc, sort), [doc, sort]);

  // 分页派生:排序/过滤后的全量行上切片;合计行也算全量(非当前页)
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);
  const pageRows = useMemo(
    () => sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sortedRows, safePage, pageSize],
  );
  const numberColumns = useMemo(() => visibleColumns.filter((c) => c.type === 'number'), [visibleColumns]);
  const hasSumFooter = numberColumns.length > 0;
  const colSums = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of numberColumns) m[c.id] = sumNumberColumn(sortedRows, c.id);
    return m;
  }, [numberColumns, sortedRows]);

  // ── v1.6.10 弹性末列 + 单列独立拖拽 ─────────────────────────────────────
  // 需求:表格永远铺满容器(100%),拖某列只改该列,列宽总和超出容器时由
  // wrap overflow-x 出横向滚动条。
  //
  // 为什么不能沿用"等比放大所有列"或"相邻列零和再分配":
  //   - 等比放大:余量按比例摊给每一列,松手重渲后所有列一起变,拖到的位置不保真;
  //   - 零和再分配:col[i] + col[i+1] 的总和恒定 ⇒ 总宽永远不变
  //     ⇒ 永远拖不出横向滚动条(与需求直接冲突)。
  // 根因:总宽 ≤ 容器时"铺满"要求余量有明确归属方,而"只动被拖列"要求其他列
  // 不动 —— 两者在数学上互斥,必须指定一方吸收。
  //
  // 落地模型 —— 余量全部交给"弹性列"(最后一个可拖列):
  //   - 弹性列的 <col> 不写 width,fixed 布局下自动吸收剩余空间 ⇒ 表格铺满;
  //   - 其余列写死宽度,拖拽只写自己那一个 col.style.width,别的列纹丝不动;
  //   - 固定列总和 ≥ 容器宽时弹性列被压到下限,表格总宽溢出 wrap,
  //     由 .sl-gh-dtable-wrap 的 overflow-x:auto 出横向滚动条;
  //   - 弹性列宽度是"剩下的",没有可再分配对象,因此不挂拖拽手柄。
  // commit 直接把渲染宽(px)写回 store:单列独立 ⇒ 不需要任何反缩放。

  // 会话级宽度覆盖(v1.6.6):公开模式 commit 不落盘,但切 tab 会卸载重挂表格 ——
  // 若不给列"记忆",切回来宽度会回到作者原始值,体验断裂。
  // 用 state 而非 ref:commit 后要触发重渲,列宽才能落到 <col> 上。
  const [sessionWidths, setSessionWidths] = useState<Record<string, number>>({});

  // 各列宽度(直接就是渲染宽,不再有 fit 缩放层):会话覆盖 > 持久化 > 默认
  const colWidths = useMemo(() => {
    const defaults: Record<string, number> = {
      [BUILTIN_COLUMN_IDS.repoUrl]: 280,
      [BUILTIN_COLUMN_IDS.name]: 170,
      [BUILTIN_COLUMN_IDS.highlights]: 240,
      [BUILTIN_COLUMN_IDS.insights]: 240,
      [BUILTIN_COLUMN_IDS.output]: 160,
    };
    const ids = [
      BUILTIN_COLUMN_IDS.repoUrl,
      BUILTIN_COLUMN_IDS.name,
      BUILTIN_COLUMN_IDS.highlights,
      BUILTIN_COLUMN_IDS.insights,
      BUILTIN_COLUMN_IDS.output,
      ...visibleColumns.map((c) => c.id),
    ];
    const out: Record<string, number> = {};
    for (const id of ids) {
      out[id] = sessionWidths[id] ?? widths[id] ?? defaults[id] ?? 160;
    }
    return out;
  }, [widths, sessionWidths, visibleColumns]);

  // 拖拽/commit 回调里读最新列宽(渲染期同步,回调不进 deps,避免反复重挂)
  const widthsRef = useRef(colWidths);
  widthsRef.current = colWidths;

  // v1.6.5 列宽拖拽(colgroup 方案):
  //   - colRefs 写列规格(col.style.width),applyLive/onCommit 都走它
  //   - thRefs 仅保留测量起点(readWidth 需要实际渲染宽度,col 的 rect 恒为 0 不可用)
  const tableRef = useRef<HTMLTableElement | null>(null);
  const colRefs = useRef<ColRefMap>({});
  const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const setColRef = useCallback((colId: string, el: HTMLTableColElement | null) => {
    colRefs.current[colId] = el;
  }, []);
  const setThRef = useCallback((colId: string, el: HTMLTableCellElement | null) => {
    thRefs.current[colId] = el;
  }, []);

  const readCurrentWidth = useCallback(
    (colId: string, fallback: number) => {
      // 实际渲染宽优先(th 有盒模型;col 无盒模型 rect 恒 0 不可用)
      const th = thRefs.current[colId];
      if (th) {
        const rect = th.getBoundingClientRect();
        if (rect.width > 0) return rect.width;
      }
      return widthsRef.current[colId] ?? fallback;
    },
    [],
  );

  // 拖拽可用条件:公开分享模式(readOnly)也允许拖 —— 不能写作者的 KV,但拖拽仅改
  // 本会话的视觉宽度(sessionWidths 保住"切 tab 回来仍在"的观感);刷新才恢复作者宽度。
  const resizeEnabled = true;
  const { bind } = useColumnResize({
    tableRef,
    // 拖拽起点 = 该列当前渲染宽(避免起点跳变)
    readWidth: (colId) => readCurrentWidth(colId, 0),
    onCommit: (colId, w) => {
      // 单列独立:只把被拖列自己的渲染宽写回。弹性列是"剩下的",不参与。
      const px = Math.max(MIN_COL_W, Math.round(w));
      setSessionWidths((prev) => ({ ...prev, [colId]: px }));
      // 正常模式走 store 持久化(内部 debounce save);公开模式内部守卫 no-op
      if (onSetColumnWidth) onSetColumnWidth(colId, px);
    },
    enabled: resizeEnabled,
    minWidth: MIN_COL_W,
    // 只写被拖列自己的 <col>:fixed 布局下其余列纹丝不动,弹性列自动让出/收回
    // 被拖列增减的空间 —— 总宽始终 = 容器宽;直到固定列总和顶满容器,此后
    // 表格溢出 wrap,由 wrap 的 overflow-x:auto 出横向滚动条。
    // 键盘 Arrow 步进走同一条 applyLive + onCommit。
    applyLive: (colId, w) => {
      const col = colRefs.current[colId];
      if (!col) return;
      col.style.width = `${Math.max(MIN_COL_W, Math.round(w))}px`;
    },
  });

  // 拖拽过程中 scrollbar-width 暂时被压缩,document.body.classList 加 is-dragging 时,
  // CSS 已对 table.is-dragging 设 user-select:none + cursor:col-resize。
  // 但展示页的 table 不带 is-dragging class(它在 wrap 上?实际 hook 写的是 tableRef.current.classList),
  // 这里 tableRef 就是 <table>,classList 加在它上面,CSS 选择器是 .sl-gh-table.is-dragging,
  // 而展示页表类是 .sl-gh-dtable —— 拖拽期间 user-select 不会自动屏蔽。
  // 解决:在 hook 里同时给 document.body 加 is-dragging class(已有),body CSS 全局选 no-select:
  // 见 index.css 的 .sl-gh-table.is-dragging, 我们需要补 body.is-dragging(全局)。
  // 这里不在 DisplayView 处理,统一改 CSS(下面 index.css 调整)。

  // 拖拽期间锁滚动条?不需要 —— 拖的是横向,scroll 容器是 .sl-gh-dtable-wrap,用户能看到
  // 横向滚动条(细),不影响 drag。

  // ── v1.6.15 自绘横向滚动条 ─────────────────────────────────────────────
  // 为什么不用 ::-webkit-scrollbar:新版 Chrome(Win11 Fluent 滚动条)会忽略
  // webkit 伪元素 —— 滚动条退化为 overlay,不占布局、不滚动不显示
  // (实测 offsetHeight-clientHeight=2px,只剩边框;--headless 才画自定义条,
  // 真机永远隐形)。「表格比视口高 + 滚动条在屏幕外」+「overlay 隐形」
  // = 用户拖宽列后找不到任何横向滚动入口。DOM 自绘与渲染环境无关,常显。
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [hscroll, setHscroll] = useState({ overflow: false, thumbW: 0, thumbX: 0 });
  const syncHscroll = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    if (scrollWidth <= clientWidth + 1) {
      setHscroll((prev) => (prev.overflow ? { ...prev, overflow: false } : prev));
      return;
    }
    // 轨道宽优先取自绘轨道自身(经典模式下 wrap 里有 12px 纵向原生条,
    // wrap.clientWidth 会比轨道窄出一条,直接用会把 thumb 推出轨道右缘)
    const trackW = trackRef.current?.clientWidth ?? el.clientWidth;
    const thumbW = Math.max(32, Math.round((clientWidth / scrollWidth) * trackW));
    const maxScroll = scrollWidth - clientWidth;
    const slide = trackW - thumbW;
    const thumbX = maxScroll > 0 && slide > 0 ? Math.round((scrollLeft / maxScroll) * slide) : 0;
    setHscroll({ overflow: true, thumbW, thumbX });
  }, []);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    syncHscroll();
    // jsdom 无 ResizeObserver;浏览器里监听 wrap 与表格尺寸变化(列宽拖拽/切页/排序)
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(syncHscroll);
    ro.observe(el);
    const table = el.querySelector('table');
    if (table) ro.observe(table);
    return () => ro.disconnect();
  }, [syncHscroll, tab, pageRows, colWidths]);

  // thumb 拖拽:pointer capture 全程跟踪;轨道空白处点击 = thumb 中心跳到点击位置
  const hscrollDrag = useRef<{ startX: number; startScroll: number } | null>(null);
  function onThumbPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const el = wrapRef.current;
    if (!el) return;
    hscrollDrag.current = { startX: e.clientX, startScroll: el.scrollLeft };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onThumbPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const el = wrapRef.current;
    const st = hscrollDrag.current;
    if (!el || !st) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const slide = (trackRef.current?.clientWidth ?? el.clientWidth) - hscroll.thumbW;
    if (maxScroll <= 0 || slide <= 0) return;
    el.scrollLeft = st.startScroll + ((e.clientX - st.startX) / slide) * maxScroll;
  }
  function onThumbPointerUp() {
    hscrollDrag.current = null;
  }
  function onTrackPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // thumb 的 pointerdown 已 stopPropagation,走到这里的一定是轨道空白
    const el = wrapRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const maxScroll = el.scrollWidth - el.clientWidth;
    const slide = e.currentTarget.clientWidth - hscroll.thumbW;
    if (maxScroll <= 0 || slide <= 0) return;
    const want = Math.min(Math.max(e.clientX - rect.left - hscroll.thumbW / 2, 0), slide);
    el.scrollLeft = (want / slide) * maxScroll;
  }

  useEffect(() => {
    // 组件卸载时清 ref map(inline style 随 DOM 一起销毁,无需手动清)
    return () => {
      colRefs.current = {};
      thRefs.current = {};
    };
  }, []);

  const barOption = useMemo(
    () =>
      chartData.length === 0
        ? null
        : {
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { data: ['亮点', '启发'], top: 0, itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 11 } },
            grid: { left: 8, right: 12, top: 34, bottom: 8, containLabel: true },
            xAxis: {
              type: 'category' as const,
              data: chartData.map((d) => d.name),
              axisLabel: {
                interval: 0,
                rotate: chartData.length > 6 ? 32 : 0,
                fontSize: 10,
                width: 88,
                overflow: 'truncate',
              },
              axisTick: { show: false },
            },
            yAxis: { type: 'value' as const, name: '字符数', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
            series: [
              { name: '亮点', type: 'bar' as const, data: chartData.map((d) => d.highlightsChars), itemStyle: { color: PRIMARY, borderRadius: [0, 0, 0, 0] }, barMaxWidth: 16 },
              { name: '启发', type: 'bar' as const, data: chartData.map((d) => d.insightsChars), itemStyle: { color: SECONDARY, borderRadius: [0, 0, 0, 0] }, barMaxWidth: 16 },
            ],
          },
    [chartData],
  );

  const pieOption = useMemo(
    () =>
      stats.total === 0
        ? null
        : {
            tooltip: { trigger: 'item' as const, formatter: '{b}: {c} 个 ({d}%)' },
            legend: { bottom: 0, itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 11 } },
            series: [
              {
                name: '亮点填写',
                type: 'pie' as const,
                radius: ['50%', '72%'],
                center: ['50%', '44%'],
                label: { show: false },
                data: [
                  { name: '已填亮点', value: stats.highlightsFilled, itemStyle: { color: INK } },
                  { name: '未填亮点', value: stats.total - stats.highlightsFilled, itemStyle: { color: MUTED } },
                ],
              },
            ],
          },
    [stats],
  );

  const { containerRef: barRef, chartRef: barChartRef } = useECharts(barOption);
  const { containerRef: pieRef } = useECharts(pieOption);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: 1 },
    );
    // 排序变更 → 回第 1 页(顺序全变,停留原页无意义)
    setPage(1);
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      let chartDataUrl: string | null = null;
      try {
        if (barChartRef.current) {
          chartDataUrl = barChartRef.current.getDataURL({
            type: 'png',
            pixelRatio: 2,
            backgroundColor: '#ffffff',
          });
        }
      } catch {
        chartDataUrl = null; // 图表异常不阻塞导出
      }
      const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false });
      const fileName = `github-show-${new Date().toISOString().slice(0, 10)}.pdf`;
      const parts = buildPrintParts({ doc, chartDataUrl, generatedAt });
      const downloaded = await exportPdf(parts, fileName);
      if (!downloaded) {
        // 下载失败(依赖加载/截图异常)→ 降级浏览器打印
        await printHtml(buildPrintHtml({ doc, chartDataUrl, generatedAt }));
      }
    } finally {
      setExporting(false);
    }
  }

  if (doc.rows.length === 0) {
    return (
      <div className="sl-gh-display">
        <div className="sl-gh-empty">
          <h2 className="sl-gh-empty__title">还没有可展示的项目</h2>
          <p className="sl-gh-empty__desc">
            切到编辑视图,添加项目并填写亮点与启发,展示页会自动生成统计图表与 PDF 导出。
          </p>
          <div className="sl-gh-empty__actions">
            <button type="button" className="sl-gh-btn sl-gh-btn--primary" onClick={onGoEdit}>
              去编辑
            </button>
          </div>
        </div>
      </div>
    );
  }

  const percent = Math.round(stats.contentRate * 100);

  /**
   * 列定义。v1.6.10 宽度策略:
   *   - 弹性列(最后一个可拖列)不写 width:<col> 缺 width,fixed 布局自动吸收
   *     剩余空间 ⇒ 表格始终铺满容器;固定列总和顶满容器后它被压到下限,表格
   *     总宽溢出 wrap,由 wrap overflow-x 出横向滚动条。
   *   - 其余列写死渲染宽,拖拽只改自己那一列(fixed 布局下互不牵连)。
   *   - resizable 与 sortable 解耦:GitHub 链接/产出不可排序但可拖宽;
   *     弹性列不挂手柄(宽度是"剩下的",没有可再分配对象)。
   */
  const headCols: Array<{
    colId: string;
    label: string;
    width?: number;
    sortKey?: SortKey; // 缺省 = 该列不可排序(渲染纯文本表头)
    resizable: boolean;
  }> = [
    { colId: BUILTIN_COLUMN_IDS.repoUrl, label: 'GitHub 链接', width: colWidths[BUILTIN_COLUMN_IDS.repoUrl] ?? 280, resizable: true },
    { colId: BUILTIN_COLUMN_IDS.name, label: '项目名', width: colWidths[BUILTIN_COLUMN_IDS.name] ?? 170, sortKey: 'name', resizable: true },
    { colId: BUILTIN_COLUMN_IDS.highlights, label: '亮点', width: colWidths[BUILTIN_COLUMN_IDS.highlights] ?? 240, sortKey: 'highlights', resizable: true },
    { colId: BUILTIN_COLUMN_IDS.insights, label: '启发', width: colWidths[BUILTIN_COLUMN_IDS.insights] ?? 240, sortKey: 'insights', resizable: true },
    { colId: BUILTIN_COLUMN_IDS.output, label: '产出', width: colWidths[BUILTIN_COLUMN_IDS.output] ?? 160, resizable: true },
    ...visibleColumns.map((c) => ({ colId: c.id, label: c.title, width: colWidths[c.id] ?? 160, sortKey: c.id as SortKey, resizable: true })),
  ];
  // 弹性列 = 最后一个可拖列:有自定义列时是最后一个自定义列,否则是「产出」。
  // 它不写宽度、不挂手柄,余量全由它吸收。
  const flexColId = headCols[headCols.length - 1]?.colId;
  // 固定列宽总和 → 交给 CSS 的 --sl-gh-fixed-sum。表格 min-width 取
  // max(100%, fixed-sum + 弹性列下限 80px):fixed 布局下无宽度的 col 会被容器
  // 压到 0(内容消失且溢出量近乎为 0,拉不出滚动条),这条下限保证容器不足时
  // 弹性列仍有 80px,表格老老实实溢出、由 wrap 出横向滚动条。
  const fixedSum = headCols.reduce(
    (acc, h) => acc + (h.colId === flexColId ? 0 : h.width ?? 0),
    0,
  );

  return (
    <div className="sl-gh-display">
      <div className="sl-gh-dtoolbar">
        <div className="sl-gh-viewswitch" role="tablist" aria-label="展示视图切换">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'table'}
            className={`sl-gh-viewswitch__btn${tab === 'table' ? ' is-active' : ''}`}
            onClick={() => switchTab('table')}
          >
            表格
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'chart'}
            className={`sl-gh-viewswitch__btn${tab === 'chart' ? ' is-active' : ''}`}
            onClick={() => switchTab('chart')}
          >
            图表
          </button>
        </div>
        {/* v1.6.43:导出 PDF 从主按钮降为次级墨线按钮 —— 展示页的绿留给
            数据本身(项目总数 / 热力图 / 图表主序列),工具栏不再抢视线。 */}
        <button
          type="button"
          className="sl-gh-btn"
          onClick={() => void handleExport()}
          disabled={exporting}
        >
          {exporting ? '正在导出…' : '导出 PDF'}
        </button>
      </div>

      {tab === 'chart' ? (
        <>
          <div className="sl-gh-dstats">
            <div className="sl-gh-dstat">
              <b>{stats.total}</b>
              <span>项目总数</span>
            </div>
            <div className="sl-gh-dstat">
              <b>{stats.highlightsFilled}</b>
              <span>已填亮点</span>
            </div>
            <div className="sl-gh-dstat">
              <b>{stats.insightsFilled}</b>
              <span>已填启发</span>
            </div>
            <div className="sl-gh-dstat">
              <b>{percent}%</b>
              <span>内容完整度</span>
            </div>
          </div>

          <div className="sl-gh-dcharts">
            <div className="sl-gh-dchart">
              <div className="sl-gh-dchart__title">项目介绍充实度</div>
              <div className="sl-gh-dchart__canvas" ref={barRef} aria-label="项目介绍充实度柱状图" />
            </div>
            <div className="sl-gh-dchart">
              <div className="sl-gh-dchart__title">亮点填写率</div>
              <div className="sl-gh-dchart__canvas" ref={pieRef} aria-label="亮点填写率环形图" />
            </div>
          </div>

          {/* v1.6.19 提交统计表(图表 tab 底部);v1.6.20 数据改走 KV 快照 */}
          <CommitStats doc={doc} publicParams={publicParams ?? null} />
        </>
      ) : (
        <>
          {/* v1.6.19 提交统计表(表格 tab 顶部) */}
          <CommitStats doc={doc} publicParams={publicParams ?? null} />
          <div className="sl-gh-dtable-wrap" ref={wrapRef} onScroll={syncHscroll}>
        <table
          className="sl-gh-dtable"
          aria-label="项目展示"
          ref={tableRef}
          style={{ '--sl-gh-fixed-sum': `${fixedSum}px` } as CSSProperties}
        >
          {/* colgroup 是列宽的唯一规格源(v1.6.5):table-layout: fixed 下
              col.width 直接决定整列宽度;拖拽 applyLive 改 col inline,
              commit 后 React props(colWidths)接管重渲。
              v1.6.10:弹性列(flexColId)是唯一不写 width 的 col —— fixed 布局
              把剩余空间全给它,这就是"表格铺满容器"的实现;固定列总和顶满容器
              后它被压到 0,表格总宽溢出 wrap,由 wrap 出横向滚动条。 */}
          <colgroup>
            {headCols.map((h) => (
              <col
                key={h.colId}
                ref={(el) => setColRef(h.colId, el)}
                style={h.width != null && h.colId !== flexColId ? { width: h.width } : undefined}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {headCols.map((h) => {
                const labelEl = h.sortKey ? (
                  <button type="button" className="sl-gh-dsort" onClick={() => toggleSort(h.sortKey as SortKey)}>
                    {h.label}
                    {sort.key === h.sortKey && sort.key !== 'order' && (
                      <span className="sl-gh-dsort__arrow">{sort.dir === 1 ? '↑' : '↓'}</span>
                    )}
                  </button>
                ) : (
                  h.label
                );
                // 手柄条件:全局可用 + 该列可拖 + 非弹性列。弹性列宽度是"剩下的",
                // 拖它没有语义 —— 要调它,拖它左边那列(左列变宽,弹性列自动变窄)。
                const canResize = resizeEnabled && h.resizable && h.colId !== flexColId;
                const cur = readCurrentWidth(h.colId, h.width ?? 160);
                return (
                  <th
                    key={h.colId}
                    ref={(el) => setThRef(h.colId, el)}
                    aria-sort={h.sortKey && sort.key === h.sortKey && sort.key !== 'order'
                      ? (sort.dir === 1 ? 'ascending' : 'descending')
                      : 'none'}
                  >
                    {labelEl}
                    {canResize && (
                      <div
                        className="sl-gh-dresizer"
                        data-col-id={h.colId}
                        {...bind(h.colId, cur, h.label)}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="sl-gh-dcell">
                    <RepoLink url={row.repoUrl} name="" />
                  </div>
                </td>
                <td className="sl-gh-dname">
                  <div className="sl-gh-dcell">{row.name || '—'}</div>
                </td>
                <td className="sl-gh-dtext">
                  <div className="sl-gh-dcell">{row.highlights || <span className="sl-gh-dim">—</span>}</div>
                </td>
                <td className="sl-gh-dtext">
                  <div className="sl-gh-dcell">{row.insights || <span className="sl-gh-dim">—</span>}</div>
                </td>
                <td>
                  <div className="sl-gh-dcell">
                    {row.output ? <RichText value={row.output} /> : <span className="sl-gh-dim">—</span>}
                  </div>
                </td>
                {visibleColumns.map((c) => {
                  const v = row.values[c.id] ?? '';
                  if (c.type === 'number') {
                    return (
                      <td key={c.id} className="sl-gh-dnum">
                        <div className="sl-gh-dcell">{v.trim() !== '' ? v : <span className="sl-gh-dim">—</span>}</div>
                      </td>
                    );
                  }
                  return (
                    <td key={c.id} className="sl-gh-dtext">
                      <div className="sl-gh-dcell">
                        {c.type === 'multi-select' ? (
                          <TagList value={v} />
                        ) : v ? (
                          <RichText value={v} />
                        ) : (
                          <span className="sl-gh-dim">—</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {hasSumFooter && (
            <tfoot>
              <tr aria-label="合计">
                <td>合计</td>
                <td />
                <td />
                <td />
                <td />
                {visibleColumns.map((c) => (
                  <td key={c.id} className={c.type === 'number' ? 'sl-gh-dnum is-sum' : undefined}>
                    {c.type === 'number' ? formatAmount(colSums[c.id] ?? 0) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 自绘横向滚动条(v1.6.15):仅在总宽溢出时渲染,轨道点击/拇指拖拽双向同步 */}
      {hscroll.overflow && (
        <div className="sl-gh-dhscroll" ref={trackRef} onPointerDown={onTrackPointerDown}>
          <div
            className="sl-gh-dhscroll__thumb"
            style={{ left: hscroll.thumbX, width: hscroll.thumbW }}
            onPointerDown={onThumbPointerDown}
            onPointerMove={onThumbPointerMove}
            onPointerUp={onThumbPointerUp}
          />
        </div>
      )}

      <PaginationBar
        total={sortedRows.length}
        page={safePage}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      />
        </>
      )}
    </div>
  );
}
