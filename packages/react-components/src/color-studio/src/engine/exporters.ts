// packages/react-components/src/color-studio/src/engine/exporters.ts
//
// 四种导出格式的纯字符串生成器(CSS Vars / Tailwind / W3C Design Tokens / JSON)。

import type { ColorStudioDocument, Palette } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

/** slug 化:中文保留,空格/特殊字符转 '-',供 CSS var / JS key 用。 */
function slug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-+|-+$/g, '') || 'palette';
}

function paletteEntries(doc: ColorStudioDocument, palette: Palette) {
  return palette.colorIds
    .map((cid) => doc.colorEntries.find((c) => c.id === cid))
    .filter((c): c is NonNullable<typeof c> => !!c);
}

export function exportCssVars(doc: ColorStudioDocument): string {
  const lines: string[] = ['/* Color Studio export — CSS Variables */', ':root {'];
  for (const p of doc.palettes) {
    const key = slug(p.name);
    paletteEntries(doc, p).forEach((e, i) => {
      lines.push(`  --color-${key}-${i}: ${e.hex};`);
    });
  }
  lines.push('}');
  return lines.join('\n');
}

export function exportTailwind(doc: ColorStudioDocument): string {
  const lines: string[] = [
    '// Color Studio export — Tailwind config',
    '// 用法:tailwind.config.js 里 require/extend',
    'module.exports = {',
    '  theme: {',
    '    extend: {',
    '      colors: {',
  ];
  for (const p of doc.palettes) {
    const key = slug(p.name);
    lines.push(`        '${key}': {`);
    paletteEntries(doc, p).forEach((e, i) => {
      lines.push(`          '${i}': '${e.hex}',`);
    });
    lines.push('        },');
  }
  lines.push('      },');
  lines.push('    },');
  lines.push('  },');
  lines.push('};');
  return lines.join('\n');
}

export function exportDesignTokens(doc: ColorStudioDocument): string {
  const tree: Record<string, Record<string, { $type: string; $value: string }>> = {};
  for (const p of doc.palettes) {
    const key = slug(p.name);
    const inner: Record<string, { $type: string; $value: string }> = {};
    paletteEntries(doc, p).forEach((e, i) => {
      inner[String(i)] = { $type: 'color', $value: e.hex };
    });
    tree[key] = inner;
  }
  return JSON.stringify(
    { $schema: 'https://design-tokens.org/schema.json', color: tree },
    null,
    2,
  );
}

export function exportJson(doc: ColorStudioDocument): string {
  return JSON.stringify(doc, null, 2);
}

/** TOML 导出 —— 与导入格式对称,便于「导出 → 复制给 LLM → 迭代 → 再导入」闭环。 */
export function exportToml(doc: ColorStudioDocument): string {
  const lines: string[] = ['# Color Studio export — TOML'];
  for (const p of doc.palettes) {
    lines.push('');
    lines.push('[[palettes]]');
    lines.push(`name = "${escapeToml(p.name)}"`);
    paletteEntries(doc, p).forEach((e) => {
      lines.push('');
      lines.push('[[palettes.colors]]');
      lines.push(`hex = "${e.hex}"`);
      lines.push(`weight = ${e.weight}`);
      if (e.note) lines.push(`note = "${escapeToml(e.note)}"`);
      if (e.tags.length > 0) {
        lines.push(`tags = [${e.tags.map((t) => `"${escapeToml(t)}"`).join(', ')}]`);
      }
    });
  }
  return lines.join('\n');
}

/** TOML basic string 转义:反斜杠 + 引号。换行等其余字符保持原样。 */
function escapeToml(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export type ExportFormat = 'css-vars' | 'tailwind' | 'design-tokens' | 'json' | 'toml';

export const EXPORT_FORMATS: { value: ExportFormat; label: string; ext: string }[] = [
  { value: 'css-vars', label: 'CSS Variables', ext: 'css' },
  { value: 'tailwind', label: 'Tailwind', ext: 'js' },
  { value: 'design-tokens', label: 'Design Tokens', ext: 'tokens.json' },
  { value: 'toml', label: 'TOML 导入格式', ext: 'toml' },
  { value: 'json', label: 'JSON 文档', ext: 'json' },
];

export function exportDoc(doc: ColorStudioDocument, format: ExportFormat): string {
  switch (format) {
    case 'css-vars': return exportCssVars(doc);
    case 'tailwind': return exportTailwind(doc);
    case 'design-tokens': return exportDesignTokens(doc);
    case 'toml': return exportToml(doc);
    case 'json': return exportJson(doc);
  }
}
