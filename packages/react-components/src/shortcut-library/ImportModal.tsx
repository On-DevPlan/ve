// ImportModal.tsx —— 粘贴/上传 TOML 的导入弹窗,内嵌格式说明

import { useRef, useState } from 'react';
import { parseImportToml, type ImportParseResult } from './import-parser';

interface Props {
  onImport: (data: ImportParseResult) => { groupsAdded: number; groupsAppended: number; shortcutsAdded: number; errors: string[] };
  onClose: () => void;
}

type TabMode = 'paste' | 'file';

// 格式说明 —— 用作内联展示 + 一键复制的内容
const FORMAT_PROMPT = `# ShortcutLibrary 导入格式 (TOML)
# UTF-8 编码

[[groups]]
name = "分组名称"

[[groups.shortcuts]]
combo = "Ctrl+R"     # 组合键,用 + 连接
desc  = "打开目录"    # 说明(可选)

# 支持多个分组和快捷键
[[groups]]
name = "Chrome"

[[groups.shortcuts]]
combo = "Ctrl+T"
desc = "新建标签页"

# 支持的修饰键: Ctrl, Shift, Alt, ⌘
# 支持的方向键: ↑, ↓, ←, →
# 支持的字母/数字: A-Z, 0-9
# 支持的功能键: F1-F12
# 文件大小限制: 1 MB`;

export default function ImportModal({ onImport, onClose }: Props) {
  const [mode, setMode] = useState<TabMode>('paste');
  const [text, setText] = useState('');
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [parsed, setParsed] = useState(false);
  const [resultSummary, setResultSummary] = useState<ReturnType<typeof onImport> | null>(null);
  const [showFormat, setShowFormat] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<number | null>(null);

  // 复制格式说明到剪贴板
  async function handleCopyFormat() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(FORMAT_PROMPT);
      } else {
        // 旧浏览器 fallback: textarea + execCommand
        const ta = document.createElement('textarea');
        ta.value = FORMAT_PROMPT;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      alert('复制失败,请手动选择文本');
      console.error(err);
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
      // Auto-parse on file load
      const result = parseImportToml(content);
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
    const result = parseImportToml(val);
    setParseResult(result);
    setParsed(true);
  }

  const totalGroups = parseResult?.groups.length ?? 0;
  const totalShortcuts = parseResult?.groups.reduce((n, g) => n + g.shortcuts.length, 0) ?? 0;
  const hasErrors = parseResult && parseResult.errors.length > 0;
  const isValid = parseResult && totalGroups > 0 && totalShortcuts > 0;

  return (
    <div className="sl-sl-overlay" onClick={() => { handleCleanup(); onClose(); }}>
      <div className="sl-sl-modal" onClick={(e) => e.stopPropagation()}>
        <header className="sl-sl-modal__head">
          <h2 className="sl-sl-modal__title">导入快捷键</h2>
          <button className="sl-sl-icon-btn" onClick={() => { handleCleanup(); onClose(); }}>×</button>
        </header>

        {/* Tab switch */}
        <div className="sl-sl-modal__tabs">
          <button
            className={`sl-sl-modal__tab ${mode === 'paste' ? 'is-active' : ''}`}
            onClick={() => { setMode('paste'); setResultSummary(null); }}
          >
            粘贴文本
          </button>
          <button
            className={`sl-sl-modal__tab ${mode === 'file' ? 'is-active' : ''}`}
            onClick={() => { setMode('file'); setResultSummary(null); }}
          >
            选择文件
          </button>
        </div>

        {mode === 'paste' ? (
          <textarea
            className="sl-sl-modal__textarea"
            rows={10}
            placeholder={`粘贴 TOML 内容...\n\n示例:\n[[groups]]\nname = "VSCode"\n\n[[groups.shortcuts]]\ncombo = "Ctrl+R"\ndesc = "打开目录"`}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            spellCheck={false}
          />
        ) : (
          <div className="sl-sl-modal__file-zone">
            <input
              ref={fileRef}
              type="file"
              accept=".toml"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
            <button
              className="sl-sl-btn sl-sl-btn--primary"
              onClick={() => fileRef.current?.click()}
            >
              选择 .toml 文件
            </button>
            {text && (
              <p className="sl-sl-modal__file-name">
                已加载 {text.length} 字节
              </p>
            )}
          </div>
        )}

        {/* Preview */}
        <div className="sl-sl-modal__preview">
          {parsed && !text.trim() && (
            <span className="sl-sl-modal__preview-text">未输入内容</span>
          )}
          {parsed && text.trim() && parseResult && (
            <span className="sl-sl-modal__preview-text">
              解析结果: {totalGroups} 个分组, {totalShortcuts} 条快捷键
              {hasErrors && (
                <span className="sl-sl-modal__preview-warn">
                  , {parseResult.errors.length} 个警告
                </span>
              )}
            </span>
          )}
        </div>

        {/* Error detail */}
        {hasErrors && (
          <div className="sl-sl-modal__errors">
            {parseResult!.errors.slice(0, 10).map((err, i) => (
              <div key={i} className="sl-sl-modal__error-item">{err}</div>
            ))}
            {parseResult!.errors.length > 10 && (
              <div className="sl-sl-modal__error-item">… 还有 {parseResult!.errors.length - 10} 条</div>
            )}
          </div>
        )}

        {/* Format reference (collapsible) */}
        <div className="sl-sl-modal__format">
          <div className="sl-sl-modal__format-head">
            <button
              className="sl-sl-modal__format-toggle"
              onClick={() => setShowFormat(!showFormat)}
            >
              📄 {showFormat ? '收起格式说明' : '查看格式说明'}
            </button>
            <button
              type="button"
              className={`sl-sl-modal__format-copy ${copied ? 'is-copied' : ''}`}
              onClick={handleCopyFormat}
              title="复制格式说明到剪贴板"
            >
              {copied ? '✓ 已复制' : '复制格式提示词'}
            </button>
          </div>
          {showFormat && (
            <div className="sl-sl-modal__format-body">
              <pre>{FORMAT_PROMPT}</pre>
            </div>
          )}
        </div>

        {/* Result summary after import */}
        {resultSummary && (
          <div className="sl-sl-modal__result">
            ✅ 导入完成: 新增 {resultSummary.groupsAdded} 个分组,
            追加 {resultSummary.groupsAppended} 个现有分组,
            合计 {resultSummary.shortcutsAdded} 条快捷键
            {resultSummary.errors.length > 0 && (
              <div className="sl-sl-modal__result-warn">
                {resultSummary.errors.length} 个警告已忽略
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="sl-sl-modal__actions">
          {!resultSummary ? (
            <>
              <button className="sl-sl-btn sl-sl-btn--ghost" onClick={() => { handleCleanup(); onClose(); }}>取消</button>
              <button
                className="sl-sl-btn sl-sl-btn--primary"
                disabled={!isValid}
                onClick={handleConfirm}
              >
                确认导入
              </button>
            </>
          ) : (
            <button className="sl-sl-btn sl-sl-btn--primary" onClick={() => { handleCleanup(); onClose(); }}>
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
