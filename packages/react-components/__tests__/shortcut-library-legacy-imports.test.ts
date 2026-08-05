import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('shortcut-library legacy files removed', () => {
  it('authClient.ts is deleted', () => {
    const p = resolve(__dirname, '../src/shortcut-library/src/engine/authClient.ts');
    expect(existsSync(p)).toBe(false);
  });

  it('userKvClient.ts is deleted', () => {
    const p = resolve(__dirname, '../src/shortcut-library/src/engine/userKvClient.ts');
    expect(existsSync(p)).toBe(false);
  });

  it('userKvStore.ts is deleted', () => {
    const p = resolve(__dirname, '../src/shortcut-library/src/engine/userKvStore.ts');
    expect(existsSync(p)).toBe(false);
  });

  it('LSStore (engine/store.ts) is kept', () => {
    const p = resolve(__dirname, '../src/shortcut-library/src/engine/store.ts');
    expect(existsSync(p)).toBe(true);
  });
});
