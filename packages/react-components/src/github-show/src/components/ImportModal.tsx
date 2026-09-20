// ImportModal.tsx —— github-show 的 TOML 批量导入弹窗。
//
// 结构参照 shortcut-library 的 ImportModal(tab 切换 / 粘贴 / 文件 / 解析预览 /
// 错误明细 / 折叠格式说明 / 一键复制提示词),但样式与命名空间完全独立(sl-gh-*)。
// 特色入口:「复制 gh 提示词」—— 按用户选项(时间窗 / 范围 / fork / 可见性)生成
// 一段提示词,复制后发给本地 agent 执行 gh CLI 拉取仓库清单并输出 TOML,回贴到
// 上方粘贴框即可批量导入。亮点 / 启发留给用户自填。

import { useEffect, useRef, useState } from 'react';
import { parseImportToml, type GithubShowImportParseResult } from '../engine/import-parser';
import { FORMAT_PROMPT, buildGhReposPrompt, type GhPromptOptions } from '../engine/import-prompts';

export interface ImportStats {
  rowsAdded: number;
  columnsCreated: number;
  rowsSkipped: number;
  errors: string[];
}

interface Props {
  onImport: (parsed: GithubShowImportParseResult) => ImportStats;
  /** 现有自定义列(解析时按列名匹配,避免重复建列) */
  columns: Array<{ id: string; title: string }>;
  onClose: () => void;
}

type TabMode = 'paste' | 'file';

// 复制反馈复位时长(与 shortcut-library ImportModal 一致)
const COPY_FEEDBACK_MS = 1800;
// 文件 / 粘贴文本大小上限
const MAX_BYTES = 1_000_000;

export default function ImportModal({ onImport, columns, onClose }: Props) {
  const [mode, setMode] = useState<TabMode>('paste');
  const [text, setText] = useState('');
  const [parseResult, setParseResult] = useState<GithubShowImportParseResult | null>(null);
  const [resultSummary, setResultSummary] = useState<ImportStats | null>(null);
  const [showFormat, setShowFormat] = useState(false);

  // gh 提示词选项(默认:最近 12 个月 / 仅个人 / 排除 fork / 全部可见性)
  const [ghMonths, setGhMonths] = useState<GhPromptOptions['months']>(12);
  const [ghScope, setGhScope] = useState<GhPromptOptions['scope']>('mine');
  const [ghFork, setGhFork] = useState<GhPromptOptions['fork']>('exclude');
  const [ghVisibility, setGhVisibility] = useState<GhPromptOptions['visibility']>('all');

  // 两个复制按钮的「已复制」反馈用独立 state,共用一个 timer ref(后点覆盖先点)
  const [promptCopied, setPromptCopied] = useState(false);
  const [formatCopied, setFormatCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // 卸载时清掉复制反馈 timer,避免对已卸载组件 setState
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, [onClose]);

  function handleClose() {
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    onClose();
  }

  // 实时解析(粘贴模式)
  function handleTextChange(val: string) {
    setText(val);
    setResultSummary(null);
    setParseResult(val.trim() ? parseImportToml(val, columns) : null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      window.alert('文件过大,请控制在 1MB 以内');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      setText(content);
      setResultSummary(null);
      setParseResult(parseImportToml(content, columns));
    };
    reader.onerror = () => window.alert('无法读取文件');
    reader.readAsText(file);
    e.target.value = '';
  }

  /** 写剪贴板;clipboard API 不可用时降级 textarea + execCommand */
  async function writeClipboard(content: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
        return true;
      }
      const ta = document.createElement('textarea');
      ta.value = content;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (err) {
      console.error('[ImportModal] copy failed:', err);
      return false;
    }
  }

  /** 复制成功后挂 is-copied 反馈;复位由共用 timer 统一清两个 state(后点覆盖先点) */
  function flashCopied(setter: (v: boolean) => void) {
    setter(true);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => {
      setPromptCopied(false);
      setFormatCopied(false);
    }, COPY_FEEDBACK_MS);
  }

  async function handleCopyGhPrompt() {
    const prompt = buildGhReposPrompt({ months: ghMonths, scope: ghScope, fork: ghFork, visibility: ghVisibility });
    if (await writeClipboard(prompt)) flashCopied(setPromptCopied);
    else window.alert('复制失败,请手动选择文本');
  }

  async function handleCopyFormat() {
    if (await writeClipboard(FORMAT_PROMPT)) flashCopied(setFormatCopied);
    else window.alert('复制失败,请手动选择文本');
  }

  function handleConfirm() {
    if (!parseResult || parseResult.projects.length === 0) return;
    setResultSummary(onImport(parseResult));
  }

  const projectCount = parseResult?.projects.length ?? 0;
  const forkCount = parseResult?.projects.filter((p) => p.isFork).length ?? 0;
  const hasErrors = (parseResult?.errors.length ?? 0) > 0;
  const isValid = projectCount > 0;

  return (
    <div
      className="sl-gh-modal__backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="sl-gh-modal sl-gh-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="导入 GitHub 项目"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sl-gh-modal__head">
          <h3 className="sl-gh-modal__title">导入 GitHub 项目</h3>
          <button
            type="button"
            className="sl-gh-modal__close"
            aria-label="关闭"
            onClick={handleClose}
          >
            ×
          </button>
        </div>

        <p className="sl-gh-modal__hint">
          粘贴 TOML 批量导入;或复制 gh 提示词发给本机 AI agent,它会用 GitHub CLI 拉取仓库清单生成 TOML,
          再粘贴回来。亮点 / 启发可稍后在表格中自填。
        </p>

        {/* Tab 切换 */}
        <div className="sl-gh-import__tabs" role="tablist" aria-label="导入方式">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'paste'}
            className={`sl-gh-import__tab${mode === 'paste' ? ' is-active' : ''}`}
            onClick={() => { setMode('paste'); setResultSummary(null); }}
          >
            粘贴文本
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'file'}
            className={`sl-gh-import__tab${mode === 'file' ? ' is-active' : ''}`}
            onClick={() => { setMode('file'); setResultSummary(null); }}
          >
            选择文件
          </button>
        </div>

        {mode === 'paste' ? (
          <textarea
            className="sl-gh-import__textarea"
            rows={10}
            placeholder={'粘贴 TOML 内容...\n\n示例:\n[[projects]]\nrepo_url = "https://github.com/vuejs/core"\nname = "vuejs/core"'}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            spellCheck={false}
          />
        ) : (
          <div className="sl-gh-import__file-zone">
            <input
              ref={fileRef}
              type="file"
              accept=".toml"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="sl-gh-btn sl-gh-btn--primary"
              onClick={() => fileRef.current?.click()}
            >
              选择 .toml 文件
            </button>
            {text && <p className="sl-gh-import__file-name">已加载 {text.length} 字符</p>}
          </div>
        )}

        {/* 解析预览 */}
        {parseResult && (
          <div className="sl-gh-import__preview">
            <span>解析结果: {projectCount} 个项目</span>
            {pendingColumnCount(parseResult) > 0 && (
              <span className="sl-gh-import__preview-newcols">
                ,新建 {pendingColumnCount(parseResult)} 列: {parseResult.pendingColumnTitles.join(' / ')}
              </span>
            )}
            {forkCount > 0 && (
              <span className="sl-gh-import__preview-warn">,{forkCount} 个 fork 仓库</span>
            )}
            {hasErrors && (
              <span className="sl-gh-import__preview-warn">,{parseResult!.errors.length} 个警告</span>
            )}
          </div>
        )}

        {/* 错误明细(前 10 条) */}
        {hasErrors && (
          <div className="sl-gh-import__errors">
            {parseResult!.errors.slice(0, 10).map((err, i) => (
              <div key={i} className="sl-gh-import__error-item">{err}</div>
            ))}
            {parseResult!.errors.length > 10 && (
              <div className="sl-gh-import__error-item">… 还有 {parseResult!.errors.length - 10} 条</div>
            )}
          </div>
        )}

        {/* gh 提示词区 —— 核心入口:选项 + 一键复制 */}
        <div className="sl-gh-import__promptbar">
          <select
            className="sl-gh-select"
            value={ghMonths}
            aria-label="时间窗"
            onChange={(e) => setGhMonths(Number(e.target.value) as GhPromptOptions['months'])}
          >
            <option value={3}>最近 3 个月</option>
            <option value={6}>最近 6 个月</option>
            <option value={12}>最近 12 个月</option>
            <option value={24}>最近 24 个月</option>
            <option value={36}>最近 36 个月</option>
          </select>
          <select
            className="sl-gh-select"
            value={ghScope}
            aria-label="仓库范围"
            onChange={(e) => setGhScope(e.target.value as GhPromptOptions['scope'])}
          >
            <option value="mine">仅个人仓库</option>
            <option value="mine+orgs">个人 + 组织仓库</option>
          </select>
          <select
            className="sl-gh-select"
            value={ghFork}
            aria-label="fork 处理"
            onChange={(e) => setGhFork(e.target.value as GhPromptOptions['fork'])}
          >
            <option value="exclude">排除 fork</option>
            <option value="include">包含 fork</option>
          </select>
          <select
            className="sl-gh-select"
            value={ghVisibility}
            aria-label="可见性"
            onChange={(e) => setGhVisibility(e.target.value as GhPromptOptions['visibility'])}
          >
            <option value="all">全部可见性</option>
            <option value="public">仅公开</option>
          </select>
          <button
            type="button"
            className={`sl-gh-import__prompt-copy${promptCopied ? ' is-copied' : ''}`}
            onClick={handleCopyGhPrompt}
            title="按当前选项生成 gh CLI 盘点提示词并复制到剪贴板"
          >
            {promptCopied ? '已复制' : '复制 gh 提示词'}
          </button>
          <p className="sl-gh-import__promptbar-hint">
            复制后发给任意 AI agent,它会在本机运行 gh 生成 TOML,再粘贴到上面。
          </p>
        </div>

        {/* 格式说明(折叠) */}
        <div className="sl-gh-import__format">
          <div className="sl-gh-import__format-head">
            <button
              type="button"
              className="sl-gh-import__format-toggle"
              onClick={() => setShowFormat(!showFormat)}
            >
              {showFormat ? '收起格式说明' : '查看格式说明'}
            </button>
            <button
              type="button"
              className={`sl-gh-import__format-copy${formatCopied ? ' is-copied' : ''}`}
              onClick={handleCopyFormat}
              title="复制 TOML 格式说明,发给 AI 生成合规 TOML"
            >
              {formatCopied ? '已复制' : '复制格式提示词'}
            </button>
          </div>
          {showFormat && (
            <div className="sl-gh-import__format-body">
              <pre>{FORMAT_PROMPT}</pre>
            </div>
          )}
        </div>

        {/* 导入结果汇总 */}
        {resultSummary && (
          <div className="sl-gh-import__result">
            导入完成: 新增 {resultSummary.rowsAdded} 行,新建 {resultSummary.columnsCreated} 列
            {resultSummary.rowsSkipped > 0 && `,跳过已存在 ${resultSummary.rowsSkipped} 行`}
            {resultSummary.errors.length > 0 && (
              <div className="sl-gh-import__result-warn">
                {resultSummary.errors.length} 条警告已忽略
              </div>
            )}
          </div>
        )}

        {/* 底部按钮 */}
        <div className="sl-gh-import__actions">
          {!resultSummary ? (
            <>
              <button type="button" className="sl-gh-btn sl-gh-btn--ghost" onClick={handleClose}>
                取消
              </button>
              <button
                type="button"
                className="sl-gh-btn sl-gh-btn--primary"
                disabled={!isValid}
                onClick={handleConfirm}
              >
                确认导入
              </button>
            </>
          ) : (
            <button type="button" className="sl-gh-btn sl-gh-btn--primary" onClick={handleClose}>
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** 待新建列数 */
function pendingColumnCount(result: GithubShowImportParseResult): number {
  return result.pendingColumnTitles.length;
}
