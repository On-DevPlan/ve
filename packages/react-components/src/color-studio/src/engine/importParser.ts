// packages/react-components/src/color-studio/src/engine/importParser.ts
//
// Zero-dependency TOML subset parser for Color Studio import.
// 与 shortcut-library 的 import-parser 同构,只支持导入规范里定义的子集:
//   - [[palettes]] array-of-tables headers
//   - [[palettes.colors]] nested array-of-tables
//   - name = "..."
//   - hex = "..."
//   - weight = <number>
//   - note = "..."
//   - tags = ["...", ...]
//   - # comments
// hex 统一归一化为大写 #RRGGBB;weight 0-100;所有非法行收集为 errors(不抛异常)。

import { parseUserInput } from './colorMath';
import type { Hex } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

export interface ImportColor {
  hex: Hex;
  /** 0-100;缺省 1 */
  weight: number;
  note: string;
  tags: string[];
}

export interface ImportPalette {
  name: string;
  colors: ImportColor[];
}

export interface ImportParseResult {
  palettes: ImportPalette[];
  errors: string[];
}

const WEIGHT_DEFAULT = 1;
const WEIGHT_MIN = 0;
const WEIGHT_MAX = 100;

/** 还原 TOML basic string 的转义序列(与快捷键模块同款实现)。
 *  单次遍历:每个转义序列只被消费一次,避免 `\\"` 被误解析成 `\"` 再丢引号。 */
function unescapeBasicString(s: string): string {
  return s.replace(/\\(["\\nrt])/g, (_match, ch: string) => {
    switch (ch) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      default: return ch; // '"' 和 '\' 直接还原成自身
    }
  });
}

/** 解析 TOML 字符串数组 ["a", "b"] → 元素数组;失败返 null。 */
function parseStringArray(raw: string): string[] | null {
  const s = raw.trim();
  if (!s.startsWith('[') || !s.endsWith(']')) return null;
  const inner = s.slice(1, -1).trim();
  if (inner === '') return [];
  // 用正则逐段提取双引号字符串(支持转义),忽略逗号/空白。
  const out: string[] = [];
  const re = /"((?:\\.|[^"\\])*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    out.push(unescapeBasicString(m[1]));
  }
  // 校验:除引号字符串、逗号、空白外没有别的字符(防 LLM 写出 {a:1} 之类)。
  const stripped = inner.replace(/"(?:\\.|[^"\\])*"/g, '').replace(/[,\s]/g, '');
  if (stripped !== '') return null;
  return out;
}

/** 解析 weight:TOML 数字,0-100。字符串数字("30")也容忍。失败返 null。 */
function parseWeight(raw: string): number | null {
  const s = raw.trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n < WEIGHT_MIN || n > WEIGHT_MAX) return null;
  return n;
}

/**
 * 解析 TOML 导入文本 → 结构化数据。
 * 容错:非法行收集到 errors,不中断;hex 解析失败的颜色条目整条跳过。
 */
export function parseColorImportToml(toml: string): ImportParseResult {
  const palettes: ImportPalette[] = [];
  const errors: string[] = [];
  const lines = toml.split('\n');

  let currentPalette: { name: string; colors: Array<{ hex: string; weight: string; note: string; tags: string[] }> } | null = null;
  let inColors = false;
  // pending 字段:[[palettes.colors]] 头先于字段出现,字段键的顺序不保证
  // (hex 可能写在 weight 后面),所以先暂存再在 hex 到达时 flush。
  let pendingHex: string | null = null;
  let pendingWeight: string | null = null;
  let pendingNote: string | null = null;
  let pendingTags: string[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    // Skip empty lines and comments
    if (line === '' || line.startsWith('#')) continue;

    // Array-of-tables header: [[palettes]]
    if (line === '[[palettes]]') {
      if (currentPalette) finalizePalette();
      currentPalette = { name: '', colors: [] };
      inColors = false;
      continue;
    }

    // Array-of-tables header: [[palettes.colors]]
    if (line === '[[palettes.colors]]') {
      inColors = true;
      resetPending();
      continue;
    }

    // Key-value pairs
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      errors.push(`第 ${i + 1} 行: 无法解析 "${raw}"`);
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    const valRaw = line.slice(eqIdx + 1).trim();
    const val = valRaw.startsWith('"') && valRaw.endsWith('"')
      ? unescapeBasicString(valRaw.slice(1, -1))
      : valRaw;

    if (inColors && currentPalette) {
      if (key === 'hex') {
        pendingHex = val;
      } else if (key === 'weight') {
        if (currentPalette.colors.length > 0) {
          // weight 出现在 hex 之后:更新最后一条已 flush 的颜色
          currentPalette.colors[currentPalette.colors.length - 1].weight = val;
        } else {
          pendingWeight = val;
        }
      } else if (key === 'note') {
        if (currentPalette.colors.length > 0) {
          currentPalette.colors[currentPalette.colors.length - 1].note = val;
        } else {
          pendingNote = val;
        }
      } else if (key === 'tags') {
        const arr = parseStringArray(valRaw);
        if (arr === null) {
          errors.push(`第 ${i + 1} 行: tags 必须是字符串数组 ["a", "b"]`);
        } else if (currentPalette.colors.length > 0) {
          currentPalette.colors[currentPalette.colors.length - 1].tags = arr;
        } else {
          pendingTags = arr;
        }
      } else {
        errors.push(`第 ${i + 1} 行: 未知字段 "${key}"`);
      }

      // hex 就位时 flush 当前颜色条目(合并可能分散的 pending 字段)
      if (key === 'hex' && currentPalette) {
        flushColor(currentPalette);
      }
    } else if (!inColors && currentPalette) {
      if (key === 'name') currentPalette.name = val;
      else errors.push(`第 ${i + 1} 行: 未知字段 "${key}"`);
    } else {
      errors.push(`第 ${i + 1} 行: 不在任何表头下的字段 "${key}"`);
    }
  }

  // Finalize last palette
  if (currentPalette) finalizePalette();

  function resetPending() {
    pendingHex = null;
    pendingWeight = null;
    pendingNote = null;
    pendingTags = null;
  }

  /** 把当前 pending 字段 flush 成一条颜色(若 hex 可解析)。 */
  function flushColor(palette: { colors: Array<{ hex: string; weight: string; note: string; tags: string[] }> }) {
    if (pendingHex === null) return;
    // 先取局部变量,再 resetPending() —— reset 会清空 pendingHex,push 之前必须已保存。
    const hex = pendingHex;
    const note = pendingNote ?? '';
    const tags = pendingTags ?? [];
    const weightRaw = pendingWeight ?? String(WEIGHT_DEFAULT);
    resetPending();
    palette.colors.push({ hex, weight: weightRaw, note, tags });
  }

  function finalizePalette() {
    if (!currentPalette) return;
    const name = currentPalette.name.trim();
    if (!name) {
      errors.push('调色板缺少 name 字段,已跳过');
      currentPalette = null;
      inColors = false;
      return;
    }

    const colors: ImportColor[] = [];
    for (const c of currentPalette.colors) {
      if (!c.hex) continue; // 防御:无 hex 的残条(理论上 flushColor 已挡,双保险)
      const hex = resolveHex(c.hex);
      if (!hex) {
        errors.push(`调色板 "${name}" · 颜色 "${c.hex}": 无法识别的颜色值,已跳过`);
        continue;
      }
      const weight = parseWeight(c.weight);
      if (weight === null) {
        errors.push(`调色板 "${name}" · ${hex}: weight 必须为 0-100 的数字,已回落到 1`);
      }
      colors.push({ hex, weight: weight ?? WEIGHT_DEFAULT, note: c.note, tags: c.tags });
    }
    palettes.push({ name, colors });
    currentPalette = null;
    inColors = false;
  }

  return { palettes, errors };
}

/** 颜色值归一化:#RGB/#RRGGBB(大小写)、rgb()/hsl()/CSS 名/无 # hex。
 *  失败返 null。 */
function resolveHex(raw: string): Hex | null {
  const hex = parseUserInput(raw);
  return hex ? hex.toUpperCase() as Hex : null;
}
