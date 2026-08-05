// app-boot.test.ts —— 宿主启动边界:jwtAuth.init()(main.ts bootstrap 第 0.5 步)。
//
// main.ts 的 bootstrap() 在启动时执行 `void jwtAuth.init()`(fire-and-forget):
//   - LS 里有 token  → 拉 /api/v1/user/info 验真,恢复 logged-in 会话
//   - LS 里没有 token → 保持 logged-out,不发起任何请求
//
// 这里在"boot 边界"上重述 auth-store.test.ts 的 init 用例(mock 形状一致),
// 确保 bootstrap 一旦接入 jwtAuth.init(),会话恢复语义不被破坏。
// 注意:不是 import main.ts 跑完整 bootstrap(那要 manifest / registry / 挂载,
// 太重且与模块单测正交);边界语义由 jwtAuth.init() 本身承担。

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jwtAuth, TOKEN_KEY } from '../src/shared/auth-store';
import { setBearerProvider } from '../src/api/http/request';

function mockJSON(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const USER = { id: 42, email: 'a@b.com', username: 'u', nickname: 'n', invitationCode: 'INVT' };

describe('app boot: jwtAuth.init() boundary', () => {
  beforeEach(() => {
    localStorage.clear();
    setBearerProvider(() => null);
    // 复位到 logged-out,避免上一用例的 logged-in 状态串扰(模块级 ref 单例)
    jwtAuth.logout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('boot with a valid LS token restores a logged-in session', async () => {
    localStorage.setItem(TOKEN_KEY, 'boot-jwt');
    global.fetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: USER }));

    // bootstrap 第 0.5 步的等价调用:fire-and-forget init
    await jwtAuth.init();

    expect(jwtAuth.state.jwtAuthState).toBe('logged-in');
    expect(jwtAuth.state.token).toBe('boot-jwt');
    expect(jwtAuth.state.jwtUser?.email).toBe('a@b.com');
  });

  it('boot without a token stays logged-out and makes no request', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const result = await jwtAuth.init();

    expect(result).toBeNull();
    expect(jwtAuth.state.jwtAuthState).toBe('logged-out');
    expect(jwtAuth.state.token).toBeNull();
    expect(jwtAuth.state.jwtUser).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('boot with an invalid LS token clears it and stays logged-out', async () => {
    localStorage.setItem(TOKEN_KEY, 'bad-jwt');
    global.fetch = vi.fn().mockResolvedValue(mockJSON(401, { code: 401, message: 'unauthorized' }));

    const result = await jwtAuth.init();

    expect(result).toBeNull();
    expect(jwtAuth.state.jwtAuthState).toBe('logged-out');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
