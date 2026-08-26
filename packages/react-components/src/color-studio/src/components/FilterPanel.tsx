// packages/react-components/src/color-studio/src/components/FilterPanel.tsx
//
// 滤镜栈编辑:加/删/开关/调值;预览区实时应用 CSS filter(非破坏性)。

import { useMemo } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { filterStackToCss } from '../engine/filterCss';
import { applyFilterStackToHex } from '../engine/filterColor';
import { addEntryToActivePalette } from '../utils/paletteActions';
import { makeId } from '../utils/id';
import { Btn } from './ui/Btn';
import { Icon } from './ui/Icon';
import type { ColorEntry, FilterType } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

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
  const hasActive = stack.some((f) => f.enabled);

  // 滤镜作用对象 = 活动调色板(即分组;"未分组"= 池中不属于任何板,暂不在此列出)
  const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const entries = useMemo(() => {
    if (!palette) return [] as ColorEntry[];
    return palette.colorIds
      .map((cid) => doc.colorEntries.find((c) => c.id === cid))
      .filter((c): c is ColorEntry => !!c);
  }, [palette, doc.colorEntries]);

  /** 每色的烘焙结果 */
  const baked = useMemo(
    () => entries.map((e) => ({ entry: e, hex: applyFilterStackToHex(e.hex, stack) })),
    [entries, stack],
  );

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

  /** 单色固化:烘焙 hex 作为新色卡追加到活动板 */
  const bakeOne = (hex: string) => {
    setDoc((d) => addEntryToActivePalette(d, hex, 'filter'));
  };

  /** 全部固化:整组烘焙结果批量入板(跳过与原色相同的) */
  const bakeAll = () => {
    const changed = baked.filter((b) => b.hex !== b.entry.hex);
    if (changed.length === 0) return;
    setDoc((d) => {
      let next = d;
      for (const b of changed) {
        next = addEntryToActivePalette(next, b.hex, 'filter');
      }
      return next;
    });
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

      {/* 分组颜色列表:活动板每色 + 滤镜烘焙结果,逐个/全部添加为新颜色 */}
      <div className="sl-cs-filters__group">
        <div className="sl-cs-filters__grouphead">
          <Icon name="palette" size={12} />
          <span>{palette?.name ?? '当前分组'}</span>
          <span className="sl-cs-filters__groupcount">{baked.length} 色</span>
          <Btn
            variant="primary"
            size="sm"
            icon="plus"
            disabled={!hasActive || baked.every((b) => b.hex === b.entry.hex)}
            onClick={bakeAll}
            title="把整组烘焙结果批量添加为新颜色(与原色相同的跳过)"
          >
            全部添加
          </Btn>
        </div>
        <ul className="sl-cs-filters__grouplist">
          {baked.length === 0 && (
            <li className="sl-cs-filters__groupempty">当前调色板没有颜色</li>
          )}
          {baked.map(({ entry, hex }) => {
            const changed = hex !== entry.hex;
            return (
              <li key={entry.id} className="sl-cs-filters__grouprow">
                <span
                  className="sl-cs-filters__bakechip"
                  style={{ backgroundColor: hex }}
                  title={`滤镜后:${hex}`}
                />
                <span className="sl-cs-filters__arrow" title="滤镜前 → 滤镜后">
                  <code className="sl-cs-filters__from">{entry.hex}</code>
                  <Icon name="redo" size={10} />
                  <code className={`sl-cs-filters__to ${changed ? 'is-changed' : ''}`}>{hex}</code>
                </span>
                <Btn
                  variant="secondary"
                  size="sm"
                  iconOnly
                  icon="plus"
                  disabled={!hasActive}
                  onClick={() => bakeOne(hex)}
                  aria-label={`添加 ${hex} 为新颜色`}
                  title="添加为新颜色"
                />
              </li>
            );
          })}
        </ul>
      </div>

      {stack.length > 0 && (
        <p className="sl-cs-filters__css" title={css}>
          <code>filter: {css}</code>
        </p>
      )}
    </div>
  );
}
