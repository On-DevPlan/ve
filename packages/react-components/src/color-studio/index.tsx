// packages/react-components/src/color-studio/index.tsx
//
// 顶层组件,组合 ColorStudioProvider + 各子组件 + 全局快捷键监听 + 导出弹窗。

import './index.css';
import { useState } from 'react';
import { ColorStudioProvider } from './src/state/ColorStudioProvider';
import { useColorStudio } from './src/state/useColorStudio';
import { ColorWheel } from './src/components/ColorWheel';
import { ColorDetailPanel } from './src/components/ColorDetailPanel';
import { PaletteSidebar } from './src/components/PaletteSidebar';
import { QuickAddBar } from './src/components/QuickAddBar';
import { PickerPanel } from './src/components/PickerPanel';
import { HistoryStrip } from './src/components/HistoryStrip';
import { ShortcutEditor } from './src/components/ShortcutEditor';
import { ExportModal } from './src/components/ExportModal';
import { Btn } from './src/components/ui/Btn';
import { useKeyboardShortcuts } from './src/hooks/useKeyboardShortcuts';
import { useShortcutPrefs } from './src/hooks/useShortcutPrefs';
import { useAutoFillEffect } from './src/hooks/useHarmony';

export default function ColorStudio() {
  return (
    <ColorStudioProvider>
      <Shell />
    </ColorStudioProvider>
  );
}

function Shell() {
  const { status, authState } = useColorStudio();
  const { prefs, ready, setKey, resetAll } = useShortcutPrefs();
  const [exportOpen, setExportOpen] = useState(false);
  useKeyboardShortcuts({ shortcuts: prefs.shortcuts });
  useAutoFillEffect();

  return (
    <div className="sl-cs">
      <header className="sl-cs__header">
        <h2>Color Studio</h2>
        <span className={`sl-cs__status sl-cs__status--${status}`}>
          {status === 'saving' ? '保存中...' : status === 'synced' ? '已同步' : status}
        </span>
        <span className="sl-cs__auth">{authState === 'logged-in' ? '已登录' : '未登录'}</span>
        <div className="sl-cs__header-actions">
          <Btn variant="secondary" size="sm" icon="download" onClick={() => setExportOpen(true)}>
            导出
          </Btn>
        </div>
      </header>
      <aside className="sl-cs__left"><PaletteSidebar /></aside>
      <main className="sl-cs__main">
        <section className="sl-cs__wheel"><ColorWheel /></section>
        <section className="sl-cs__detail"><ColorDetailPanel /></section>
        <section className="sl-cs__history"><HistoryStrip /></section>
      </main>
      <aside className="sl-cs__right">
        <PickerPanel />
        <ShortcutEditor prefs={prefs} ready={ready} setKey={setKey} resetAll={resetAll} />
      </aside>
      <footer className="sl-cs__bottom"><QuickAddBar /></footer>
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
