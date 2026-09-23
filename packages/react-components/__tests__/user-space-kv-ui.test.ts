import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const inventory = readFileSync(resolve(__dirname, '../src/user-space/src/pages/Inventory.tsx'), 'utf8');
const modal = readFileSync(resolve(__dirname, '../src/user-space/src/pages/KvEditorModal.tsx'), 'utf8');
const indexTsx = readFileSync(resolve(__dirname, '../src/user-space/index.tsx'), 'utf8');
// 注意:repo 根 apps/ 在 __tests__ 的上三级(packages/react-components/__tests__ →
// ../../../apps),不是两级。此路径从 brief 修正。
const store = readFileSync(resolve(__dirname, '../../../apps/showcase/src/api/components/user-space/createUserSpaceStore.ts'), 'utf8');
const css = readFileSync(resolve(__dirname, '../src/user-space/index.css'), 'utf8');
const uploadModal = readFileSync(resolve(__dirname, '../src/user-space/src/pages/UploadFileModal.tsx'), 'utf8');

describe('user-space 与共享 FileDropZone 的样式装配', () => {
  it('上传弹窗用共享层的 zone 形态,不自备按钮类名、也不自画虚线框', () => {
    expect(uploadModal).toContain("variant: 'zone'");
    expect(uploadModal).not.toContain("variant: 'bare'");
    expect(uploadModal).not.toContain('buttonClass');
    // 框由共享层提供(style.css 的 .sl-file-drop--zone),这里再画一次就是框套框
    expect(uploadModal).not.toContain('dashed');
  });

  // 这两条 reset 特异性 (0,3,1) 高于共享按钮的 (0,1,0):命中时按钮会被擦成一行
  // 裸文字(不报错,纯静默失败)。上传弹窗现在走 zone(框内没有按钮)所以不会命中,
  // 这两处 carve-out 是**防御性**的 —— 一旦有人把该处换回 button / bare 形态,
  // 它们必须还在,否则就是又一次静默失败。
  it('两条 button reset 都放过共享组件的 sl-file-drop', () => {
    const resets = css
      .split(/\r?\n/)
      .filter((l) => /button:not\(\[class\*="sl-us-btn"\]\)/.test(l));
    expect(resets).toHaveLength(2);
    for (const line of resets) {
      expect(line).toContain(':not([class*="sl-file-drop"])');
    }
  });
});

describe('user-space KV management UI', () => {
  it('Inventory renders write controls only for writer+', () => {
    expect(inventory).toContain('hasMinRole');
    expect(inventory).toContain('新建');
    expect(inventory).toContain('详情');
  });

  it('Inventory wires pagination and tag filter', () => {
    expect(inventory).toContain('pageSize');
    expect(inventory).toContain('total');
    expect(inventory).toContain('onTagChange');
  });

  it('KvEditorModal locks key in edit mode and converts ttl days to seconds', () => {
    expect(modal).toContain('disabled');
    expect(modal).toContain('* 86400');
    expect(modal).toContain('portal');
  });

  it('KvEditorModal shows version history selector in edit mode (restore to version)', () => {
    expect(modal).toContain('版本历史');
    expect(modal).toContain('恢复该版本');
    expect(modal).toContain('onRestoreVersion');
    expect(modal).toContain('versionsLoading');
    expect(modal).toContain('mode === \'edit\'');
  });

  it('index.tsx passes listKvs/createKv/updateKv/deleteKv down to Inventory', () => {
    expect(indexTsx).toContain('listKvs');
    expect(indexTsx).toContain('createKv');
    expect(indexTsx).toContain('updateKv');
    expect(indexTsx).toContain('deleteKv');
  });

  it('index.tsx wires version history: listKvVersions load + restoreKv handler', () => {
    expect(indexTsx).toContain('listKvVersions');
    expect(indexTsx).toContain('restoreKv');
    expect(indexTsx).toContain('kvVersions');
    expect(indexTsx).toContain('onRestoreVersion');
  });

  it('store exposes listKvVersions + restoreKv for the version selector', () => {
    expect(store).toContain('listKvVersions');
    expect(store).toContain('restoreKv');
    expect(store).toContain('kvV1Service.versions');
    expect(store).toContain('kvV1Service.restore');
  });

  it('store no longer exposes legacy inventory()', () => {
    expect(store).not.toContain('async function inventory');
  });
});
