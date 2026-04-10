# WorkflowCanvas 开发规范

## 概述

WorkflowCanvas 是基于 Vue Flow 的节点式工作流画布，支持通过工具栏、拖拽、粘贴等方式添加节点，节点间可连线。

## 目录结构

```
src/components/canvas/WorkflowCanvas/
├── component.js           # 组件配置（auto-discovery 必需）
├── index.vue              # 主视图：Toolbar + VueFlow + PropertyPanel
├── composables/           # 业务逻辑 composables
│   ├── useNodeActions.js  # 节点 CRUD（增删、导入导出、选中）
│   └── useClipboard.js    # 剪贴板（Ctrl+V 粘贴、拖拽放置）
└── nodes/                 # 节点 UI 组件
    ├── ImageNode.vue      # 图片节点
    ├── InputNode.vue      # 输入框节点
    └── TextNode.vue       # 纯文本展示节点
```

## 职责划分

### index.vue（视图层）

- 声明节点类型注册表（`nodeTypes`），必须用 `markRaw` 包裹
- 组合 composables，绑定 UI 事件
- 不直接操作节点数据，只通过 composables 间接操作

### composables/useNodeActions.js（节点管理）

| 职责 | 说明 |
|------|------|
| `selectedNode` | 当前选中的节点 ref |
| `addNode(type, position?)` | 创建指定类型的节点 |
| `removeNode(id)` | 删除节点及关联边 |
| `clearAll()` | 清空画布 |
| `exportJSON()` | 导出工作流为 JSON 文件 |
| `importJSON(file)` | 从 JSON 文件导入工作流 |
| `onNodeClick({ node })` | 处理节点点击事件 |

**节点默认数据表：**

```js
const defaultNodeData = {
  image:        { label: 'Image',        imageUrl: '',         imageWidth: 200, imageHeight: 150 },
  textInput:    { label: 'Input',        inputText: '',        placeholder: 'Enter content...' },
  text:         { label: 'Text',         content: 'Display content', fontSize: 14 },
  textToImage:  { label: 'Text→Image',   prompt: '', model: 'image-01', aspectRatio: '1:1', styleType: '', styleWeight: 0.8, n: 1, promptOptimizer: false, aigcWatermark: false, imageUrls: [], loading: false, error: null },
  imageToImage: { label: 'Image→Image',  subjectImageUrl: '',  prompt: '', model: 'image-01', aspectRatio: '1:1', styleType: '', styleWeight: 0.8, n: 1, promptOptimizer: false, aigcWatermark: false, imageUrls: [], loading: false, error: null }
}
```

添加新节点类型需要同时修改 `defaultNodeData`、`index.vue` 的 `toolbarButtons` 和 `nodeTypes`。

### composables/useClipboard.js（剪贴板与拖拽）

| 职责 | 说明 |
|------|------|
| `isDragging` | 拖拽进入状态（控制拖拽高亮） |
| `handleDragover / handleDragleave` | 拖拽悬停事件 |
| `handleDrop` | 拖拽释放：图片文件 → ImageNode |
| `handlePaste` | Ctrl+V 粘贴：图片 → ImageNode，文字 → TextNode |
| `enablePaste / disablePaste` | 注册/注销 document paste 事件监听 |

### composables/useKeyboard.js（键盘控制）

| 职责 | 说明 |
|------|------|
| WASD 平移画布 | W=上, A=左, S=下, D=右（按住持续平滑滚动）；聚焦节点输入框时自动禁用 |

```js
// 传入 focusedNodeId，当有节点输入框聚焦时自动禁用 WASD
useKeyboard(focusedNodeId)
```

### composables/useNodeActions.js（节点管理）

新增状态：

| 状态/方法 | 说明 |
|-----------|------|
| `focusedNodeId` | 当前聚焦的节点 ID（textarea focus 时） |
| `onNodeFocus({ node })` | 节点输入框聚焦时调用 |
| `onNodeBlur()` | 节点输入框失焦时调用 |

### nodes/*.vue（节点视图）

每个节点组件必须：
- 接收 `id`（string）和 `data`（object）props
- 使用 `@vue-flow/core` 的 `<Handle>` 声明连接桩（`type="target"` / `type="source"`，`position` 指定边）
- 根元素设置 `position: relative`（Handle 定位依赖）
- 有输入框的节点（InputNode）需 emit `node-focus`（`@focusin`）和 `node-blur`（`@focusout`）事件，根 div 使用 `@focusin`/`@focusout` 配合 `emit` 向上传递

## 节点类型

| 类型 | 文件 | 用途 | 数据字段 |
|------|------|------|----------|
| `image` | ImageNode.vue | 显示图片 | `imageUrl` |
| `textInput` | InputNode.vue | 可编辑输入框 | `inputText`, `placeholder` |
| `text` | TextNode.vue | 纯文本展示 | `content`, `fontSize` |
| `textToImage` | TextToImageNode.vue | 文生图（MiniMax API） | `prompt`, `model`, `aspectRatio`, `styleType`, `n`, `imageUrls`, `loading`, `error` |
| `imageToImage` | ImageToImageNode.vue | 图生图（MiniMax API） | `subjectImageUrl`, `prompt`, `model`, `aspectRatio`, `styleType`, `n`, `imageUrls`, `loading`, `error` |

## AI 生成节点（MiniMax）

### API 配置

点击工具栏 **🔐 API** 按钮，在弹窗中填写：
- **Endpoint**：默认为 `https://api.minimaxi.com`，可自定义
- **API Key**：存储在 localStorage，仅发送到目标 endpoint

### TextToImageNode（文生图）

- 输入 prompt，选择模型、宽高比、画风
- 点击 **✨ Generate** 发起请求
- 生成的图片显示为缩略图，点击可添加到画布（自动创建 ImageNode）

### ImageToImageNode（图生图）

- 先上传/拖入一张主体参考图
- 输入 prompt，选择模型、宽高比、画风
- 点击 **✨ Transform** 发起请求
- 生成的图片同样可点击添加到画布

### useImageGen.js

| 导出 | 说明 |
|------|------|
| `useImageGen(nodeData)` | 返回 `textToImage()`、`imageToImage()` 方法，操作 nodeData 上的 `imageUrls` / `loading` / `error` |
| `saveApiConfig(ep, key)` | 保存到 localStorage |
| `hasApiKey()` | 检查是否已配置 |
| `apiConfig` | 响应式配置对象 |

## 添加新节点类型

1. **创建节点组件**：`nodes/NewNode.vue`
   ```vue
   <script setup>
   import { Handle, Position } from '@vue-flow/core'
   const props = defineProps({ id: String, data: Object })
   </script>
   <template>
     <div class="new-node">
       <!-- Handle 必须 -->
       <Handle type="target" :position="Position.Left" />
       ...节点内容...
       <Handle type="source" :position="Position.Right" />
     </div>
   </template>
   ```

2. **注册节点类型**：`index.vue`
   ```js
   import NewNode from './nodes/NewNode.vue'
   const nodeTypes = {
     ...,
     newNode: markRaw(NewNode)
   }
   ```

3. **添加工具栏按钮**：`index.vue` toolbarButtons
   ```js
   { type: 'newNode', label: 'New', icon: '🆕' }
   ```

4. **添加默认数据**：`useNodeActions.js` defaultNodeData
   ```js
   newNode: { label: 'New', ...otherFields }
   ```

## 聚焦高亮系统

当节点内的输入框聚焦时，节点显示蓝色边框：

```css
/* 默认灰色边框 */
border: 2px solid #e8e8e8;

/* 聚焦时蓝色边框 */
border-color: #3b82f6;
box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
```

InputNode 使用 `:focus-within` 实现自动高亮，无需额外 JS 代码。有输入框的节点需向上 emit `node-focus`/`node-blur` 事件，由 VueFlow relay 到 index.vue 统一管理 `focusedNodeId`。

## 粘贴系统（Ctrl+V）

粘贴事件在 `useClipboard.js` 的 `handlePaste` 中处理：

```
document.addEventListener('paste', handlePaste)
```

`handlePaste` 遍历 `clipboardData.items`：
- `item.type.startsWith('image/')` → 调用 `readFileAsBlobUrl` → 创建 ImageNode
- `text/plain` → 读取文本内容 → 创建 TextNode（默认位置：画布中心 400, 250）

如需粘贴到鼠标光标位置，需要传入 `event.clientX/Y` 并转换坐标系。

## 定位方式

- **默认添加**：`getDefaultPosition()` → 屏幕中心区域随机偏移 `{ x: 300~500, y: 200~350 }`
- **拖拽放置**：使用 `event.dataTransfer` 的坐标减去容器 `getBoundingClientRect()`
- **Ctrl+V 粘贴**：固定中心位置 `{ x: 400, y: 250 }`（后续可扩展为光标位置）
- **节点拖拽**：由 Vue Flow 内置处理，emit `onNodeDrag` 可监听

## 依赖

```
@vue-flow/core        # 核心画布引擎
@vue-flow/background  # 背景网格
@vue-flow/controls    # 缩放/重置控件
@vue-flow/minimap    # 小地图导航
```

## 与 Vue Flow 的交互

- `v-model:nodes` / `v-model:edges` 双向绑定节点和边数据
- `onConnect(params)` 处理连线创建
- `fitView()` 在挂载时调用，使画布内容适应视口
- `default-viewport` 设置初始缩放和平移
