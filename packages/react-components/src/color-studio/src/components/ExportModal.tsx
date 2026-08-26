// packages/react-components/src/color-studio/src/components/ExportModal.tsx
//
// 导出弹窗:四种格式 tabs + 预览 + 复制 / 下载。

import { useMemo, useState } from 'react';
import { Icon } from './ui/Icon';
import { Btn } from './ui/Btn';
import { useColorStudio } from '../state/useColorStudio';
import { EXPORT_FORMATS, exportDoc, type ExportFormat } from '../engine/exporters';
import { writeClipboard } from '../utils/clipboard';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExportModal({ open, onClose }: Props) {
  const { doc } = useColorStudio();
  const [format, setFormat] = useState<ExportFormat>('css-vars');
  const [copied, setCopied] = useState(false);

  const content = useMemo(() => exportDoc(doc, format), [doc, format]);
  const meta = EXPORT_FORMATS.find((f) => f.value === format);

  if (!open) return null;

  const copy = async () => {
    await writeClipboard(content).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `color-studio.${meta?.ext ?? 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="sl-cs-modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div className="sl-cs-modal" role="dialog" aria-modal="true" aria-label="导出颜色">
        <header className="sl-cs-modal__head">
          <h3><Icon name="download" size={15} /> 导出</h3>
          <Btn variant="ghost" size="sm" iconOnly icon="close" onClick={onClose} aria-label="关闭" />
        </header>
        <div className="sl-cs-modal__tabs" role="tablist">
          {EXPORT_FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={format === f.value}
              className={`sl-cs-modal__tab ${format === f.value ? 'is-active' : ''}`}
              onClick={() => setFormat(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <textarea
          className="sl-cs-modal__preview"
          value={content}
          readOnly
          aria-label="导出内容预览"
        />
        <footer className="sl-cs-modal__foot">
          <Btn variant="secondary" icon="copy" onClick={copy}>
            {copied ? '已复制' : '复制到剪贴板'}
          </Btn>
          <Btn variant="primary" icon="download" onClick={download}>
            下载 .{meta?.ext}
          </Btn>
        </footer>
      </div>
    </div>
  );
}
