// sha256.test.ts —— 纯 TS 增量 SHA-256 对拍 node:crypto。
//
// 覆盖:
//   1) 标准向量:空串 / 'abc' / 长输入(多块)
//   2) padding 边界:55/56/63/64/120 字节(块缓冲 + 长度域的临界)
//   3) 增量分批喂入(逐字节 / 随机块) == 一次性喂入 == node:crypto

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Sha256 } from '../src/api/components/user-space/sha256';

function nodeSha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** 确定性伪随机(Mulberry32)—— 测试可复现,不依赖 Math.random。 */
function pseudoRandom(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  let a = seed;
  for (let i = 0; i < n; i++) {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    out[i] = (t ^ (t >>> 14)) & 0xff;
  }
  return out;
}

describe('Sha256 — 标准向量', () => {
  it('空输入', () => {
    expect(new Sha256().digestHex()).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it("'abc'", () => {
    const h = new Sha256();
    h.update(new TextEncoder().encode('abc'));
    expect(h.digestHex()).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('长输入(1MB,128 块)对拍 node:crypto', () => {
    const bytes = pseudoRandom(1024 * 1024, 42);
    const h = new Sha256();
    h.update(bytes);
    expect(h.digestHex()).toBe(nodeSha256(bytes));
  });
});

describe('Sha256 — padding 边界', () => {
  // 0x80 + 8 字节长度域要塞进剩余空间,55/56/63/64 是换块临界
  for (const len of [55, 56, 63, 64, 120, 128]) {
    it(`${len} 字节`, () => {
      const bytes = pseudoRandom(len, len * 7 + 1);
      const h = new Sha256();
      h.update(bytes);
      expect(h.digestHex()).toBe(nodeSha256(bytes));
    });
  }
});

describe('Sha256 — 增量一致性', () => {
  const bytes = pseudoRandom(10_000, 99);

  it('一次性喂入 == node:crypto', () => {
    const h = new Sha256();
    h.update(bytes);
    expect(h.digestHex()).toBe(nodeSha256(bytes));
  });

  it('逐字节喂入 == 一次性', () => {
    const h = new Sha256();
    for (let i = 0; i < bytes.length; i++) h.update(bytes.subarray(i, i + 1));
    expect(h.digestHex()).toBe(nodeSha256(bytes));
  });

  it('随机块大小喂入 == 一次性', () => {
    const h = new Sha256();
    let off = 0;
    let step = 1;
    while (off < bytes.length) {
      h.update(bytes.subarray(off, off + step));
      off += step;
      step = (step * 7 + 13) % 300; // 1..299 抖动,跨 64 边界各种切法
      if (step === 0) step = 1;
    }
    expect(h.digestHex()).toBe(nodeSha256(bytes));
  });
});
