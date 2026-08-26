// packages/react-components/src/color-studio/index.tsx
//
// 顶层组件:ColorStudioProvider + 三视图切换(色盘/比例/笔刷)+
// 右栏(取色/全局色/滤镜/快捷键)+ 导出弹窗 + 全局快捷键。

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
import { ProportionalView } from './src/components/ProportionalView';
import { TokenPanel } from './src/components/TokenPanel';
import { FilterPanel } from './src/components/FilterPanel';
import { BrushCanvas } from './src/components/BrushCanvas';
import { Btn } from './src/components/ui/Btn';
import { Icon, type IconName } from './src/components/ui/Icon';
import { useKeyboardShortcuts } from './src/hooks/useKeyboardShortcuts';
import { useShortcutPrefs } from './src/hooks/useShortcutPrefs';
import { useAutoFillEffect } from './src/hooks/useHarmony';
import { makeId } from './src/utils/id';
import { parseUserInput } from './src/engine/colorMath';
import type { ColorStudioDocument } from '../../../../apps/showcase/src/api/components/color-studio/types';

const MAIN_VIEWS: { value: 'wheel' | 'proportional' | 'brush'; label: string; icon: IconName }[] = [
  { value: 'wheel', label: '色盘', icon: 'palette' },
  { value: 'proportional', label: '比例', icon: 'group' },
  { value: 'brush', label: '笔刷', icon: 'brush' },
];

export default function ColorStudio() {
  return (
    <ColorStudioProvider>
      <Shell />
    </ColorStudioProvider>
  );
}

function Shell() {
  const { doc, setDoc, status, authState } = useColorStudio();
  const { prefs, ready, setKey, resetAll } = useShortcutPrefs();
  const [exportOpen, setExportOpen] = useState(false);
  useKeyboardShortcuts({ shortcuts: prefs.shortcuts });
  useAutoFillEffect();

  const mainView = doc.viewState.mainView ?? 'wheel';

  const setMainView = (view: 'wheel' | 'proportional' | 'brush') => {
    setDoc((d) => ({
      ...d,
      viewState: { ...d.viewState, mainView: view },
      meta: { ...d.meta, updatedAt: Date.now() },
    }));
  };

  const addPickedColor = (hex: string) => {
    if (!parseUserInput(hex)) return;
    const ts = Date.now();
    setDoc((d) => {
      const id = makeId(ts);
      const next: ColorStudioDocument = {
        ...d,
        colorEntries: [...d.colorEntries, { id, hex, weight: 1, locked: false, note: '', tags: [], createdAt: ts, updatedAt: ts }],
        palettes: d.palettes.map((p) => p.id === d.activePaletteId
          ? { ...p, colorIds: [...p.colorIds, id], updatedAt: ts }
          : p),
        pickHistory: [{ hex, source: 'eyedropper', pickedAt: ts }, ...d.pickHistory].slice(0, 12),
        meta: { ...d.meta, updatedAt: ts },
      };
      return next;
    });
  };

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
      <aside className="sl-cs__left">
        <PaletteSidebar />
        <TokenPanel />
      </aside>
      <main className="sl-cs__main">
        <nav className="sl-cs__viewnav" role="tablist" aria-label="工作区视图">
          {MAIN_VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              role="tab"
              aria-selected={mainView === v.value}
              className={`sl-cs-btn sl-cs-btn--sm sl-cs-btn--ghost ${mainView === v.value ? 'is-active' : ''}`}
              onClick={() => setMainView(v.value)}
            >
              <Icon name={v.icon} size={13} /> {v.label}
            </button>
          ))}
        </nav>
        {mainView === 'wheel' && (
          <>
            <section className="sl-cs__wheel"><ColorWheel /></section>
            <section className="sl-cs__detail"><ColorDetailPanel /></section>
            <section className="sl-cs__history"><HistoryStrip /></section>
          </>
        )}
        {mainView === 'proportional' && (
          <section className="sl-cs__propwrap"><ProportionalView /></section>
        )}
        {mainView === 'brush' && (
          <section className="sl-cs__brushwrap"><BrushCanvas onPickColor={addPickedColor} /></section>
        )}
      </main>
      <aside className="sl-cs__right">
        <PickerPanel />
        <FilterPanel />
        <ShortcutEditor prefs={prefs} ready={ready} setKey={setKey} resetAll={resetAll} />
      </aside>
      <footer className="sl-cs__bottom"><QuickAddBar /></footer>
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
