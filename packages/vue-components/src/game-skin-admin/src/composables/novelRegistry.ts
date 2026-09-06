// novelRegistry.ts — 小说公共目录（group 190）
//
// 与 fr lib/core/novel_reader/novel_reader_constants.dart 对齐：
//   KV key  = novel_reader_catalog:index
//   tag     = novel-reader-catalog
//   groupId = 190
//   visibility = public
//
// value = NovelBookEntry[]（内置书元数据；正文仍走 remoteUrl / 本地文件）

export interface NovelCatalogEntry {
  id: string;
  title: string;
  fileName: string;
  source?: 'builtIn' | 'imported';
  remoteUrl?: string | null;
  importedAt?: number | null;
  fileId?: string | null;
  updatedAt?: number | null;
}

export const NOVEL_CATALOG = {
  kvIndexKey: 'novel_reader_catalog:index',
  tagPrefix: 'novel-reader-catalog',
  groupId: 190,
} as const;

/** Seed used when catalog key is missing — matches fr NovelReaderConstants. */
export const NOVEL_DEFAULT_CATALOG: NovelCatalogEntry[] = [
  {
    id: 'builtin_seven_day',
    title: 'Seven Day',
    fileName: 'sevenDay.txt',
    source: 'builtIn',
    remoteUrl:
      'https://kklrbynhqpwwhtfanqwt.supabase.co/storage/v1/object/public/music/assets/books/sevenDay.txt',
  },
];

export function emptyNovelDraft(): NovelCatalogEntry {
  return {
    id: '',
    title: '',
    fileName: '',
    source: 'builtIn',
    remoteUrl: '',
  };
}

export function validateNovelEntry(e: NovelCatalogEntry): string | null {
  const id = e.id?.trim() ?? '';
  const title = e.title?.trim() ?? '';
  const fileName = e.fileName?.trim() ?? '';
  if (!id) return 'id 不能为空';
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) {
    return 'id 仅允许字母数字、_、-，且以字母数字开头';
  }
  if (!title) return 'title 不能为空';
  if (!fileName) return 'fileName 不能为空';
  if (e.remoteUrl && e.remoteUrl.trim()) {
    try {
      new URL(e.remoteUrl.trim());
    } catch {
      return 'remoteUrl 不是合法 URL';
    }
  }
  return null;
}
