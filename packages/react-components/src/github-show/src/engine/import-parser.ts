// src/engine/import-parser.ts —— github-show TOML 子集导入解析器(零依赖)。
//
// 只认 [[projects]] 数组 + 单行 key = "value"(双引号字符串 / 布尔),解析为
// 项目行数据;未知 key 尝试匹配现有自定义列,匹配不到则进 pendingValues
// (导入时统一建列)。解析失败 / 缺字段进 errors / warnings,不抛异常。
//
// 行扫描 + 一次性正则转义的实现方式与 shortcut-library 的 import-parser 同源,
// 但语义完全独立 —— 不要跨包复用。

import { deriveRepoName, normalizeRepoUrl } from '../utils/repo';

/** 内建字段(中文语义字段见 FORMAT_PROMPT;这里只做机器映射) */
const BUILTIN_STRING_FIELDS = ['name', 'highlights', 'insights', 'output'] as const;

export interface GithubShowImportProject {
  repoUrl: string;
  /** TOML 未提供 name 时,解析器从 repo_url 推导 owner/repo */
  name: string;
  highlights: string;
  insights: string;
  output: string;
  /** 已匹配现有列的值:colId → value */
  values: Record<string, string>;
  /** 未匹配列的值:列名 → value(导入时统一建列) */
  pendingValues: Record<string, string>;
  /** 仅解析期元数据(预览时数 fork 仓库),不写入 doc */
  isFork?: boolean;
}

export interface GithubShowImportParseResult {
  projects: GithubShowImportProject[];
  errors: string[];
  /** fork 计数、类型强转、忽略的表头等(不阻断导入) */
  warnings: string[];
  /** 文件内待新建的列名(去重,按首次出现顺序) */
  pendingColumnTitles: string[];
}

/** 还原 TOML basic string 转义(单遍正则,与 shortcut-library 同源)。
 *  支持 \\ \" \n \r \t;中文 / 全角标点无需转义。 */
function unescapeBasicString(s: string): string {
  return s.replace(/\\(["\\nrt])/g, (_match, ch: string) => {
    switch (ch) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      default: return ch; // '"' 和 '\' 还原为自身
    }
  });
}

/** 解析布尔值:true/false/yes/no/on/off/1/0(别名容忍,非规范值 warning)。 */
function parseBoolLoose(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === 'yes' || v === 'on' || v === '1') return true;
  if (v === 'false' || v === 'no' || v === 'off' || v === '0') return false;
  return null;
}

/** 切出一行的 key 和值原文;格式非法返回 null。 */
function splitLine(line: string): { key: string; rawValue: string } | null {
  const eqIdx = line.indexOf('=');
  if (eqIdx <= 0) return null;
  return {
    key: line.slice(0, eqIdx).trim(),
    rawValue: line.slice(eqIdx + 1).trim(),
  };
}

/** 从值原文提取字符串值:双引号串取「首个引号到末个引号之间」(允许行内 # 注释);
 *  裸值原样返回(交给字段级校验)。 */
function extractValue(rawValue: string): { value: string; quoted: boolean } {
  if (rawValue.startsWith('"')) {
    const last = rawValue.lastIndexOf('"');
    if (last > 0) {
      return { value: unescapeBasicString(rawValue.slice(1, last)), quoted: true };
    }
  }
  return { value: rawValue, quoted: false };
}

/**
 * 解析 TOML 导入文本。
 * - 合法 [[projects]] 表内 key=value 逐条累积;repo_url 必填,缺失整条跳过
 * - 未知 key 按现有列 title 匹配,未命中进 pendingValues + pendingColumnTitles
 * - 文件内重复 repoUrl(归一化后)保留首条 + warning
 */
export function parseImportToml(
  toml: string,
  existingColumns: Array<{ id: string; title: string }>,
): GithubShowImportParseResult {
  const projects: GithubShowImportProject[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const pendingColumnTitles: string[] = [];
  const seenUrls = new Set<string>();
  // 列 title → colId(现有列匹配)
  const columnsByTitle = new Map(existingColumns.map((c) => [c.title, c.id]));

  const lines = toml.split('\n');
  // 当前 [[projects]] 表的累积区:字段值 + pending 字段(key 顺序保留)。
  // ignored=true 的 draft 是「未知表头」的回收站 —— 其下字段静默丢弃,不报错。
  let draft: {
    repoUrl: string;
    name: string;
    highlights: string;
    insights: string;
    output: string;
    isFork?: boolean;
    unknown: Array<{ key: string; value: string }>;
    ignored?: boolean;
  } | null = null;

  function finalizeDraft() {
    if (!draft) return;
    if (draft.ignored) {
      draft = null;
      return;
    }
    if (!draft.repoUrl.trim()) {
      errors.push('一条项目缺少 repo_url 字段,已跳过');
      draft = null;
      return;
    }
    const url = normalizeRepoUrl(draft.repoUrl);
    if (seenUrls.has(url)) {
      warnings.push(`重复的仓库链接已跳过: ${url}`);
      draft = null;
      return;
    }
    seenUrls.add(url);
    const values: Record<string, string> = {};
    const pendingValues: Record<string, string> = {};
    for (const { key, value } of draft.unknown) {
      const colId = columnsByTitle.get(key);
      if (colId) values[colId] = value;
      else {
        pendingValues[key] = value;
        if (!pendingColumnTitles.includes(key)) pendingColumnTitles.push(key);
      }
    }
    projects.push({
      repoUrl: url,
      name: draft.name.trim() || deriveRepoName(url),
      highlights: draft.highlights,
      insights: draft.insights,
      output: draft.output,
      values,
      pendingValues,
      ...(draft.isFork !== undefined ? { isFork: draft.isFork } : {}),
    });
    draft = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('#')) continue;

    // 表头:只认 [[projects]];其它 [[...]] / [...] 警告并把该表下字段丢进 ignored 草稿
    const tableMatch = /^\[\[?[^[\]]+\]\]?$/.exec(line);
    if (tableMatch) {
      // [[projects]] 结束上一个 draft,开新 draft;其它表头开 ignored draft
      const isProjects = line === '[[projects]]';
      finalizeDraft();
      draft = {
        repoUrl: '', name: '', highlights: '', insights: '', output: '',
        unknown: [],
        ...(isProjects ? {} : { ignored: true }),
      };
      if (!isProjects) {
        warnings.push(`第 ${i + 1} 行: 忽略未识别的表头 "${line}"(只支持 [[projects]])`);
      }
      continue;
    }

    const parts = splitLine(line);
    if (!parts) {
      errors.push(`第 ${i + 1} 行: 无法解析 "${lines[i].trim()}"`);
      continue;
    }
    const { key, rawValue } = parts;
    if (!draft) {
      errors.push(`第 ${i + 1} 行: 字段 "${key}" 不在任何 [[projects]] 表内`);
      continue;
    }

    const { value, quoted } = extractValue(rawValue);

    if (key === 'repo_url') {
      if (quoted) draft.repoUrl = value;
      else errors.push(`第 ${i + 1} 行: repo_url 必须是双引号字符串`);
    } else if (key === 'is_fork') {
      // 布尔值可能带引号(is_fork = "yes")也可能裸写(is_fork = true),两种都解析
      const b = parseBoolLoose(quoted ? value : rawValue);
      if (b === null) warnings.push(`第 ${i + 1} 行: is_fork 的值 "${rawValue}" 不是布尔,已忽略`);
      else draft.isFork = b;
    } else if ((BUILTIN_STRING_FIELDS as readonly string[]).includes(key)) {
      if (quoted) {
        draft[key as (typeof BUILTIN_STRING_FIELDS)[number]] = value;
      } else {
        // 裸值容忍:数字列值等场景强转字符串
        draft[key as (typeof BUILTIN_STRING_FIELDS)[number]] = rawValue;
        warnings.push(`第 ${i + 1} 行: ${key} 的值未加引号,已按文本处理`);
      }
    } else if (key === 'pushed_at') {
      // 解析期忽略(仅提示词输出用)
    } else {
      // 未知 key → 自定义列。字符串值直接用;裸值(数字/布尔)强转文本
      if (!quoted) {
        warnings.push(`第 ${i + 1} 行: ${key} 的值未加引号,已按文本处理`);
      }
      draft.unknown.push({ key, value: quoted ? value : rawValue });
    }
  }
  finalizeDraft();

  return { projects, errors, warnings, pendingColumnTitles };
}
