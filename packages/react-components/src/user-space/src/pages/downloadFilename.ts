// downloadFilename —— 给 <a download="..."> 派生文件名 = displayName + 扩展。
//
// Files.tsx 行下载按钮使用。规则:
//   - 从 contentType 取「type/subtype」前缀,查表得到 `.ext`。
//   - 未命中(未知 / 缺失 / 含 charset 等参数) → 不加扩展,保留 displayName。
//   - 浏览器遇到没扩展 + 同源响应,会用 Content-Disposition 或 MIME 推断默认名;
//     我们不强行补 `.img` / `.bin` 之类的错名,免得误导用户。
//
// 覆盖范围:常见 image / 文档 / 表格 / 演示 / 压缩 / 视频 / 音频 / 文本。
// 不在本期:application/octet-stream(刻意不映射,交给浏览器 / 后端 disposition)。

interface FileLike {
  displayName: string;
  contentType: string;
}

/** 主 mime(type/subtype) → 文件扩展名。命中失败不抛错,返回空字符串。 */
const MIME_EXT: Readonly<Record<string, string>> = {
  // images
  'image/png': '.png',
  'image/jpeg': '.jpeg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  // documents
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  // text
  'text/plain': '.txt',
  'text/html': '.html',
  'text/css': '.css',
  'text/csv': '.csv',
  'text/markdown': '.md',
  'text/xml': '.xml',
  // data
  'application/json': '.json',
  'application/xml': '.xml',
  // archives
  'application/zip': '.zip',
  'application/x-tar': '.tar',
  'application/gzip': '.gz',
  // media
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
};

/**
 * 给 <a download="..."> 派生文件名。
 *
 * @param file  - 至少包含 displayName + contentType(只读)。
 * @returns `<displayName><ext>`;未知 mime 返回原 displayName。
 *
 * @example
 *   downloadFilename({ displayName: 'abc12345', contentType: 'image/png' })
 *   // → 'abc12345.png'
 *   downloadFilename({ displayName: 'blob', contentType: 'application/octet-stream' })
 *   // → 'blob'
 */
export function downloadFilename(file: FileLike): string {
  const ct = (file.contentType ?? '').trim().toLowerCase();
  if (!ct) return file.displayName;
  // 去掉 "; charset=..." 等参数,只留 type/subtype 主段
  const main = ct.split(';')[0]?.trim() ?? '';
  const ext = MIME_EXT[main];
  return ext ? `${file.displayName}${ext}` : file.displayName;
}
