// src/components/PaginationBar.tsx —— 通用分页条(对齐中后台表格原型)。
//
// 布局:共 N 条 · [‹ 1 … 4 5 6 … 20 ›] · 10 条/页 · 跳转至 [n] 页
// - 页码列表:总页数 ≤7 全展示;否则收拢为「1 … 当前±1 … 末页」,靠端点多展示几个
// - 跳转输入:Enter 提交,越界自动钳制到 [1, totalPages]
// - 无副作用纯展示组件;页大小选项固定 10/20/50/100

import { useState, type KeyboardEvent } from 'react';

export interface PaginationBarProps {
  /** 总条数 */
  total: number;
  /** 当前页(1-based;调用方负责钳制,组件内也兜底) */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const SIZE_OPTIONS = [10, 20, 50, 100];

type PageItem = number | '…';

function buildPageList(totalPages: number, page: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, totalPages]);
  for (const p of [page - 1, page, page + 1]) {
    if (p >= 1 && p <= totalPages) set.add(p);
  }
  // 靠近端点时多铺几个页码,避免出现「1 … 5 … 20」这种过窄形态
  if (page <= 3) [2, 3, 4].forEach((p) => p < totalPages && set.add(p));
  if (page >= totalPages - 2) {
    [totalPages - 1, totalPages - 2, totalPages - 3].forEach((p) => p > 1 && set.add(p));
  }
  const nums = [...set].sort((a, b) => a - b);
  const out: PageItem[] = [];
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}

export default function PaginationBar({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const [jumpDraft, setJumpDraft] = useState('');

  function commitJump() {
    const n = Number(jumpDraft);
    if (jumpDraft.trim() === '' || Number.isNaN(n)) {
      setJumpDraft('');
      return;
    }
    onPageChange(Math.min(Math.max(1, Math.round(n)), totalPages));
    setJumpDraft('');
  }

  function handleJumpKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitJump();
  }

  return (
    /* 对齐中后台原型(v1.6.2),布局见 index.css:
       左段留空(原型为「已选 N 行」开关)| 右段整体靠右:
       共 N 条 + ‹页码› + 每页条数 + 跳转。
       页码裸数字无边框,仅 active 绿底白字;‹ › 为裸导航符。 */
    <nav className="sl-gh-pagination" aria-label="分页">
      {/* 左段:占位 */}
      <span className="sl-gh-pagination__side" aria-hidden="true" />

      <div className="sl-gh-pagination__right">
        <span className="sl-gh-pagination__total">共 {total} 条</span>
        <div className="sl-gh-pager">
          <button
            type="button"
            className="sl-gh-pager__nav"
            disabled={safePage <= 1}
            aria-label="上一页"
            onClick={() => onPageChange(safePage - 1)}
          >
            ‹
          </button>
          {buildPageList(totalPages, safePage).map((it, i) =>
            it === '…' ? (
              <span key={`e${i}`} className="sl-gh-pager__ellipsis" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={it}
                type="button"
                className={`sl-gh-pager__btn${it === safePage ? ' is-active' : ''}`}
                aria-current={it === safePage ? 'page' : undefined}
                aria-label={`第 ${it} 页`}
                onClick={() => onPageChange(it)}
              >
                {it}
              </button>
            ),
          )}
          <button
            type="button"
            className="sl-gh-pager__nav"
            disabled={safePage >= totalPages}
            aria-label="下一页"
            onClick={() => onPageChange(safePage + 1)}
          >
            ›
          </button>
        </div>
        <select
          className="sl-gh-select sl-gh-pagination__size"
          value={pageSize}
          aria-label="每页条数"
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} 条/页
            </option>
          ))}
        </select>
        <span className="sl-gh-pagination__jump">
          跳转至
          <input
            className="sl-gh-pagination__jump-input"
            type="number"
            min={1}
            max={totalPages}
            value={jumpDraft}
            aria-label="跳转到指定页"
            onChange={(e) => setJumpDraft(e.target.value)}
            onKeyDown={handleJumpKeyDown}
            placeholder={String(safePage)}
          />
          页
        </span>
      </div>
    </nav>
  );
}
