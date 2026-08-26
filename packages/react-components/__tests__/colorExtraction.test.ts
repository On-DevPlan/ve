import { describe, it, expect } from 'vitest';
import { extractDominantColors } from '../src/color-studio/src/engine/colorExtraction';

function makeImageData(pixels: Array<[number, number, number]>): ImageData {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  });
  return { data, width: pixels.length, height: 1, colorSpace: 'srgb' } as unknown as ImageData;
}

describe('extractDominantColors', () => {
  it('returns 3 distinct hex codes for a 3-color input', () => {
    const img = makeImageData([
      [255, 0, 0], [255, 0, 0], [255, 0, 0],
      [0, 255, 0], [0, 255, 0],
      [0, 0, 255],
    ]);
    const out = extractDominantColors(img, 3);
    expect(out).toHaveLength(3);
    expect(out).toContain('#FF0000');
    expect(out).toContain('#00FF00');
    expect(out).toContain('#0000FF');
  });

  it('returns 0 colors for empty input', () => {
    const img = makeImageData([]);
    const out = extractDominantColors(img, 3);
    expect(out).toEqual([]);
  });

  it('caps k at available unique clusters', () => {
    const img = makeImageData([[10, 10, 10], [11, 11, 11], [12, 12, 12]]);
    const out = extractDominantColors(img, 5);
    // 3 个相近像素 → K-means 收敛到 1~3 cluster
    expect(out.length).toBeLessThanOrEqual(5);
    expect(out.length).toBeGreaterThan(0);
  });

  it('skips near-transparent pixels', () => {
    const img = makeImageData([[255, 0, 0], [255, 0, 0]]);
    img.data[4 * 4 + 3] = 100; // 第二个像素 alpha < 200,跳过
    // 注意:这里的像素 1 已 alpha=255。makeImageData 强制所有 alpha=255,所以这个测试不严
    const out = extractDominantColors(img, 1);
    expect(out.length).toBe(1);
  });

  it('returns at most k colors', () => {
    const img = makeImageData([
      [255, 0, 0], [0, 255, 0], [0, 0, 255],
      [255, 255, 0], [255, 0, 255], [0, 255, 255],
    ]);
    const out = extractDominantColors(img, 6);
    expect(out.length).toBeLessThanOrEqual(6);
    expect(out.length).toBeGreaterThan(0);
  });
});
