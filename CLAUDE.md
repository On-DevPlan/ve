# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Vue 3 + Vite** demo showcase system with auto-discovering component architecture. The project's purpose is to store and display various demo components, where each component is automatically discovered and routed without manual configuration.

## Development Commands

```bash
pnpm dev      # Start development server (0.0.0.0:5173)
pnpm build    # Build for production
pnpm preview  # Preview production build (0.0.0.0:4173)
```

## Adding New Demo Components

The core of this project is the `component.js` configuration file. To add a new demo:

1. Create a new directory under `src/components/`:
   ```
   src/components/YourComponent/
   ├── component.js    # Component configuration (required)
   └── index.vue       # Component implementation (required)
   ```

2. **Create `component.js`** with the following structure:

```javascript
export default {
  // === Basic Information ===
  name: 'ComponentName',           // Technical identifier (must match directory name)
  title: 'Display Title',          // Human-readable title shown in UI
  description: 'Component description for users',
  version: '1.0.0',                // Semantic version

  // === Grouping & Tags ===
  group: 'GroupName',              // Main category (e.g., 'Three.js', 'Basic')
  category: 'SubCategory',         // Sub-grouping (e.g., '3D Effects', 'Display')
  tags: ['tag1', 'tag2'],          // Search/filter tags

  // === Entry Point ===
  component: './index.vue',        // Path to component file (relative)

  // === Routing (optional) ===
  route: {
    path: '/custom-path',          // Custom route path (defaults to `/components/{name}`)
    meta: {
      title: 'Page Title',         // Page title
      icon: '🎨'                   // Icon emoji for cards
    }
  },

  // === Display Options ===
  fullscreen: true,                // Whether component should fill entire screen

  // === Dependencies (optional) ===
  dependencies: ['three'],         // List external dependencies

  // === Default Props (optional) ===
  defaultProps: {                  // Default props passed to component
    someProp: 'defaultValue'
  }
}
```

3. **Create `index.vue`** with your component implementation using Vue 3 Composition API:
```vue
<script setup>
import { ref } from 'vue'

const props = defineProps({
  // Define your props here
})
</script>

<template>
  <div class="your-component">
    <!-- Your component template -->
  </div>
</template>

<style scoped>
/* Your component styles */
</style>
```

**That's it!** The component will be automatically:
- Discovered on application load
- Added to the home page grid
- Registered with its custom route
- Available for search and filtering

## Architecture Overview

### Component Auto-Discovery
- **`src/utils/componentDiscovery.js`**: Scans `src/components/**/component.js` using Vite's `import.meta.glob()`
- **`src/utils/dynamicImports.js`**: Pre-defined component loaders for build optimization
- **`src/router/index.js`**: Dynamically generates routes from component configurations

### Views
- **`src/views/Home.vue`**: Component grid with filtering, search, and info modals
- **`src/views/ComponentView.vue`**: Fullscreen component display (no UI chrome)

### Key Patterns
- All components default to fullscreen mode
- No navigation chrome in component view - pure component display
- Component info shown via modal on home page cards
- Gray/neutral color theme (#f5f5f5 background, #e8e8e8 accents)

## Component Configuration Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique component identifier |
| `title` | string | Yes | Display name in UI |
| `description` | string | Yes | Component description |
| `version` | string | Yes | Semantic version |
| `group` | string | Yes | Main category |
| `category` | string | Yes | Sub-category |
| `tags` | array | Yes | Search keywords |
| `component` | string | Yes | Path to `.vue` file |
| `route` | object | No | Custom route configuration |
| `fullscreen` | boolean | No | Display mode (default: true) |
| `dependencies` | array | No | External dependencies |
| `defaultProps` | object | No | Default component props |

## Common Issues

- **Component not loading?** Check that `component.js` and `index.vue` exist and are properly formatted
- **Route not working?** Ensure the `name` field matches the directory name
- **Build fails?** Add component to `src/utils/dynamicImports.js` for proper bundling
