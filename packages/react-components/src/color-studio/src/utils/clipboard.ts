// packages/react-components/src/color-studio/src/utils/clipboard.ts
//
// navigator.clipboard.writeText 包装,捕获异常。

export async function writeClipboard(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('clipboard API unavailable');
  }
  await navigator.clipboard.writeText(text);
}
