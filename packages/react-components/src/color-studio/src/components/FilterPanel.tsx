// packages/react-components/src/color-studio/src/components/FilterPanel.tsx
//
// 滤镜栈编辑:加/删/开关/调值;预览区实时应用 CSS filter(非破坏性)。

import { useColorStudio } from '../state/useColorStudio';
import { filterStackToCss } from '../engine/filterCss';
import { makeId } from '../utils/id';
import { Btn } from './ui/Btn';
import { Icon } from './ui/Icon';
import type { FilterType } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

const FILTER_META: { type: FilterType; label: string; min: number; max: number; step: number; def: number }[] = [
  { type: 'brightness', label: '亮度', min: 0, max: 300, step: 5, def: 120 },
  { type: 'contrast', label: '对比度', min: 0, max: 300, step: 5, def: 120 },
  { type: 'saturate', label: '饱和度', min: 0, max: 300, step: 5, def: 150 },
  { type: 'hueRotate', label: '色相旋转', min: 0, max: 360, step: 5, def: 30 },
  { type: 'grayscale', label: '灰度', min: 0, max: 100, step: 5, def: 50 },
  { type: 'sepia', label: '棕褐', min: 0, max: 100, step: 5, def: 40 },
  { type: 'invert', label: '反相', min: 0, max: 100, step: 5, def: 100 },
];

export function FilterPanel() {
  const { doc, setDoc } = useColorStudio();
  const stack = doc.filterStack;
  const css = filterStackToCss(stack);

  const addFilter = (type: FilterType) => {
    const meta = FILTER_META.find((m) => m.type === type);
    if (!meta) return;
    setDoc((d) => ({
      ...d,
      filterStack: [...d.filterStack, { id: makeId(), type, value: meta.def, enabled: true }],
      meta: { ...d.meta, updatedAt: Date.now() },
    }));
  };

  const updateFilter = (id: string, patch: { value?: number; enabled?: boolean }) => {
    setDoc((d) => ({
      ...d,
      filterStack: d.filterStack.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      meta: { ...d.meta, updatedAt: Date.now() },
    }));
  };

  const removeFilter = (id: string) => {
    setDoc((d) => ({
      ...d,
      filterStack: d.filterStack.filter((f) => f.id !== id),
      meta: { ...d.meta, updatedAt: Date.now() },
    }));
  };

  return (
    <div className="sl-cs-filters">
      <div className="sl-cs-filters__head">
        <h4><Icon name="filter" size={13} /> 滤镜(非破坏性)</h4>
      </div>

      {/* 预览条:当前板色 + 滤镜 */}
      <div className="sl-cs-filters__preview" style={{ filter: css }}>
        {(() => {
          const p = doc.palettes.find((x) => x.id === doc.activePaletteId);
          const colors = (p?.colorIds ?? [])
            .map((cid) => doc.colorEntries.find((c) => c.id === cid)?.hex ?? '#000000')
            .slice(0, 8);
          return colors.map((hex, i) => (
            <span key={`${hex}-${i}`} style={{ backgroundColor: hex }} />
          ));
        })()}
      </div>

      <ul className="sl-cs-filters__list">
        {stack.map((f) => {
          const meta = FILTER_META.find((m) => m.type === f.type);
          if (!meta) return null;
          return (
            <li key={f.id} className={`sl-cs-filters__row ${f.enabled ? '' : 'is-disabled'}`}>
              <label className="sl-cs-filters__toggle">
                <input
                  type="checkbox"
                  checked={f.enabled}
                  onChange={(e) => updateFilter(f.id, { enabled: e.target.checked })}
                  aria-label={`启用 ${meta.label}`}
                />
              </label>
              <span className="sl-cs-filters__label">{meta.label}</span>
              <input
                type="range"
                min={meta.min}
                max={meta.max}
                step={meta.step}
                value={f.value}
                onChange={(e) => updateFilter(f.id, { value: Number(e.target.value) })}
                aria-label={`${meta.label} 数值`}
              />
              <span className="sl-cs-filters__value">{f.value}</span>
              <Btn variant="ghost" size="sm" iconOnly icon="close" onClick={() => removeFilter(f.id)} aria-label={`删除 ${meta.label}`} />
            </li>
          );
        })}
      </ul>

      <div className="sl-cs-filters__add">
        {FILTER_META.filter((m) => !stack.some((f) => f.type === m.type)).map((m) => (
          <Btn key={m.type} variant="secondary" size="sm" icon="plus" onClick={() => addFilter(m.type)}>
            {m.label}
          </Btn>
        ))}
      </div>
      {stack.length > 0 && (
        <p className="sl-cs-filters__css" title={css}>
          <code>filter: {css}</code>
        </p>
      )}
    </div>
  );
}
