// packages/react-components/src/color-studio/src/components/ProportionalView.tsx
//
// 比例呈现:条形 / 环形 / 面积 三种渲染,按 ColorEntry.weight 归一化。
// 拖条形分割线 / 输入百分比改权重。

import { useMemo, useState } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { normalizeWeights, donutSlicePath } from '../engine/proportional';
import { Icon } from './ui/Icon';
import type { ColorEntry } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

type Mode = 'bar' | 'donut' | 'area';

const DONUT_SIZE = 220;
const DONUT_RO = 100;
const DONUT_RI = 55;

export function ProportionalView() {
  const { doc, setDoc } = useColorStudio();
  const [mode, setMode] = useState<Mode>('bar');
  const [editing, setEditing] = useState<string | null>(null);
  const [draftPct, setDraftPct] = useState('');

  const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const entries = useMemo(() => {
    if (!palette) return [] as ColorEntry[];
    return palette.colorIds
      .map((cid) => doc.colorEntries.find((c) => c.id === cid))
      .filter((c): c is ColorEntry => !!c);
  }, [palette, doc.colorEntries]);
  const slices = useMemo(() => normalizeWeights(entries), [entries]);

  const setWeight = (entryId: string, weight: number) => {
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.map((c) =>
        c.id === entryId ? { ...c, weight: Math.max(0, Math.min(100, weight)), updatedAt: Date.now() } : c,
      ),
      meta: { ...d.meta, updatedAt: Date.now() },
    }));
  };

  const commitPct = (entryId: string) => {
    const v = parseFloat(draftPct);
    if (!Number.isNaN(v)) setWeight(entryId, v);
    setEditing(null);
  };

  const startBarDrag = (index: number, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const container = e.currentTarget.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      // 分割线 index 表示 slice[index-1] 与 slice[index] 的边界
      const leftW = ratio * 100;
      const rightW = 100 - leftW;
      const left = slices[index - 1];
      const right = slices[index];
      if (!left || !right) return;
      // 按比例换算回 weight(保持右侧总和)
      const rightTotal = slices.slice(index).reduce((s, sl) => s + sl.entry.weight, 0);
      const newLeft = rightTotal > 0 ? (leftW / rightW) * rightTotal : leftW;
      setWeight(left.entry.id, Math.round(newLeft * 100) / 100);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  if (entries.length === 0) {
    return <div className="sl-cs-prop sl-cs-prop--empty">当前调色板没有颜色</div>;
  }

  return (
    <div className="sl-cs-prop">
      <div className="sl-cs-prop__toolbar">
        {(['bar', 'donut', 'area'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`sl-cs-btn sl-cs-btn--sm sl-cs-btn--ghost ${mode === m ? 'is-active' : ''}`}
            onClick={() => setMode(m)}
          >
            {m === 'bar' ? '条形' : m === 'donut' ? '环形' : '面积'}
          </button>
        ))}
      </div>

      {mode === 'bar' && (
        <div className="sl-cs-prop__bar">
          <div className="sl-cs-prop__bartrack">
            {slices.map((s, i) => (
              <div key={s.entry.id}>
                {i > 0 && (
                  <div
                    className="sl-cs-prop__divider"
                    onPointerDown={(e) => startBarDrag(i, e)}
                    role="separator"
                    aria-label={`调整 ${s.entry.hex} 占比`}
                  />
                )}
                <div
                  className="sl-cs-prop__barseg"
                  style={{ flexGrow: Math.max(0.0001, s.entry.weight), backgroundColor: s.entry.hex }}
                  title={`${s.entry.hex} ${s.pct}%`}
                >
                  {s.pct >= 12 && <span>{s.pct}%</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'donut' && (
        <svg
          className="sl-cs-prop__donut"
          width={DONUT_SIZE}
          height={DONUT_SIZE}
          viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
        >
          {(() => {
            let acc = 0;
            return slices.map((s) => {
              const start = acc;
              acc += s.pct;
              return (
                <path
                  key={s.entry.id}
                  d={donutSlicePath(DONUT_SIZE / 2, DONUT_SIZE / 2, DONUT_RO, DONUT_RI, start, acc)}
                  fill={s.entry.hex}
                  stroke="var(--sl-color-surface, #fff)"
                  strokeWidth={1}
                >
                  <title>{`${s.entry.hex} ${s.pct}%`}</title>
                </path>
              );
            });
          })()}
        </svg>
      )}

      {mode === 'area' && (
        <div className="sl-cs-prop__area">
          {slices.map((s) => (
            <div
              key={s.entry.id}
              className="sl-cs-prop__areablock"
              style={{
                backgroundColor: s.entry.hex,
                flexGrow: Math.max(0.0001, s.entry.weight * s.entry.weight),
              }}
              title={`${s.entry.hex} ${s.pct}%`}
            >
              <span>{s.entry.hex}</span>
              <span>{s.pct}%</span>
            </div>
          ))}
        </div>
      )}

      <ul className="sl-cs-prop__list">
        {slices.map((s) => (
          <li key={s.entry.id} className="sl-cs-prop__row">
            <span className="sl-cs-prop__dot" style={{ backgroundColor: s.entry.hex }} />
            <code>{s.entry.hex}</code>
            {editing === s.entry.id ? (
              <input
                autoFocus
                className="sl-cs-input sl-cs-prop__pctinput"
                value={draftPct}
                onChange={(e) => setDraftPct(e.target.value)}
                onBlur={() => commitPct(s.entry.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitPct(s.entry.id);
                  if (e.key === 'Escape') setEditing(null);
                }}
              />
            ) : (
              <button
                type="button"
                className="sl-cs-prop__pct"
                onClick={() => { setDraftPct(String(s.entry.weight)); setEditing(s.entry.id); }}
                title="点击编辑权重"
              >
                {s.pct}%
              </button>
            )}
            <span className="sl-cs-prop__weight">权重 {s.entry.weight}</span>
          </li>
        ))}
      </ul>
      <p className="sl-cs-prop__hint">
        <Icon name="palette" size={11} /> 权重模拟实际使用面积占比;拖条形分割线或点击百分比直接输入
      </p>
    </div>
  );
}
