// packages/react-components/src/color-studio/src/components/ImportModal.tsx
//
// 导入弹窗:粘贴 / 上传 TOML → 解析预览 → 确认增量合并。
// 附「复制格式提示词」与「AI 增量提示词」两个按钮(对称 shortcut-library 的 ImportModal)。
// 复制提示词 → 用户贴给任意 LLM(可带混沌代码/图片)→ LLM 产出规范 TOML → 粘回这里导入。

import { useRef, useState } from 'react';
import { parseColorImportToml, type ImportParseResult } from '../engine/importParser';
import { COLOR_IMPORT_FORMAT_PROMPT } from '../prompts/colorImportPrompt';
import { Icon } from './ui/Icon';
import { Btn } from './ui/Btn';
import type { ColorEntry, Palette } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

interface Props {
  open: boolean;
  /** 解析结果 → 增量合并,返回统计供弹窗展示。 */
  onImport: (data: ImportParseResult) => {
    palettesAdded: number;
    palettesAppended: number;
    colorsAdded: number;
    colorsSkipped: number;
  };
  onClose: () => void;
  /** 当前活动调色板(用于「AI 增量提示词」列出已有颜色,避免重复)。 */
  activePalette?: { palette: Palette; colors: ColorEntry[] } | null;
}

type TabMode = 'paste' | 'file';

export function ImportModal({ open, onImport, onClose, activePalette }: Props) {
  const [mode, setMode] = useState<TabMode>('paste');
  const [text, setText] = useState('');
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [parsed, setParsed] = useState(false);
  const [resultSummary, setResultSummary] = useState<ReturnType<typeof onImport> | null>(null);
  const [showFormat, setShowFormat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [incrementalCopied, setIncrementalCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<number | null>(null);

  if (!open) return null;

  // 复制格式说明到剪贴板
  async function handleCopyFormat() {
    await copyText(COLOR_IMPORT_FORMAT_PROMPT, setCopied);
  }

  /**
   * 拼出「AI 增量生成」提示词:
   *   - 角色 + 任务:扩展当前活动调色板的配色
   *   - 原 COLOR_IMPORT_FORMAT_PROMPT 完整原文(让 LLM 严格遵循 TOML 格式)
   *   - 当前调色板已有 hex 清单
   *   - 避冲突指令:必须避开以上 hex
   * 用户拿到后贴给任意 LLM,直接产出不冲突的 TOML 文本。
   */
  function buildIncrementalPrompt(paletteName: string, colors: ColorEntry[]): string {
    const lines: string[] = [];
    lines.push(`你是一个配色扩展助手。当前调色板「${paletteName}」已经有以下颜色,请你按照下面给出的 TOML 格式规范,基于「${paletteName}」的语义,扩展出更多配色(更多颜色、更全的场景覆盖,并给出合理的 weight 占比)。`);
    lines.push('');
    lines.push('# === 已有颜色(请严格避开这些 hex,不要输出相同或冲突的条目) ===');
    if (colors.length === 0) {
      lines.push('# (当前调色板为空,可以自由扩展)');
    } else {
      for (const c of colors) {
        const note = c.note || '(无备注)';
        const tags = c.tags.length > 0 ? `,tags=${JSON.stringify(c.tags)}` : '';
        lines.push(`# - hex="${c.hex}"  weight=${c.weight}  note="${note}"${tags}`);
      }
    }
    lines.push('');
    lines.push('# === 输出要求 ===');
    lines.push('# - 严格按下面给出的 TOML 格式规范输出');
    lines.push('# - 不要重复上述「已有颜色」列表中的任何 hex');
    lines.push('# - 输出 [[palettes]] 时 name 必须为 "' + paletteName + '"');
    lines.push('# - 只输出 TOML 文本,不要 markdown 代码块包裹,不要写前言/解释');
    lines.push('');
    lines.push('# === TOML 格式规范(原样遵循) ===');
    lines.push('');
    lines.push(COLOR_IMPORT_FORMAT_PROMPT);
    return lines.join('\n');
  }

  async function handleCopyIncremental() {
    if (!activePalette) return;
    const prompt = buildIncrementalPrompt(activePalette.palette.name, activePalette.colors);
    await copyText(prompt, setIncrementalCopied);
  }

  async function copyText(text: string, setState: (v: boolean) => void) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setState(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setState(false), 1800);
    } catch {
      alert('复制失败,请手动选择文本');
    }
  }

  // 卸载时清理 timer
  function handleCleanup() {
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }

  function handleConfirm() {
    if (!parseResult) return;
    const stats = onImport(parseResult);
    setResultSummary(stats);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      alert('文件过大,请控制在 1MB 以内');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      setText(content);
      const result = parseColorImportToml(content);
      setParseResult(result);
      setParsed(true);
    };
    reader.onerror = () => alert('无法读取文件');
    reader.readAsText(file);
    e.target.value = '';
  }

  // Re-parse when text changes in paste mode
  function handleTextChange(val: string) {
    setText(val);
    setResultSummary(null);
    if (!val.trim()) {
      setParseResult(null);
      setParsed(false);
      return;
    }
    const result = parseColorImportToml(val);
    setParseResult(result);
    setParsed(true);
  }

  const totalPalettes = parseResult?.palettes.length ?? 0;
  const totalColors = parseResult?.palettes.reduce((n, p) => n + p.colors.length, 0) ?? 0;
  const hasErrors = parseResult && parseResult.errors.length > 0;
  const isValid = parseResult && totalPalettes > 0 && totalColors > 0;

  return (
    <div className="sl-cs-modal__backdrop" onClick={() => { handleCleanup(); onClose(); }} role="presentation">
      <div className="sl-cs-modal sl-cs-import" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="导入颜色">
        <header className="sl-cs-modal__head">
          <h3><Icon name="upload" size={15} /> 导入颜色</h3>
          <Btn variant="ghost" size="sm" iconOnly icon="close" onClick={() => { handleCleanup(); onClose(); }} aria-label="关闭" />
        </header>

        {/* Tab switch */}
        <div className="sl-cs-modal__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'paste'}
            className={`sl-cs-modal__tab ${mode === 'paste' ? 'is-active' : ''}`}
            onClick={() => { setMode('paste'); setResultSummary(null); }}
          >
            粘贴文本
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'file'}
            className={`sl-cs-modal__tab ${mode === 'file' ? 'is-active' : ''}`}
            onClick={() => { setMode('file'); setResultSummary(null); }}
          >
            选择文件
          </button>
        </div>

        {mode === 'paste' ? (
          <textarea
            className="sl-cs-modal__preview sl-cs-import__textarea"
            rows={10}
            placeholder={`粘贴 TOML 内容...\n\n示例:\n[[palettes]]\nname = "品牌主色"\n\n[[palettes.colors]]\nhex = "#3B82F6"\nweight = 60\nnote = "主品牌蓝"`}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            spellCheck={false}
            aria-label="TOML 内容"
          />
        ) : (
          <div className="sl-cs-import__file-zone">
            <input
              ref={fileRef}
              type="file"
              accept=".toml,.txt"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
            <Btn variant="secondary" icon="upload" onClick={() => fileRef.current?.click()}>
              选择 .toml 文件
            </Btn>
            {text && (
              <p className="sl-cs-import__file-name">已加载 {text.length} 字节</p>
            )}
          </div>
        )}

        {/* Preview */}
        <div className="sl-cs-import__preview">
          {parsed && !text.trim() && <span>未输入内容</span>}
          {parsed && text.trim() && parseResult && (
            <span>
              解析结果: {totalPalettes} 个调色板, {totalColors} 个颜色
              {hasErrors && <span className="sl-cs-import__preview-warn">, {parseResult.errors.length} 个警告</span>}
            </span>
          )}
        </div>

        {/* Error detail */}
        {hasErrors && (
          <div className="sl-cs-import__errors">
            {parseResult!.errors.slice(0, 10).map((err, i) => (
              <div key={i} className="sl-cs-import__error-item">{err}</div>
            ))}
            {parseResult!.errors.length > 10 && (
              <div className="sl-cs-import__error-item">… 还有 {parseResult.errors.length - 10} 条</div>
            )}
          </div>
        )}

        {/* Format reference (collapsible) */}
        <div className="sl-cs-import__format">
          <div className="sl-cs-import__format-head">
            <button
              type="button"
              className="sl-cs-import__format-toggle"
              onClick={() => setShowFormat(!showFormat)}
            >
              {showFormat ? '收起格式说明' : '查看格式说明'}
            </button>
            <Btn
              size="sm"
              icon="copy"
              className={`sl-cs-import__format-copy ${incrementalCopied ? 'is-copied' : ''}`}
              onClick={handleCopyIncremental}
              disabled={!activePalette}
              title={activePalette
                ? `把当前调色板「${activePalette.palette.name}」的扩展提示词(含已有 hex 清单)复制到剪贴板`
                : '请先在左侧选中一个调色板'}
            >
              {incrementalCopied ? '已复制' : 'AI 增量提示词'}
            </Btn>
            <Btn
              size="sm"
              icon="copy"
              className={`sl-cs-import__format-copy ${copied ? 'is-copied' : ''}`}
              onClick={handleCopyFormat}
              title="复制格式说明到剪贴板"
            >
              {copied ? '已复制' : '复制格式提示词'}
            </Btn>
          </div>
          {showFormat && (
            <div className="sl-cs-import__format-body">
              <pre>{COLOR_IMPORT_FORMAT_PROMPT}</pre>
            </div>
          )}
        </div>

        {/* Result summary after import */}
        {resultSummary && (
          <div className="sl-cs-import__result">
            导入完成: 新增 {resultSummary.palettesAdded} 个调色板,
            追加 {resultSummary.palettesAppended} 个现有调色板,
            合计 {resultSummary.colorsAdded} 个颜色
            {resultSummary.colorsSkipped > 0 && (
              <span className="sl-cs-import__result-warn">, 跳过 {resultSummary.colorsSkipped} 个重复颜色</span>
            )}
          </div>
        )}

        {/* Actions */}
        <footer className="sl-cs-modal__foot">
          {!resultSummary ? (
            <>
              <Btn variant="ghost" onClick={() => { handleCleanup(); onClose(); }}>取消</Btn>
              <Btn variant="primary" disabled={!isValid} onClick={handleConfirm}>确认导入</Btn>
            </>
          ) : (
            <Btn variant="primary" onClick={() => { handleCleanup(); onClose(); }}>关闭</Btn>
          )}
        </footer>
      </div>
    </div>
  );
}
