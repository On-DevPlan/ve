// src/utils/format.ts —— 数字格式化 / 数字列求和纯函数(无 UI / 无依赖)。
//
// 合计行用:数字自定义列的值存 JSON 字符串(values[colId]),求和时跳过
// 空串与非数字(NaN),避免脏数据把合计打成 NaN。

import type { GithubShowRow } from '@api/components/github-show/types';

/** 金额格式化:千分位 + 固定 2 位小数(对齐中后台原型 9,000.00 样式)。 */
export function formatAmount(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 对某数字列求和;空串 / 非数字值跳过(而非当 0 吸进来,语义更稳)。 */
export function sumNumberColumn(rows: GithubShowRow[], colId: string): number {
  let sum = 0;
  for (const r of rows) {
    const raw = (r.values[colId] ?? '').trim();
    if (raw === '') continue;
    const n = Number(raw);
    if (!Number.isNaN(n)) sum += n;
  }
  return sum;
}
