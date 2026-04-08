# GOST HTML Migration Design

## 背景

将 `.claude/skills/goat/` 下的 ~113 个博主 HTML demo 迁移到本项目的 Vue 3 组件系统。每个 demo 独立迁移，互不依赖。

## 迁移规范

### 目标结构

每个 demo 转为 Vue 组件，结构如下：

```
src/components/gost/
├── No1_ClickPopText/
│   ├── component.js   # 组件配置
│   └── index.vue       # Vue 组件实现
├── No2_WindowBlind/
│   ├── component.js
│   └── index.vue
└── ...
```

### component.js 规范

```js
export default {
  name: 'No1_ClickPopText',       // 必须与目录名一致
  title: '页面点击文字',           // 中文标题（从原 title 提取）
  description: '点击页面随机弹出文字动画', // 一句话描述
  version: '1.0.0',
  group: 'gost',                  // 固定
  category: 'demos',              // 固定
  tags: ['click', 'text', 'animation'], // 从内容提取关键词
  component: './index.vue'
}
```

### index.vue 规范

- `<template>`：原 HTML `<body>` 内容
- `<style scoped>`：原 `<style>` 内容（去重后）
- `<script setup>`：原 `<script>` 内容，转为 Vue 3 Composition API

### 转换规则

| 原 HTML 部分 | 转换方式 |
|------------|---------|
| `<body>` 内联元素 | → `<template>` 根元素 |
| `<style>` 块 | → `<style scoped>`，去除 `body {}` 包装 |
| `<script>` 内联 JS | → `<script setup>`，ref reactive 化 |
| `document.onclick` | → `@click` 绑定 |
| `document.onmousemove` | → `@mousemove` 绑定 |
| `setTimeout/setInterval` | 保持，清理逻辑放 `onUnmounted` |
| CSS 变量 (`var()`) | 迁移保留 |
| 背景色/文字色 | 保持原样或适度提亮 |

### 命名映射

- 目录名 = `No{序号}_{英文标题首字母大写}` 如 `No8_MouseNavBar`
- title = 原 HTML `<title>` 内容，如 `陳山羊/页面点击文字`
- description = 从标题或内容提炼，如 `点击页面随机弹出文字动画`

## 迁移流程

每条任务处理一个 demo：

1. 读取源 HTML 文件（去目录列表中找到对应 html）
2. 提取 `<style>` 内容 → `index.vue` 的 `<style scoped>`
3. 提取 `<body>` 内容 → `index.vue` 的 `<template>`
4. 提取 `<script>` 内容 → `index.vue` 的 `<script setup>`
5. 创建 `component.js`
6. `pnpm run build` 验证
7. `git add` + `git commit` + `git push`

## 任务记录

全部 113 个 demo 逐条记录在此任务列表中，每条独立 commit。

## 进度追踪

使用 TaskCreate 逐条创建任务，完成后标记 done。

## 关键技术约束

- 不使用任何额外依赖（纯 CSS + Vanilla JS）
- 所有 demo 均为 `fullscreen: true`（默认）
- 不需要 `dependencies` 字段
- 通用样式（body { margin:0; overflow:hidden }）在 Vue 单文件内处理
