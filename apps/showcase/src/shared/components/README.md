# shared/components —— 跨框架共享组件白名单

这个目录下的组件**写一次，Vue 树与 React 树都能用**。

它是**能力白名单**，不是引用白名单：只有本目录下的组件会获得「island 桥接 +
样式自动注入」这套支持；其它目录的组件仍各自框架专用。

---

## 三条硬约定

### 1. props 必须是框架无关的纯数据 + 回调

island 边界上只过得了 JSON-ish 值与函数。所以：

- 可以：`string` / `number` / `boolean` / 数组 / 纯对象 / 回调函数
- 不可以：Vue 的 `Ref` / `Slots` / `VNode`，React 的 `ReactNode` / `ReactElement`

对外通信**一律走 props 回调**（如 `onSelect` / `onReject`），不要用 `defineEmits` ——
Vue 的 `emit` 在 island 边界上无法被 React 侧感知。

### 2. 样式放独立的 style.css，不用 SFC `<style>`

SFC `<style>` 由 `plugin-vue` + `vue-style-collector` 按 `packages/vue-components`
目录收集；React 的 `index.css` 由 `registry/css-maps.ts` 里硬编码的 glob 收集。
**两条通道都不覆盖本目录** —— 依赖自动注入就会裸样式渲染。

所以 CSS 必须显式挂在 descriptor 上（`import css from './style.css?inline'`），
由 `SharedMount` 壳按宿主环境注入。

同时**不得使用 scoped**：ShadowRoot / Light DOM 的隔离由容器提供，不需要 scoped；
而 scoped 依赖 plugin-vue 的编译期改写，与 `?inline` 拿到的原文对不上。

样式里只使用 `--sl-*` 主题 token，不写死颜色。

### 3. 只从目录入口 index.ts 引入

消费方 import 的是 descriptor（`FileDropZone/index.ts`），不是 `FileDropZone.vue`。
绕过 `SharedMount` 直接用组件，样式没人注入。

---

## 用法

Vue 侧：

```vue
<script setup lang="ts">
import SharedMount from '@/shared/components/runtime/SharedMount.vue';
import FileDropZone from '@/shared/components/FileDropZone';
</script>

<template>
  <SharedMount
    :module="FileDropZone"
    :component-props="{ accept: '.toml', onSelect: handleFiles }"
  />
</template>
```

React 侧：

```tsx
import { SharedMount } from '@/shared/components/runtime/SharedMount';
import FileDropZone from '@/shared/components/FileDropZone';

export function Toolbar() {
  return (
    <SharedMount
      module={FileDropZone}
      componentProps={{ accept: '.toml', onSelect: handleFiles }}
    />
  );
}
```

---

## FileDropZone 的四个形态

`variant` 决定呈现形态，四者的校验 / 拖拽 / 回调语义完全一致：

| | `'button'`（默认） | `'tile'` | `'bare'` | `'zone'` |
|---|---|---|---|---|
| 外观 | 按钮 + 下方提示行 | 方格，整格即触发区 | 只有一个按钮，容器无装饰 | 虚线拖放区，整块即触发区，框内只有文字 |
| 适用 | 弹窗、工具条 | 网格格子（批量导入、封面管理） | 消费方已有自己的按钮设计系统 | 「选文件」就是该区域主动作（导入弹窗的文件页） |
| 内容 | `label` 文字 | `imageUrl`（预览图）或 `text`，二选一 | `label` 文字 | `label`（主文案，默认「点击或拖拽文件到此处」）+ `hint`（副文案） |
| `hint` | 提示行；不传则按 `accept` / `maxSizeMb` 自动生成 | 底部覆盖条，hover / 拖拽 / 聚焦时淡入；**不传则不渲染** | 同 button，但**不传则不渲染** | 框内副文案；不传则由 `accept` 生成「支持 .toml」，无 `accept` 则不渲染 |
| 点击 | 只认按钮 | 整格可点，另补了 `role="button"` + `tabindex` + Enter/Space | 只认按钮 | 同 tile，整块可点 |
| 按钮类名 | 内置 `.sl-file-drop__btn` | 无按钮 | `buttonClass`；**不传则回落内置** `.sl-file-drop__btn` | 无按钮（整块即目标） |

### zone 形态：虚线框是共享层的一部分

zone 的虚线框（`padding: 32px 24px` / `2px dashed` / 居中，对齐 shortcut-library 原来的
`.sl-sl-modal__file-zone`）写在 `style.css` 里，是全仓库「拖放区外观」的唯一事实源。

**消费方不要再自己画虚线框。** 否则就是「框套框」，或是边框粗细不一 —— 改造前正是
如此：shortcut-library `2px` / github-show `1px` / color-studio 干脆没有。消费方容器
只保留外边距（`margin` / `padding`）与框下方那行「已加载 N 字节」。

`align-items` 记得用默认的 `stretch`：写成 `center` 会让 zone 被缩成内容宽度。

现状（6 处）：

- shortcut-library / github-show / color-studio 三个 TOML 导入弹窗；
- user-space 的 `UploadFileModal`（表单里那格「文件」字段 —— 虚线框是控件本身，
  字段标签与下方的文件名 / 体积行仍是宿主的表单排版）；
- game-skin-admin 的 `ReplaceTab` 替换弹窗与 `EmojiUploadModal`（同为表单字段形态，
  一个在弹窗里独占一行、一个是「图片文件」字段）。

**网格格子不要改成 zone。** game-skin-admin 的 `ImportTab` / `CoversListView` 是
`repeat(N, 1fr)` 网格里 `aspect-ratio: 1` 的方格，而 zone 是**撑满容器的整块区域**，
换过去会把网格撑坏 —— 那两处保持 `'tile'`。这个分工由
`apps/showcase/__tests__/shared-consumer-game-skin-admin.test.ts` 锁住（弹窗 zone /
网格 tile）。

`'bare'` 的用意：消费方已有按钮体系时，传 `buttonClass` 就能在**不更换视觉**的前提下
白拿「accept 真实校验 + 拖拽填入 + input.value 重置」这三件事。

**不传 `buttonClass` = 接受共享层的统一外观**：此时挂内置 `.sl-file-drop__btn`，
它的度量（radius 6 / padding 6×14 / 13px，对齐 shortcut-library 的 `.sl-sl-btn`）与
token 色是**全仓库选择文件按钮的唯一事实源**。现状：shortcut-library / github-show /
color-studio（导入弹窗 + 取色器）四处走这条路。自备类名的只剩 gis 两处（粉色主题的
`data-btn` / `upload-btn`）；user-space 与 game-skin-admin 的两个弹窗已改走 `zone`。

内置样式与消费方类名**二选一，不叠加** —— 二者同为 (0,1,0)，同时挂上时谁生效取决于
两份 CSS 的注入顺序，不可控。

想要「几何统一、颜色随宿主主题」的宿主，不要覆盖类名，而是在自己根容器上声明
`--sl-color-primary` / `--sl-color-on-primary`（`--sl-*` 全仓库目前无人定义，所有
取值实际落在各处的 fallback 上；声明一次即可让共享组件跟随宿主主题）。

tile / bare 的视觉覆盖都靠消费方类名，理由同：消费方选择器优先级更高，
或干脆就是唯一作用于该元素的类。**zone 是例外** —— 它的虚线框由共享层提供
（见上「zone 形态」），消费方覆盖它反而会重新造出不一致。

### bare 形态的三个装配要求

`bare` 比别人多三处要消费方配合，漏了会**静默失败**（不报错，只是没样式 / 宽度不对）。
第 1 条只在**自备 `buttonClass`** 时才需要；不传类名走内置样式的话，那条不适用：

1. **按钮样式必须写在非 scoped 块里。**

   那个 `<button>` 是共享组件内部渲染的，消费方 scoped 的 `[data-v-*]` 属性加不到
   它身上 —— 写在 scoped 块里的 `.my-btn { … }` 不会生效。

   做法：在同一 SFC 里加第二个**不带 scoped** 的 `<style>` 块，用消费方根类名收敛
   作用域。现有三处：game-skin-admin 用 `.sl-csa`（独立 `index.css`），gis 的
   ControlPanel / PointEditor 用 `.control-panel` / `.editor-overlay`（同 SFC 的
   第二个 style 块）。选择器特异度与原来的 `.xxx[data-v-*]` 一致，都是 (0,2,0)，
   观感不变。

   另外：元素从 `<label>` 换成 `<button>` 时（PointEditor 的「添加图片」就是这样），
   要显式复位 UA 样式表的 `border` 与 `font-family`。
   反过来，本来就在用 `<button>` 的地方（ControlPanel 的 `.data-btn`）不需要。

2. **`SharedMount` 的壳不参与布局，必要时自己补。**

   壳多出一层 `div`。原来作为 flex item 靠 `align-items: stretch` 铺满整行的按钮，
   加壳后会退化成内容宽度。

   做法：在非 scoped 块里补回布局，用 `> *` 而不是点共享组件的内部类名 ——
   宿主不该伸进共享组件的实现里：

   ```css
   .control-panel .data-buttons > .import-file,
   .control-panel .data-buttons > .import-file > * {
     display: block;
     width: 100%;
   }
   ```

3. **宿主若有「兜底 button reset」，要放过 `sl-file-drop`。**

   有些组件为了去掉浏览器默认 chrome，写的是通配式 reset，靠 `:not()` 把自己
   的按钮类排除在外，例如 user-space：

   ```css
   .sl-us-modal-backdrop button:not([class*="sl-us-btn"]) { background: none; border: none; padding: 0; … }
   ```

   这类选择器特异性常在 (0,2,1) 以上，**压得过**共享按钮的 (0,1,0)。以前消费方传
   自己的 `buttonClass` 时天然被 carve-out 放过；改用内置样式后类名变成
   `sl-file-drop__btn`，若没一并排除，按钮会被擦成一行裸文字（同样不报错）。

   做法：在 `:not()` 里再加一条 `:not([class*="sl-file-drop"])`。现状只有
   user-space 有这种 reset（`react-components/__tests__/user-space-kv-ui.test.ts`
   已锁住这两条规则），其余三处的 button 规则都按容器收敛，不受影响。

   注意 user-space 那两处目前是**防御性**的：它的上传弹窗已经改用 `zone`
   （框内没有按钮），所以这条规则眼下不会命中共享组件 —— 但一旦有人把该处换回
   `button` / `bare`，carve-out 必须还在，否则就是又一次静默失败。

   **还有一种 carve-out 加不得。** game-skin-admin 的 `.sl-csa button`（纯类型
   选择器，特异性 (0,1,1)）同样压过 `.sl-file-drop__btn`，但**不能**用 `:not()` 修：
   补上 `:not([class*="sl-file-drop"])` 会把特异性抬到 (0,2,1)，反过来压过
   `.sl-csa .csa-btn` (0,2,0)，把整个后台的按钮全擦掉。该组件里的四个选文件点
   因此一律走 `zone` / `tile`（框内没有 `<button>`，天然躲开这条 reset）——
   这就是「同一组件内选文件点从按钮形态改成 zone」的直接动因，注释写在
   `game-skin-admin/index.css` 与 `index.vue` 的那条 reset 上。

两个坑已内建，调用方不必再管：

- 点到隐藏 `input` 自身时不再转发 `click` —— 否则 `input.click()` 冒泡回容器
  会变成无限递归；
- tile 形态 `padding: 0`。消费方常按百分比缩放预览图（`img { width: 74% }`），
  容器 padding 会直接改变图片可见尺寸。

### 不该用的地方

共享组件是「文件选择 UI」，不是「文件触发句柄」。以下形态不要硬套：

- **程序式触发**：消费方从自己的按钮 / 菜单项里调 `ref.click()`（BrandBadge 的
  上传菜单项、PinMode 的背景按钮）。这些触发元素的内容是自定义的，而共享组件
  不接受 slot。
- **双语义按钮**：PinMode 的背景按钮在「已有背景」时是清除、否则是选择。

注意：「真上传」不构成排除理由 —— FileDropZone 只负责**选择 UI**，分片 / 进度 /
后端逻辑本来就在消费方。表单字段形态也能收敛：user-space 的 `UploadFileModal`
就是把「文件」这一格的控件换成了 `zone`，白拿拖拽填入与统一外观（该弹窗对可上传
类型无限制，所以不传 `accept`；字段标签与文件名行仍留在宿主侧）。

---

## 拒绝提示文案

`FileDropZone` 一并导出 `formatRejectInfo(info)` / `REJECT_REASON_TEXT`，
把「类型不符 / 超体积 / 拖进目录」三种拒绝原因拼成一句可直接展示的提示。
调用点不要再各写一份映射表。

---

## 三种宿主环境

| | E1 Light DOM | E2 ShadowRoot 内 | E0 游离子树 |
|---|---|---|---|
| 典型件 | 宿主 chrome 的返回键 | 被 demo 组件消费的文件选择按钮 | 测试里 `mount()`、离屏渲染、导出截图 |
| 样式落点 | `document.head` | 当前那一层 shadow root | `document.head` |
| 去重域 | 模块级 Set（document 全局唯一） | 按 shadow root 局部（`adoptCssTexts` 负责） | 同 E1 |

分派由 `runtime/host-env.ts` 的策略完成，调用方不需要感知。

**E0 必须存在的理由**：`@vue/test-utils` 的 `mount()` 默认把组件挂到一个游离 div 上，
此时 `anchor.getRootNode()` 返回那棵游离子树的根元素 —— 既不是 `document` 也不是
`ShadowRoot`。没有 E0 时这里**直接抛错**，表现为「组件一进游离容器就炸」。
游离子树最终会接入 document，所以提前把样式注进 `head` 即可，不会漏样式。

**关键**：`SharedMount` 不自建 ShadowRoot，只复用 anchor 已有的那一层。
所以任何情况下都只有一层 shadow root，不会出现嵌套 shadow 带来的事件 retarget
等问题。

---

## 加一个新组件

1. 建目录 `shared/components/<Name>/`
2. `<Name>.vue` —— 实现
3. `style.css` —— 非 scoped，只用 `--sl-*` token
4. `types.ts` —— props 契约（框架无关）
5. `index.ts` —— 导出 descriptor
6. 在调用点用 `SharedMount` 引用

---

## 已知限制

- `SharedMount` 的 React 侧约定 `module` 为静态 import 出来的常量，运行期不更换组件。
  需要换组件时请用 `key` 让 React 重建本组件。
- props 变化走浅合并同步，被移除的 key 会保留旧值。
- 当前源框架统一 Vue。`descriptor.ts` 的 `SharedHostFramework` 已预留 `'react'`，
  但 React 组件在 Vue 树里渲染的壳尚未实现。
