---
ref: how-to-add-component
parent: web-work-flow
---

# ref2: How to Add a Component

在 wb 项目中新增一个 Vue 或 React 组件的标准流程。**核心结论:加组件 = 写 `component.config.ts` + `index.{vue,tsx}`,别无其他步骤**。

> 字段名 / 类型严格对齐 `packages/component-contract/src/types.ts` —— 改字段名会导致 manifest 校验失败。

---

## 1. 文件结构

每个组件是**一个独立目录**,目录名 = 组件 id。组件由 `import.meta.glob` 通过**唯一顶层入口**加载:

```
packages/vue-components/src/<id>/
├── index.vue              # Vue 实现入口(glob 唯一扫描目标)
├── component.config.ts    # 组件元数据(必填,ESLint 校验格式)
├── index.css               # React 组件 side-effect 导入的全局样式(仅 React 必备)
└── README.md              # 简要说明(可选但推荐)
```

```
packages/react-components/src/<id>/
├── index.tsx              # React 实现入口
├── component.config.ts
├── index.css              # ← 顶部 import './index.css' 必须存在,否则 ShadowRoot 内无样式
└── README.md
```

**没有 `src/<id>/index.ts`** 这种"统一出口"—— Host 通过 `import.meta.glob` 直接加载 `index.vue` / `index.tsx`,Vite 把每个组件打成独立 chunk。

**关键约束**:`import.meta.glob` 的字面量路径只匹配**顶层** `index.{vue,tsx}`,不会扫子目录。组件内部怎么拆,只要 `index.{vue,tsx}` 还在,外层零感知。

> **组件比较大**(`index.{vue,tsx}` > 300 行 / 模板 ≥ 3 个子视图 / 业务逻辑层 ≥ 2 个模块) → 读 [[large-component-layout]] 拿目录模板。本文件只覆盖单文件组件。

## 2. component.config.ts 模板

```ts
import type { ComponentConfig } from '@style-library/component-contract';

export default {
  // 必填:基础身份
  id: 'my-button',                    // kebab-case,全局唯一;ESLint 强制 = 目录名
  name: 'MyButton',                    // PascalCase 技术名
  title: '我的按钮',                   // 中文标题(卡片显示)
  description: '一个会变色的按钮组件',   // 卡片副文
  version: '1.0.0',                    // SemVer

  // 必填:技术分类
  framework: 'vue',                    // 'vue' | 'react';ESLint 强制与所在包匹配
  entry: './index.vue',                // 相对此 config 的实现路径

  // 可选:目标运行平台(默认 'both')
  platform: 'both',                    // 'pc' | 'mobile' | 'both';见 §2.1

  // 必填:目录结构
  group: '基础',                       // 一级分组
  category: '交互',                    // 二级分类
  tags: ['button', 'demo'],            // 检索标签

  // 必填:挂载方式
  mount: { kind: 'vue', propsMode: 'default' },

  // 可选但强烈推荐:状态 + 路由
  status: 'stable',                    // 'stable' | 'experimental' | 'deprecated'
  route: { path: '/components/my-button', title: '我的按钮' },
                                       // ESLint 强制 == '/components/<id>'

  // 可选:隔离与主题
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },

  // 可选:能力
  capabilities: { resizable: false, fullscreen: false },

  // 可选:依赖
  dependencies: [
    { name: 'echarts', version: '^5.0.0', sharing: 'host' },
  ],

  // 可选:远程 loader(见 §5.1)
  // loaderUrl: 'https://cdn.example.com/my-chart.js',
} satisfies ComponentConfig;
```

**字段名严格对齐 spec**: 不要改 `id` → `componentId`、不要改 `framework` → `kind`,JSON Schema 会拒收。

### 2.1 `platform` 字段语义

`platform` 控制组件在 PC / 手机端的可见性,由 `apps/showcase/src/composables/usePlatform.ts` 自动检测:

| 值 | PC 端可见 | 手机端可见 | 适用场景 |
|---|---|---|---|
| `'pc'` | ✅ | ❌ | 桌面大屏组件(如地图、3D 场景、双人游戏、快捷键管理) |
| `'mobile'` | ❌ | ✅ | 手机端专属组件(如底部导航、触摸手势) |
| `'both'`(默认) | ✅ | ✅ | 两端都适用的通用组件 |

**检测策略**(`usePlatform.ts`):
1. UA 匹配: `Android|iPhone|iPad|Mobile` 等关键词命中 → `'mobile'`
2. 屏幕宽度: `<= 768px` → `'mobile'`
3. UA 匹配优先于宽度

**过滤机制**(`SearchIndex.ts`): PC 端只看 `platform='pc'|'both'` 的组件;手机端只看 `'mobile'|'both'`。`manifest-generator` 在构建时对未声明的字段默认补 `'both'`(`generator.ts:56`)。

ESLint 规则目前不校验该字段,纯运行时过滤。

## 3. Vue 组件示例

```vue
<!-- packages/vue-components/src/my-button/index.vue -->
<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  label?: string;
  variant?: 'primary' | 'secondary';
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Click me',
  variant: 'primary',
});

const count = ref(0);
</script>

<template>
  <button
    :class="['sl-btn', `sl-btn--${props.variant}`]"
    @click="count++"
  >
    {{ props.label }} ({{ count }})
  </button>
</template>

<style scoped>
.sl-btn {
  font-family: var(--sl-font-family);
  padding: var(--sl-space-2) var(--sl-space-3);
  border-radius: var(--sl-radius-md);
  background: var(--sl-color-primary);
  color: var(--sl-color-on-primary);
}
.sl-btn--secondary {
  background: var(--sl-color-surface);
  color: var(--sl-color-text);
  border: 1px solid var(--sl-color-border);
}
</style>
```

**关键约定**:

- 类名以 `sl-` 前缀(便于 ShadowRoot CSS adoption 识别)
- CSS 全部走 `--sl-*` token,不要写死颜色
- `<style scoped>` 由 Vite 自动处理 ShadowRoot 内的样式克隆

## 4. React 组件示例

```tsx
// packages/react-components/src/data-table/index.tsx
import { useMemo, useState } from 'react';
import './index.css';  // side-effect import: Vite 会把 CSS 注入 document.head

interface Column<T> {
  key: keyof T & string;
  title: string;
  width?: number;
}

interface Props<T = Record<string, unknown>> {
  data?: T[];
  columns?: Column<T>[];
  pageSize?: number;
}

interface DefaultRow {
  id: number;
  name: string;
  role: string;
}

const DEFAULT_COLUMNS: Column<DefaultRow>[] = [
  { key: 'id', title: 'ID', width: 60 },
  { key: 'name', title: '姓名', width: 140 },
  { key: 'role', title: '角色' },
];

export default function DataTable<T extends Record<string, unknown> = DefaultRow>(props: Props<T>) {
  const data = (props.data ?? (DEFAULT_DATA as unknown as T[]));
  const columns = (props.columns ?? (DEFAULT_COLUMNS as unknown as Column<T>[]));
  const pageSize = props.pageSize ?? 2;

  const [page, setPage] = useState(0);
  const slice = useMemo(
    () => data.slice(page * pageSize, (page + 1) * pageSize),
    [data, page, pageSize],
  );

  return (
    <div className="sl-table">
      <table>
        {/* ... */}
      </table>
    </div>
  );
}
```

```css
/* packages/react-components/src/data-table/index.css */
.sl-table {
  font-family: var(--sl-font-family);
  color: var(--sl-color-text);
}
.sl-table th {
  background: var(--sl-color-surface-alt);
  font-weight: 600;
}
```

## 5. 添加组件流程(零配置)

新组件**默认会被自动发现**。加组件 = 写 `component.config.ts` + `index.{vue,tsx}`,**写完即可,不需要重启 dev server**。

```text
新增组件 → 写 component.config.ts + index.vue/tsx
  ↓
  ESLint 校验 config.ts 字段格式
  ↓
dev:
  - import.meta.glob 已扫到 index.{vue,tsx},Vite 自动出独立 chunk
  - manifestPlugin watcher 监听到 component.config.ts 的 add 事件
  - 200ms debounce → 重新生成 cachedManifest + 浏览器 full-reload
  - 卡片出现,详情路由可访问

prod:
  - pnpm --filter @style-library/showcase build
  - Vite 把每个组件打成独立 chunk,manifest emit 到 dist/component-manifest.json
```

### 5.1 例外情况:显式 `loaderUrl`

下面这些情况需要在 `component.config.ts` 显式声明 `loaderUrl`:

1. **远程 CDN 组件**(Module Federation、CDN)
2. **外部 npm 包组件**(不是本仓库源码)
3. **自定义目录结构**(不在 `packages/{vue,react}-components/src/<id>/`)

```ts
import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'remote-chart',
  name: 'RemoteChart',
  title: '远程图表',
  description: '从 CDN 加载的图表组件',
  version: '1.0.0',
  framework: 'vue',
  entry: './index.js',
  group: '数据可视化',
  category: '图表',
  tags: ['chart', 'remote'],
  mount: { kind: 'vue' },
  loaderUrl: 'https://cdn.example.com/my-chart.js',   // ← 显式远程 URL
} satisfies ComponentConfig;
```

`setLoaders(manifest)` 会用 `loaderUrl` 覆盖 `import.meta.glob` 的结果——给远程组件留出口,本地默认约定无需任何配置。

### 5.2 删除组件

```bash
rm -rf packages/vue-components/src/my-button
```

manifestPlugin watcher 监听到 `unlink` 事件 → 200ms debounce → 重新生成 cachedManifest + full-reload。manifest 自动清掉这条记录,卡片消失,详情路由 404。

### 5.3 loader 找不到时的报错

```text
DetailPage 控制台: "No loader registered for \"my-button\""
```

这意味着:

- 你的 `id` 跟目录名不一致(loaderKey 默认 = id,目录不匹配 `import.meta.glob` 就扫不到)
- 或 `loaderUrl` 写错了
- 或 `packages/{vue,react}-components/src/<id>/index.{vue,tsx}` 物理上不存在

## 6. 测试要点

不需要写组件本身的单元测试(展示中心是手动演示为主),但建议:

```ts
// packages/vue-components/__tests__/my-button.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MyButton from '../src/my-button/index.vue';

describe('MyButton', () => {
  it('renders label', () => {
    const wrapper = mount(MyButton, { props: { label: 'hi' } });
    expect(wrapper.text()).toContain('hi');
  });

  it('increments count on click', async () => {
    const wrapper = mount(MyButton);
    await wrapper.find('button').trigger('click');
    expect(wrapper.text()).toContain('(1)');
  });
});
```

`@vue/test-utils` 已在 showcase devDependencies 里。

## 7. 验证清单(端到端)

按顺序跑:

```bash
# 1. ESLint 校验 component.config.ts 格式
pnpm lint
# 期望:0 errors / 0 warnings(尤其 style-library/valid-component-config 必须过)

# 2. dev server 自动发现
pnpm --filter @style-library/showcase dev &
sleep 8
curl -s http://localhost:5173/__component-manifest.json | grep my-button
# 期望:出现 "id":"my-button" 的条目

# 3. 构建并验证独立 chunk
pnpm --filter @style-library/showcase build
ls apps/showcase/dist/assets/ | grep my-button
# 期望:出现 vc-my-button-*.js 或 rc-my-button-*.js

# 4. 跑测试
pnpm exec vitest run
```

## 8. 常见错误

| 错误 | 症状 | 修复 |
|---|---|---|
| 忘记 `component.config.ts` | manifest 中没这条;卡片不显示 | 检查文件名拼写 + id 唯一 |
| `component.config.ts` 字段错 | `pnpm lint` 报 ajv / `style-library/valid-component-config` 错 | 对照 types.ts 字段名 + ESLint 规则提示 |
| `id` 与目录名不一致 | `pnpm lint` 报 idMismatch + 详情页 `No loader registered` | 改 id 或改目录名,两边保持一致 |
| `framework` 与所在包不一致 | `pnpm lint` 报 frameworkMismatch | vue 包 → `framework: 'vue'`,react 包 → `framework: 'react'` |
| `route.path` 与 id 不匹配 | `pnpm lint` 报 routePathIdMismatch | `route.path` 必须等于 `/components/<id>` |
| `loaderUrl` 写错路径 | 详情页 mount 抛错 | 控制台看 import 异常,校对 URL |
| 满足默认约定但 loader 找不到 | `import.meta.glob` 是相对路径字面量,扫不到 | 检查目录确实在 `packages/{vue,react}-components/src/<id>/` 下 |
| `framework` 与 `mount.kind` 不一致 | validator 拒绝 | manifest-generator 已 build-time 阻断 |
| Vue SFC 用 unscoped 类名(无 `sl-` 前缀) | ShadowRoot 内样式丢失 | CSS 类名加 `sl-` 前缀,或修改 CSS adoption 过滤规则 |
| React 组件没 side-effect import CSS | ShadowRoot 内样式丢失 | `import './index.css'` 必须放在文件最顶部 |
| CSS 写死颜色 / 间距 | 主题切换不生效 | 全部走 `var(--sl-*, fallback)` |
| dev server 运行时加组件不出现 | watcher 失效 | 检查 `packages/*/src/` 路径是否在 `componentRoots` 配置里;重启 dev server |

## 9. 提交格式

```bash
git add packages/vue-components/src/my-button
git commit -m "feat(vue-components): add my-button example component"
```

## 10. 快速链接

- 类型定义: `packages/component-contract/src/types.ts`
- JSON Schema: `packages/component-contract/src/component-config.schema.json`
- Loader 自动发现(import.meta.glob): `apps/showcase/src/registry/loaders.ts`
- **manifestPlugin(watcher + dev middleware + prod emit): `packages/manifest-generator/src/vite-plugin.ts`**
- Scanner + Generator: `packages/manifest-generator/src/scanner.ts` / `generator.ts`
- Loaders 注入 Vue (provide): `apps/showcase/src/registry/loaders.ts` (`LoadersKey` / `setLoaders()`)
- 共享样式 adoption: `packages/mount-adapters/src/style-adoption.ts`
- Adapter 工厂 + 选择器: `packages/mount-adapters/src/AdapterFactory.ts`(`createAdapters` / `selectAdapter`)
- Vue adapter: `packages/mount-adapters/src/VueMountAdapter.ts`
- React adapter: `packages/mount-adapters/src/ReactMountAdapter.ts`
- ESLint 自定义规则: `eslint/rules/valid-component-config.js`
- vue-components 标准组件约定: `packages/vue-components/src/<id>/index.vue`
- react-components 标准组件约定: `packages/react-components/src/<id>/index.tsx`
- 现有 Vue 示例: `packages/vue-components/src/button/` / `china-map/` / `heavy-chart/`
- 现有 React 示例: `packages/react-components/src/data-table/`