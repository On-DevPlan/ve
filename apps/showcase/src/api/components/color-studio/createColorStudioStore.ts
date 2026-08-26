// apps/showcase/src/api/components/color-studio/createColorStudioStore.ts
//
// 业务封装:把整个 ColorStudioDocument 整体读写进 kvV1。
// 复用 shortcut-library / user-space 的单 key + 单 tag + 不传 groupId 范式。

import { kvV1Service } from '../../services';
import { ApiError } from '../../services/base';
import { docSchema } from './docSchema';
import type { ColorStudioDocument } from './types';
import { emptyDoc } from './types';

export const COLOR_STUDIO_KV_KEY = 'color-studio';
const COLOR_STUDIO_TAGS = ['color-studio'] as const;

export interface ColorStudioStoreLite {
  load(): Promise<ColorStudioDocument>;
  save(doc: ColorStudioDocument): Promise<void>;
  exportJson(doc: ColorStudioDocument): string;
  importJson(raw: string): ColorStudioDocument;
  readonly authState: 'logged-out' | 'logged-in' | 'syncing' | 'error';
}

export function createColorStudioStore(): ColorStudioStoreLite {
  async function load(): Promise<ColorStudioDocument> {
    try {
      const item = await kvV1Service.get({ key: COLOR_STUDIO_KV_KEY });
      // KV item.value is a JSON string; 解析 + Zod 校验,失败兜底到空文档。
      try {
        const parsed = JSON.parse(item.value);
        return docSchema.parse(parsed) as ColorStudioDocument;
      } catch {
        return emptyDoc();
      }
    } catch (e) {
      // code 50(no default group)、404(key 不存在)、其他网络错误 → 容错空文档
      if (e instanceof ApiError && (e.code === 50 || e.code === 404)) {
        return emptyDoc();
      }
      return emptyDoc();
    }
  }

  async function save(doc: ColorStudioDocument): Promise<void> {
    await kvV1Service.set({
      key: COLOR_STUDIO_KV_KEY,
      value: JSON.stringify(doc),
      tags: [...COLOR_STUDIO_TAGS],
      ttl: 0,
    });
  }

  function exportJson(doc: ColorStudioDocument): string {
    return JSON.stringify(doc, null, 2);
  }

  function importJson(raw: string): ColorStudioDocument {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('invalid JSON: cannot parse');
    }
    return docSchema.parse(parsed) as ColorStudioDocument;
  }

  return {
    load,
    save,
    exportJson,
    importJson,
    authState: 'logged-in',
  };
}
