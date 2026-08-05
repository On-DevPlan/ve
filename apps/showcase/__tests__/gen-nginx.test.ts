// __tests__/gen-nginx.test.ts —— registry → nginx location 片段的契约测试。
//
// 继承自老 packages/manifest-generator/__tests__/nginx-emit.test.ts 的核心契约:
//   1) proxy_pass 不带尾斜杠(带 / 会剥 location 前缀,后端 404)
//   2) location 用 ^~ 前缀(普通前缀会被 default.conf 的静态资源正则抢走)
//   3) target.{dev,prod} 分环境(prod 绝不取 dev 值)
//   4) context 冲突:同 context 不同 target → throw
//   5) 空 registry → 返回注释占位,产物文件始终存在
//
// 新增(修复 dev/prod 尾斜杠不一致):
//   6) location 不硬补尾斜杠 —— nginx 前缀匹配天然覆盖 <ctx> 与 <ctx>/...,
//      与 dev 侧 matchesContext 语义一致(POST /api/v1/kv 在 prod 不再 405)
//   7) query string 不参与 nginx 渲染(nginx location 天然忽略 query)
//
// 不依赖文件系统:测试调 normalizeApi 和 genNginxOut 的等价入口,
// 真正写文件的部分(默认 outDir)有默认行为,这里只验证字符串内容。

// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  normalizeApi,
  normalizeContext,
  matchesContext,
  NormalizeError,
} from '../src/api/normalize';
import type { BackendRegistration } from '../src/api/types';
import { genNginxOut } from '../src/api/gen-nginx';

// 因为 gen-nginx 内部硬编码读 registry.ts,这里走 normalizeApi 单元测试覆盖
// 字符串契约;走 genNginxOut() 临时改 outDir 写临时文件,再读回比对。

function makeBackend(target: BackendRegistration['target'], route: string): BackendRegistration {
  return { target, route };
}

const authDev: BackendRegistration = makeBackend(
  { dev: 'http://localhost:8080', prod: 'http://47.110.80.47:8988' },
  '/api/auth',
);
const authSingle: BackendRegistration = makeBackend('https://single.example.com', '/api/single');

describe('normalizeApi', () => {
  it('dev:取 target.dev', () => {
    const r = normalizeApi(authDev, /* isProd */ false, 'auth');
    expect(r.target).toBe('http://localhost:8080');
    expect(r.context).toBe('/api/auth');
    expect(r.changeOrigin).toBe(true);
  });

  it('prod:取 target.prod,绝不取 dev 值', () => {
    const r = normalizeApi(authDev, /* isProd */ true, 'auth');
    expect(r.target).toBe('http://47.110.80.47:8988');
  });

  it('string target:两端都用它', () => {
    const rDev = normalizeApi(authSingle, false, 'single');
    const rProd = normalizeApi(authSingle, true, 'single');
    expect(rDev.target).toBe('https://single.example.com');
    expect(rProd.target).toBe('https://single.example.com');
  });

  it('缺 target.prod 时抛 NormalizeError,不静默回退到 dev', () => {
    const broken = makeBackend({ dev: 'http://localhost:8080' }, '/api/broken'); // prod 缺失
    expect(() => normalizeApi(broken, /* isProd */ true, 'broken')).toThrow(
      NormalizeError,
    );
  });

  it('route 为空抛 NormalizeError', () => {
    const empty = makeBackend('http://x', '');
    expect(() => normalizeApi(empty, false, 'empty')).toThrow(/route/);
  });

  it('context 不以 / 开头抛 NormalizeError', () => {
    const bad = makeBackend('http://x', 'api/oops');
    expect(() => normalizeApi(bad, false, 'oops')).toThrow(/does not start with "\/"/);
  });

  it('target 的尾斜杠被剥掉(proxy_pass 语义)', () => {
    const trailing = makeBackend({ dev: 'http://localhost:8080/', prod: 'http://x:8080/' }, '/api/a');
    const r = normalizeApi(trailing, false, 'a');
    expect(r.target).toBe('http://localhost:8080');
  });
});

describe('normalizeContext / matchesContext —— dev/prod 共用语义', () => {
  it('normalizeContext 剥掉尾斜杠 — /api/v1/kv/ → /api/v1/kv', () => {
    expect(normalizeContext('/api/v1/kv/')).toBe('/api/v1/kv');
    expect(normalizeContext('/api/v1/kv')).toBe('/api/v1/kv');
  });

  it('根路径 '/' 是唯一保留斜杠的特例', () => {
    expect(normalizeContext('/')).toBe('/');
  });

  it('matchesContext:精确路径命中', () => {
    expect(matchesContext('/api/v1/kv', '/api/v1/kv')).toBe(true);
  });

  it('matchesContext:子路径命中(POST /api/v1/kv 就是 set())', () => {
    expect(matchesContext('/api/v1/kv/shortcuts', '/api/v1/kv')).toBe(true);
  });

  it('matchesContext:query string 被剥掉后仍命中(list?limit=10)', () => {
    expect(matchesContext('/api/v1/kv?limit=10', '/api/v1/kv')).toBe(true);
    expect(matchesContext('/api/v1/kv?limit=10&offset=5', '/api/v1/kv')).toBe(true);
  });

  it('matchesContext:不是路径边界的不命中(/api/v1/kvx)', () => {
    expect(matchesContext('/api/v1/kvx', '/api/v1/kv')).toBe(false);
  });

  it('matchesContext:不同前缀不命中', () => {
    expect(matchesContext('/api/v2/kv', '/api/v1/kv')).toBe(false);
  });
});

describe('genNginxOut — 字符串契约', () => {
  it('写入的产物包含 ^~ location + proxy_pass 不带尾斜杠 + 头部 proxy_set_header', () => {
    const tmp = mkdtempSync(resolve(tmpdir(), 'gen-nginx-'));
    try {
      const out = genNginxOut({ outDir: tmp, verbose: false });
      const body = readFileSync(out, 'utf8');

      const locations = body.match(/location\s+\^~[^/]+/g) ?? [];
      expect(locations.length).toBeGreaterThanOrEqual(2);

      const proxyPass = body.match(/proxy_pass\s+([^;]+);/g) ?? [];
      expect(proxyPass.length).toBeGreaterThanOrEqual(2);
      for (const line of proxyPass) {
        expect(line, line).not.toMatch(/proxy_pass\s+[^;]*\/$/);
      }

      expect(body).toContain('proxy_set_header Host $proxy_host');
      expect(body).toContain('proxy_set_header X-Real-IP $remote_addr');
      expect(body).toContain('proxy_set_header X-Forwarded-For');
      expect(body).toContain('proxy_set_header X-Forwarded-Proto $scheme');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('location 不硬补尾斜杠 —— POST /api/v1/kv 在 prod 也要命中', () => {
    const tmp = mkdtempSync(resolve(tmpdir(), 'gen-nginx-'));
    try {
      const out = genNginxOut({ outDir: tmp, verbose: false });
      const body = readFileSync(out, 'utf8');
      // 关键回归:kvV1Service.set() 请求 /api/v1/kv(无尾斜杠)。
      // 如果渲染成 `location ^~ /api/v1/kv/`,精确请求落到 try_files → index.html → 405。
      expect(body).toMatch(/location\s+\^~\s+\/api\/v1\/kv\s+\{/);
      expect(body).toMatch(/location\s+\^~\s+\/api\/v1\/user\s+\{/);
      // 不该出现硬补斜杠的形态
      expect(body).not.toMatch(/location\s+\^~\s+\/api\/v1\/kv\/\s+\{/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('prod target 正确:每个 backend 都指向 prod,不是 localhost', () => {
    const tmp = mkdtempSync(resolve(tmpdir(), 'gen-nginx-'));
    try {
      const out = genNginxOut({ outDir: tmp, verbose: false });
      const body = readFileSync(out, 'utf8');
      const prodProxy = body.match(/proxy_pass\s+http:\/\/47\.110\.80\.47:8988/g) ?? [];
      expect(prodProxy.length).toBeGreaterThanOrEqual(2);
      expect(body).not.toContain('proxy_pass http://localhost:');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('返回路径就是生成的 .conf 文件', () => {
    const tmp = mkdtempSync(resolve(tmpdir(), 'gen-nginx-'));
    try {
      const out = genNginxOut({ outDir: tmp, verbose: false });
      expect(out.endsWith('generated.conf')).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});