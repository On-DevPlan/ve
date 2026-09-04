// src/composables/useSkinAdmin.ts — 游戏无关的皮肤管理工厂
//
// 从 useChessSkinAdmin.ts (490 行) 抽出的通用版：
//   - 所有游戏相关常量经 GameSkinRegistryEntry 注入
//   - KV key / tag 前缀 / groupId / assetKeys / fileNames 全部派生
//   - 对外 API 与原 useChessSkinAdmin 等价，便于视图无缝迁移
//   - 保留原 chess 的 boardBackground 孤儿 file 清理与 deleteSkin 并发删除语义
//
// 不打破现有 fileV1/kvV1 导入；仅新增对 gameSkinRegistry 的依赖。

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { kvV1Service, fileV1Service, type KvItem } from '@api/services';
import { jwtAuth } from '@api/http/auth-store';
import { resolveFileUrl } from '@api/tools/file-url';

import {
  type GameSkinRegistryEntry,
  type AiPromptArgs,
  resolveGameSkinEntry,
} from './gameSkinRegistry';

export type GroupRole = 'owner' | 'admin' | 'writer' | 'reader';

export interface AssetFile {
  fileId: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}

/** 通用皮肤 meta —— KV schema 字段名全游戏统一为 `pieces`（fr GameSkinMeta 只读此字段）。
 *  chess 放 12 keys（wK..bp），gomoku 放 black/white；字段名与具体游戏无关。 */
export interface SkinMeta {
  id: string;
  displayName: string;
  version: number;
  colorStyle?: string;
  createdAt: string;
  updatedAt: string;
  pieces?: Record<string, AssetFile>;
  boardBackground?: unknown;
  author?: string;
  description?: string;
}

export type AssetKey = string;

export interface DeleteSkinResult {
  pieceFilesDeleted: number;
  backgroundDeleted: boolean;
}

export interface ReplacePieceResult {
  meta: SkinMeta;
  orphanedCleaned: string[];
  orphanedFailed: { fileId: string; error: string }[];
}

function getAssetMap(meta: SkinMeta): Record<string, AssetFile> {
  return meta.pieces ?? {};
}

function setAssetMap(meta: SkinMeta, map: Record<string, AssetFile>): SkinMeta {
  // 字段名全游戏统一 `pieces`（与 fr lib/core/game_kit/skin/game_skin_meta.dart 对齐）。
  return { ...meta, pieces: map };
}

export function assetTags(entry: GameSkinRegistryEntry, skinId: string, assetKey: string): string[] {
  const p = entry.tagPrefix;
  return [p, `${p}:${skinId}`, `${p}:${skinId}:${assetKey}`];
}

// 兼容旧 import：chess 专用别名
export function pieceTags(entry: GameSkinRegistryEntry, skinId: string, pieceKey: string): string[] {
  return assetTags(entry, skinId, pieceKey);
}

export interface UseSkinAdmin {
  /** 当前游戏配置（响应式只读，由工厂闭包捕获） */
  entry: GameSkinRegistryEntry;
  /** 快捷：entry.assetKeys */
  assetKeys: readonly string[];
  /** 快捷：entry.fileNames */
  fileNames: Record<string, string>;
  index: Ref<SkinMeta[]>;
  myRole: Ref<GroupRole | null>;
  canEdit: ComputedRef<boolean>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  loginHint: ComputedRef<string | null>;
  loadIndex: () => Promise<void>;
  replacePiece: (skinId: string, assetKey: string, blob: Blob, originalName?: string) => Promise<ReplacePieceResult>;
  renameSkin: (skinId: string, newDisplayName: string) => Promise<SkinMeta>;
  deleteSkin: (skinId: string) => Promise<DeleteSkinResult>;
  applyBatchMeta: (meta: SkinMeta, files: Record<string, Blob>) => Promise<SkinMeta>;
  generateAiPrompt: (args: AiPromptArgs) => string;
  previewFileUrl: (fileId: string) => string;
}

export function useSkinAdmin(gameIdOrEntry: string | GameSkinRegistryEntry): UseSkinAdmin {
  const entry: GameSkinRegistryEntry =
    typeof gameIdOrEntry === 'string' ? resolveGameSkinEntry(gameIdOrEntry) : gameIdOrEntry;

  const index = ref<SkinMeta[]>([]);
  const myRole = ref<GroupRole | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const canEdit = computed(() => myRole.value === 'owner' || myRole.value === 'admin');
  const loginHint = computed(() => (jwtAuth.state.token ? null : '未登录：仅可预览，无法修改皮肤'));

  async function uploadAll(
    skinId: string,
    assetFiles: Partial<Record<string, Blob>>,
  ): Promise<Record<string, AssetFile>> {
    const out: Partial<Record<string, AssetFile>> = {};
    for (const key of entry.assetKeys) {
      const blob = assetFiles[key];
      if (!blob) throw new Error(`missing asset: ${key}`);
      const tags = assetTags(entry, skinId, key);
      const info = await fileV1Service.upload({
        file: blob,
        groupId: entry.groupId,
        tags,
      });
      out[key] = {
        fileId: info.fileId,
        fileName: entry.fileNames[key] ?? `${key}.webp`,
        sizeBytes: info.size,
        contentType: info.contentType,
      };
    }
    return out as Record<string, AssetFile>;
  }

  async function loadKvItem(): Promise<KvItem> {
    if (!jwtAuth.state.token) throw new Error('not logged in');
    return kvV1Service.get({ key: entry.kvIndexKey, groupId: entry.groupId });
  }

  async function persistIndex(next: SkinMeta[]): Promise<void> {
    await kvV1Service.set({
      key: entry.kvIndexKey,
      value: JSON.stringify(next),
      groupId: entry.groupId,
      tags: [entry.tagPrefix],
      ttl: 0,
    });
  }

  async function loadIndex() {
    loading.value = true;
    error.value = null;
    try {
      const item = await loadKvItem();
      myRole.value = item.myRole;
      try {
        const parsed = JSON.parse(item.value) as SkinMeta[];
        // 归一：确保每条都有可读的 asset map（防御旧数据）
        index.value = Array.isArray(parsed) ? parsed : [];
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

  async function replacePiece(
    skinId: string,
    assetKey: string,
    blob: Blob,
    originalName?: string,
  ): Promise<ReplacePieceResult> {
    if (!canEdit.value) throw new Error('insufficient role: need owner or admin');
    loading.value = true;
    error.value = null;
    try {
      const current = index.value.find((m) => m.id === skinId);
      if (!current) throw new Error(`skin not found: ${skinId}`);
      const assetMap = getAssetMap(current);
      const oldPiece = assetMap[assetKey];
      const oldFileId =
        oldPiece && typeof oldPiece.fileId === 'string' && oldPiece.fileId.length > 0
          ? oldPiece.fileId
          : null;

      const tags = assetTags(entry, skinId, assetKey);
      const info = await fileV1Service.upload({
        file: blob,
        groupId: entry.groupId,
        tags,
      });
      const newFileId = info.fileId;
      const newPiece: AssetFile = {
        fileId: newFileId,
        fileName: originalName ?? entry.fileNames[assetKey] ?? `${assetKey}.webp`,
        sizeBytes: info.size,
        contentType: info.contentType,
      };

      const now = new Date().toISOString();
      const next = index.value.map((m) => {
        if (m.id !== skinId) return m;
        const map = { ...getAssetMap(m), [assetKey]: newPiece };
        return setAssetMap({ ...m, version: (m.version ?? 0) + 1, updatedAt: now }, map);
      });
      const updated = next.find((m) => m.id === skinId);
      if (!updated) throw new Error(`skin not found: ${skinId}`);
      await persistIndex(next);
      index.value = next;

      const orphanedCleaned: string[] = [];
      const orphanedFailed: { fileId: string; error: string }[] = [];
      if (oldFileId && oldFileId !== newFileId) {
        try {
          await fileV1Service.delete({ fileId: oldFileId, groupId: entry.groupId });
          orphanedCleaned.push(oldFileId);
        } catch (e) {
          orphanedFailed.push({
            fileId: oldFileId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
      return { meta: updated, orphanedCleaned, orphanedFailed };
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function renameSkin(skinId: string, newDisplayName: string): Promise<SkinMeta> {
    if (!canEdit.value) throw new Error('insufficient role: need owner or admin');
    const trimmed = newDisplayName.trim();
    if (!trimmed) throw new Error('displayName 不能为空');
    loading.value = true;
    error.value = null;
    try {
      const next = index.value.map((m) =>
        m.id === skinId
          ? { ...m, displayName: trimmed, version: (m.version ?? 0) + 1, updatedAt: new Date().toISOString() }
          : m,
      );
      const updated = next.find((m) => m.id === skinId);
      if (!updated) throw new Error(`skin not found: ${skinId}`);
      await persistIndex(next);
      index.value = next;
      return updated;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function deleteSkin(skinId: string): Promise<DeleteSkinResult> {
    if (!canEdit.value) throw new Error('insufficient role: need owner or admin');
    loading.value = true;
    error.value = null;
    try {
      const target = index.value.find((m) => m.id === skinId);
      if (!target) throw new Error(`skin not found: ${skinId}`);

      const assetMap = getAssetMap(target);
      const pieceFileIds: string[] = Object.values(assetMap)
        .map((p) => p.fileId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      let backgroundFileId: string | null = null;
      const bg = target.boardBackground;
      if (bg && typeof bg === 'object' && 'fileId' in bg) {
        const fid = (bg as { fileId: unknown }).fileId;
        if (typeof fid === 'string' && fid.length > 0) backgroundFileId = fid;
      }

      const pieceResults = await Promise.allSettled(
        pieceFileIds.map((fileId) => fileV1Service.delete({ fileId, groupId: entry.groupId })),
      );
      const pieceFailures: { fileId: string; error: string }[] = [];
      pieceResults.forEach((r, i) => {
        if (r.status === 'rejected') {
          pieceFailures.push({
            fileId: pieceFileIds[i],
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          });
        }
      });

      let backgroundDeleted = false;
      let backgroundFailure: string | null = null;
      if (backgroundFileId) {
        try {
          await fileV1Service.delete({ fileId: backgroundFileId, groupId: entry.groupId });
          backgroundDeleted = true;
        } catch (e) {
          backgroundFailure = e instanceof Error ? e.message : String(e);
        }
      }

      if (pieceFailures.length > 0 || backgroundFailure) {
        const parts: string[] = [];
        if (pieceFailures.length > 0) {
          const ids = pieceFailures.map((f) => f.fileId.slice(0, 8)).join(', ');
          parts.push(`资源文件 ${pieceFailures.length} 个删除失败 (${ids})`);
        }
        if (backgroundFailure) parts.push(`背景图删除失败:${backgroundFailure}`);
        const msg = `${parts.join('；')}。KV index 未变更，该皮肤仍保留。`;
        error.value = msg;
        throw new Error(msg);
      }

      const next = index.value.filter((m) => m.id !== skinId);
      await persistIndex(next);
      index.value = next;
      return { pieceFilesDeleted: pieceFileIds.length, backgroundDeleted };
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function applyBatchMeta(meta: SkinMeta, files: Record<string, Blob>): Promise<SkinMeta> {
    if (!canEdit.value) throw new Error('insufficient role: need owner or admin');
    loading.value = true;
    error.value = null;
    try {
      const pieces = await uploadAll(meta.id, files);
      const now = new Date().toISOString();
      const full: SkinMeta = setAssetMap(
        { ...meta, version: 1, createdAt: meta.createdAt || now, updatedAt: now },
        pieces,
        entry,
      );
      const byId = new Map(index.value.map((m) => [m.id, m]));
      byId.set(full.id, full);
      const next = Array.from(byId.values());
      await persistIndex(next);
      index.value = next;
      return full;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function generateAiPrompt(args: AiPromptArgs): string {
    return entry.aiPrompt(args);
  }

  function previewFileUrl(fileId: string): string {
    if (!fileId) return '';
    return resolveFileUrl(`/files/${fileId}`);
  }

  return {
    entry,
    assetKeys: entry.assetKeys,
    fileNames: entry.fileNames,
    index,
    myRole,
    canEdit,
    loading,
    error,
    loginHint,
    loadIndex,
    replacePiece,
    renameSkin,
    deleteSkin,
    applyBatchMeta,
    generateAiPrompt,
    previewFileUrl,
  };
}
