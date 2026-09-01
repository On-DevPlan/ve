// src/composables/useChessSkinAdmin.ts —— 国际象棋皮肤管理 composable
//
// 职责:
//   1) loadIndex() —— 登录态 GET /api/v1/kv/chess_skin:index?groupId=190
//      一次拿 value + myRole(后端已返回)。前端用 myRole 决定 UI 可见性。
//   2) replacePiece(skinId, pieceKey, blob, originalName)
//      上传新图(fileV1 带 tags)+ 改 KV chess_skin:index 该 piece 的 fileId +1 version
//   3) applyBatchMeta(meta, files)
//      一次性上传 12 张图(每张带三级 tags),合并到 KV chess_skin:index
//   4) generateAiPrompt(args)
//      返回给用户的 AI 提示词(只输出 meta JSON 模板)
//   5) previewFileUrl(fileId) —— 拼同源 /files/<id> 给 <img src>
//
// 鉴权:
//   - loadIndex 是登录态;未登录时本 composable 退化为"只读 + 提示登录"
//   - replacePiece / applyBatchMeta 后端会按 groupId=190 的 myRole 校验;
//     前端用 myRole === 'owner' 决定 UI(后端兜底)。
//   - 全程只在 group 190 (shared 公共组) 下操作,与 fr chess-skin-pipeline 同源。

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { kvV1Service, fileV1Service, type KvItem } from '@api/services';
import { jwtAuth } from '@api/http/auth-store';
import { resolveFileUrl } from '@api/tools/file-url';

const KV_INDEX_KEY = 'chess_skin:index';
const SHARED_GROUP_ID = 190;
const COMMON_TAG = 'chess-skin';

export type GroupRole = 'owner' | 'admin' | 'writer' | 'reader';

export interface ChessPieceFile {
  fileId: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}

export interface ChessSkinMeta {
  id: string;
  displayName: string;
  version: number;
  colorStyle: string;
  createdAt: string;
  updatedAt: string;
  pieces: Record<string, ChessPieceFile>;
  boardBackground?: unknown;
}

export const PIECE_KEYS = [
  'wK', 'wQ', 'wR', 'wB', 'wN', 'wp',
  'bK', 'bQ', 'bR', 'bB', 'bN', 'bp',
] as const;
export type PieceKey = typeof PIECE_KEYS[number];

export const PIECE_KEY_FILENAME: Record<PieceKey, string> = {
  wK: '00_white_king.webp', wQ: '01_white_queen.webp', wR: '02_white_rook.webp',
  wB: '03_white_bishop.webp', wN: '04_white_knight.webp', wp: '05_white_pawn.webp',
  bK: '06_black_king.webp', bQ: '07_black_queen.webp', bR: '08_black_rook.webp',
  bB: '09_black_bishop.webp', bN: '10_black_knight.webp', bp: '11_black_pawn.webp',
};

export interface AiPromptArgs {
  skinId: string;
  displayName: string;
  colorStyle: 'vivid' | 'warm' | 'cool' | 'muted';
  /** 自由描述,告诉 AI 想要的美术风格/主题 */
  artDirection?: string;
}

/** 计算某 skin/piece 的三级 tag(与 fr retag_existing.py / add_skin.py 完全一致)。 */
export function pieceTags(skinId: string, pieceKey: string): string[] {
  return [COMMON_TAG, `chess-skin:${skinId}`, `chess-skin:${skinId}:${pieceKey}`];
}

export interface UseChessSkinAdmin {
  index: Ref<ChessSkinMeta[]>;
  myRole: Ref<GroupRole | null>;
  canEdit: ComputedRef<boolean>;
  loading: Ref<boolean>;
  error: Ref<string | null>;

  loadIndex: () => Promise<void>;
  replacePiece: (skinId: string, pieceKey: PieceKey, blob: Blob, originalName?: string) => Promise<ChessSkinMeta>;
  /** 改某皮肤的 displayName(版本号 +1,持久化 KV)。 */
  renameSkin: (skinId: string, newDisplayName: string) => Promise<ChessSkinMeta>;
  /** 从 KV index 移除该皮肤(文件资源不删)。 */
  deleteSkin: (skinId: string) => Promise<void>;
  applyBatchMeta: (meta: ChessSkinMeta, files: Record<PieceKey, Blob>) => Promise<ChessSkinMeta>;
  generateAiPrompt: (args: AiPromptArgs) => string;
  previewFileUrl: (fileId: string) => string;
  loginHint: ComputedRef<string | null>;
}

export function useChessSkinAdmin(): UseChessSkinAdmin {
  const index = ref<ChessSkinMeta[]>([]);
  const myRole = ref<GroupRole | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 写权限:owner + admin(后端按 groupId=190 的 myRole 兜底校验,
  // 前端这里只是少画按钮;writer 不开放 —— shared 公共组限定管理岗)
  const canEdit = computed(() => myRole.value === 'owner' || myRole.value === 'admin');
  const loginHint = computed(() =>
    jwtAuth.state.token ? null : '未登录：仅可预览,无法修改皮肤'
  );

  /** 同步上传 12 张图 + 合并写 KV。返回更新后的单 skin meta。 */
  async function uploadAll(
    skinId: string,
    pieceFiles: Partial<Record<PieceKey, Blob>>,
  ): Promise<Record<PieceKey, ChessPieceFile>> {
    const out: Partial<Record<PieceKey, ChessPieceFile>> = {};
    for (const key of PIECE_KEYS) {
      const blob = pieceFiles[key];
      if (!blob) throw new Error(`missing piece: ${key}`);
      const tags = pieceTags(skinId, key);
      const info = await fileV1Service.upload({
        file: blob,
        groupId: SHARED_GROUP_ID,
        tags,
      });
      out[key] = {
        fileId: info.fileId,
        fileName: PIECE_KEY_FILENAME[key],
        sizeBytes: info.size,
        contentType: info.contentType,
      };
    }
    return out as Record<PieceKey, ChessPieceFile>;
  }

  /** 拉 KV chess_skin:index(登录态);失败抛错。 */
  async function loadKvItem(): Promise<KvItem> {
    if (!jwtAuth.state.token) throw new Error('not logged in');
    return kvV1Service.get({ key: KV_INDEX_KEY, groupId: SHARED_GROUP_ID });
  }

  /** 把新 skin 合并进 index,写回 KV(replace by id)。 */
  async function persistIndex(next: ChessSkinMeta[]): Promise<void> {
    await kvV1Service.set({
      key: KV_INDEX_KEY,
      value: JSON.stringify(next),
      groupId: SHARED_GROUP_ID,
      tags: [COMMON_TAG],
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
        index.value = JSON.parse(item.value) as ChessSkinMeta[];
      } catch {
        index.value = [];
        error.value = 'KV chess_skin:index value 不是合法 JSON';
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      index.value = [];
      myRole.value = null;
    } finally {
      loading.value = false;
    }
  }

  /** 单棋子替换 —— 上传新图 + 改 index 该 piece 的 fileId + version+1。 */
  async function replacePiece(
    skinId: string,
    pieceKey: PieceKey,
    blob: Blob,
    originalName?: string,
  ): Promise<ChessSkinMeta> {
    if (!canEdit.value) throw new Error('insufficient role: need owner or admin');
    loading.value = true;
    error.value = null;
    try {
      // 1) 上传新图(带三级 tag)
      const tags = pieceTags(skinId, pieceKey);
      const info = await fileV1Service.upload({
        file: blob,
        groupId: SHARED_GROUP_ID,
        tags,
      });
      const newPiece: ChessPieceFile = {
        fileId: info.fileId,
        fileName: originalName ?? PIECE_KEY_FILENAME[pieceKey],
        sizeBytes: info.size,
        contentType: info.contentType,
      };
      // 2) 合并 KV index
      const now = new Date().toISOString();
      const next = index.value.map((m) =>
        m.id === skinId
          ? {
              ...m,
              version: (m.version ?? 0) + 1,
              updatedAt: now,
              pieces: { ...m.pieces, [pieceKey]: newPiece },
            }
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

  /** 重命名 —— 改 displayName + version+1 + updatedAt,持久化。 */
  async function renameSkin(
    skinId: string,
    newDisplayName: string,
  ): Promise<ChessSkinMeta> {
    if (!canEdit.value) throw new Error('insufficient role: need owner or admin');
    const trimmed = newDisplayName.trim();
    if (!trimmed) throw new Error('displayName 不能为空');
    loading.value = true;
    error.value = null;
    try {
      const next = index.value.map((m) =>
        m.id === skinId
          ? {
              ...m,
              displayName: trimmed,
              version: (m.version ?? 0) + 1,
              updatedAt: new Date().toISOString(),
            }
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

  /** 删除 —— 从 KV index 移除(文件资源保留)。 */
  async function deleteSkin(skinId: string): Promise<void> {
    if (!canEdit.value) throw new Error('insufficient role: need owner or admin');
    loading.value = true;
    error.value = null;
    try {
      const next = index.value.filter((m) => m.id !== skinId);
      if (next.length === index.value.length) {
        throw new Error(`skin not found: ${skinId}`);
      }
      await persistIndex(next);
      index.value = next;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /** 批量导入 —— 用户从 AI 拿到 meta + 12 张图后调这个。 */
  async function applyBatchMeta(
    meta: ChessSkinMeta,
    files: Record<PieceKey, Blob>,
  ): Promise<ChessSkinMeta> {
    if (!canEdit.value) throw new Error('insufficient role: need owner or admin');
    loading.value = true;
    error.value = null;
    try {
      // 1) 上传 12 张
      const pieces = await uploadAll(meta.id, files);
      const now = new Date().toISOString();
      const full: ChessSkinMeta = {
        ...meta,
        version: 1,
        createdAt: meta.createdAt || now,
        updatedAt: now,
        pieces: pieces as ChessSkinMeta['pieces'],
      };
      // 2) 合并 KV index
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
    const art = args.artDirection?.trim() || '保持统一视觉风格,边缘干净,适合在棋盘上缩放至 32×32 显示';
    const pieceExample = (k: PieceKey) =>
      `    "${k}": { "fileId": "TBD", "fileName": "${PIECE_KEY_FILENAME[k]}", "sizeBytes": 0, "contentType": "image/webp" }`;
    const piecesJson = PIECE_KEYS.map(pieceExample).join(',\n');
    return [
      '请输出一个国际象棋皮肤 meta JSON(只输出 JSON,不要任何解释/代码块/前后缀文字)。',
      '',
      '皮肤主题：' + art,
      '',
      'JSON schema:',
      '{',
      `  "id": "${args.skinId}",`,
      `  "displayName": "${args.displayName}",`,
      '  "version": 1,',
      `  "colorStyle": "${args.colorStyle}",`,
      '  "createdAt": "<ISO 8601 时间戳,例如 2026-09-01T00:00:00Z>",',
      '  "updatedAt": "<ISO 8601 时间戳>",',
      '  "pieces": {',
      piecesJson,
      '  }',
      '}',
      '',
      '硬约束：',
      '- id 必须匹配 ^[a-z0-9][a-z0-9-]{0,31}$(你已经拿到 skinId,直接填)',
      '- 12 个 piece key 必须齐全:wK wQ wR wB wN wp / bK bQ bR bB bN bp',
      '- 所有 fileId 先填 "TBD" 占位 —— 用户拿到 JSON 后会用批量上传脚本回填',
      '- createdAt / updatedAt 都填当前时间(ISO 8601)',
      '- colorStyle 必须是 vivid / warm / cool / muted 之一',
    ].join('\n');
  }

  /** /files/<id> 同源路径(供 <img src>)—— 后端 url 已 resolveFileUrl 改写过,这里再保险一次。 */
  function previewFileUrl(fileId: string): string {
    if (!fileId) return '';
    return resolveFileUrl(`/files/${fileId}`);
  }

  return {
    index,
    myRole,
    canEdit,
    loading,
    error,
    loadIndex,
    replacePiece,
    renameSkin,
    deleteSkin,
    applyBatchMeta,
    generateAiPrompt,
    previewFileUrl,
    loginHint,
  };
}
