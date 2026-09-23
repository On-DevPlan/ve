# 消费共享组件（调用点侧）

> 前置阅读：SKILL.md「快速契约卡」。推荐先浏览仓库内 `apps/showcase/src/shared/components/README.md` 的「用法」与「FileDropZone 四个形态」。

## 标准 wiring

Vue 侧：

```vue
<script setup lang="ts">
import SharedMount from '@/shared/components/runtime/SharedMount.vue';
import FileDropZone from '@/shared/components/FileDropZone'; // descriptor！
</script>
<template>
  <SharedMount :module="FileDropZone"
    :component-props="{ accept: '.toml', onSelect: handleFiles }" />
</template>
```

React 侧：

```tsx
import { SharedMount } from '@/shared/components/runtime/SharedMount';
import FileDropZone from '@/shared/components/FileDropZone';

<SharedMount module={FileDropZone}
  componentProps={{ accept: '.toml', onSelect: handleFiles }} />
```

**注意「视觉/交互语言由谁出」**：color-studio 那类自装弹窗里，外观走宿主的类名 → `variant: 'bare'` + 宿主自己的按钮体系；要白拿统一虚线拖放框 → `variant: 'zone'`。

## variant 选型表

| | button（默认） | tile | bare | zone |
|---|---|---|---|---|
| 外观 | 按钮 + 提示行 | 方格，整格触发区 | 一个按钮，容器无装饰 | 虚线拖放区，整块即触发区 |
| 适用 | 弹窗、工具条 | 网格格子 | 消费方已有自己的按钮体系 | 选文件是区域主动作（导入弹窗） |
| 按钮类名 | 内置 `.sl-file-drop__btn` | 无 | `buttonClass`，不传回落内置 | 无按钮 |

- **选区判断铁律**：`repeat(N,1fr)` 网格 + `aspect-ratio:1` 方格 → **tile**；`zone` 是撑满容器的整块，进网格就把网格撑坏（`shared-consumer-game-skin-admin.test.ts` 锁住「弹窗 zone / 网格 tile」分工）。
- **bare 白拿三件事**：accept 真实校验 + 拖拽填入 + input.value 重置，且不更换视觉。
- 内置样式与 `buttonClass` 二选一不叠加 —— 同为 (0,1,0)，共同挂上谁生效取决于注入顺序。
- 想要「几何统一、颜色随宿主」：不覆盖类名，在宿主根容器声明 `--sl-color-primary` 等即可。
- 拒绝提示：用共享导出的 `formatRejectInfo(info)`，别再自写映射表。

## bare 形态三装配（漏了全是静默失败）

1. **`buttonClass` 样式写非 scoped 块**（自备类名时才需要）：共享组件内部渲染的 button 拿不到宿主的 `[data-v-*]`。在同一 SFC 加第二个不带 scoped 的 `<style>`，用根类名收敛作用域，如 `.sl-csa .my-btn`（特异性 (0,2,0) 与原 `.xxx[data-v-*]` 一致）。元素从 `<label>` 变 `<button>` 时要显式复位 `border`/`font-family`。
2. **SharedMount 壳不参与布局**：壳多一层 div，原 `align-items: stretch` 铺满的按钮会退化成内容宽。补回布局用 `> *`，不要点共享组件的内部类名。
3. **宿主通配 button reset 要放过 `sl-file-drop`**：

```css
/* user-space 型：特异性 (0,2,1) 起步，压得过共享按钮 (0,1,0) */
.sl-us-root button:not([class*="sl-us-btn"]):not([class*="sl-file-drop"]) { … }
```

**但这一型加不得**：game-skin-admin 的 `.sl-csa button`（纯类型选择器 (0,1,1)）—— 加 `:not()` 会抬到 (0,2,1) 反压 `.sl-csa .csa-btn` (0,2,0)，整个后台按钮被擦。该组件的正确解法是**选文件点一律 zone/tile**（框内无 button）。

## 接线小坑

- 外层**不要用 `label`** 包共享组件：点击 label 额外激活内部 input，弹两次选择器；用 `div`。
- 不再手写 `e.target.value = ''`（共享组件内部负责）。
- zone 容器 `align-items` 用默认 `stretch` —— 写 `center` 会把 zone 缩成内容宽度。
- 消费方 CSS 里被共享层接手的部分要清理干净：自画虚线框（dashed border）、`input[type=file]{display:none}`、已失效的 `::file-selector-button` 规则，全部删掉，否则框套框 / 死样式堆积。
- 共享组件是「选择 UI」不是「文件触发句柄」：程序式触发（菜单项调 `ref.click()`、slot 自定义内容）、双语义按钮（有背景时清除否则选择）**不要硬套**。真上传逻辑（分片/进度/后端）本来就在消费方，不构成排除理由。

## 错误案例

| 错误操作 | 实际后果 | 正确做法 |
| --- | --- | --- |
| label 包 SharedMount | 两次文件选择器 | div |
| 网格里用 zone | 网格撑坏 | tile |
| 消费方自画 dashed 框 | 框套框、粗细不一（历史：2px/1px/无，三处不一致） | 框由共享层提供 |
| reset 加 :not() 修 game-skin-admin 型 | 后台按钮全被擦 | 该处改 zone/tile |
| `align-items: center` 包 zone | zone 缩成内容宽 | 保持默认 stretch |
| hook 里的 onChange 只取 `files[0]` 但 input 有 multiple | 多选静默丢掉（PointEditor 真实 bug） | 遍历 `picked` |
