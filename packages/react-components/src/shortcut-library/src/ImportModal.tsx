// ImportModal.tsx —— 粘贴/上传 TOML 的导入弹窗,内嵌格式说明

import { useRef, useState } from 'react';
import { parseImportToml, type ImportParseResult } from './import-parser';

interface Props {
  onImport: (data: ImportParseResult) => { groupsAdded: number; groupsAppended: number; shortcutsAdded: number; errors: string[] };
  onClose: () => void;
}

type TabMode = 'paste' | 'file';

// 格式说明 —— 喂给 LLM 用,让它直接产出符合本组件规范的 TOML。
// 设计原则:
//   1. 角色 + 任务清楚,LLM 不会被误以为是「通用 TOML 教学」
//   2. 字段表 + 修饰键表,机器生成时能直接查表
//   3. 多场景示例(纯组合、condition、重复修饰键),覆盖典型用法
//   4. 反例 + 易错点放在末尾,降低「自由发挥」概率
const FORMAT_PROMPT = `你是一个快捷键数据生成助手。根据用户需求,产出符合以下规范的 TOML,用于导入到 ShortcutLibrary 组件(一个本地快捷键管理工具)。

# === 格式规范 ===
# - 每个 \`[[groups]]\` 表示一个应用分组(如 VSCode、Chrome)
# - 每个 \`[[groups.shortcuts]]\` 是该分组下的一条快捷键
# - 同一分组的快捷键条目必须紧跟在该 \`[[groups]]\` 之后,不能跨组穿插
# - UTF-8 编码,使用中文说明时无需转义
# - 文件大小不超过 1 MB

# === 字段表 ===
# [[groups]]        类型:表数组        必填:是  说明:每个分组一个 [[groups]]
# name              类型:字符串        必填:是  说明:分组名称,如 "VSCode"、"Chrome"
# [[groups.shortcuts]]  类型:嵌套表数组  必填:否  说明:分组下的快捷键条目
# combo             类型:字符串        必填:是  说明:组合键,用 + 连接,如 "Ctrl+R"
# desc              类型:字符串        必填:否  说明:这条快捷键做什么(中文/英文均可)
# condition         类型:字符串        必填:否  说明:激活条件,纯备注,运行时不做检查。例:"选中数字时"、"仅 macOS"、"编辑器内"

# === 修饰键写法(不区分左右) ===
# Ctrl  Shift  Alt  ⌘(Meta/Command)

# === 主键写法(大小写不敏感) ===
# 字母: A-Z     数字: 0-9     功能键: F1-F12
# 方向: ↑ ↓ ← →
# 符号: - = [ ] ; ' , . / \` 以及反斜杠(写法见下方"字符串转义")
# 特殊: Enter Esc Tab Space Backspace
# 导航: Insert(Ins) Home PageUp(PgUp) Delete(Del) End PageDown(PgDn)
#       └ 括号内是等价简写,两种都能识别
# ⚠️ 以上就是全部可用按键。不在这个清单里的名字一律报"无法识别的按键"。

# === 字符串转义(TOML 双引号字符串规则) ===
# 在 combo / desc / condition 的双引号内,这两个字符必须转义:
#   反斜杠 → 写两个反斜杠      引号 → 写 \\"
# 例:反斜杠键这条快捷键(Krita 的"显示工具选项")
#   对: combo = "\\\\"          错: combo = "\\"
# 例:说明文字里出现路径
#   对: desc = "打开 C:\\\\Users 目录"
# 中文、全角标点、emoji 都不需要转义,直接写。

# === 不要这样写 ===
# - 不要用列表外的按键名。常见错误:
#     错 Return   → 对 Enter
#     错 Escape   → 对 Esc
#     错 Control  → 对 Ctrl
#     错 Ctrl_L   → 对 Ctrl
#     错 KeyA     → 对 A
#     错 Digit1   → 对 1
#     错 Minus    → 对 -
#     错 Numpad1  → 小键盘不支持,改用主键区数字 1
# - 不要把 + 键本身放进 combo —— + 是分隔符,无法转义。
#   需要表达 "Alt+Shift 加上加号键" 时,请改用它在主键行的符号名 =
#   (US 布局下 + 是 Shift+= ),例:combo = "Alt+Shift+="
#   同理 combo = "Alt+Shift++" 或 "Alt+Shift++;" 都会被静默解析成错误的组合键。
# - 不要用 combo = "" 或只有修饰键的 combo(如 "Ctrl+Shift"),必须有一个主键
# - 不要给同一分组写出两条完全相同的 combo(会被判为冲突并标红)

# === 示例 1:基础分组 ===
[[groups]]
name = "VSCode"

[[groups.shortcuts]]
combo = "Ctrl+R"
desc = "打开目录"

[[groups.shortcuts]]
combo = "Ctrl+Shift+P"
desc = "命令面板"

[[groups.shortcuts]]
combo = "Ctrl+P"
desc = "文件搜索"

# === 示例 2:多个分组 ===
[[groups]]
name = "Chrome"

[[groups.shortcuts]]
combo = "Ctrl+T"
desc = "新建标签页"

[[groups.shortcuts]]
combo = "Ctrl+Shift+T"
desc = "恢复关闭标签页"

[[groups]]
name = "Slack"

[[groups.shortcuts]]
combo = "Ctrl+K"
desc = "快速切换频道"

# === 示例 3:带激活条件的快捷键(条件为备注,不参与运行时判断) ===
[[groups]]
name = "Word"

[[groups.shortcuts]]
combo = "Ctrl+Shift+1"
desc = "上标"
condition = "选中文本时"

[[groups.shortcuts]]
combo = "Ctrl+Shift+2"
desc = "下标"
condition = "选中文本时"

[[groups.shortcuts]]
combo = "Ctrl+Shift+L"
desc = "切换侧边栏"
condition = "仅 Windows/Linux"

# === 示例 4:导航键 + 符号键 + 转义(照这个写法准没错) ===
[[groups]]
name = "Krita"

[[groups.shortcuts]]
combo = "PageUp"
desc = "切换到上一层图层"

[[groups.shortcuts]]
combo = "Ctrl+PageDown"
desc = "把当前图层下移一层"

[[groups.shortcuts]]
combo = "\\\\"
desc = "显示工具选项"
condition = "Krita 2.9.6 起 \\\\ 打开工具选项"

[[groups.shortcuts]]
combo = ";"
desc = "切换到上一个被激活的图层"

[[groups.shortcuts]]
combo = "Alt+Shift+="
desc = "切换上一个混合模式"
condition = "US 布局下 + 是 Shift+= ,所以这里写 ="

# === 易错点(必须避免) ===
# 1. combo 只写修饰键 → "Ctrl+Shift" 是非法,必须含主键
# 2. 主键用全名 → 错:"Control+R" / "Digit1" / "Minus";对:"Ctrl+R" / "1" / "-"
# 3. 顺序不规范 → 修饰键在前,主键在末尾,例:"Ctrl+Shift+P" 而不是 "P+Ctrl+Shift"
# 4. 出现未知字段 → 每个 [[groups.shortcuts]] 只允许 combo / desc / condition
# 5. 缩进/引号混乱 → name 与 desc 一律用双引号包裹
# 6. 反斜杠没转义 → 错:combo = "\\";对:combo = "\\\\"
# 7. 想表达 + 键 → 不能写 "+",改写成 "="(见示例 4)

# === 输出要求 ===
# - 只输出 TOML 文本,不要包裹在 markdown 代码块里(用户复制时不需要三个反引号 toml)
# - 不要写解释、不要写前言,直接第一行就是 [[groups]]
# - 不要使用 [[groups.shortcut]] 单数,必须是复数 shortcuts`;

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
              {showFormat ? '收起格式说明' : '查看格式说明'}
            </button>
            <button
              type="button"
              className={`sl-sl-modal__format-copy ${copied ? 'is-copied' : ''}`}
              onClick={handleCopyFormat}
              title="复制格式说明到剪贴板"
            >
              {copied ? '已复制' : '复制格式提示词'}
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
            导入完成: 新增 {resultSummary.groupsAdded} 个分组,
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
