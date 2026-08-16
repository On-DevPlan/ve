// api/components/user-space/sha256.ts —— 纯 TS 增量 SHA-256(FIPS 180-4)。
//
// 为什么不用 WebCrypto:subtle.digest 只支持一次性整块,没有流式增量;
// 分片上传 init 要整文件指纹,大文件不能整个读进内存,必须边读边算
// (py 模拟器的 hashlib 流式对应物)。fileMd5 后端可选,前端不发,
// 避免再实现一份 JS MD5(WebCrypto 也没有 MD5)。
//
// 单一代码路径的好处:浏览器 / vitest / 非安全上下文(http)行为一致,
// 且可用 node:crypto 对拍测试。性能 ~100MB/s 量级,1GB 文件哈希 ~10s,
// 相对上传耗时可忽略(独立 hashing 进度阶段展示)。
//
// 用法(与 hashlib.createHash 同构):
//   const h = new Sha256();
//   h.update(chunk1); h.update(chunk2);
//   h.digestHex(); // 64 hex 小写;digest 后实例作废

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export class Sha256 {
  /** H0..H7,初始为标准 IV */
  private readonly state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  /** 未满 64 字节的块缓冲 */
  private readonly block = new Uint8Array(64);
  private blockLen = 0;
  /** 累计字节数。Number 精度 2^53,远超任何真实文件,足够存 */
  private totalLen = 0;
  /** 复用的 message schedule(W[0..63]) */
  private readonly w = new Uint32Array(64);

  update(data: Uint8Array): this {
    this.totalLen += data.length;
    let off = 0;
    // 先填满半满块
    if (this.blockLen > 0) {
      const take = Math.min(64 - this.blockLen, data.length);
      this.block.set(data.subarray(0, take), this.blockLen);
      this.blockLen += take;
      off = take;
      if (this.blockLen === 64) {
        this.processBlock(this.block, 0);
        this.blockLen = 0;
      }
    }
    // 中段整块直消(绕过 block 缓冲,少一次拷贝)
    while (off + 64 <= data.length) {
      this.processBlock(data, off);
      off += 64;
    }
    // 尾巴进缓冲
    if (off < data.length) {
      this.block.set(data.subarray(off), this.blockLen);
      this.blockLen += data.length - off;
    }
    return this;
  }

  /** 终结 + 输出 64 hex 小写。调用后实例作废(重复调用结果错误)。 */
  digestHex(): string {
    // bit 长度 = totalLen * 8,拆 32bit 高低位:hi = totalLen / 2^29,lo = (totalLen % 2^29) * 8
    const total = this.totalLen;
    const bitHi = Math.floor(total / 0x20000000);
    const bitLo = (total % 0x20000000) * 8;
    // padding:0x80 + 0…0 + 8 字节大端 bit 长度,总长补到 64 的倍数
    const tail = new Uint8Array(128);
    let n = 0;
    tail[n++] = 0x80;
    while ((total + n) % 64 !== 56) tail[n++] = 0;
    const dv = new DataView(tail.buffer);
    dv.setUint32(n, bitHi);
    dv.setUint32(n + 4, bitLo);
    n += 8;
    // 消化 tail,但不动 totalLen(update 会改)—— 手动走 block 路径。
    // (total + n) % 64 === 0 保证消化完 blockLen 恰好归零,无残余。
    let off = 0;
    if (this.blockLen > 0) {
      const take = Math.min(64 - this.blockLen, n);
      this.block.set(tail.subarray(0, take), this.blockLen);
      this.blockLen += take;
      off = take;
      if (this.blockLen === 64) {
        this.processBlock(this.block, 0);
        this.blockLen = 0;
      }
    }
    while (off + 64 <= n) {
      this.processBlock(tail, off);
      off += 64;
    }
    if (off < n) {
      this.block.set(tail.subarray(off), this.blockLen);
      this.blockLen += n - off;
      this.processBlock(this.block, 0);
      this.blockLen = 0;
    }
    let hex = '';
    for (let i = 0; i < 8; i++) hex += this.state[i].toString(16).padStart(8, '0');
    return hex;
  }

  /** 压缩函数:src[off, off+64) 一个块进 state。 */
  private processBlock(src: Uint8Array, off: number): void {
    const w = this.w;
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] = ((src[j] << 24) | (src[j + 1] << 16) | (src[j + 2] << 8) | src[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = this.state[0], b = this.state[1], c = this.state[2], d = this.state[3];
    let e = this.state[4], f = this.state[5], g = this.state[6], h = this.state[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e;
      e = (d + t1) >>> 0;
      d = c; c = b; b = a;
      a = (t1 + t2) >>> 0;
    }
    this.state[0] = (this.state[0] + a) >>> 0;
    this.state[1] = (this.state[1] + b) >>> 0;
    this.state[2] = (this.state[2] + c) >>> 0;
    this.state[3] = (this.state[3] + d) >>> 0;
    this.state[4] = (this.state[4] + e) >>> 0;
    this.state[5] = (this.state[5] + f) >>> 0;
    this.state[6] = (this.state[6] + g) >>> 0;
    this.state[7] = (this.state[7] + h) >>> 0;
  }
}
