// packages/react-components/src/color-studio/index.tsx
//
// 顶层组件,组合 ColorStudioProvider + 各子组件 + 全局快捷键监听。

import './index.css';
import { ColorStudioProvider } from './src/state/ColorStudioProvider';
import { ColorWheel } from './src/components/ColorWheel';
import { ColorDetailPanel } from './src/components/ColorDetailPanel';
import { PaletteSidebar } from './src/components/PaletteSidebar';
import { QuickAddBar } from './src/components/QuickAddBar';
import { PickerPanel } from './src/components/PickerPanel';
import { HistoryStrip } from './src/components/HistoryStrip';
import { KeyboardHints } from './src/components/KeyboardHints';
import { useKeyboardShortcuts } from './src/hooks/useKeyboardShortcuts';
import { useColorStudio } from './src/state/useColorStudio';

export default function ColorStudio() {
  return (
    <ColorStudioProvider>
      <Shell />
    </ColorStudioProvider>
  );
}

function Shell() {
  const { status, authState } = useColorStudio();
  useKeyboardShortcuts();
  return (
    <div className="sl-cs">
      <header className="sl-cs__header">
        <h2>Color Studio</h2>
        <span className={`sl-cs__status sl-cs__status--${status}`}>
          {status === 'saving' ? '保存中...' : status === 'synced' ? '已同步' : status}
        </span>
        <span className="sl-cs__auth">{authState === 'logged-in' ? '已登录' : '未登录'}</span>
      </header>
      <aside className="sl-cs__left"><PaletteSidebar /></aside>
      <main className="sl-cs__main">
        <section className="sl-cs__wheel"><ColorWheel /></section>
        <section className="sl-cs__detail"><ColorDetailPanel /></section>
        <section className="sl-cs__history"><HistoryStrip /></section>
      </main>
      <aside className="sl-cs__right">
        <PickerPanel />
        <KeyboardHints />
      </aside>
      <footer className="sl-cs__bottom"><QuickAddBar /></footer>
    </div>
  );
}
