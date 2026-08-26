// packages/react-components/src/color-studio/src/utils/id.ts
//
// 26-char Crockford-base32 ID:10-char 时间戳(36 进制 ms) + 16-char 随机。
// 不是 ULID spec 标准,但用途相近:单调排序 + 足够熵。

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford(去 I/L/O/U)

export function makeId(now: number = Date.now()): string {
  return encodeTime(now, 10) + encodeRandom(16);
}

function encodeTime(t: number, len: number): string {
  let out = '';
  // 防御负值:absolute
  t = Math.max(0, Math.floor(t));
  for (let i = len - 1; i >= 0; i--) {
    const mod = t % 32;
    out = ALPHABET[mod] + out;
    t = (t - mod) / 32;
  }
  return out;
}

function encodeRandom(len: number): string {
  let out = '';
  const bytes = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % 32];
  }
  return out;
}
