// downloadFilename 单测 —— 锁住 mime → 扩展名映射 + displayName 透传 + 未知 mime 兜底。
//
// 背景:Files.tsx 行下载按钮的 <a download="..."> 文件名派生。当前所有 fileKind
// 都过这里,所以覆盖度要够:常见 image / 文档 / 压缩 / 视频 / 文本都打到,
// 未知 mime 和缺失 mime 走"不加扩展"分支。

import { describe, it, expect } from 'vitest';
import { downloadFilename } from '../src/user-space/src/pages/downloadFilename';

describe('downloadFilename', () => {
  it('appends .png for image/png', () => {
    expect(downloadFilename({ displayName: 'abc12345', contentType: 'image/png' })).toBe('abc12345.png');
  });

  it('appends .jpeg for image/jpeg', () => {
    expect(downloadFilename({ displayName: 'shot', contentType: 'image/jpeg' })).toBe('shot.jpeg');
  });

  it('appends .webp for image/webp', () => {
    expect(downloadFilename({ displayName: 'hero', contentType: 'image/webp' })).toBe('hero.webp');
  });

  it('appends .svg for image/svg+xml', () => {
    expect(downloadFilename({ displayName: 'logo', contentType: 'image/svg+xml' })).toBe('logo.svg');
  });

  it('appends .pdf for application/pdf', () => {
    expect(downloadFilename({ displayName: 'report', contentType: 'application/pdf' })).toBe('report.pdf');
  });

  it('appends .txt for text/plain', () => {
    expect(downloadFilename({ displayName: 'notes', contentType: 'text/plain' })).toBe('notes.txt');
  });

  it('appends .md for text/markdown', () => {
    expect(downloadFilename({ displayName: 'readme', contentType: 'text/markdown' })).toBe('readme.md');
  });

  it('appends .csv for text/csv', () => {
    expect(downloadFilename({ displayName: 'data', contentType: 'text/csv' })).toBe('data.csv');
  });

  it('appends .json for application/json', () => {
    expect(downloadFilename({ displayName: 'pkg', contentType: 'application/json' })).toBe('pkg.json');
  });

  it('appends .zip for application/zip', () => {
    expect(downloadFilename({ displayName: 'bundle', contentType: 'application/zip' })).toBe('bundle.zip');
  });

  it('appends .mp4 for video/mp4', () => {
    expect(downloadFilename({ displayName: 'clip', contentType: 'video/mp4' })).toBe('clip.mp4');
  });

  it('appends .mp3 for audio/mpeg', () => {
    expect(downloadFilename({ displayName: 'song', contentType: 'audio/mpeg' })).toBe('song.mp3');
  });

  it('appends .docx for openxml word', () => {
    expect(downloadFilename({ displayName: 'doc', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe('doc.docx');
  });

  it('appends .xlsx for openxml excel', () => {
    expect(downloadFilename({ displayName: 'sheet', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })).toBe('sheet.xlsx');
  });

  it('preserves spaces in displayName', () => {
    expect(downloadFilename({ displayName: 'my report', contentType: 'application/pdf' })).toBe('my report.pdf');
  });

  it('returns displayName unchanged for unknown mime', () => {
    expect(downloadFilename({ displayName: 'blob', contentType: 'application/x-mystery' })).toBe('blob');
  });

  it('returns displayName unchanged when contentType is empty', () => {
    expect(downloadFilename({ displayName: 'mystery', contentType: '' })).toBe('mystery');
  });

  it('handles mime with charset suffix (text/plain; charset=utf-8)', () => {
    expect(downloadFilename({ displayName: 'log', contentType: 'text/plain; charset=utf-8' })).toBe('log.txt');
  });

  it('handles unknown image subtype gracefully', () => {
    // 没列出的 image 子类(如 image/heic)兜底不加扩展;避免错贴 .img 这种错名
    expect(downloadFilename({ displayName: 'raw', contentType: 'image/heic' })).toBe('raw');
  });

  it('handles uppercase MIME via .toLowerCase()', () => {
    expect(downloadFilename({ displayName: 'cap', contentType: 'IMAGE/PNG' })).toBe('cap.png');
  });

  it('handles null contentType via ?? ""', () => {
    // Mimic what FileView passes when contentType is undefined; we type it as string but the helper tolerates undefined via ??
    expect(downloadFilename({ displayName: 'absent', contentType: undefined as unknown as string })).toBe('absent');
  });

  it('handles multi-parameter content type with boundary', () => {
    expect(downloadFilename({ displayName: 'pkg', contentType: 'application/json; charset=utf-8; boundary=---' })).toBe('pkg.json');
  });
});
