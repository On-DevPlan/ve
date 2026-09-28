// src/components/GithubShowTable.tsx —— 编辑视图的数据库表格本体。
//
// 列:GitHub 链接 | 项目名 | 亮点 | 启发 | 产出(可选文本列) | 自定义列 | 操作
// - 链接列(GitHub)用 LinkCell:合法即点击跳转,可编辑
// - 产出是可选文本列:可写解释文字,含 http 自动可点,可修改可清空
// - 自定义列:text 用自动撑高 textarea(含 http 渲染在展示/导出);multi-select 用 chip 编辑器
// - 操作列:上移 / 下移调整项目顺序(随保存自动同步);删除行走两步确认
// - v1.5.0 列宽可拖拽:每个表头(末列 ops 除外)右侧 6px 透明 hover 区;
//   useColumnResize 把拖拽转成 CSS 变量 `--sl-gh-col-w-<id>`,松手通过 onCommit 写回 store
// - v1.6.30 行拖拽:URL 格左缘 hover 显出抓手(行是 display:contents 无盒子,
//   抓手必须挂在真实 cell 上);指针拖拽实时高亮插入位置,松手走 onMoveRowTo
//   (按目标行上/下沿换算最终下标);触屏可拖(touch-action:none),内滚容器边缘自动滚动。
// 样式统一 sl-gh- 前缀 + --sl-* token。

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import {
  BUILTIN_COLUMN_IDS,
  type GithubShowColumn,
  type GithubShowRow,
} from '@api/components/github-show/types';
import { useColumnResize } from '../hooks/useColumnResize';
import { formatAmount, sumNumberColumn } from '../utils/format';
import { deriveRepoName, displayLinkText } from '../utils/repo';
import LinkCell from './LinkCell';
import MultiSelectCell from './MultiSelectCell';
import NumberCell from './NumberCell';
import PaginationBar from './PaginationBar';

export interface GithubShowTableProps {
  rows: GithubShowRow[];
  columns: GithubShowColumn[];
  /** 添加后需要聚焦的行的 id(新行链接输入框自动聚焦) */
  focusRowId: string | null;
  /** 持久化的列宽像素 —— key = 列稳定 id(BUILTIN_COLUMN_IDS.* 或 c.id) */
  widths: Record<string, number>;
  /** true = 公开分享模式,隐藏拖拽手柄,不可调宽度 */
  readOnly: boolean;
  /** 列宽变更回调(松手后调用一次) */
  onSetColumnWidth: (colId: string, widthPx: number) => void;
  onAddRow: () => void;
  onUpdateRow: (
    id: string,
    patch: Partial<Pick<GithubShowRow, 'repoUrl' | 'name' | 'highlights' | 'insights' | 'output'>>,
  ) => void;
  onDeleteRow: (id: string) => void;
  /** 调整行顺序:dir = -1 上移,1 下移(与相邻行交换,随保存自动同步) */
  onMoveRow: (id: string, dir: -1 | 1) => void;
  onSetCellValue: (rowId: string, colId: string, value: string) => void;
  // ── 分页状态由父级持有(v1.6.0):顶栏「添加项目」加行后也要跳到末页 ──
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/** 自动撑高 textarea:内容变长时高度跟随,超出不出现滚动条。 */
function AutoTextarea({
  value,
  placeholder,
  ariaLabel,
  onChange,
}: {
  value: string;
  placeholder?: string;
  ariaLabel?: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  };

  useEffect(() => {
    resize();
  }, [value]);

  useEffect(() => {
    resize();
  }, []);

  return (
    <textarea
      ref={ref}
      className="sl-gh-textarea"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** 弹性列下限(px):与展示表格弹性列的 minmax 下限保持同一刻度。 */
const FLEX_COL_MIN_W = 80;

/**
 * 拼接 grid-template-columns 字符串(v1.6.10 弹性末列 + 单列独立拖拽):
 *   - 弹性列 = 最后一个可拖列(有自定义列时是最后一个自定义列,否则是「产出」),
 *     用 minmax(80px, 1fr):容器有余量时它全部吸收 ⇒ 表格铺满 100%(旧版全固定宽,
 *     宽屏下右侧会留一大块白);固定列总和顶满容器后它收到 80px 下限,表格总宽
 *     溢出 .sl-gh-table(overflow-x:auto)出细横向滚动条。
 *   - 其余列固定宽度:拖 A 列只有 A 动,弹性列被动让出/收回差额。
 *   - 弹性列不挂拖拽手柄 —— 它的宽度是"剩下的",拖它没有语义。
 *   - 旧版亮点/启发用 minmax(80px,1fr) 自适应、拖其它列时它们被挤压 —— 已废弃。
 *
 * CSS Grid 不支持 `repeat()` over distinct var names(每列 var 不同名),只能 JSX 拼。
 */
function buildGridTemplate(columns: GithubShowColumn[]): string {
  const flex = `minmax(${FLEX_COL_MIN_W}px, 1fr)`;
  const custom = columns
    .map((c, i) => (i === columns.length - 1 ? flex : `var(--sl-gh-col-w-${c.id}, 160px)`))
    .join(' ');
  // 没有自定义列时,「产出」是最后一个可拖列,由它承担弹性
  const output = columns.length === 0 ? flex : 'var(--sl-gh-col-w-__builtin_output, 160px)';
  return [
    'var(--sl-gh-col-w-__builtin_repoUrl, 300px)',
    'var(--sl-gh-col-w-__builtin_name, 170px)',
    'var(--sl-gh-col-w-__builtin_highlights, 280px)',
    'var(--sl-gh-col-w-__builtin_insights, 280px)',
    output,
    custom,
    '44px',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * 把持久化 widths 翻译成 CSS 变量写到 root.style。
 * 内建列(含 highlights/insights,与固定宽度策略一致)+ 自定义列各一条变量。
 * 注意:弹性列的那条变量写了也没人读 —— buildGridTemplate 给它的 track 是
 * minmax(80px, 1fr),不再引用 --sl-gh-col-w-*。留着无害(历史值仍有记录)。
 */
function widthsToCssVars(
  widths: Record<string, number>,
): Record<string, string> {
  const vars: Record<string, string> = {};
  const builtinPairs: Array<[string, number]> = [
    BUILTIN_COLUMN_IDS.repoUrl,
    BUILTIN_COLUMN_IDS.name,
    BUILTIN_COLUMN_IDS.highlights,
    BUILTIN_COLUMN_IDS.insights,
    BUILTIN_COLUMN_IDS.output,
  ].map((id) => [id, widths[id]]);
  for (const [id, val] of builtinPairs) {
    if (typeof val === 'number' && val > 0) vars[`--sl-gh-col-w-${id}`] = `${val}px`;
  }
  for (const [id, val] of Object.entries(widths)) {
    if (Object.values(BUILTIN_COLUMN_IDS).includes(id as never)) continue;
    if (typeof val === 'number' && val > 0) vars[`--sl-gh-col-w-${id}`] = `${val}px`;
  }
  return vars;
}

function GithubShowTable({
  rows,
  columns,
  focusRowId,
  widths,
  readOnly,
  onSetColumnWidth,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onMoveRow,
  onMoveRowTo,
  onSetCellValue,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: GithubShowTableProps) {
  // 两步删除:× → ?(变红)→ 再点 → 真删;失焦自动取消
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── 行拖拽(v1.6.30)──
  // 行是 display:contents(无盒子),拖拽抓手挂在 URL cell 左缘,pointer 事件全走抓手
  // (setPointerCapture 保证移出元素仍收 move)。实时态同时进 ref(move 里读最新值,
  // 避免闭包过期)和 state(驱动 is-dragging / is-over-* 指示线渲染)。
  type RowDragState = { id: string; overId: string | null; pos: 'before' | 'after' };
  const [rowDrag, setRowDrag] = useState<RowDragState | null>(null);
  const rowDragRef = useRef<RowDragState | null>(null);
  // 拖拽起点的行矩形(display:contents 的行无盒子,用每行首个 cell 的矩形)与内滚容器 scrollTop:
  // 边缘自动滚动改变 scrollTop 后,viewport 坐标要加上滚动增量才能对上起始矩形。
  const dragRectsRef = useRef<Array<{ id: string; top: number; bottom: number }>>([]);
  const dragScrollTopRef = useRef(0);

  function handleRowDragStart(e: React.PointerEvent<HTMLButtonElement>, rowId: string) {
    if (readOnly || e.button !== 0) return;
    e.preventDefault();
    const root = tableRef.current;
    if (!root) return;
    const rects: Array<{ id: string; top: number; bottom: number }> = [];
    for (const rowEl of Array.from(root.querySelectorAll<HTMLElement>('.sl-gh-row'))) {
      const cell = rowEl.querySelector<HTMLElement>('.sl-gh-cell');
      if (!cell) continue;
      const r = cell.getBoundingClientRect();
      if (r.height > 0) rects.push({ id: rowEl.dataset.rowId ?? '', top: r.top, bottom: r.bottom });
    }
    dragRectsRef.current = rects;
    dragScrollTopRef.current = root.scrollTop;
    const st: RowDragState = { id: rowId, overId: null, pos: 'before' };
    rowDragRef.current = st;
    setRowDrag(st);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleRowDragMove(e: React.PointerEvent<HTMLButtonElement>) {
    const st = rowDragRef.current;
    if (!st) return;
    const root = tableRef.current;
    let y = e.clientY;
    if (root) {
      // 内滚容器边缘 32px 内自动滚动(每 move 事件步进 14px)
      const box = root.getBoundingClientRect();
      if (e.clientY - box.top < 32) root.scrollTop -= 14;
      else if (box.bottom - e.clientY < 32) root.scrollTop += 14;
      y += root.scrollTop - dragScrollTopRef.current;
    }
    let overId: string | null = null;
    let pos: 'before' | 'after' = 'before';
    for (const r of dragRectsRef.current) {
      if (y >= r.top && y <= r.bottom) {
        overId = r.id;
        pos = y > (r.top + r.bottom) / 2 ? 'after' : 'before';
        break;
      }
    }
    if (overId === st.overId && pos === st.pos) return;
    const next: RowDragState = { ...st, overId, pos };
    rowDragRef.current = next;
    setRowDrag(next);
  }

  function handleRowDragEnd(e: React.PointerEvent<HTMLButtonElement>, commit: boolean) {
    const st = rowDragRef.current;
    rowDragRef.current = null;
    setRowDrag(null);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!commit || !st || !st.overId || st.overId === st.id) return;
    const from = rowIdxById.get(st.id);
    const to = rowIdxById.get(st.overId);
    if (from == null || to == null || from === to) return;
    // 插入方向 → 源行最终应占据的原始数组下标:
    // 向下拖(from<to)先摘除源行,目标上移一位:沿下沿 → 落在目标原位(to),上沿 → to-1;
    // 向上拖(from>to)目标下标不变:上沿 → to,下沿 → to+1。
    const final = from < to
      ? (st.pos === 'after' ? to : to - 1)
      : (st.pos === 'after' ? to + 1 : to);
    if (final !== from) onMoveRowTo(st.id, final);
  }

  // ── 分页(v1.6.0):状态由父级(index.tsx)持有,这里只派生 ──
  // rows 已是父级过滤后的列表;编辑不改变行数,不会误触发翻页
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  useEffect(() => {
    if (page !== safePage) onPageChange(safePage);
  }, [page, safePage, onPageChange]);
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize],
  );
  // 全量行索引:上移/下移的 isFirst/isLast 要看全局位置,不是页内位置
  const rowIdxById = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(r.id, i));
    return m;
  }, [rows]);

  /** 表格底部「添加一行」:加行 + 跳到包含新行的末页 */
  function handleAddRowAndGoLastPage() {
    onAddRow();
    onPageChange(Math.max(1, Math.ceil((rows.length + 1) / pageSize)));
  }

  // ── 合计行(v1.6.0)──
  // 仅当存在数字自定义列时渲染;合计范围 = 当前过滤后的全部行(非当前页)
  const numberColumns = useMemo(() => columns.filter((c) => c.type === 'number'), [columns]);
  const hasSumFooter = numberColumns.length > 0;
  const colSums = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of numberColumns) m[c.id] = sumNumberColumn(rows, c.id);
    return m;
  }, [numberColumns, rows]);

  const tableRef = useRef<HTMLDivElement | null>(null);
  // grid track 是 var()/minmax(),无法从 CSS 直接读 px,挂载时测量一次写入此 Map,作为拖拽起点
  const measuredRef = useRef<Record<string, number>>({});

  /** 给出当前列的真实像素宽度:持久化的 widths 优先,否则从测量 Map 拿,再否则用传入 fallback */
  const readCurrentWidth = useCallback(
    (colId: string, fallback: number) => {
      const w = widths[colId];
      if (typeof w === 'number' && w > 0) return w;
      const m = measuredRef.current[colId];
      if (typeof m === 'number' && m > 0) return m;
      return fallback;
    },
    [widths],
  );

  const { bind } = useColumnResize({
    tableRef,
    readWidth: (colId) => widths[colId] ?? measuredRef.current[colId] ?? 0,
    onCommit: onSetColumnWidth,
    // 1fr 列(亮点/启发)在 useColumnResize 内部用 BUILTIN_COLUMN_IDS 不被支持,因为
    // 它们本身没存到 widths(也不应存);bind 时 per-call 传 enabled。
    enabled: !readOnly,
  });

  /**
   * root 的 inline style:
   * - `--sl-gh-col-w-<id>: Npx` 控制内建 + 自定义列的固定宽度(空 widths 不写)
   * - `gridTemplateColumns` 拼出完整 track 列表,自定义列按列数拼接
   * - `--sl-gh-custom-cols` 仍保留(给旧 CSS 兜底,新版 CSS 不再依赖)
   */
  const cssVars = useMemo(
    () => ({
      ...widthsToCssVars(widths),
      gridTemplateColumns: buildGridTemplate(columns),
      '--sl-gh-custom-cols': columns.length,
    }),
    [widths, columns],
  );

  // 挂载后测量各列实际渲染宽(拖拽起点);columns/widths 变化时重测。
  // 用表头 cell 上的 data-col-id 建索引 —— 旧版按 .sl-gh-cell--custom 去 find,
  // 多个自定义列会全部命中同一格(第一个),导致拖拽起点错位。
  useLayoutEffect(() => {
    const root = tableRef.current;
    if (!root) return;
    const cells = Array.from(
      root.querySelectorAll<HTMLElement>('.sl-gh-head > .sl-gh-cell[data-col-id]'),
    );
    const next: Record<string, number> = {};
    for (const cell of cells) {
      const id = cell.dataset.colId;
      const w = cell.getBoundingClientRect().width;
      if (id && w > 0) next[id] = w;
    }
    measuredRef.current = next;
  }, [columns.length, columns, widths]);

  /** 链接提交:自动解析项目名(仅当名字为空或仍等于上次的自动名时才覆盖) */
  function handleRepoUrlCommit(row: GithubShowRow, value: string) {
    const derived = deriveRepoName(value);
    const prevDerived = deriveRepoName(row.repoUrl);
    const autoNamed = !row.name.trim() || (prevDerived !== '' && row.name === prevDerived);
    onUpdateRow(row.id, autoNamed ? { repoUrl: value, name: derived } : { repoUrl: value });
  }

  function handleRowKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Ctrl/Cmd + Enter 触发行内任意输入框失焦(提交输入法候选)——
    // 无实际副作用,仅为移动端/输入法场景提供确定性提交。
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      (e.target as HTMLElement).blur();
    }
  }

  // 表头 cell 配置:每列含 [colId, label, builtinKey]
  const headCols: Array<{
    colId: string;
    label: string;
    selector: string;
    builtinKey: keyof typeof BUILTIN_COLUMN_IDS;
  }> = [
    { colId: BUILTIN_COLUMN_IDS.repoUrl, label: 'GitHub 链接', selector: 'sl-gh-cell--url', builtinKey: 'repoUrl' },
    { colId: BUILTIN_COLUMN_IDS.name, label: '项目名', selector: 'sl-gh-cell--name', builtinKey: 'name' },
    { colId: BUILTIN_COLUMN_IDS.highlights, label: '亮点', selector: 'sl-gh-cell--highlights', builtinKey: 'highlights' },
    { colId: BUILTIN_COLUMN_IDS.insights, label: '启发', selector: 'sl-gh-cell--insights', builtinKey: 'insights' },
    { colId: BUILTIN_COLUMN_IDS.output, label: '产出', selector: 'sl-gh-cell--demo', builtinKey: 'output' },
  ];

  // 弹性列 = 最后一个可拖列:有自定义列时是最后一个自定义列,否则是「产出」。
  // 它的宽度由 grid 的 minmax(80px, 1fr) 决定(吃余量),因此不挂拖拽手柄。
  const flexColId: string =
    columns.length > 0 ? columns[columns.length - 1].id : BUILTIN_COLUMN_IDS.output;

  return (
    // v1.6.26:表格根(grid)自身是固定高度的内滚容器,分页条提为兄弟节点
    <>
      <div
        className={`sl-gh-table${columns.length > 0 ? ' sl-gh-table--has-custom' : ''}${readOnly ? ' is-readonly' : ''}`}
        role="table"
        aria-label="GitHub 项目数据库"
        ref={tableRef}
        style={cssVars as CSSProperties}
      >
      <div className="sl-gh-head" role="row">
        {headCols.map((h) => {
          const cur = readCurrentWidth(h.colId, 160);
          // 弹性列不挂手柄:它是 minmax(80px,1fr),宽度是"剩下的" —— 拖它没有语义,
          // 要调它拖它左边那列即可(左列变宽,弹性列自动变窄)。
          const handleEnabled = !readOnly && h.colId !== flexColId;
          return (
            <div
              className={`sl-gh-cell ${h.selector}`}
              role="columnheader"
              key={h.colId}
              data-col-id={h.colId}
              title={h.colId === BUILTIN_COLUMN_IDS.repoUrl
                ? '粘贴 GitHub 仓库链接,点击可打开'
                : h.colId === BUILTIN_COLUMN_IDS.name
                  ? '从链接自动解析,可手动修改'
                  : h.colId === BUILTIN_COLUMN_IDS.highlights
                    ? '做了什么 / 技术亮点 / 成果(1fr 自适应,不参与持久化)'
                    : h.colId === BUILTIN_COLUMN_IDS.insights
                      ? '做这件事的收获 / 可复用的思路(1fr 自适应,不参与持久化)'
                      : '可选:产出 / 成果链接,可写说明,含 http 自动可点'}
            >
              {h.label}
              {handleEnabled && (
                <div
                  className="sl-gh-resizer"
                  data-col-id={h.colId}
                  {...bind(h.colId, cur, h.label)}
                />
              )}
            </div>
          );
        })}
        {columns.map((c) => {
          const cur = readCurrentWidth(c.id, 160);
          // 最后一个自定义列是弹性列,同上不挂手柄
          const handleEnabled = !readOnly && c.id !== flexColId;
          return (
            <div
              className={`sl-gh-cell sl-gh-cell--custom${c.type === 'multi-select' ? ' is-multi' : ''}`}
              role="columnheader"
              key={c.id}
              data-col-id={c.id}
              title={`${c.title}(${c.type === 'multi-select' ? '多选' : c.type === 'number' ? '数字' : '文本'})`}
            >
              {c.title}
              {handleEnabled && (
                <div
                  className="sl-gh-resizer"
                  data-col-id={c.id}
                  {...bind(c.id, cur, c.title)}
                />
              )}
            </div>
          );
        })}
        <div className="sl-gh-cell sl-gh-cell--ops" role="columnheader" aria-label="操作">
          {/* 留白:操作列 —— 不挂 resizer,44px 固定 */}
        </div>
      </div>

      {pageRows.map((row) => {
        const confirming = confirmDeleteId === row.id;
        // 上移/下移按全局位置判断边界(跨页移动合法,顺序存 doc.rows)
        const globalIdx = rowIdxById.get(row.id) ?? 0;
        const isFirst = globalIdx === 0;
        const isLast = globalIdx === rows.length - 1;
        // 行拖拽态:源行淡出;目标行按插入方向画上/下沿指示线
        const isDragSrc = rowDrag?.id === row.id;
        const isOver = rowDrag != null && rowDrag.overId === row.id && rowDrag.id !== row.id;
        const rowCls = [
          'sl-gh-row',
          isDragSrc ? 'is-dragging' : '',
          isOver ? `is-over-${rowDrag.pos}` : '',
        ].filter(Boolean).join(' ');
        return (
          <div
            className={rowCls}
            role="row"
            key={row.id}
            data-row-id={row.id}
            onKeyDown={(e) => handleRowKeyDown(e)}
          >
            <div className="sl-gh-cell sl-gh-cell--url" role="cell">
              {!readOnly && (
                <button
                  type="button"
                  className={`sl-gh-grip${isDragSrc ? ' is-active' : ''}`}
                  title="拖拽调整行顺序"
                  aria-label={`拖拽调整 ${row.name || row.id} 的顺序(上下移动也可用右侧箭头)`}
                  onPointerDown={(e) => handleRowDragStart(e, row.id)}
                  onPointerMove={handleRowDragMove}
                  onPointerUp={(e) => handleRowDragEnd(e, true)}
                  onPointerCancel={(e) => handleRowDragEnd(e, false)}
                >
                  ⠿
                </button>
              )}
              <LinkCell
                value={row.repoUrl}
                placeholder="https://github.com/…"
                ariaLabel="GitHub 仓库链接"
                autoFocus={row.id === focusRowId}
                displayText={deriveRepoName(row.repoUrl) || displayLinkText(row.repoUrl)}
                onCommit={(v) => handleRepoUrlCommit(row, v)}
              />
            </div>
            <div className="sl-gh-cell sl-gh-cell--name" role="cell">
              <input
                className="sl-gh-input"
                value={row.name}
                placeholder="自动解析，可修改"
                aria-label="项目名"
                onChange={(e) => onUpdateRow(row.id, { name: e.target.value })}
              />
            </div>
            <div className="sl-gh-cell sl-gh-cell--highlights" role="cell">
              <AutoTextarea
                value={row.highlights}
                placeholder="技术亮点、难点与成果…"
                ariaLabel={`${row.name || '项目'} 的亮点`}
                onChange={(v) => onUpdateRow(row.id, { highlights: v })}
              />
            </div>
            <div className="sl-gh-cell sl-gh-cell--insights" role="cell">
              <AutoTextarea
                value={row.insights}
                placeholder="做这件事的收获、可复用的思路…"
                ariaLabel={`${row.name || '项目'} 的启发`}
                onChange={(v) => onUpdateRow(row.id, { insights: v })}
              />
            </div>
            <div className="sl-gh-cell sl-gh-cell--demo" role="cell">
              <AutoTextarea
                value={row.output}
                placeholder="可选:产出 / 成果链接或说明,含 http 自动可点…"
                ariaLabel="产出"
                onChange={(v) => onUpdateRow(row.id, { output: v })}
              />
            </div>
            {columns.map((c) => (
              <div
                className={`sl-gh-cell sl-gh-cell--custom${c.type === 'multi-select' ? ' is-multi' : ''}${c.type === 'number' ? ' is-num' : ''}`}
                role="cell"
                key={c.id}
              >
                {c.type === 'multi-select' ? (
                  <MultiSelectCell
                    value={row.values[c.id] ?? ''}
                    ariaLabel={c.title}
                    onCommit={(v) => onSetCellValue(row.id, c.id, v)}
                  />
                ) : c.type === 'number' ? (
                  <NumberCell
                    value={row.values[c.id] ?? ''}
                    ariaLabel={c.title}
                    onCommit={(v) => onSetCellValue(row.id, c.id, v)}
                  />
                ) : (
                  <AutoTextarea
                    value={row.values[c.id] ?? ''}
                    placeholder="—"
                    ariaLabel={c.title}
                    onChange={(v) => onSetCellValue(row.id, c.id, v)}
                  />
                )}
              </div>
            ))}
            <div className="sl-gh-cell sl-gh-cell--ops" role="cell">
              <div className="sl-gh-ops">
                <button
                  type="button"
                  className="sl-gh-move"
                  title="上移"
                  aria-label={`上移 ${row.name || row.id}`}
                  disabled={isFirst}
                  onClick={() => onMoveRow(row.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="sl-gh-move"
                  title="下移"
                  aria-label={`下移 ${row.name || row.id}`}
                  disabled={isLast}
                  onClick={() => onMoveRow(row.id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={`sl-gh-del${confirming ? ' is-confirming' : ''}`}
                  title={confirming ? '再次点击确认删除' : '删除此行'}
                  aria-label={confirming ? '确认删除' : '删除'}
                  onBlur={() => { if (confirming) setConfirmDeleteId(null); }}
                  onClick={() => {
                    if (confirming) {
                      onDeleteRow(row.id);
                      setConfirmDeleteId(null);
                    } else {
                      setConfirmDeleteId(row.id);
                    }
                  }}
                >
                  {confirming ? '?' : '×'}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* 合计行:仅存在数字自定义列时渲染;合计 = 过滤后全部行(v1.6.0) */}
      {hasSumFooter && (
        <div className="sl-gh-footrow" role="row" aria-label="合计">
          <div className="sl-gh-cell sl-gh-cell--url">合计</div>
          <div className="sl-gh-cell sl-gh-cell--name" />
          <div className="sl-gh-cell sl-gh-cell--highlights" />
          <div className="sl-gh-cell sl-gh-cell--insights" />
          <div className="sl-gh-cell sl-gh-cell--demo" />
          {columns.map((c) => (
            <div
              key={c.id}
              className={`sl-gh-cell sl-gh-cell--custom${c.type === 'number' ? ' is-sum' : ''}`}
            >
              {c.type === 'number' ? formatAmount(colSums[c.id] ?? 0) : ''}
            </div>
          ))}
          <div className="sl-gh-cell sl-gh-cell--ops" />
        </div>
      )}

      <button type="button" className="sl-gh-add-row" onClick={handleAddRowAndGoLastPage}>
        ＋ 添加一行
      </button>
    </div>
      {/* v1.6.26:分页条移出 .sl-gh-table(它现在是固定高度的内滚容器),
          作为兄弟节点常驻底部,不随行滚动。 */}
      <PaginationBar
        total={rows.length}
        page={safePage}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </>
  );
}

export default GithubShowTable;
