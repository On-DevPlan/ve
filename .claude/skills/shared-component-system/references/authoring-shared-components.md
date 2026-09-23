# 新增 / 修改共享组件（shared/components 本体）

> 前置阅读：SKILL.md「快速契约卡」。仓库内唯一事实源：`apps/showcase/src/shared/components/README.md`。

## 新增组件 SOP

1. 建目录 `apps/showcase/src/shared/components/<Name>/`
2. `<Name>.vue` — 实现（`<script setup lang="ts">`）
3. `style.css` — 非 scoped，只用 `--sl-*` token，不写死颜色
4. `types.ts` — props 契约（框架无关类型 + 回调）
5. `index.ts` — 导出 descriptor：

```ts
export default defineSharedModule({
  Component: <Name>,
  css, // import css from './style.css?inline'
  meta: { name: '<Name>', host: 'vue' },
});
```

6. 调用点一律经 `SharedMount` 引用 descriptor，不直接渲染组件
7. 更新 `scoped-id.test.ts`（若只动 shared 本体则锁值不受影响；动了 packages/vue-components 的 SFC 受影响）

## descriptor 契约细节

- `defineSharedModule()` 产出，勿手写字面量对象 —— 手写会漏 `render` 防误用哨兵（直接当组件渲染时抛错，把「静默渲染空」变成「立刻炸」）。
- `meta.name` 必须与目录名一致 —— SharedMount 样式注入按它标记。
- css 必须显式挂在 descriptor 上。原因：SFC `<style>` 由 plugin-vue + vue-style-collector 按 packages/vue-components 收集、React index.css 由 `css-maps.ts` 硬编码 glob 收集，**两条通道都不覆盖 shared/components**。scoped 也不可用（编译期改写与 `?inline` 原文对不上）。

## 设计组件时的约束

- props 只能 `string/number/boolean/数组/纯对象/回调`；禁止 `Ref/Slots/VNode/ReactNode`（island 边界只过 JSON-ish + 函数）。
- 通信全部走 props 回调（`onSelect`/`onReject`），不用 `defineEmits`（Vue emit 在 React 侧不可感知）。
- 组件内不引 slot、不引 css 之外的运行时依赖 —— 内部已建的两个内建坑对策可参照 FileDropZone：
  - 点击命中隐藏 input 自身时不转发 click（防 `input.click()` 冒泡回容器无限递归）；
  - tile 形态 `padding: 0`（消费方常按百分比缩放预览图）。

## 样式注入：三种宿主环境（host-env.ts 策略自动分派）

| | E1 Light DOM | E2 ShadowRoot 内 | E0 游离子树 |
|---|---|---|---|
| 典型件 | 宿主 chrome 返回键 | demo 组件（ShadowRoot 内）消费 | `mount()` / 离屏渲染 / 截图 |
| 样式落点 | `document.head` | 当前那层 shadow root | `document.head` |
| 去重域 | 模块级 Set | 按 shadow root（`adoptCssTexts`） | 同 E1 |

- E0 必须存在：`@vue/test-utils mount()` 挂到游离 div，`getRootNode()` 既非 document 也非 ShadowRoot，没有 E0 会直接抛错。
- SharedMount **不自建** ShadowRoot，只复用 anchor 已有层 —— 全局永远只有一层 shadow root。

### style-adoption 的导入方向

`adoptCssTexts` / `djb2` 来自 `@style-library/mount-adapters/style-adoption`（子路径导出）。**不要**改为从包 barrel `index.ts` 引 —— barrel 会把 react-dom 拉进 shared-components chunk。

## 已知限制（写组件时心里有数）

- React 侧 `module` 是静态 import 常量，运行期不换组件；需要换用 `key` 重建。
- props 浅合并，被移除 key 保留旧值。
- 目前源框架统一 Vue；`SharedHostFramework` 预留 `'react'` 但 React 组件进 Vue 树的壳未实现。

## 错误案例

| 错误操作 | 实际后果 | 正确做法 |
| --- | --- | --- |
| 用 barrel `index.ts` 引 style-adoption | shared-components chunk 静态 import react-vendor（192KB），Vue 首页被拉 React | 子路径 `@style-library/mount-adapters/style-adoption` |
| SFC 里直接写 `<style>` 依赖自动注入 | 裸样式渲染（无人收集 shared 目录） | style.css + `?inline` 挂 descriptor |
| style.css 用 scoped | `?inline` 拿到原文与编译产物对不上，token 匹配失败 | 非 scoped；隔离交给容器 |
