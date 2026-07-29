# Vue 3 Demo Showcase

一个基于 Vue 3 + Vite 的组件演示系统，支持组件自动发现和动态路由。

## 特性

- **组件自动发现**：无需手动配置，自动扫描并注册组件
- **动态路由**：根据组件配置自动生成路由
- **全屏展示**：组件以全屏模式展示，无干扰
- **筛选搜索**：支持按分组、类别和关键词筛选
- **灰色主题**：简洁的中性灰色界面

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 预览构建结果

```bash
npm run preview
```

## 添加新组件

在 `src/components/` 下创建新目录，包含两个文件：

```
src/components/YourDemo/
├── component.js    # 组件配置
└── index.vue       # 组件实现
```

### component.js 示例

```javascript
export default {
  name: 'YourDemo',
  title: '您的演示',
  description: '组件描述',
  version: '1.0.0',
  group: 'Demo',
  category: 'Example',
  tags: ['demo', 'example'],
  component: './index.vue',
  route: {
    path: '/yourdemo',
    meta: {
      title: '您的演示',
      icon: '🎨'
    }
  },
  fullscreen: true
}
```

组件会自动被发现并在首页展示。

## 技术栈

- Vue 3 (Composition API)
- Vite
- Vue Router
- Three.js

## 项目结构

```
src/
├── components/           # 组件目录
│   └── ComponentName/
│       ├── component.js  # 组件配置
│       └── index.vue     # 组件实现
├── router/              # 路由配置
├── utils/               # 工具函数
│   ├── componentDiscovery.js  # 组件自动发现
│   └── dynamicImports.js      # 动态导入
├── views/               # 页面视图
│   ├── Home.vue         # 首页（组件列表）
│   └── ComponentView.vue # 组件详情页
└── App.vue              # 根组件
```

详细说明请参阅 [CLAUDE.md](./CLAUDE.md)
