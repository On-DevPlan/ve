# Project Index: ve

Generated: 2026-04-07

## 📁 Project Structure

```
ve/
├── src/
│   ├── components/           # Auto-discovered demo components
│   │   ├── Blessing/         # 祝福页 - 浪漫安宁
│   │   ├── RelaxFlow/        # 放松流动 - 蓝色气泡
│   │   ├── HelloWorld/       # Basic demo
│   │   ├── canvas/           # Canvas-based components
│   │   │   ├── KnowledgeGraph/
│   │   │   ├── Whiteboard/
│   │   │   └── WorkflowCanvas/
│   │   ├── huang/            # Custom components (gis, map, report)
│   │   ├── table/            # Table components
│   │   │   ├── BryntumGridTable/
│   │   │   ├── DataTable/
│   │   │   ├── JspreadsheetTable/
│   │   │   ├── NocoDBTable/
│   │   │   └── RevoGridTable/
│   │   └── three/            # Three.js 3D components
│   │       ├── Barrage3D/
│   │       └── CyberTemple/
│   ├── views/
│   │   ├── Home.vue          # Component grid with search/filter
│   │   ├── ComponentView.vue # Fullscreen component display
│   │   └── NotFound.vue      # 404 page
│   ├── router/
│   │   └── index.js          # Dynamic route registration
│   ├── utils/
│   │   └── componentDiscovery.js  # Auto-discovery system
│   ├── App.vue
│   └── main.js
├── .github/workflows/
│   └── deploy.yml            # GitHub Actions deployment
├── package.json
├── vite.config.js
└── CLAUDE.md
```

## 🚀 Entry Points

- Dev: `npm run dev` → http://0.0.0.0:5173
- Build: `npm run build` → generates `dist/`
- Preview: `npm run preview` → http://0.0.0.0:4173

## 📦 Core Modules

### Module: componentDiscovery
- Path: `src/utils/componentDiscovery.js`
- Exports: `ComponentDiscovery` class, `useComponentDiscovery()` composable
- Purpose: Auto-scan `component.js` files and register routes

### Module: router
- Path: `src/router/index.js`
- Exports: `router`, `setupComponentRoutes()`
- Purpose: Dynamic route registration from discovered components

### Module: Home
- Path: `src/views/Home.vue`
- Purpose: Component grid with filtering, search, info modals

### Module: ComponentView
- Path: `src/views/ComponentView.vue`
- Purpose: Fullscreen component display (no navigation chrome)

## 🔧 Configuration

- `vite.config.js`: Vite build configuration
- `.github/workflows/deploy.yml`: Docker build & SSH deploy on push to `deploy` branch

## 📚 Documentation

- `CLAUDE.md`: Project guidance for Claude Code
- `PROJECT_INDEX.md`: This file

## 🧪 Test Coverage

No test files in this project.

## 🔗 Key Dependencies

- **vue**: ^3.5.24 - UI framework
- **vue-router**: ^4.6.4 - Routing
- **vite**: ^7.2.4 - Build tool
- **three**: ^0.182.0 - 3D rendering
- **echarts**: ^6.0.0 - Charts
- **@antv/g6**: ^5.1.0 - Graph visualization
- **cytoscape**: ^3.33.1 - Network graph
- **@tldraw/tldraw**: ^4.5.4 - Whiteboard
- **ag-grid-community**: ^35.1.0 - Data grid
- **@revolist/revogrid**: ^4.20.2 - Virtual grid

## ⚙️ Component Auto-Discovery

Every component must have:
```
src/components/{ComponentName}/
├── component.js    # Required config
└── index.vue       # Required implementation
```

Required `component.js` fields: `name`, `title`, `description`, `version`, `group`, `category`, `tags`, `component`

Routes are auto-registered based on `route.path` or default `/components/{name}`
