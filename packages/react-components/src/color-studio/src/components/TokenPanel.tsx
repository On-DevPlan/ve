// packages/react-components/src/color-studio/src/components/TokenPanel.tsx
//
// 全局色彩变量:提升 / 解除 / 重命名 / 改色(改 token hex 全联动)。

import { useState } from 'react';
import { useColorStudio } from '../state/useColorStudio';
import { promoteToToken, unlinkToken, syncTokenLinks } from '../engine/tokenLink';
import { parseUserInput } from '../engine/colorMath';
import { Icon } from './ui/Icon';
import { Btn } from './ui/Btn';

export function TokenPanel() {
  const { doc, setDoc } = useColorStudio();
  const [naming, setNaming] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [editingHex, setEditingHex] = useState<string | null>(null);
  const [hexDraft, setHexDraft] = useState('');

  const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);

  /** 当前板内被 token 链接的条目 id 集 */
  const linkedIds = new Set(
    (palette?.colorIds ?? []).filter((cid) => doc.colorEntries.find((c) => c.id === cid)?.tokenId),
  );

  const commitPromote = () => {
    if (!naming) return;
    setDoc((d) => promoteToToken(d, naming, nameDraft).doc);
    setNaming(null);
  };

  const unlink = (entryId: string) => {
    setDoc((d) => unlinkToken(d, entryId));
  };

  /** 改 token hex:先改 token 本体,再同步所有引用条目 */
  const setTokenHex = (tokenId: string, raw: string) => {
    const hex = parseUserInput(raw);
    if (!hex) return;
    setDoc((d) => {
      const now = Date.now();
      const afterToken: typeof d = {
        ...d,
        globalTokens: d.globalTokens.map((t) =>
          t.id === tokenId ? { ...t, hex, updatedAt: now } : t,
        ),
        meta: { ...d.meta, updatedAt: now },
      };
      return syncTokenLinks(afterToken, tokenId, hex) ?? afterToken;
    });
    setEditingHex(null);
  };

  const renameToken = (tokenId: string, name: string) => {
    setDoc((d) => ({
      ...d,
      globalTokens: d.globalTokens.map((t) =>
        t.id === tokenId ? { ...t, name: name.trim() || t.name, updatedAt: Date.now() } : t,
      ),
      meta: { ...d.meta, updatedAt: Date.now() },
    }));
  };

  return (
    <div className="sl-cs-tokens">
      <div className="sl-cs-tokens__head">
        <h4><Icon name="group" size={13} /> 全局色</h4>
        <span className="sl-cs-tokens__count">{doc.globalTokens.length}</span>
      </div>

      {doc.globalTokens.length === 0 && (
        <p className="sl-cs-tokens__empty">暂无全局色。点击色卡上的分组图标可提升为全局色。</p>
      )}

      <ul className="sl-cs-tokens__list">
        {doc.globalTokens.map((t) => (
          <li key={t.id} className="sl-cs-tokens__row" title={t.note}>
            {editingHex === t.id ? (
              <input
                autoFocus
                className="sl-cs-input sl-cs-tokens__hexinput"
                value={hexDraft}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={() => setTokenHex(t.id, hexDraft)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setTokenHex(t.id, hexDraft);
                  if (e.key === 'Escape') setEditingHex(null);
                }}
              />
            ) : (
              <button
                type="button"
                className="sl-cs-tokens__swatch"
                style={{ backgroundColor: t.hex }}
                onClick={() => { setHexDraft(t.hex); setEditingHex(t.id); }}
                title="点击改色(全量联动)"
                aria-label={`改 ${t.name} 色值`}
              />
            )}
            <input
              className="sl-cs-input sl-cs-tokens__nameinput"
              value={t.name}
              onChange={(e) => renameToken(t.id, e.target.value)}
              aria-label={`重命名 ${t.name}`}
            />
            <code className="sl-cs-tokens__hex">{t.hex}</code>
          </li>
        ))}
      </ul>

      {naming && (
        <div className="sl-cs-tokens__naming" role="dialog" aria-label="命名全局色">
          <input
            autoFocus
            className="sl-cs-input"
            placeholder="全局色名称,如:品牌蓝"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitPromote();
              if (e.key === 'Escape') setNaming(null);
            }}
          />
          <Btn variant="primary" size="sm" onClick={commitPromote}>提升</Btn>
          <Btn variant="ghost" size="sm" onClick={() => setNaming(null)}>取消</Btn>
        </div>
      )}

      {linkedIds.size > 0 && (
        <div className="sl-cs-tokens__linked">
          <p>当前板内已链接条目:</p>
          <ul>
            {Array.from(linkedIds).map((cid) => {
              const e = doc.colorEntries.find((c) => c.id === cid);
              if (!e) return null;
              return (
                <li key={cid}>
                  <span className="sl-cs-prop__dot" style={{ backgroundColor: e.hex }} />
                  <code>{e.hex}</code>
                  <Btn variant="ghost" size="sm" iconOnly icon="close" onClick={() => unlink(cid)} aria-label="解除引用" title="解除引用" />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
