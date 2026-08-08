// src/DebugPanel.tsx —— 高级调试开关 + 复位（设计规范 §6.4）
interface DebugPanelProps {
  debugMode: boolean;
  onToggleDebug: () => void;
  onReset: () => void;
}

export default function DebugPanel({ debugMode, onToggleDebug, onReset }: DebugPanelProps) {
  return (
    <div className="sl-cmc-debug">
      <label className="sl-cmc-debug-toggle">
        <input type="checkbox" checked={debugMode} onChange={onToggleDebug} />
        <span>高级调试（显示省份边界）</span>
      </label>
      <button type="button" className="sl-cmc-reset" onClick={onReset}>
        复位
      </button>
    </div>
  );
}
