# WorkflowCanvas 开发规范

## 概述

WorkflowCanvas 是基于 Vue Flow 的节点式工作流画布，支持工具栏、拖拽、粘贴、右键菜单等方式添加和管理节点，节点间可连线。

## 目录结构

```
src/components/canvas/WorkflowCanvas/
├── component.js              # 组件配置（auto-discovery 必需）
├── index.vue                 # 主视图：纯编排，组合 composables 和子组件
├── components/               # UI 子组件（样式 + 事件封装）
│   ├── Toolbar.vue           # 工具栏：添加/删除/清空/导入导出/API 按钮
│   ├── ApiConfigModal.vue   # API 配置弹窗：Endpoint / API Key / Model
│   ├── ContextMenu.vue       # 右键菜单：删除节点
│   └── PropertyPanel.vue     # 属性面板：编辑选中节点数据
├── composables/             # 业务逻辑 composables
│   ├── useNodeActions.js    # 节点 CRUD（增删、导入导出、选中、聚焦）
│   ├── useClipboard.js      # 剪贴板（Ctrl+V 粘贴、拖拽放置）
│   ├── useKeyboard.js        # WASD 画布平移（支持模态框屏蔽）
│   └── useImageGen.js        # MiniMax 文生图/图生图 API 封装
└── nodes/                   # 节点视图组件
    ├── ImageNode.vue         # 图片节点（支持本地上传 / Blob URL）
    ├── InputNode.vue         # 输入框节点（带聚焦高亮）
    ├── TextNode.vue          # 纯文本展示节点
    ├── TextToImageNode.vue   # 文生图节点（调用 MiniMax API）
    └── ImageToImageNode.vue  # 图生图节点（调用 MiniMax API）
```

---

## 职责划分

### `index.vue` — 纯编排层

**不包含任何 UI 模板和 CSS**，只负责：
- 调用所有 composables，汇聚共享状态（`nodes`、`edges`）
- 组合子组件，通过 props / emit 与子组件通信
- 注册 `wf:add-image-node` 全局事件（AI 节点生成结果 → 自动添加到画布）
- 管理模态框状态（`showApiConfig`），透传给 `useKeyboard` / `useClipboard` 实现快捷键屏蔽

```js
// 模态框打开时自动屏蔽 WASD 和 Ctrl+V
const showApiConfig = ref(false)
useKeyboard(focusedNodeId, showApiConfig)
useClipboard(nodes, addNode, showApiConfig)
```

### `components/Toolbar.vue` — 工具栏

| Props | 说明 |
|-------|------|
| `selectedNode` | 当前选中节点，用于禁用删除按钮 |
| `toolbarButtons` | 按钮配置数组 `[{ type, label, icon }]` |

| Emit | 说明 |
|------|------|
| `add-node` | 点击添加节点按钮，payload 为节点类型字符串 |
| `delete-node` | 删除当前选中节点 |
| `clear-all` | 清空画布 |
| `export-json` | 导出工作流 |
| `import-json` | 导入工作流（payload 为 File 对象） |
| `open-api-config` | 打开 API 配置弹窗 |

### `components/ApiConfigModal.vue` — API 配置弹窗

| Props | 说明 |
|-------|------|
| `endpoint` | API 端点 |
| `apiKey` | API 密钥 |
| `model` | 默认模型（`image-01` / `image-01-live`） |

| Emit | 说明 |
|------|------|
| `save` | 保存配置，payload 为 `{ endpoint, apiKey, model }` |
| `cancel` | 取消，关闭弹窗 |

### `components/ContextMenu.vue` — 右键菜单

| Props | 说明 |
|-------|------|
| `visible` | 是否显示 |
| `x`, `y` | 菜单定位（屏幕坐标） |

| Emit | 说明 |
|------|------|
| `delete` | 删除当前节点 |
| `close` | 关闭菜单 |

点击菜单外部或按 Escape 自动关闭（在 `index.vue` 的 `document` 级别监听）。

### `components/PropertyPanel.vue` — 属性面板

| Props | 说明 |
|-------|------|
| `node` | 当前选中的节点对象 |

| Emit | 说明 |
|------|------|
| `close` | 关闭面板 |
| `update` | 节点数据变更（用于触发响应式更新） |

当前支持 `image`（显示 URL）、`textInput`（编辑 inputText）、`text`（编辑 content + fontSize）三种节点属性编辑。

---

## Composables 详解

### `useNodeActions.js` — 节点管理

```js
const {
  selectedNode,       // 当前选中节点
  focusedNodeId,      // 当前聚焦的节点 ID（输入框 focus 时）
  addNode,            // addNode(type, position?) 创建节点
  removeNode,         // removeNode(id) 删除节点及关联边
  clearAll,           // 清空画布
  exportJSON,         // 导出 JSON 文件
  importJSON,         // importJSON(file) 导入
  onNodeClick,        // 绑定 @node-click
  onNodeFocus,        // 绑定 @node-focus
  onNodeBlur          // 绑定 @node-blur
} = useNodeActions(nodes, edges)
```

**节点默认数据表：**

```js
const defaultNodeData = {
  image:        { label: 'Image',        imageUrl: '',         imageWidth: 200, imageHeight: 150 },
  textInput:    { label: 'Input',        inputText: '',        placeholder: 'Enter content...' },
  text:         { label: 'Text',         content: 'Display content', fontSize: 14 },
  textToImage:  { label: 'Text→Image',  prompt: '', model: 'image-01', aspectRatio: '1:1', styleType: '', styleWeight: 0.8, n: 1, promptOptimizer: false, aigcWatermark: false, imageUrls: [], loading: false, error: null },
  imageToImage: { label: 'Image→Image', subjectImageUrl: '',  prompt: '', model: 'image-01', aspectRatio: '1:1', styleType: '', styleWeight: 0.8, n: 1, promptOptimizer: false, aigcWatermark: false, imageUrls: [], loading: false, error: null }
}
```

### `useClipboard.js` — 剪贴板与拖拽

```js
// 第三个参数 disabledRef 为响应式布尔 ref，为 true 时禁用所有事件
const { isDragging, handleDrop, handleDragover, handleDragleave, enablePaste, disablePaste } =
  useClipboard(nodes, addNode, disabledRef)
```

| 状态/方法 | 说明 |
|-----------|------|
| `isDragging` | 拖拽进入状态，控制 canvas 拖拽高亮样式 |
| `handleDrop` | 图片文件拖入 → 自动创建 ImageNode |
| `handleDragover` / `handleDragleave` | 拖拽悬停事件 |
| `handlePaste` | Ctrl+V：图片 → ImageNode，文字 → TextNode |
| `enablePaste` / `disablePaste` | 注册/注销 document paste 监听 |

### `useKeyboard.js` — WASD 画布平移

```js
// focusedNodeId：输入框聚焦时禁用 WASD
// disabledRef：模态框打开时完全屏蔽 WASD（不响应任何按键）
useKeyboard(focusedNodeId, disabledRef)
```

- 按住 W/A/S/D 持续平滑滚动，速度 8px/帧
- 有输入框聚焦时自动禁用
- 模态框打开时（`disabledRef.value === true`）完全屏蔽

### `useImageGen.js` — MiniMax 图像生成 API

```js
const { textToImage, imageToImage } = useImageGen(nodeData)

// nodeData 上的字段会被直接修改：
// - nodeData.loading: boolean
// - nodeData.error: string | null
// - nodeData.imageUrls: string[]
```

| 导出 | 说明 |
|------|------|
| `useImageGen(nodeData)` | 返回 `textToImage()` / `imageToImage()` 方法 |
| `saveApiConfig(ep, key, model)` | 保存到 localStorage |
| `hasApiKey()` | 检查是否已配置 |
| `apiConfig` | 响应式配置 `{ endpoint, apiKey, model }` |

---

## 节点类型

| 类型 | 文件 | 用途 |
|------|------|------|
| `image` | nodes/ImageNode.vue | 显示本地图片 |
| `textInput` | nodes/InputNode.vue | 可编辑输入框 |
| `text` | nodes/TextNode.vue | 纯文本展示 |
| `textToImage` | nodes/TextToImageNode.vue | 文生图 |
| `imageToImage` | nodes/ImageToImageNode.vue | 图生图 |

每个节点组件必须：
- 接收 `id`（string）和 `data`（object）props
- 根元素设置 `position: relative`（Handle 定位依赖）
- 使用 `@vue-flow/core` 的 `<Handle>` 声明连接桩
- 有输入框的节点需 emit `node-focus` / `node-blur`，由 `index.vue` relay 到 `useNodeActions` 统一管理 `focusedNodeId`

---

## 添加新节点类型

### 步骤 1：创建节点组件

```vue
<!-- nodes/NewNode.vue -->
<script setup>
import { Handle, Position } from '@vue-flow/core'
const props = defineProps({ id: String, data: Object })
</script>
<template>
  <div class="new-node" style="position: relative;">
    <Handle type="target" :position="Position.Left" />
    <!-- 节点内容 -->
    <Handle type="source" :position="Position.Right" />
  </div>
</template>
```

### 步骤 2：注册节点

在 `index.vue` 中：

```js
import NewNode from './nodes/NewNode.vue'

const nodeTypes = {
  ...,
  newNode: markRaw(NewNode)  // markRaw 必须
}

const toolbarButtons = [
  ...,
  { type: 'newNode', label: 'New', icon: '🆕' }
]
```

### 步骤 3：添加默认数据

在 `useNodeActions.js` 的 `defaultNodeData` 中添加：

```js
newNode: { label: 'New', ...otherFields }
```

---

## 聚焦高亮系统

InputNode 等有输入框的节点，使用 CSS `:focus-within` 自动实现蓝色边框高亮，无需额外 JS：

```css
/* 默认灰色边框 */
border: 2px solid #e8e8e8;

/* 输入框聚焦时蓝色边框 */
border-color: #3b82f6;
box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
```

节点内部 emit `node-focus` / `node-blur` → VueFlow relay → `index.vue` @node-focus/@node-blur → `useNodeActions` 更新 `focusedNodeId` → `useKeyboard` 感知并禁用 WASD。

---

## 右键菜单

右键节点触发 `@node-context-menu`，`index.vue` 的 `onNodeContextMenu` 更新 `contextMenu` 状态，`ContextMenu` 组件通过 `<Teleport to="body">` 渲染到 `body` 底部。

如需扩展右键菜单项，在 `components/ContextMenu.vue` 中添加按钮即可。

---

## AI 生成节点（MiniMax）

点击工具栏 **🔐 API** 按钮配置：
- **Endpoint**：默认为 `https://api.minimaxi.com`
- **API Key**：存储在 localStorage
- **Default Model**：`image-01` 或 `image-01-live`

生成的图片结果以缩略图展示，点击后通过 `window.dispatchEvent(new CustomEvent('wf:add-image-node', { detail: node }))` 自动在画布上创建一个 ImageNode。

---

## 依赖

```
@vue-flow/core        # 核心画布引擎
@vue-flow/background  # 背景网格
@vue-flow/controls    # 缩放/重置控件
@vue-flow/minimap     # 小地图导航
```

---

## VueFlow 交互要点

- `v-model:nodes` / `v-model:edges` 双向绑定
- `nodeTypes` 必须用 `markRaw` 包裹防止 Vue 响应式代理
- `onConnect(params)` 处理连线创建
- `fitView()` 在 onMounted 延迟调用使内容适应视口
- `default-viewport` 设置初始缩放和平移 `{ x: 0, y: 0, zoom: 0.8 }`
