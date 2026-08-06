# ShadowRoot 同步 CSS 注入实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让组件 CSS 在 `createRoot().render()` / `app.mount()` 之前同步注入 ShadowRoot,消除"DOM 先到、CSS 后到"的 FOUC。

**Architecture:** 构建期把每个组件的 CSS 编译成同步文本字符串(React 走 `import.meta.glob(...?inline)` eager, Vue 走 vite 插件生成的 `virtual:vue-styles` 聚合模块)。运行时 `DetailPage` 并行取 `{ module, cssTexts }`,在 adapter 之前 `host.injectCss(cssTexts)` 把 `<style>` 同步落进 ShadowRoot;adapter 收到 `MountContext.cssReady` 后 `await` 再 render。远程组件(`loaderUrl`)拿不到构建期 CSS,`cssReady` 缺省 → adapter 回退现有 `adoptStylesInto` 扫 head 兜底。

**Tech Stack:** Vite 5、Vue 3、React 19、`@vue/compiler-sfc`、vitest(jsdom)。

**Spec:** `docs/superpowers/specs/2026-08-06-shadow-root-css-sync-mount-design.md`

## Global Constraints

- 分支:当前 `feat/user-space-kv-crud`(不新建分支)。Conventional Commits,每 Task 一个 atomic commit;提交命令实际执行时附 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` 尾行。
- `MountContext.cssReady` 为**可选**字段,缺省时 adapter 必须保持旧行为(adoptStylesInto 兜底)——保证远程组件不回归。
- 本地组件(无 `loaderUrl`)一律走新机制,不再走 `adoptStylesInto`。
- 测试:`pnpm exec vitest run`;lint:pre-commit hook + `pnpm lint`(`--max-warnings=0`)。
- 目标产物必须 dev / prod 同构:不得出现"dev 正常、prod 闪烁"。
- 构建产物约束:virtual module 的 import 复用 `@vitejs/plugin-vue` + vite CSS(`?inline`),**禁止**自写 scoped 编译逻辑(保证 `data-v-xxx` 与 vue plugin 运行时对齐)。

---

### Task 1: MountContext.cssReady 字段 + ShadowRootHost injectCss/ready

**Files:**
- Modify: `packages/component-contract/src/types.ts`(MountContext 增 `cssReady`)
- Modify: `packages/mount-adapters/src/style-adoption.ts`(导出 `styleFingerprint`)
- Modify: `packages/mount-adapters/src/ShadowRootHost.ts`(增 `injectCss` / `ready`;废弃 `stylesheetUrls` 选项)
- Test: `packages/mount-adapters/__tests__/ShadowRootHost.test.ts`

**Interfaces:**
- Produces:
  - `MountContext.cssReady?: Promise<void>`
  - `ShadowRootHost.injectCss(texts: string[]): void` —— 同步 append `<style data-sl-css="<fp>">`,同文本去重,幂等
  - `ShadowRootHost.ready: Promise<void>` —— CSS 注入完成信号;同步注入下即 `Promise.resolve()`
  - `styleFingerprint(text: string): string`(从 style-adoption.ts 导出)

- [ ] **Step 1: 写失败测试**

追加到 `packages/mount-adapters/__tests__/ShadowRootHost.test.ts` 的 describe 内:

```ts
it('injectCss appends a <style> with the given css text into shadowRoot', () => {
  const host = createShadowRootHost({ container });
  host.injectCss(['.inject-test { color: seagreen; }']);
  const texts = Array.from(host.shadowRoot.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n');
  expect(texts).toContain('.inject-test { color: seagreen; }');
});

it('injectCss is idempotent for identical css text', () => {
  const host = createShadowRootHost({ container });
  host.injectCss(['.dedup { color: red; }']);
  host.injectCss(['.dedup { color: red; }']);
  expect(host.shadowRoot.querySelectorAll('style[data-sl-css]')).toHaveLength(1);
});

it('exposes a ready promise that resolves after injectCss', async () => {
  const host = createShadowRootHost({ container });
  host.injectCss(['.ready-test { color: blue; }']);
  await expect(host.ready).resolves.toBeUndefined();
});
```

- [ ] **Step 2: 跑测试,验证失败**

Run: `pnpm --filter @style-library/mount-adapters test -- ShadowRootHost`
Expected: FAIL — `host.injectCss is not a function`

- [ ] **Step 3: 实现**

`packages/component-contract/src/types.ts` 的 `MountContext` 追加:

```ts
export interface MountContext {
  container: HTMLElement;
  shadowRoot: ShadowRoot;
  props: Record<string, unknown>;
  theme: ThemeRuntime;
  signal: AbortSignal;
  /**
   * 组件 CSS 已注入 ShadowRoot 的完成信号。adapter 必须在 render / app.mount 前 await。
   * - resolve:CSS 已同步就位(本地组件的常态)
   * - reject:CSS 获取失败,adapter 必须降级为「无样式渲染」,不得白屏
   * - undefined:宿主不管理 CSS,adapter 走 adoptStylesInto 兜底(远程组件)
   */
  cssReady?: Promise<void>;
}
```

`packages/mount-adapters/src/style-adoption.ts`:把 `function styleFingerprint` 改为 `export function styleFingerprint`(djb2 指纹,供 ShadowRootHost 复用)。

`packages/mount-adapters/src/ShadowRootHost.ts`:
- 选项 `stylesheetUrls` 标 `@deprecated`(保留类型,不再注入逻辑)。
- 接口追加 `injectCss(texts: string[]): void` 与 `ready: Promise<void>`。
- 工厂内追加:

```ts
// 已注入的 CSS 指纹(Style 节点去重;随 ShadowRoot 生命周期)
const seenCssFingerprints = new Set<string>();

function injectCss(texts: string[]): void {
  for (const text of texts) {
    if (!text) continue;
    const fp = styleFingerprint(text);
    if (seenCssFingerprints.has(fp)) continue;
    seenCssFingerprints.add(fp);
    if (shadowRoot.querySelector(`style[data-sl-css="${fp}"]`)) continue;
    const style = document.createElement('style');
    style.setAttribute('data-sl-css', fp);
    style.textContent = text;
    shadowRoot.appendChild(style);
  }
}
```

工厂返回对象追加 `injectCss` 与 `ready: Promise.resolve()`:

```ts
return {
  container,
  shadowRoot,
  portalTarget,
  injectCss,
  ready: Promise.resolve(),
  destroy,
};
```

文件头新增 `import { styleFingerprint } from './style-adoption.ts';`。

- [ ] **Step 4: 跑测试,验证通过**

Run: `pnpm --filter @style-library/mount-adapters test -- ShadowRootHost`
Expected: PASS(3 个新用例 + 现有 5 个用例)

- [ ] **Step 5: Commit**

```bash
git add packages/component-contract/src/types.ts packages/mount-adapters/src/style-adoption.ts packages/mount-adapters/src/ShadowRootHost.ts packages/mount-adapters/__tests__/ShadowRootHost.test.ts
git commit -m "feat(contract): add cssReady to MountContext + ShadowRootHost injectCss/ready"
```

---

### Task 2: css-collector 纯函数 + css-maps 骨架

**Files:**
- Create: `apps/showcase/src/registry/css-collector.ts`(纯函数 + 类型)
- Create: `apps/showcase/src/registry/css-maps.ts`(构建期真实 map:React `?inline` glob + Vue virtual import)
- Test: `apps/showcase/__tests__/css-collector.test.ts`

**Interfaces:**
- Consumes: `ManifestEntry`(from `@style-library/component-contract`)
- Produces:
  - `interface CssMaps { react: Record<string,string>; vue: Record<string,string[]> }`
  - `collectCss(entry: ManifestEntry, maps: CssMaps): string[]`
  - `export const cssMaps: CssMaps`(Task 5 使用;`vue` 来自 `virtual:vue-styles`,Task 3 后才有真实值)

- [ ] **Step 1: 写失败测试**

创建 `apps/showcase/__tests__/css-collector.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { collectCss, type CssMaps } from '../src/registry/css-collector';
import type { ManifestEntry } from '@style-library/component-contract';

const maps: CssMaps = {
  react: { 'user-space': 'body { color: red; }' },
  vue: { 'china-map': ['.a { color: blue; }', '.b { color: green; }'] },
};

function entry(overrides: Partial<ManifestEntry>): ManifestEntry {
  return {
    id: 'x', name: 'X', title: 'X', description: '', version: '1.0.0',
    framework: 'react', group: 'g', category: 'c', tags: [], status: 'stable',
    platform: 'both', route: { path: '/components/x', title: 'X' },
    mount: { kind: 'react' }, isolation: { mode: 'shadow-dom' },
    assets: { entryChunk: 'assets/x.js' }, loaderKey: 'x',
    ...overrides,
  };
}

describe('collectCss', () => {
  it('returns the single react css text for a react component', () => {
    expect(collectCss(entry({ loaderKey: 'user-space' }), maps)).toEqual(['body { color: red; }']);
  });

  it('returns the full vue css array for a vue component', () => {
    expect(collectCss(entry({ framework: 'vue', loaderKey: 'china-map' }), maps)).toEqual([
      '.a { color: blue; }',
      '.b { color: green; }',
    ]);
  });

  it('returns [] for a remote loaderUrl component', () => {
    expect(collectCss(entry({ loaderUrl: 'https://cdn/x.js' }), maps)).toEqual([]);
  });

  it('returns [] when the loaderKey is missing from maps', () => {
    expect(collectCss(entry({ loaderKey: 'unknown' }), maps)).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试,验证失败**

Run: `pnpm exec vitest run --project showcase css-collector`
Expected: FAIL — module not found(`css-collector.ts` 不存在)

- [ ] **Step 3: 实现**

创建 `apps/showcase/src/registry/css-collector.ts`:

```ts
// registry/css-collector.ts —— 把组件 CSS 文本映射成 adapter 注入用的 string[]。
//
// 纯函数:不接触 glob / virtual module,便于测试。真实 map 见 css-maps.ts。
// 契约:远程组件(loaderUrl)收集不到构建期 CSS,返回 [] —— adapter 走 adoptStylesInto 兜底。

import type { ManifestEntry } from '@style-library/component-contract';

export interface CssMaps {
  /** loaderKey → 单条 CSS 文本(React:index.css) */
  react: Record<string, string>;
  /** loaderKey → CSS 文本数组(Vue:组件目录下所有 .vue 的 style block) */
  vue: Record<string, string[]>;
}

export function collectCss(entry: ManifestEntry, maps: CssMaps): string[] {
  if (entry.loaderUrl) return [];
  if (entry.framework === 'react') {
    const text = maps.react[entry.loaderKey];
    return text ? [text] : [];
  }
  if (entry.framework === 'vue') {
    return maps.vue[entry.loaderKey] ?? [];
  }
  return [];
}
```

创建 `apps/showcase/src/registry/css-maps.ts`:

```ts
// registry/css-maps.ts —— 构建期真实 CSS 文本 map(dev/prod 同构)。
//   - React:`?inline` eager glob,同步返回 CSS 文本(Vite 文档确认)
//   - Vue:import virtual:vue-styles(由 vue-style-collector 插件提供,Task3)
//
// 为什么顶层 import.meta.glob 能同步:?inline 把 CSS 文本变成 JS 字符串,
// eager:true 在构建时内联进 chunk,运行时零异步、零网络。

import vueStylesMap from 'virtual:vue-styles';
import type { CssMaps } from './css-collector';

const reactCss = import.meta.glob(
  '../../../../packages/react-components/src/*/index.css?inline',
  { eager: true, import: 'default' },
) as Record<string, string>;

const react: Record<string, string> = {};
for (const [path, text] of Object.entries(reactCss)) {
  const id = path.match(/\/src\/([^/]+)\/index\.css/)?.[1];
  if (id) react[id] = text;
}

export const cssMaps: CssMaps = { react, vue: vueStylesMap };

export { collectCss } from './css-collector';
```

> ⚠️ `css-maps.ts` import `virtual:vue-styles`(Task 3 前不存在),dev/build 失败 — 预期中间态。Task 2 验收只跑 `css-collector.test.ts`。

- [ ] **Step 4: 跑测试,验证通过**

Run: `pnpm exec vitest run --project showcase css-collector`
Expected: PASS(4 个用例)

- [ ] **Step 5: Commit**

```bash
git add apps/showcase/src/registry/css-collector.ts apps/showcase/src/registry/css-maps.ts apps/showcase/__tests__/css-collector.test.ts
git commit -m "feat(showcase): add css-collector pure fn + css-maps skeleton"
```

---

### Task 3: vue-style-collector v2 改写(伪 .css 路径)

**Files:**
- Modify: `apps/showcase/src/registry/vue-style-collector.ts`(大幅改写 — 双拦截 resolveId/load,新增 `pseudoCssPath` / `compileRawScopedCss`,删除 v1 的 `compareVueNames` 排序逻辑外其他内联细节;**re-export `computeScopedId` 保留旧调用**)
- Modify: `apps/showcase/__tests__/vue-style-collector.test.ts`(改 v1 的 `export const s0 = "..."` 断言为 cssIds / cssMap 形态;新增 resolveId/load 双拦截断言;**`compileRawScopedCss` 必须含 `data-v-[a-f0-9]{8}` 是 v2 核心不变量**)

**Interfaces:**
- Produces(新增):
  - `pseudoCssPath(file, index): string` —— `<dir>/__vscoped__<basename>.<index>.css`
  - `compileRawScopedCss(block, { root, isProduction }): string` —— 编译后 raw CSS,带 data-v-xxx
  - `vueStyleCollector(opts).resolveId(id)` —— 双拦截(virtual:vue-styles + 伪 .css 路径)
  - `vueStyleCollector(opts).load(id)` —— 双拦截(virtual:vue-styles 返回模块源码;伪 .css 路径返回 raw scoped CSS)
- 兼容:v1 的 `VIRTUAL_VUE_STYLES` / `StyleBlockEntry` / `countStyleBlocks` / `collectVueStyleBlocks` / `computeScopedId`(re-export)签名不变
- 不变:css-maps.ts / DetailPage / adapter / vite.config 注册(那是 Task 3 / Task 4 才动)

## 不变(关键边界)
- scopedId 算法仍 100% 与 `@vitejs/plugin-vue@5.2.4` 一致(由 Task 1 的 `plugins/scoped-id.ts` + `scoped-id-guard` 兜底)
- pnpm-lock 不动、@vitejs/plugin-vue 仍是 5.2.4
- **不注册 scoped-id-guard 到 vite.config.ts** — 那是一独立 commit(Task 1 brief 已明确 Task 1 不注册,延续到 Task 2)
- **不改 css-maps.ts / DetailPage / adapter / vite.config.ts**

## 全局约束
- Conventional Commits;commit 消息末尾必须附:`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- 在 `feat/user-space-kv-crud` 直接提交;不 push
- 只改 brief 列的 2 个文件
- 不顺手做无关重构

## 完整可粘贴代码

**`apps/showcase/src/registry/vue-style-collector.ts`**(参考调研 agent 输出 1,可粘贴;关键点:`enforce: 'pre'`、`resolveId` 双拦截(`virtual:vue-styles` 与伪 `.css`)、`load` 双拦截、伪 .css 路径返回 compileStyle 编译后的 raw CSS、生成模块源码导出 `cssIds` 数组与 `cssMap` 聚合、保留 computeScopedId re-export)

**`apps/showcase/__tests__/vue-style-collector.test.ts`**(参考调研 agent 输出 2:14 个用例,覆盖 countStyleBlocks / collect / / / cssIds 形态 / 聚合 / 不含 import query / `compileRawScopedCss` 含 `data-v-[a-f0-9]{8}` 核心断言 / pseudoCssPath 同目录 / resolveId 双拦截 / load 返回 raw scoped CSS / computeScopedId 算法与确定性)

## 环境提示
- 测试:
  - `pnpm exec vitest run --project showcase vue-style-collector`(本 task)
  - `pnpm exec vitest run`(全仓库)
- lint:`pnpm exec eslint --max-warnings=0 < <改动的文件>`
- **build 冒烟(必修)**: `pnpm --filter @style-library/showcase build` — 验证 v2 不再 build 挂,且:
  1. `grep -hoE 'data-v-[a-f0-9]{8}' dist/assets/vc-*.css | sort -u` — scopedId 仍在 css chunk,5 个 SFC 与现行锁值一致(`42b507f2 / 568fc508 / 66bfaf13 / 5e86a972 / f2f288d1`)
  2. `grep -r "export const s0 = " dist/ 2>/dev/null` — 必须空(不再有 v1 残留)
  3. `pnpm --filter @style-library/showcase build 2>&1 | grep -i "expected ident"` — 必须空(无 CSS 解析报错)
  4. `ls dist/assets/vc-*.css | wc -l` — 应等于 vue 组件数
  5. `grep -l "__vscoped__" dist/assets/*.js` — Task 2 期间**空集 OK**(Task 4 才接 consumer);Task 4 后非空

## 报告
写完整报告到 `D:\DevProjects\my\github\ve\.superpowers\sdd\2026-08-06-shadow-root-css-sync-mount\task-2-report.md`:
- 状态:DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- 改动摘要
- 测试:vue-style-collector 用例数 + 全仓库数
- build 冒烟:5 个 grep 证据(每条 grep 命令 + 输出 + 解读)
- commit hash + message
- 顾虑

## 返回给我
状态、commit hash、5 个 grep 各自结论一句话、顾虑。