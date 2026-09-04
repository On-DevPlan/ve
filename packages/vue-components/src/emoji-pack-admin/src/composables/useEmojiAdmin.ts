// src/composables/useEmojiAdmin.ts — 表情包管理的 open-set 工厂
//
// 复用 fileV1/kvV1 from game-skin-admin pattern：
//   loadIndex / uploadEmoji / deleteEmoji / reorder / previewFileUrl
//   KV key = emoji_<scope>:index, tag = <scope>-emoji, groupId 190
// 对外 API：scope 注入，其余派生；index 为 Flat open-set list。

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { kvV1Service, fileV1Service, type KvItem } from '@api/services';
import { jwtAuth } from '@api/http/auth-store';
import { resolveFileUrl } from '@api/tools/file-url';

import {
  type EmojiScopeEntry,
  emojiTags,
  resolveEmojiScopeEntry,
} from './emojiRegistry';

export type GroupRole = 'owner' | 'admin' | 'writer' | 'reader';

export interface EmojiFileRef {
  fileId: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}

export interface EmojiMeta {
  id: string;
  displayName?: string;
  file: EmojiFileRef;
  author?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type EmojiId = string;

export interface DeleteEmojiResult {
  fileDeleted: boolean;
}

export interface ReorderResult {
  orderedIds: string[];
}

export interface UseEmojiAdmin {
  entry: EmojiScopeEntry;
  index: Ref<EmojiMeta[]>;
  myRole: Ref<GroupRole | null>;
  canEdit: ComputedRef<boolean>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  loginHint: ComputedRef<string | null>;
  loadIndex: () => Promise<void>;
  uploadEmoji: (blob: Blob, emojiId: string, displayName?: string) => Promise<EmojiMeta>;
  deleteEmoji: (emojiId: string) => Promise<DeleteEmojiResult>;
  reorder: (orderedIds: string[]) => Promise<ReorderResult>;
  previewFileUrl: (fileId: string) => string;
}

function emojiIdPatternOk(id: string): boolean {
  return /^[a-z0-9][a-z0-9-_]{0,31}$/.test(id);
}

export function useEmojiAdmin(scopeOrEntry: string | EmojiScopeEntry): UseEmojiAdmin {
  const entry: EmojiScopeEntry =
    typeof scopeOrEntry === 'string' ? resolveEmojiScopeEntry(scopeOrEntry) : scopeOrEntry;

  const index = ref<EmojiMeta[]>([]);
  const myRole = ref<GroupRole | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const canEdit = computed(() => myRole.value === 'owner' || myRole.value === 'admin');
  const loginHint = computed(() => (jwtAuth.state.token ? null : '未登录：仅可预览，无法修改表情'));

  async function loadKvItem(): Promise<KvItem> {
    if (!jwtAuth.state.token) throw new Error('not logged in');
    return kvV1Service.get({ key: entry.kvIndexKey, groupId: entry.groupId });
  }

  async function persistIndex(next: EmojiMeta[]): Promise<void> {
    await kvV1Service.set({
      key: entry.kvIndexKey,
      value: JSON.stringify(next),
      groupId: entry.groupId,
      tags: [entry.tagPrefix],
      ttl: 0,
    });
  }

  function normalizeList(parsed: unknown): EmojiMeta[] {
    if (!Array.isArray(parsed)) return [];
    const out: EmojiMeta[] = [];
    const seen = new Set<string>();
    for (const raw of parsed) {
      if (!raw || typeof raw !== 'object') continue;
      const m = raw as Record<string, unknown>;
      const id = typeof m.id === 'string' ? (m.id as string).trim() : '';
      if (!id || !emojiIdPatternOk(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      const file = m.file as Record<string, unknown> | undefined;
      if (!file || typeof file.fileId !== 'string' || !file.fileId) continue;
      out.push({
        id,
        displayName: typeof m.displayName === 'string' ? (m.displayName as string) : undefined,
        file: {
          fileId: file.fileId as string,
          fileName: typeof file.fileName === 'string' ? (file.fileName as string) : `${id}.webp`,
          sizeBytes:
            typeof file.sizeBytes === 'number' ? (file.sizeBytes as number) : 0,
          contentType:
            typeof file.contentType === 'string'
              ? (file.contentType as string)
              : 'image/webp',
        },
        author: typeof m.author === 'string' ? (m.author as string) : undefined,
        version: typeof m.version === 'number' ? (m.version as number) : 1,
        createdAt: typeof m.createdAt === 'string' ? (m.createdAt as string) : undefined,
        updatedAt: typeof m.updatedAt === 'string' ? (m.updatedAt as string) : undefined,
      });
    }
    return out;
  }

  async function loadIndex(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const item = await loadKvItem();
      myRole.value = item.myRole;
      try {
        const parsed = JSON.parse(item.value) as unknown;
        index.value = normalizeList(parsed);
      } catch {
        index.value = [];
        error.value = `KV ${entry.kvIndexKey} value 不是合法 JSON`;
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      index.value = [];
      myRole.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function uploadEmoji(
    blob: Blob,
    emojiId: string,
    displayName?: string,
  ): Promise<EmojiMeta> {
    if (!canEdit.value) throw new Error('insufficient role: need owner or admin');
    const id = emojiId.trim().toLowerCase();
    if (!id) throw new Error('emoji id 不能为空');
    if (!emojiIdPatternOk(id)) throw new Error('emoji id 需匹配 ^[a-z0-9][a-z0-9-_]{0,31}$');
    if (index.value.some((e) => e.id === id)) throw new Error(`emoji 已存在: ${id}`);
    loading.value = true;
    error.value = null;
    try {
      const tags = emojiTags(entry.scope, id);
      const info = await fileV1Service.upload({
        file: blob,
        groupId: entry.groupId,
        tags,
      });
      const now = new Date().toISOString();
      const meta: EmojiMeta = {
        id,
        displayName: (displayName?.trim() || id),
        file: {
          fileId: info.fileId,
          fileName: `${id}.webp`,
          sizeBytes: info.size,
          contentType: info.contentType,
        },
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      const next = [...index.value, meta];
      await persistIndex(next);
      index.value = next;
      return meta;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function deleteEmoji(emojiId: string): Promise<DeleteEmojiResult> {
    if (!canEdit.value) throw new Error('insufficient role: need owner or admin');
    loading.value = true;
    error.value = null;
    try {
      const target = index.value.find((m) => m.id === emojiId);
      if (!target) throw new Error(`emoji not found: ${emojiId}`);
      const fileId = target.file.fileId;
      let fileDeleted = false;
      let fileDeleteError: string | null = null;
      if (fileId) {
        try {
          await fileV1Service.delete({ fileId, groupId: entry.groupId });
          fileDeleted = true;
        } catch (e) {
          fileDeleteError = e instanceof Error ? e.message : String(e);
        }
      }
      if (fileDeleteError) {
        const msg = `文件删除失败 ${fileId.slice(0, 8)}: ${fileDeleteError}。KV index 未变更。`;
        error.value = msg;
        throw new Error(msg);
      }
      const next = index.value.filter((m) => m.id !== emojiId);
      await persistIndex(next);
      index.value = next;
      return { fileDeleted };
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function reorder(orderedIds: string[]): Promise<ReorderResult> {
    if (!canEdit.value) throw new Error('insufficient role: need owner or admin');
    loading.value = true;
    error.value = null;
    try {
      const byId = new Map(index.value.map((m) => [m.id, m]));
      if (orderedIds.length !== byId.size) throw new Error('reorder: 长度不一致');
      for (const id of orderedIds) {
        if (!byId.has(id)) throw new Error(`reorder: 未知 emoji id: ${id}`);
      }
      const next = orderedIds.map((id) => byId.get(id)!);
      await persistIndex(next);
      index.value = next;
      return { orderedIds };
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function previewFileUrl(fileId: string): string {
    if (!fileId) return '';
    return resolveFileUrl(`/files/${fileId}`);
  }

  return {
    entry,
    index,
    myRole,
    canEdit,
    loading,
    error,
    loginHint,
    loadIndex,
    uploadEmoji,
    deleteEmoji,
    reorder,
    previewFileUrl,
  };
}
