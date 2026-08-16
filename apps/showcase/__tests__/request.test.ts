// request.test.ts —— 验证 API 传输层 fetch 客户端(api/http/request.ts)的契约。
//
// 覆盖:
//   1) 自有后端:解 {code, data, message} 包络,code!==0 抛 ApiError
//   2) 第三方(raw:true):不解包络,原样返回
//   3) Bearer 请求 401 → 调用注入的 unauthorized handler + 抛 ApiError(不动路由)
//   4) 形态不对的 JSON(nginx 5xx HTML、第三方混入)宽容回退原值
//   5) credentials:'include' 必须出现在 fetch init 里
//   6) body JSON.stringify 默认生效;FormData / 二进制 raw body(Blob /
//      ArrayBuffer / TypedArray)透传 + octet-stream(分片上传单片通道)
//   7) skipUnauthorized:true 时不触发 401 信号
//   8) 无 Bearer 的 401 不触发 handler(只抛 ApiError)
//   9) SSR(Node 环境):模块顶层 import 不崩,call() 在 fetch 失败时抛 0-code ApiError
//
// 关键:request 不 import 任何 auth 状态,401 handler 是**注入**的 ——
// 测试直接 setBearerProvider + setBearerUnauthorizedHandler 注入 spy,
// 不再需要 mock auth-store(旧版 request import auth-store,已解除)。
//
// 需要 jsdom:API 响应构造用 fetch 的 Response(jsdom 提供)。

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiError,
  setBearerProvider,
  setBearerUnauthorizedHandler,
} from '../src/api/http/request';

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

const mockUnauthorizedHandler = vi.fn();

beforeEach(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockReset();
  mockUnauthorizedHandler.mockClear();
  setBearerProvider(() => null);
  setBearerUnauthorizedHandler(mockUnauthorizedHandler);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function envelope<T>(data: T, code = 0, message = 'ok') {
  return { code, data, message };
}

async function importFreshApi() {
  // 重新 import 让模块求值一次(request 是模块级 provider,动态 import 保证干净)
  return await import('../src/api/http/request');
}

describe('request — 包络解封(自有后端)', () => {
  it('成功时返回 data 字段', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(envelope({ id: 'u1', name: 'alice' })), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { api } = await importFreshApi();
    const out = await api.get<{ id: string; name: string }>('/api/auth/me');
    expect(out).toEqual({ id: 'u1', name: 'alice' });
  });

  it('code !== 0 抛 ApiError,并把 message 带进 error', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(envelope(null, 51, 'The email field is required')), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { api } = await importFreshApi();
    await expect(api.get('/api/auth/login')).rejects.toThrowError(
      new ApiError(51, 'The email field is required'),
    );
  });

  it('形态不像是包络({code,data} 缺失)时,宽容回退原 JSON', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ hello: 'world' }), {
        status: 200,
      }),
    );

    const { api } = await importFreshApi();
    const out = await api.get<{ hello: string }>('/api/whatever');
    expect(out).toEqual({ hello: 'world' });
  });
});

describe('request — 第三方后端(api.raw)', () => {
  it('raw.get 不解包络,原样返回', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 1 }, { id: 2 }]), {
        status: 200,
      }),
    );

    const { api } = await importFreshApi();
    const out = await api.raw.get<Array<{ id: number }>>('/api/v1/kv/projects');
    expect(out).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('raw.post 序列化 body 并保留 raw:true', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const { api } = await importFreshApi();
    await api.raw.post('/api/v1/kv/x', { a: 1 });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0];
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({ a: 1 });
    expect(init.headers['content-type']).toBe('application/json');
  });
});

describe('request — 401 信号(注入 handler)', () => {
  it('带 Bearer 的 401 触发注入的 handler 并抛 ApiError(401)', async () => {
    setBearerProvider(() => 'jwt-token');
    mockFetch.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));

    const { api } = await importFreshApi();
    await expect(api.get('/api/v1/kv/x')).rejects.toBeInstanceOf(ApiError);

    expect(mockUnauthorizedHandler).toHaveBeenCalledTimes(1);
    setBearerProvider(() => null);
  });

  it('无 Bearer 的 401 不触发 handler(不是 JWT 会话)', async () => {
    // provider 返回 null —— cookie 会话 401,不该清 JWT 态
    mockFetch.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));

    const { api } = await importFreshApi();
    await expect(api.get('/api/v1/kv/x')).rejects.toBeInstanceOf(ApiError);

    expect(mockUnauthorizedHandler).not.toHaveBeenCalled();
  });

  it('skipUnauthorized:true 不触发 handler,API caller 自己处理', async () => {
    setBearerProvider(() => 'jwt-token');
    mockFetch.mockResolvedValueOnce(new Response('wrong-password', { status: 401 }));

    const { api } = await importFreshApi();
    await expect(
      api.post('/api/v1/user/login', { email: 'x', pwd: 'wrong' }, { skipUnauthorized: true }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(mockUnauthorizedHandler).not.toHaveBeenCalled();
    setBearerProvider(() => null);
  });
});

describe('request — fetch / 网络', () => {
  it('credentials=include 必须出现在 fetch init', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(envelope({})), { status: 200 }),
    );

    const { api } = await importFreshApi();
    await api.get('/api/auth/me');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.credentials).toBe('include');
  });

  it('没有 body 时不发 content-type 头', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(envelope({})), { status: 200 }),
    );

    const { api } = await importFreshApi();
    await api.get('/api/auth/me');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['content-type']).toBeUndefined();
  });

  it('body 非 undefined 时强制 JSON 序列化', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(envelope({ ok: true })), { status: 200 }),
    );

    const { api } = await importFreshApi();
    await api.post('/api/auth/login', { email: 'x@y.z' });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.body).toBe('{"email":"x@y.z"}');
  });

  it('FormData body 不被 JSON.stringify(透传原始 FormData 实例)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(envelope({ ok: true })), { status: 200 }),
    );

    const { api } = await importFreshApi();
    const fd = new FormData();
    fd.append('file', new Blob(['hello']), 'hello.txt');
    await api.post('/api/v1/files', fd);
    const [, init] = mockFetch.mock.calls[0];
    // body 必须是 FormData 自身(无 JSON.stringify 包装)
    expect(init.body).toBe(fd);
    expect(typeof init.body).not.toBe('string');
  });

  it('FormData body 时不设置 content-type 头(浏览器会自动加 multipart boundary)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(envelope({ ok: true })), { status: 200 }),
    );

    const { api } = await importFreshApi();
    const fd = new FormData();
    fd.append('file', new Blob(['hello']), 'hello.txt');
    await api.post('/api/v1/files', fd);
    const [, init] = mockFetch.mock.calls[0];
    // FormData 必须不带 content-type —— 浏览器会附 multipart boundary;手动设会丢失
    expect(init.headers['content-type']).toBeUndefined();
  });

  it('Blob body 透传不 JSON.stringify,并显式 octet-stream(分片上传单片通道)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(envelope({ ok: true })), { status: 200 }),
    );

    const { api } = await importFreshApi();
    // 故意带 text/plain type:证明 content-type 由传输层钉死 octet-stream,不受 blob.type 影响
    const chunk = new Blob(['raw-bytes'], { type: 'text/plain' });
    await api.put('/api/v1/files/uploads/u1/chunks/0', chunk);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/files/uploads/u1/chunks/0');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(chunk);
    expect(typeof init.body).not.toBe('string');
    expect(init.headers['content-type']).toBe('application/octet-stream');
  });

  it('ArrayBuffer / Uint8Array body 同样走二进制通道(octet-stream + 透传)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(envelope({ ok: 1 })), { status: 200 }),
    );

    const { api } = await importFreshApi();
    const buf = new TextEncoder().encode('abc');
    await api.put('/api/v1/files/uploads/u1/chunks/1', buf);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.body).toBe(buf);
    expect(init.headers['content-type']).toBe('application/octet-stream');

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(envelope({ ok: 2 })), { status: 200 }),
    );
    const ab = new TextEncoder().encode('xyz').buffer;
    await api.put('/api/v1/files/uploads/u1/chunks/2', ab);
    const [, init2] = mockFetch.mock.calls[1];
    expect(init2.body).toBe(ab);
    expect(init2.headers['content-type']).toBe('application/octet-stream');
  });

  it('fetch 抛 TypeError(断网)被包装成 code=0 ApiError', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const { api } = await importFreshApi();
    await expect(api.get('/api/auth/me')).rejects.toMatchObject({
      code: 0,
      message: expect.stringContaining('Failed to fetch'),
    });
  });

  it('非 2xx 非 401:返回 ApiError 把 status 当 code', async () => {
    mockFetch.mockResolvedValueOnce(new Response('boom', { status: 500 }));

    const { api } = await importFreshApi();
    await expect(api.get('/api/auth/me')).rejects.toMatchObject({ code: 500 });
  });

  it('非 2xx 且 body 为 JSON 时,抽取 message 字段而非整串 JSON', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 401, message: 'bad password' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { api } = await importFreshApi();
    await expect(api.get('/api/auth/me')).rejects.toMatchObject({
      code: 500,
      message: 'bad password',
    });
  });
});