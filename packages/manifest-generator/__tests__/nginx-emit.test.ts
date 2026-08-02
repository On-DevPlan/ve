// 单元测试:nginx-emit —— dev/prod 共用同一份 ComponentConfig.api 的 prod 侧出口。
//
// 重点覆盖那些"生成的配置语法合法、nginx 能正常启动、但路由行为是错的"
// 静默失效场景 —— 这类 bug 不会在构建期暴露,只会在上线后表现为 404/502,
// 恰恰是这套生成器要消灭的东西:
//   1) proxy_pass 尾斜杠 → 剥掉 location 前缀 → 后端 404
//   2) 普通前缀 location → 被 default.conf 的静态资源正则抢走
//   3) dev 的 localhost target 被印进 prod → 容器内 502
//   4) 同 context 不同 target → nginx 无法按组件消歧
//
// emitNginxLocations 是纯函数,直接喂 config 字面量即可,无需碰文件系统。

import { describe, it, expect } from 'vitest';
import { emitNginxLocations } from '../src/nginx-emit';
import type { ComponentConfig } from '@style-library/component-contract';

// 造一个最小 ComponentConfig。emitNginxLocations 只读 id 与 api 两个字段,
// 其余必填字段用 cast 绕过 —— 与 reconcile.test.ts 的做法保持一致。
function makeConfig(id: string, api: ComponentConfig['api']): ComponentConfig {
  return { id, api } as unknown as ComponentConfig;
}

const PROD = { env: 'prod' } as const;

describe('emitNginxLocations', () => {
  describe('proxy_pass 语义', () => {
    it('emits proxy_pass without a trailing slash so the URI prefix is preserved', () => {
      // 带尾斜杠时 nginx 会剥掉 location 前缀:
      //   /api/v1/user/login → /v1/user/login → 后端 404
      // 这是最容易写错、且构建期完全看不出来的一条。
      const out = emitNginxLocations(
        [makeConfig('shortcut-library', [{ context: '/api', target: { dev: 'http://localhost:8080', prod: 'http://47.110.80.47:8988' } }])],
        PROD,
      );
      expect(out).toContain('proxy_pass http://47.110.80.47:8988;');
      expect(out).not.toContain('proxy_pass http://47.110.80.47:8988/;');
    });

    it('strips an author-written trailing slash from target', () => {
      const out = emitNginxLocations(
        [makeConfig('c', [{ context: '/api', target: { dev: 'http://localhost:8080/', prod: 'http://backend:8988/' } }])],
        PROD,
      );
      expect(out).toContain('proxy_pass http://backend:8988;');
    });
  });

  describe('location 匹配优先级', () => {
    it('uses ^~ so the static-asset regex in default.conf cannot preempt it', () => {
      // nginx 优先级:= > ^~ > 正则 > 普通前缀。default.conf 里的
      // `location ~* \.(js|css|png|...)$` 是正则,会赢过普通前缀 ——
      // 那样 /api/foo.svg 会被当成静态资源。
      const out = emitNginxLocations(
        [makeConfig('c', [{ context: '/api', target: 'http://backend:8988' }])],
        PROD,
      );
      expect(out).toContain('location ^~ /api/ {');
    });

    it('does not emit a double slash when context already ends with one', () => {
      // 'location ^~ /api//' 永不匹配任何请求 —— 又一个静默失效。
      const out = emitNginxLocations(
        [makeConfig('c', [{ context: '/api/', target: 'http://backend:8988' }])],
        PROD,
      );
      expect(out).toContain('location ^~ /api/ {');
      // 只查 location 行:target 里的 http:// 天然含双斜杠
      expect(out).not.toMatch(/location \^~ \S*\/\//);
    });

    it('orders longer contexts first so the output diff is stable and readable', () => {
      const out = emitNginxLocations(
        [
          makeConfig('a', [{ context: '/api', target: 'http://one:1' }]),
          makeConfig('b', [{ context: '/api/deep/nested', target: 'http://two:2' }]),
        ],
        PROD,
      );
      expect(out.indexOf('/api/deep/nested/')).toBeLessThan(out.indexOf('location ^~ /api/ {'));
    });
  });

  describe('环境隔离', () => {
    it('picks the prod target, never leaking the dev localhost value', () => {
      // 这是整套设计的核心保证:localhost:8080 指的是开发机上的进程,
      // 印进生产配置后在容器里必然 502。
      const out = emitNginxLocations(
        [makeConfig('c', [{ context: '/api', target: { dev: 'http://localhost:8080', prod: 'http://47.110.80.47:8988' } }])],
        PROD,
      );
      expect(out).toContain('http://47.110.80.47:8988');
      expect(out).not.toContain('localhost:8080');
    });

    it('picks the dev target when asked for dev', () => {
      const out = emitNginxLocations(
        [makeConfig('c', [{ context: '/api', target: { dev: 'http://localhost:8080', prod: 'http://prod:8988' } }])],
        { env: 'dev' },
      );
      expect(out).toContain('http://localhost:8080');
      expect(out).not.toContain('http://prod:8988');
    });

    it('treats a plain string target as shared by both environments', () => {
      const shared = [makeConfig('c', [{ context: '/api', target: 'http://public-api.example.com' }])];
      expect(emitNginxLocations(shared, PROD)).toContain('http://public-api.example.com');
      expect(emitNginxLocations(shared, { env: 'dev' })).toContain('http://public-api.example.com');
    });

    it('throws rather than silently falling back when prod target is missing', () => {
      // 静默回退到 dev 值 = 把 localhost 印进生产配置,正是要防的失败模式。
      // 宁可构建期炸,不要运行期 502。
      const out = () =>
        emitNginxLocations(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          [makeConfig('c', [{ context: '/api', target: { dev: 'http://localhost:8080' } as any }])],
          PROD,
        );
      expect(out).toThrow(/missing target\.prod/);
    });
  });

  describe('冲突检测', () => {
    it('throws when two components claim the same context with different targets', () => {
      // dev 靠 activeId 消歧,nginx 没有这个概念 —— 必须构建期中断,
      // 而不是让后写的静默覆盖先写的。
      const out = () =>
        emitNginxLocations(
          [
            makeConfig('shortcut-library', [{ context: '/api', target: 'http://one:8988' }]),
            makeConfig('other-component', [{ context: '/api', target: 'http://two:9001' }]),
          ],
          PROD,
        );
      expect(out).toThrow(/location conflict on context "\/api"/);
      // 报错必须指名道姓,否则大仓库里无从查起
      expect(out).toThrow(/shortcut-library/);
      expect(out).toThrow(/other-component/);
    });

    it('allows two components to share one backend (same context, same target)', () => {
      const out = emitNginxLocations(
        [
          makeConfig('a', [{ context: '/api', target: 'http://shared:8988' }]),
          makeConfig('b', [{ context: '/api', target: 'http://shared:8988' }]),
        ],
        PROD,
      );
      // 良性重复:去重成一条,不报错
      expect(out.match(/location \^~ \/api\/ \{/g)).toHaveLength(1);
    });

    it('detects a conflict even when one side writes a trailing slash', () => {
      const out = () =>
        emitNginxLocations(
          [
            makeConfig('a', [{ context: '/api', target: 'http://one:1' }]),
            makeConfig('b', [{ context: '/api/', target: 'http://two:2' }]),
          ],
          PROD,
        );
      expect(out).toThrow(/location conflict/);
    });
  });

  describe('输入校验', () => {
    it('rejects a context that does not start with /', () => {
      // 'api' 永远匹配不上任何请求路径 —— 静默失效,构建期拦掉。
      const out = () => emitNginxLocations([makeConfig('c', [{ context: 'api', target: 'http://b:1' }])], PROD);
      expect(out).toThrow(/does not start with/);
    });

    it('rejects a context containing characters that would escape the location block', () => {
      const out = () =>
        emitNginxLocations([makeConfig('c', [{ context: '/api} deny all; #', target: 'http://b:1' }])], PROD);
      expect(out).toThrow(/whitespace or one of/);
    });

    it('refuses to auto-translate rewrite rules', () => {
      // JS 正则语义与 PCRE 有差异,函数形式根本无法序列化。生成一份
      // "看着对但行为不同"的 rewrite 比直接拒绝更危险。
      const out = () =>
        emitNginxLocations(
          [makeConfig('c', [{ context: '/api', target: 'http://b:1', rewrite: { '^/api': '' } }])],
          PROD,
        );
      expect(out).toThrow(/not auto-translated/);
    });
  });

  describe('归一化与两端一致性', () => {
    it('supports the object shorthand, deriving context from the key', () => {
      // 与 dev 中间件共用 normalizeApi(),所以两端对简写的解释必然一致。
      const out = emitNginxLocations([makeConfig('c', { shortcut: 'http://backend:8988' })], PROD);
      expect(out).toContain('location ^~ /api/shortcut/ {');
    });

    it('emits ws upgrade headers only when ws is declared', () => {
      const withWs = emitNginxLocations(
        [makeConfig('c', [{ context: '/ws', target: 'http://b:1', ws: true }])],
        PROD,
      );
      expect(withWs).toContain('proxy_set_header Upgrade $http_upgrade;');
      expect(withWs).toContain('proxy_http_version 1.1;');

      const withoutWs = emitNginxLocations(
        [makeConfig('c', [{ context: '/api', target: 'http://b:1' }])],
        PROD,
      );
      expect(withoutWs).not.toContain('Upgrade');
    });

    it('maps changeOrigin to the Host header', () => {
      // changeOrigin: true(默认)等价于让后端看到自己的 host
      const on = emitNginxLocations([makeConfig('c', [{ context: '/api', target: 'http://b:1' }])], PROD);
      expect(on).toContain('proxy_set_header Host $proxy_host;');

      const off = emitNginxLocations(
        [makeConfig('c', [{ context: '/api', target: 'http://b:1', changeOrigin: false }])],
        PROD,
      );
      expect(off).toContain('proxy_set_header Host $host;');
    });
  });

  describe('产物形态', () => {
    it('returns a comment-only file when no component declares api', () => {
      // 返回纯注释而非空串:让"确实没有 api 声明"与"生成器没跑"在产物上可区分。
      const out = emitNginxLocations([makeConfig('c', undefined)], PROD);
      expect(out).toContain('No component declares');
      // 断言没有 location **指令**;"location" 这个词本身出现在头部警告文案里
      expect(out).not.toMatch(/^\s*location /m);
    });

    it('warns against dropping the file into conf.d/', () => {
      // conf.d/ 是在 http{} 层 include 的,裸 location 在那儿是语法错误,
      // nginx 会直接起不来 —— 产物里必须自带这个警告。
      const out = emitNginxLocations([makeConfig('c', [{ context: '/api', target: 'http://b:1' }])], PROD);
      expect(out).toContain('conf.d/');
      expect(out).toContain('DO NOT EDIT BY HAND');
    });
  });
});
