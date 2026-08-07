import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const inventory = readFileSync(resolve(__dirname, '../src/user-space/src/pages/Inventory.tsx'), 'utf8');
const modal = readFileSync(resolve(__dirname, '../src/user-space/src/pages/KvEditorModal.tsx'), 'utf8');
const indexTsx = readFileSync(resolve(__dirname, '../src/user-space/index.tsx'), 'utf8');
// 注意:repo 根 apps/ 在 __tests__ 的上三级(packages/react-components/__tests__ →
// ../../../apps),不是两级。此路径从 brief 修正。
const store = readFileSync(resolve(__dirname, '../../../apps/showcase/src/api/components/user-space/createUserSpaceStore.ts'), 'utf8');

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
